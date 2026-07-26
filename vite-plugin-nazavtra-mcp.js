import { homedir } from 'os'
import { join, dirname } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'fs'
import { randomBytes, createCipheriv, createDecipheriv, randomUUID } from 'crypto'
import { execSync } from 'child_process'

const DATA_DIR = join(homedir(), '.nazavtra')
const DATA_FILE = join(DATA_DIR, 'data.json')
const SETTINGS_FILE = join(DATA_DIR, 'settings.json')
const KEY_FILE = join(DATA_DIR, 'key')

const DEFAULT_SETTINGS = { mcpEnabled: true, port: 5174, encryptEnabled: false }
const DEFAULT_DATA = {
  tasks: [],
  projects: [{ id: 'inbox', name: 'Входящие', color: '#6b7280' }],
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#6366f1', '#a855f7', '#ec4899']

const MAX_TITLE_LENGTH = 500
const MAX_DESC_LENGTH = 10_000
const MAX_SUBTASK_TITLE_LENGTH = 200
const MAX_SUBTASKS = 100
const MAX_BODY_SIZE = 512_000
const MAX_PROJECT_NAME_LENGTH = 200

function uid() {
  return randomUUID().slice(0, 8)
}

// ─── AES-256-GCM ───────────────────────────────────────────────

function encrypt(text, key) {
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  let enc = cipher.update(text, 'utf8', 'hex')
  enc += cipher.final('hex')
  return JSON.stringify({ v: 1, iv: iv.toString('hex'), tag: cipher.getAuthTag().toString('hex'), data: enc })
}

function decrypt(encoded, key) {
  const { iv, tag, data } = JSON.parse(encoded)
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'))
  decipher.setAuthTag(Buffer.from(tag, 'hex'))
  let dec = decipher.update(data, 'hex', 'utf8')
  dec += decipher.final('utf8')
  return dec
}

function loadKey() {
  if (process.env.NAZAVTRA_KEY) return Buffer.from(process.env.NAZAVTRA_KEY, 'hex')
  try { return readFileSync(KEY_FILE) } catch { return null }
}

function ensureKey() {
  let key = loadKey()
  if (!key) {
    key = randomBytes(32)
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
    writeFileSync(KEY_FILE, key)
    try { chmodSync(KEY_FILE, 0o600) } catch {}
  }
  return key
}

// ─── Task field migration ──────────────────────────────────────

function ensureTaskFields(task) {
  if (!Array.isArray(task.parentIds)) task.parentIds = []
  if (!('graphPos' in task)) task.graphPos = null
  if (!('onGraph' in task)) task.onGraph = false
  if (!('completedCount' in task)) task.completedCount = 0
  if (!task.updatedAt) task.updatedAt = task.createdAt || new Date().toISOString()
  return task
}

// ─── Graph cycle detection ─────────────────────────────────────
// Returns true if adding parentId as a parent of taskId would create a cycle.
// Traverses downward (parent→child via parentIds reverse index) from taskId
// to check if parentId is already a descendant.
function wouldCreateCycle(taskId, parentId, tasks) {
  const visited = new Set()
  const stack = [taskId]
  while (stack.length) {
    const cur = stack.pop()
    if (cur === parentId) return true
    if (visited.has(cur)) continue
    visited.add(cur)
    for (const t of tasks) {
      if (t.parentIds?.includes(cur)) stack.push(t.id)
    }
  }
  return false
}

// ─── Storage ────────────────────────────────────────────────────

function loadData() {
  try {
    if (existsSync(DATA_FILE)) {
      const raw = readFileSync(DATA_FILE, 'utf-8')
      const s = loadSettings()
      let parsed
      if (s.encryptEnabled) {
        try { parsed = JSON.parse(decrypt(raw, ensureKey())) } catch { parsed = JSON.parse(raw) }
      } else {
        parsed = JSON.parse(raw)
      }
      if (Array.isArray(parsed.tasks)) {
        parsed.tasks = parsed.tasks.map(ensureTaskFields)
      }
      return parsed
    }
  } catch {}
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  const data = JSON.parse(JSON.stringify(DEFAULT_DATA))
  saveData(data)
  return data
}

function saveData(data) {
  const s = loadSettings()
  let output = JSON.stringify(data, null, 2)
  if (s.encryptEnabled) {
    output = encrypt(output, ensureKey())
  }
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(DATA_FILE, output, 'utf-8')
}

// ─── Settings ───────────────────────────────────────────────────

function loadSettings() {
  try {
    if (existsSync(SETTINGS_FILE)) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(readFileSync(SETTINGS_FILE, 'utf-8')) }
    }
  } catch {}
  return { ...DEFAULT_SETTINGS }
}

