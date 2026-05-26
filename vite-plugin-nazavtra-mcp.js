import { homedir } from 'os'
import { join, dirname } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'

const DATA_FILE = join(homedir(), '.nazavtra', 'data.json')

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#6366f1', '#a855f7', '#ec4899']

const DEFAULT_DATA = {
  tasks: [],
  projects: [{ id: 'inbox', name: 'Входящие', color: '#6b7280' }],
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function loadData() {
  try {
    if (existsSync(DATA_FILE)) {
      return JSON.parse(readFileSync(DATA_FILE, 'utf-8'))
    }
  } catch {}
  const dir = dirname(DATA_FILE)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const data = JSON.parse(JSON.stringify(DEFAULT_DATA))
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
  return data
}

function saveData(data) {
  const dir = dirname(DATA_FILE)
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8')
}

// ─── Tool registry ───────────────────────────────────────────

const tools = [
  {
    name: 'nazavtra_list_projects',
    description: 'Список всех проектов',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      const { projects } = loadData()
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, data: projects }) }] }
    },
  },
  {
    name: 'nazavtra_list_tasks',
    description: 'Список задач с возможностью фильтрации по проекту, статусу и поиску',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'ID проекта для фильтрации' },
        status: { type: 'string', enum: ['all', 'active', 'completed', 'overdue'], description: 'Статус: all, active, completed, overdue' },
        search: { type: 'string', description: 'Поиск по тексту задачи и описанию' },
      },
    },
    handler: async ({ projectId, status, search }) => {
      const { tasks } = loadData()
      let filtered = [...tasks]
      if (projectId) filtered = filtered.filter(t => t.projectId === projectId)
      if (status === 'active') filtered = filtered.filter(t => !t.completed)
      if (status === 'completed') filtered = filtered.filter(t => t.completed)
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
      filtered.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, data: filtered, total: filtered.length }) }] }
    },
  },
  {
    name: 'nazavtra_get_task',
    description: 'Детальная информация о задаче по ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID задачи' },
      },
      required: ['id'],
    },
    handler: async ({ id }) => {
      const { tasks, projects } = loadData()
      const task = tasks.find(t => t.id === id)
      if (!task) return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Задача не найдена' }) }] }
      const project = projects.find(p => p.id === task.projectId)
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, data: { ...task, projectName: project?.name || null } }) }] }
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
      },
      required: ['title'],
    },
    handler: async ({ title, priority, dueDate, projectId, description, subtasks }) => {
      if (!title) return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Название задачи обязательно' }) }] }
      const data = loadData()
      const task = {
        id: uid(),
        title,
        completed: false,
        priority: priority ?? 1,
        dueDate: dueDate ?? null,
        projectId: projectId ?? 'inbox',
        description: description ?? null,
        subtasks: (subtasks ?? []).map(s => ({ id: uid(), title: s, completed: false })),
        createdAt: new Date().toISOString(),
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
      },
      required: ['id'],
    },
    handler: async ({ id, ...updates }) => {
      const data = loadData()
      const task = data.tasks.find(t => t.id === id)
      if (!task) return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Задача не найдена' }) }] }
      for (const [key, val] of Object.entries(updates)) {
        if (val !== undefined) task[key] = val
      }
      saveData(data)
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Задача обновлена', data: task }) }] }
    },
  },
  {
    name: 'nazavtra_delete_task',
    description: 'Удалить задачу по ID',
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
      saveData(data)
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Задача удалена', title }) }] }
    },
  },
  {
    name: 'nazavtra_toggle_task',
    description: 'Переключить выполнение задачи (выполнена/не выполнена)',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'ID задачи' } },
      required: ['id'],
    },
    handler: async ({ id }) => {
      const data = loadData()
      const task = data.tasks.find(t => t.id === id)
      if (!task) return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Задача не найдена' }) }] }
      task.completed = !task.completed
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
      data.projects = data.projects.filter(p => p.id !== id)
      data.tasks = data.tasks.filter(t => t.projectId !== id)
      saveData(data)
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Проект удалён', name: project.name }) }] }
    },
  },
  {
    name: 'nazavtra_get_stats',
    description: 'Статистика по задачам: общее количество, активные, выполненные, просроченные',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    handler: async () => {
      const { tasks } = loadData()
      const total = tasks.length
      const completed = tasks.filter(t => t.completed).length
      const active = total - completed
      const overdue = tasks.filter(t => {
        if (t.completed || !t.dueDate) return false
        return new Date(t.dueDate) < new Date(new Date().toDateString())
      }).length
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, data: { total, active, completed, overdue } }) }] }
    },
  },
]

// ─── MCP JSON-RPC handler ────────────────────────────────────

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
      capabilities: {
        tools: {},
      },
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
      server.middlewares.use('/mcp', async (req, res, next) => {
        if (req.method !== 'POST') return next()

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

      server.middlewares.use('/api/data', async (req, res, next) => {
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
    },
  }
}