function saveSettings(settings) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8')
}

function isDataFileEncrypted() {
  try {
    if (existsSync(DATA_FILE)) {
      const firstBytes = readFileSync(DATA_FILE, 'utf-8').trimStart().slice(0, 20)
      return firstBytes.startsWith('{"v":') || firstBytes.startsWith('{"iv":')
    }
  } catch {}
  return false
}

// ─── Input validation ──────────────────────────────────────────

function valString(v, maxLen, label) {
  if (v == null) return null
  if (typeof v !== 'string') return `${label} должен быть строкой`
  if (v.length > maxLen) return `${label} максимум ${maxLen} символов`
  return null
}

function valPriority(v) {
  if (v == null) return null
  if (![0, 1, 2].includes(v)) return 'priority должен быть 0 (низкий), 1 (средний) или 2 (высокий)'
  return null
}

function valDueDate(v) {
  if (v == null) return null
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'dueDate должен быть в формате YYYY-MM-DD'
  return null
}

function valRecurring(v) {
  if (v == null) return null
  if (typeof v !== 'object') return 'recurring должен быть объектом'
  const types = ['daily', 'weekdays', 'weekly', 'interval', 'monthly']
  if (!types.includes(v.type)) return `recurring.type должен быть одним из: ${types.join(', ')}`
  if (v.interval != null && (typeof v.interval !== 'number' || v.interval < 1)) return 'recurring.interval должен быть числом >= 1'
  if (v.weekdays != null) {
    if (!Array.isArray(v.weekdays)) return 'recurring.weekdays должен быть массивом'
    if (v.weekdays.some(d => typeof d !== 'number' || d < 0 || d > 6)) return 'recurring.weekdays: дни 0-6 (0=Вс)'
  }
  if (v.time != null && (typeof v.time !== 'string' || !/^\d{2}:\d{2}$/.test(v.time))) return 'recurring.time в формате HH:MM'
  if (v.duration != null && (typeof v.duration !== 'number' || v.duration < 1)) return 'recurring.duration минуты >= 1'
  return null
}

function valParentIds(v, tasks) {
  if (v == null) return null
  if (!Array.isArray(v)) return 'parentIds должен быть массивом строк'
  for (const pid of v) {
    if (typeof pid !== 'string') return 'parentIds: каждый элемент должен быть строкой'
    if (!tasks.find(t => t.id === pid)) return `parentIds: задача с id "${pid}" не найдена`
  }
  return null
}

function getNextDueDate(task) {
  if (!task.recurring || !task.dueDate) return null
  const d = new Date(task.dueDate + 'T00:00:00Z')
  const r = task.recurring
  if (r.type === 'daily') {
    d.setUTCDate(d.getUTCDate() + 1)
  } else if (r.type === 'interval') {
    d.setUTCDate(d.getUTCDate() + (r.interval || 1))
  } else if (r.type === 'weekdays') {
    const days = r.weekdays?.length ? r.weekdays : [1, 2, 3, 4, 5]
    for (let i = 1; i <= 7; i++) {
      const next = new Date(d)
      next.setUTCDate(d.getUTCDate() + i)
      if (days.includes(next.getUTCDay())) return next.toISOString().slice(0, 10)
    }
  } else if (r.type === 'weekly') {
    d.setUTCDate(d.getUTCDate() + 7 * (r.interval || 1))
  } else if (r.type === 'monthly') {
    const day = d.getUTCDate()
    d.setUTCMonth(d.getUTCMonth() + 1)
    d.setUTCDate(Math.min(day, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()))
  }
  return d.toISOString().slice(0, 10)
}

// ─── Origin guard ──────────────────────────────────────────────

function checkOrigin(req, res, server) {
  const origin = req.headers.origin || ''
  if (!origin) return true

  let port = 5174
  try {
    const addr = server.httpServer?.address()
    if (addr && typeof addr === 'object') port = addr.port
  } catch {}

  const allowed = [
    `http://localhost:${port}`,
    `http://127.0.0.1:${port}`,
  ]

  if (allowed.includes(origin)) return true

  res.writeHead(403, { 'Content-Type': 'text/plain' })
  res.end('Forbidden')
  return false
}

// ─── Tool registry ────────────────────────────────────────────

const tools = [
  {
    name: 'nazavtra_list_projects',
    description: 'Список всех проектов',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const { projects } = loadData()
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, data: projects }) }] }
    },
  },
  {
    name: 'nazavtra_list_tasks',
    description: 'Список задач с возможностью фильтрации по проекту, статусу, поиску и признаку карты целей',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID проекта для фильтрации' },
        status: { type: 'string', enum: ['all', 'active', 'completed', 'overdue', 'recurring'], description: 'Статус: all, active, completed, overdue, recurring' },
        search: { type: 'string', description: 'Поиск по тексту задачи и описанию' },
        onGraph: { type: 'boolean', description: 'true — только задачи на карте целей, false — только вне карты' },
      },
    },
    handler: async ({ projectId, status, search, onGraph }) => {
      const { tasks } = loadData()
      let filtered = [...tasks]
      if (projectId) filtered = filtered.filter(t => t.projectId === projectId)
      if (status === 'active') filtered = filtered.filter(t => !t.completed)
      if (status === 'completed') filtered = filtered.filter(t => t.completed)
      if (status === 'recurring') filtered = filtered.filter(t => t.recurring)
      if (status === 'overdue') filtered = filtered.filter(t => {
        if (t.completed || !t.dueDate) return false
        return new Date(t.dueDate) < new Date(new Date().toDateString())
      })
      if (search) {
        const q = search.toLowerCase()
        filtered = filtered.filter(t =>
          (t.title || '').toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q)
        )
      }
      if (onGraph != null) {
        filtered = filtered.filter(t => !!t.onGraph === onGraph)
      }
      filtered.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, data: filtered, total: filtered.length }) }] }
    },
  },
  {
    name: 'nazavtra_get_task',
    description: 'Детальная информация о задаче по ID, включая связи на карте целей',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'ID задачи' } },
      required: ['id'],
    },
    handler: async ({ id }) => {
      const { tasks, projects } = loadData()
      const task = tasks.find(t => t.id === id)
      if (!task) return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Задача не найдена' }) }] }
      const project = projects.find(p => p.id === task.projectId)
      const parentTasks = (task.parentIds || [])
        .map(pid => tasks.find(t => t.id === pid))
        .filter(Boolean)
        .map(t => ({ id: t.id, title: t.title }))
      const children = tasks
        .filter(t => t.parentIds?.includes(id))
        .map(t => ({ id: t.id, title: t.title }))
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: { ...task, projectName: project?.name || null, parentTasks, children },
          }),
        }],
      }
    },
  },
  {
    name: 'nazavtra_create_task',
    description: 'Создать новую задачу',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Название задачи' },
        priority: { type: 'number', enum: [0, 1, 2], description: 'Приоритет: 0=низкий, 1=средний, 2=высокий (по умолчанию 1)' },
        dueDate: { type: 'string', description: 'Дата в формате YYYY-MM-DD' },
        projectId: { type: 'string', description: 'ID проекта (по умолчанию inbox)' },
        description: { type: 'string', description: 'Описание в Markdown' },
        subtasks: { type: 'array', items: { type: 'string' }, description: 'Названия подзадач' },
        recurring: {
          type: 'object',
          description: 'Правило повтора',
          properties: {
            type: { type: 'string', enum: ['daily', 'weekdays', 'weekly', 'interval', 'monthly'] },
            interval: { type: 'number', description: 'Каждые N дней/недель' },
            weekdays: { type: 'array', items: { type: 'number' }, description: 'Дни недели 0-6 (0=Вс)' },
            time: { type: 'string', description: 'Время HH:MM' },
            duration: { type: 'number', description: 'Длительность в минутах' },
          },
          required: ['type'],
        },
        parentIds: { type: 'array', items: { type: 'string' }, description: 'ID родительских задач на карте целей' },
        onGraph: { type: 'boolean', description: 'Показывать задачу на карте целей' },
      },
      required: ['title'],
    },
    handler: async ({ title, priority, dueDate, projectId, description, subtasks, recurring, parentIds, onGraph }) => {
      const data = loadData()
      const err =
        valString(title, MAX_TITLE_LENGTH, 'title') ||
        valPriority(priority) ||
        valDueDate(dueDate) ||
        valString(description, MAX_DESC_LENGTH, 'description') ||
        valRecurring(recurring) ||
        valParentIds(parentIds, data.tasks)
      if (err) return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: err }) }] }
      if (!title) return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Название задачи обязательно' }) }] }
      if (recurring && !dueDate) return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Повторяющаяся задача требует dueDate' }) }] }
      const subArr = (subtasks ?? []).slice(0, MAX_SUBTASKS)
      for (const s of subArr) {
        const e = valString(s, MAX_SUBTASK_TITLE_LENGTH, 'subtask')
        if (e) return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: e }) }] }
      }
      const now = new Date().toISOString()
      const resolvedParentIds = parentIds ?? []
      const resolvedOnGraph = onGraph ?? (resolvedParentIds.length > 0 ? true : false)
      const task = {
        id: uid(),
        title,
        completed: false,
        completedCount: 0,
        priority: priority ?? 1,
        dueDate: dueDate ?? null,
        projectId: projectId ?? 'inbox',
        description: description ?? null,
        subtasks: subArr.map(s => ({ id: uid(), title: s, completed: false })),
        recurring: recurring ?? null,
        parentIds: resolvedParentIds,
        onGraph: resolvedOnGraph,
        graphPos: null,
        createdAt: now,
        updatedAt: now,
        order: data.tasks.length,
      }
      data.tasks.push(task)
      saveData(data)
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Задача создана', data: task }) }] }
    },
  },
  {
    name: 'nazavtra_update_task',
    description: 'Обновить поля задачи по ID. Передавать только изменяемые поля.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID задачи' },
        title: { type: 'string', description: 'Новое название' },
        priority: { type: 'number', enum: [0, 1, 2], description: 'Приоритет: 0=низкий, 1=средний, 2=высокий' },
        dueDate: { type: 'string', description: 'Дата YYYY-MM-DD или null чтобы убрать' },
        projectId: { type: 'string', description: 'ID проекта' },
        description: { type: 'string', description: 'Описание или null' },
        completed: { type: 'boolean', description: 'Статус выполнения' },
        recurring: {
          type: 'object',
          description: 'Правило повтора или null чтобы убрать',
          properties: {
            type: { type: 'string', enum: ['daily', 'weekdays', 'weekly', 'interval', 'monthly'] },
            interval: { type: 'number' },
            weekdays: { type: 'array', items: { type: 'number' } },
            time: { type: 'string' },
            duration: { type: 'number' },
          },
        },
        onGraph: { type: 'boolean', description: 'Показывать задачу на карте целей' },
        graphPos: {
          description: 'Позиция узла на карте целей или null чтобы сбросить',
          oneOf: [
            { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } }, required: ['x', 'y'] },
            { type: 'null' },
          ],
        },
      },
      required: ['id'],
    },
    handler: async ({ id, ...updates }) => {
      const err =
        valString(updates.title, MAX_TITLE_LENGTH, 'title') ||
        valPriority(updates.priority) ||
        valDueDate(updates.dueDate) ||
        valString(updates.description, MAX_DESC_LENGTH, 'description') ||
        valRecurring(updates.recurring)
      if (err) return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: err }) }] }
      const data = loadData()
      const task = data.tasks.find(t => t.id === id)
      if (!task) return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Задача не найдена' }) }] }
      for (const [key, val] of Object.entries(updates)) {
        if (val !== undefined) task[key] = val
      }
      task.updatedAt = new Date().toISOString()
      saveData(data)
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Задача обновлена', data: task }) }] }
    },
  },
  {
    name: 'nazavtra_delete_task',
    description: 'Удалить задачу по ID. Автоматически удаляет ссылки на неё из parentIds других задач.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'ID задачи' } },
      required: ['id'],
    },
    handler: async ({ id }) => {
      const data = loadData()
      const idx = data.tasks.findIndex(t => t.id === id)
      if (idx === -1) return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Задача не найдена' }) }] }
      const title = data.tasks[idx].title
      data.tasks.splice(idx, 1)
      // Clean up parentIds references in remaining tasks
      for (const t of data.tasks) {
        if (t.parentIds?.includes(id)) {
          t.parentIds = t.parentIds.filter(pid => pid !== id)
        }
      }
      saveData(data)
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Задача удалена', title }) }] }
    },
  },
  {
    name: 'nazavtra_toggle_task',
    description: 'Переключить выполнение задачи. Для повторяющихся — перепланирует на следующую дату.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'ID задачи' } },
      required: ['id'],
    },
    handler: async ({ id }) => {
      const data = loadData()
      const task = data.tasks.find(t => t.id === id)
      if (!task) return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Задача не найдена' }) }] }

      if (task.recurring && !task.completed) {
        const nextDate = getNextDueDate(task)
        if (nextDate) {
          task.dueDate = nextDate
          task.completedCount = (task.completedCount || 0) + 1
          task.subtasks = (task.subtasks ?? []).map(s => ({ ...s, completed: false }))
        } else {
          task.completed = !task.completed
        }
      } else {
        task.completed = !task.completed
      }

      task.updatedAt = new Date().toISOString()
      saveData(data)
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, data: task }) }] }
    },
  },
  {
    name: 'nazavtra_create_project',
    description: 'Создать новый проект для группировки задач',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Название проекта' } },
      required: ['name'],
    },
    handler: async ({ name }) => {
      const err = valString(name, MAX_PROJECT_NAME_LENGTH, 'name')
      if (err) return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: err }) }] }
      if (!name) return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Название проекта обязательно' }) }] }
      const data = loadData()
      const id = uid()
      const color = COLORS[data.projects.length % COLORS.length]
      data.projects.push({ id, name, color })
      saveData(data)
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Проект создан', data: { id, name, color } }) }] }
    },
  },
  {
    name: 'nazavtra_delete_project',
    description: 'Удалить проект и все его задачи. Нельзя удалить "Входящие".',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'ID проекта' } },
      required: ['id'],
    },
    handler: async ({ id }) => {
      const data = loadData()
      if (id === 'inbox') return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Нельзя удалить проект "Входящие"' }) }] }
      const project = data.projects.find(p => p.id === id)
      if (!project) return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Проект не найден' }) }] }
      const deletedIds = new Set(data.tasks.filter(t => t.projectId === id).map(t => t.id))
      data.projects = data.projects.filter(p => p.id !== id)
      data.tasks = data.tasks.filter(t => t.projectId !== id)
      // Clean up parentIds references to deleted tasks
      for (const t of data.tasks) {
        if (t.parentIds?.some(pid => deletedIds.has(pid))) {
          t.parentIds = t.parentIds.filter(pid => !deletedIds.has(pid))
        }
      }
      saveData(data)
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Проект удалён', name: project.name }) }] }
    },
  },
  {
    name: 'nazavtra_get_stats',
    description: 'Статистика по задачам: общее количество, активные, выполненные, просроченные',
    inputSchema: { type: 'object', properties: {} },
    handler: async () => {
      const { tasks } = loadData()
      const total = tasks.length
      const completed = tasks.filter(t => t.completed).length
      const active = total - completed
      const overdue = tasks.filter(t => {
        if (t.completed || !t.dueDate) return false
        return new Date(t.dueDate) < new Date(new Date().toDateString())
      }).length
      const onGraph = tasks.filter(t => t.onGraph || t.parentIds?.length > 0).length
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, data: { total, active, completed, overdue, onGraph } }) }] }
    },
  },
  {
    name: 'nazavtra_add_parent_link',
    description: 'Добавить связь «родитель → потомок» на карте целей. Проверяет отсутствие циклов.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'ID дочерней задачи' },
        parentId: { type: 'string', description: 'ID родительской задачи' },
      },
      required: ['taskId', 'parentId'],
    },
    handler: async ({ taskId, parentId }) => {
      if (taskId === parentId) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Задача не может быть родителем самой себя' }) }] }
      }
      const data = loadData()
      const task = data.tasks.find(t => t.id === taskId)
      if (!task) return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: `Задача "${taskId}" не найдена` }) }] }
      const parent = data.tasks.find(t => t.id === parentId)
      if (!parent) return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: `Родительская задача "${parentId}" не найдена` }) }] }
      if (task.parentIds?.includes(parentId)) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Связь уже существует' }) }] }
      }
      if (wouldCreateCycle(taskId, parentId, data.tasks)) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Нельзя создать связь: образуется цикл' }) }] }
      }
      task.parentIds = [...(task.parentIds || []), parentId]
      task.onGraph = true
      parent.onGraph = true
      task.updatedAt = new Date().toISOString()
      saveData(data)
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ success: true, message: `Связь добавлена: «${parent.title}» → «${task.title}»` }),
        }],
      }
    },
  },
  {
    name: 'nazavtra_remove_parent_link',
    description: 'Удалить связь «родитель → потомок» на карте целей.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'ID дочерней задачи' },
        parentId: { type: 'string', description: 'ID родительской задачи' },
      },
      required: ['taskId', 'parentId'],
    },
    handler: async ({ taskId, parentId }) => {
      const data = loadData()
      const task = data.tasks.find(t => t.id === taskId)
      if (!task) return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: `Задача "${taskId}" не найдена` }) }] }
      const parent = data.tasks.find(t => t.id === parentId)
      if (!parent) return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: `Родительская задача "${parentId}" не найдена` }) }] }
      if (!task.parentIds?.includes(parentId)) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Связь не существует' }) }] }
      }
      task.parentIds = task.parentIds.filter(pid => pid !== parentId)
      task.updatedAt = new Date().toISOString()
      saveData(data)
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ success: true, message: `Связь удалена: «${parent.title}» → «${task.title}»` }),
        }],
      }
    },
  },
  {
    name: 'nazavtra_get_graph',
    description: 'Получить карту целей: задачи на графе и рёбра между ними',
    inputSchema: {
      type: 'object',
      properties: {
        hideCompleted: { type: 'boolean', description: 'Скрыть выполненные задачи (по умолчанию false)' },
      },
    },
    handler: async ({ hideCompleted = false }) => {
      const { tasks, projects } = loadData()
      // A task is on the graph if it has onGraph=true, or has parentIds, or is referenced as a parent
      const referencedAsParent = new Set(tasks.flatMap(t => t.parentIds || []))
      const graphTasks = tasks.filter(t =>
        t.onGraph || (t.parentIds?.length > 0) || referencedAsParent.has(t.id)
      )
      const visibleTasks = hideCompleted ? graphTasks.filter(t => !t.completed) : graphTasks
      const visibleIds = new Set(visibleTasks.map(t => t.id))

      const projectMap = Object.fromEntries(projects.map(p => [p.id, p.name]))

      const taskData = visibleTasks.map(t => ({
        id: t.id,
        title: t.title,
        completed: t.completed,
        priority: t.priority ?? 1,
        projectId: t.projectId ?? null,
        projectName: projectMap[t.projectId] ?? null,
        graphPos: t.graphPos ?? null,
        parentIds: (t.parentIds || []).filter(pid => visibleIds.has(pid)),
        onGraph: t.onGraph ?? false,
      }))

      const edges = []
      for (const t of visibleTasks) {
        for (const pid of t.parentIds || []) {
          if (visibleIds.has(pid)) {
            edges.push({ source: pid, target: t.id })
          }
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ success: true, data: { tasks: taskData, edges, total: taskData.length } }),
        }],
      }
    },
  },
]

// ─── MCP JSON-RPC handler ─────────────────────────────────────

function rpcError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } }
}

function rpcResult(id, result) {
  return { jsonrpc: '2.0', id, result }
}

async function handleMCP(body) {
  const { jsonrpc, id, method, params } = body || {}

  if (jsonrpc !== '2.0') {
    return rpcError(null, -32600, 'Invalid Request: jsonrpc must be 2.0')
  }

  if (method === 'initialize') {
    return rpcResult(id, {
      protocolVersion: '2025-03-26',
      capabilities: { tools: {} },
      serverInfo: { name: 'НаЗавтра', version: '1.0.0' },
    })
  }

  if (method === 'notifications/initialized') {
    return null
  }

  if (method === 'tools/list') {
    return rpcResult(id, {
      tools: tools.map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    })
  }

  if (method === 'tools/call') {
    const settings = loadSettings()
    if (!settings.mcpEnabled) {
      return rpcError(id, -32000, 'MCP server disabled')
    }
    const tool = tools.find(t => t.name === params?.name)
    if (!tool) {
      return rpcError(id, -32601, `Tool not found: ${params?.name}`)
    }
    const args = params?.arguments || {}
    try {
      return rpcResult(id, await tool.handler(args))
    } catch (err) {
      return rpcError(id, -32000, err.message || 'Tool execution failed')
    }
  }

  return rpcError(id, -32601, `Method not found: ${method}`)
}

// ─── Vite plugin ─────────────────────────────────────────────

export default function nazavtraMCP() {
  return {
    name: 'vite-plugin-nazavtra-mcp',

    configureServer(server) {
      // ── /mcp ──────────────────────────────────────────────
      server.middlewares.use('/mcp', async (req, res, next) => {
        if (req.method !== 'POST') return next()
        if (!checkOrigin(req, res, server)) return

        const len = parseInt(req.headers['content-length'] || '0')
        if (len > MAX_BODY_SIZE) {
          res.writeHead(413, { 'Content-Type': 'text/plain' })
          res.end('Payload too large')
          return
        }

        let body = ''
        req.on('data', chunk => body += chunk)
        req.on('end', async () => {
          try {
            const result = await handleMCP(JSON.parse(body))
            if (!result) {
              res.writeHead(202, { 'Content-Type': 'application/json; charset=utf-8' })
              res.end('{}')
              return
            }
            const json = JSON.stringify(result)
            res.writeHead(200, {
              'Content-Type': 'application/json; charset=utf-8',
              'Content-Length': Buffer.byteLength(json),
            })
            res.end(json)
          } catch (err) {
            const json = JSON.stringify(rpcError(null, -32700, `Parse error: ${err.message}`))
            res.writeHead(400, {
              'Content-Type': 'application/json; charset=utf-8',
              'Content-Length': Buffer.byteLength(json),
            })
            res.end(json)
          }
        })
      })

      // ── /api/data ────────────────────────────────────────────
      server.middlewares.use('/api/data', async (req, res, next) => {
        if (!checkOrigin(req, res, server)) return

        if (req.method === 'GET') {
          const data = loadData()
          const json = JSON.stringify(data)
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Length': Buffer.byteLength(json),
          })
          res.end(json)
          return
        }

        if (req.method === 'POST') {
          let body = ''
          req.on('data', chunk => body += chunk)
          req.on('end', () => {
            try {
              const data = JSON.parse(body)
              if (data.tasks && Array.isArray(data.tasks)) {
                for (const t of data.tasks) {
                  if (t.title && t.title.length > MAX_TITLE_LENGTH) {
                    res.statusCode = 400
                    res.end('Title too long')
                    return
                  }
                  if (t.description && t.description.length > MAX_DESC_LENGTH) {
                    res.statusCode = 400
                    res.end('Description too long')
                    return
                  }
                }
              }
              saveData(data)
              const json = JSON.stringify({ ok: true })
              res.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Length': Buffer.byteLength(json),
              })
              res.end(json)
            } catch {
              res.statusCode = 400
              res.end('Invalid JSON')
            }
          })
          return
        }

        next()
      })

      // ── /api/settings ─────────────────────────────────────────
      server.middlewares.use('/api/settings', async (req, res, next) => {
        if (!checkOrigin(req, res, server)) return

        if (req.method === 'GET') {
          const settings = loadSettings()
          const response = { ...settings, encryptedOnDisk: isDataFileEncrypted() }
          const json = JSON.stringify(response)
          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Length': Buffer.byteLength(json),
          })
          res.end(json)
          return
        }

        if (req.method === 'POST') {
          let body = ''
          req.on('data', chunk => body += chunk)
          req.on('end', () => {
            try {
              const data = JSON.parse(body)
              saveSettings(data)
              const json = JSON.stringify({ ok: true })
              res.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Length': Buffer.byteLength(json),
              })
              res.end(json)
            } catch {
              res.statusCode = 400
              res.end('Invalid JSON')
            }
          })
          return
        }

        next()
      })

      // ── /api/version ─────────────────────────────────────────
      server.middlewares.use('/api/version', (req, res, next) => {
        if (req.method !== 'GET') return next()

        let sha = 'unknown'
        try {
          sha = execSync('git log --oneline -1', { encoding: 'utf-8' }).split(' ')[0]
        } catch {}

        const json = JSON.stringify({ sha })
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': Buffer.byteLength(json),
        })
        res.end(json)
      })
    },
  }
}
