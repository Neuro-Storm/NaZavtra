import { defineStore } from 'pinia'
import { ref, computed, onScopeDispose } from 'vue'
import { uid, now, getNextDueDate, localDateStr, hasPath } from '../utils.js'

const STORAGE_KEY = 'todo-app-data'

function ensureUpdatedAt(item) {
  if (!item.updatedAt) item.updatedAt = now()
  // Graph fields migration
  if (!Array.isArray(item.parentIds)) item.parentIds = []
  if (!('graphPos' in item)) item.graphPos = null
  if (!('onGraph' in item)) item.onGraph = false
  return item
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveLocal(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

async function fetchData() {
  try {
    const res = await fetch('/api/data')
    if (res.ok) return await res.json()
  } catch {}
  return null
}

function postData(data) {
  fetch('/api/data', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).catch(() => {})
}

const DEFAULT_PROJECTS = [{ id: 'inbox', name: 'Входящие', color: '#6b7280', updatedAt: new Date(0).toISOString() }]

export const useTasksStore = defineStore('tasks', () => {
  const local = loadLocal()

  const tasks = ref((local?.tasks ?? []).map(ensureUpdatedAt))
  const projects = ref((local?.projects ?? [...DEFAULT_PROJECTS]).map(ensureUpdatedAt))
  const activeProjectId = ref(local?.activeProjectId ?? null)
  const searchQuery = ref('')
  const filterStatus = ref('all')
  const activeTaskId = ref(null)
  const sortBy = ref(local?.sortBy ?? 'manual')
  const draggingTaskId = ref(null)

  function storageHandler(e) {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const data = JSON.parse(e.newValue)
        if (data.tasks) tasks.value = data.tasks.map(ensureUpdatedAt)
        if (data.projects) projects.value = data.projects.map(ensureUpdatedAt)
        if (data.activeProjectId) activeProjectId.value = data.activeProjectId
      } catch {}
    }
  }
  window.addEventListener('storage', storageHandler)
  onScopeDispose(() => window.removeEventListener('storage', storageHandler))

  if (import.meta.env.DEV) {
    fetchData().then(data => {
      if (data) {
        tasks.value = (data.tasks ?? []).map(ensureUpdatedAt)
        projects.value = (data.projects ?? [...DEFAULT_PROJECTS]).map(ensureUpdatedAt)
        activeProjectId.value = data.activeProjectId ?? null
        console.info('[dev] state loaded from /api/data')
      }
    })
  }

  function persist() {
    const data = {
      tasks: tasks.value,
      projects: projects.value,
      activeProjectId: activeProjectId.value,
      sortBy: sortBy.value,
    }
    saveLocal(data)
    if (import.meta.env.DEV) postData(data)
  }

  const agenda = computed(() => {
    const todayStr = localDateStr(new Date())
    const items = tasks.value.filter(t => !t.completed && t.dueDate && t.dueDate.slice(0, 10) <= todayStr)
    const overdue = items.filter(t => t.dueDate.slice(0, 10) < todayStr)
    const today = items.filter(t => t.dueDate.slice(0, 10) === todayStr)
    const timed = today.filter(t => t.recurring?.time).sort((a, b) => a.recurring.time.localeCompare(b.recurring.time))
    const untimed = today.filter(t => !t.recurring?.time)
    return { overdue, timed, untimed }
  })

  const filteredTasks = computed(() => {
    let list = tasks.value

    if (activeProjectId.value === 'recurring') {
      list = list.filter(t => t.recurring && !t.completed)
      return [...list].sort((a, b) => {
        const timeA = a.recurring?.time || '99:99'
        const timeB = b.recurring?.time || '99:99'
        if (timeA !== timeB) return timeA.localeCompare(timeB)
        return (a.order ?? 0) - (b.order ?? 0)
      })
    }

    if (activeProjectId.value === 'today') {
      const a = agenda.value
      return [...a.overdue, ...a.timed, ...a.untimed]
    }

    if (activeProjectId.value) {
      list = list.filter(t => t.projectId === activeProjectId.value)
    }

    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase()
      list = list.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q)
      )
    }

    if (filterStatus.value === 'active') {
      list = list.filter(t => !t.completed)
    } else if (filterStatus.value === 'completed') {
      list = list.filter(t => t.completed)
    }

    return [...list].sort((a, b) => {
      switch (sortBy.value) {
        case 'due':
          if (!a.dueDate && !b.dueDate) return 0
          if (!a.dueDate) return 1
          if (!b.dueDate) return -1
          return a.dueDate.localeCompare(b.dueDate)
        case 'priority':
          return (b.priority ?? 1) - (a.priority ?? 1)
        case 'name':
          return a.title.localeCompare(b.title, 'ru')
        case 'created':
          return (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
        default: // 'manual'
          return (a.order ?? 0) - (b.order ?? 0)
      }
    })
  })

  const recurringTasks = computed(() =>
    tasks.value.filter(t => t.recurring && !t.completed)
  )

  const taskCountByProject = computed(() => {
    const m = {}
    for (const t of tasks.value) {
      if (t.projectId) m[t.projectId] = (m[t.projectId] ?? 0) + 1
    }
    return m
  })

  const activeProject = computed(() => {
    if (activeProjectId.value === 'recurring') {
      return { id: 'recurring', name: 'Повторяющиеся', color: '#8b5cf6' }
    }
    if (activeProjectId.value === 'today') {
      return { id: 'today', name: 'Сегодня' }
    }
    if (activeProjectId.value === 'graph') {
      return { id: 'graph', name: 'Карта целей' }
    }
    return projects.value.find(p => p.id === activeProjectId.value)
  })

  // Graph computed
  const graphTaskIds = computed(() => {
    const ids = new Set()
    for (const t of tasks.value) {
      if (t.onGraph || t.parentIds?.length > 0) ids.add(t.id)
    }
    // also add tasks that are referenced as parents
    for (const t of tasks.value) {
      for (const pid of (t.parentIds ?? [])) ids.add(pid)
    }
    return ids
  })

  const graphTasks = computed(() =>
    tasks.value.filter(t => graphTaskIds.value.has(t.id))
  )

  const graphEdges = computed(() => {
    const ids = graphTaskIds.value
    const edges = []
    for (const t of tasks.value) {
      for (const pid of (t.parentIds ?? [])) {
        if (ids.has(pid) && ids.has(t.id)) {
          edges.push({ id: `${pid}->${t.id}`, source: pid, target: t.id })
        }
      }
    }
    return edges
  })

  const stats = computed(() => {
    const total = tasks.value.length
    const completed = tasks.value.filter(t => t.completed).length
    const active = total - completed
    const overdue = tasks.value.filter(t => {
      if (t.completed || !t.dueDate) return false
      return new Date(t.dueDate) < new Date(new Date().toDateString())
    }).length
    return { total, completed, active, overdue }
  })

  function addTask(data) {
    const projId = activeProjectId.value
    const task = {
      id: uid(),
      title: data.title,
      description: data.description ?? '',
      projectId: data.projectId ?? (projId && !['recurring','today','graph'].includes(projId) ? projId : null),
      priority: data.priority ?? 1,
      dueDate: data.dueDate ?? null,
      completed: false,
      completedCount: 0,
      subtasks: data.subtasks ?? [],
      recurring: data.recurring ?? null,
      order: tasks.value.length,
      parentIds: [],
      graphPos: null,
      onGraph: data.onGraph ?? false,
      createdAt: now(),
      updatedAt: now(),
    }
    tasks.value.push(task)
    persist()
    return task
  }

  function updateTask(id, data) {
    const idx = tasks.value.findIndex(t => t.id === id)
    if (idx === -1) return
    Object.assign(tasks.value[idx], data, { updatedAt: now() })
    persist()
  }

  function deleteTask(id) {
    tasks.value = tasks.value.filter(t => t.id !== id)
    // remove dangling parentIds references
    for (const t of tasks.value) {
      if (t.parentIds?.includes(id)) {
        t.parentIds = t.parentIds.filter(pid => pid !== id)
      }
    }
    if (activeTaskId.value === id) activeTaskId.value = null
    persist()
  }

  // ── Cascade completion (session-scoped, not persisted) ──────────────────
  const autoCompletedBy = new Map() // parentId → [childId, ...]

  function cascadeComplete(parentId, autoList) {
    const children = tasks.value.filter(t => t.parentIds?.includes(parentId))
    for (const child of children) {
      if ((child.parentIds?.length ?? 0) > 1) continue // skip multi-parent
      if (child.completed) continue                     // already done, stop branch
      const cidx = tasks.value.findIndex(t => t.id === child.id)
      if (cidx !== -1) {
        tasks.value[cidx] = { ...tasks.value[cidx], completed: true, updatedAt: now() }
        autoList.push(child.id)
        cascadeComplete(child.id, autoList)
      }
    }
  }

  function cascadeUncomplete(parentId) {
    const ids = autoCompletedBy.get(parentId)
    if (!ids) return
    for (const id of ids) {
      const cidx = tasks.value.findIndex(t => t.id === id)
      if (cidx !== -1 && tasks.value[cidx].completed) {
        tasks.value[cidx] = { ...tasks.value[cidx], completed: false, updatedAt: now() }
      }
      autoCompletedBy.delete(id) // clean up any nested entries
    }
    autoCompletedBy.delete(parentId)
  }
  // ────────────────────────────────────────────────────────────────────────

  function toggleTask(id) {
    const idx = tasks.value.findIndex(t => t.id === id)
    if (idx === -1) return
    const task = tasks.value[idx]

    if (task.recurring && !task.completed) {
      const nextDate = getNextDueDate(task)
      if (nextDate) {
        tasks.value[idx] = {
          ...task,
          dueDate: nextDate,
          completedCount: (task.completedCount || 0) + 1,
          subtasks: (task.subtasks ?? []).map(s => ({ ...s, completed: false })),
          updatedAt: now(),
        }
      } else {
        tasks.value[idx] = { ...task, completed: !task.completed, updatedAt: now() }
      }
    } else if (!task.completed) {
      // Completing → cascade single-parent children
      tasks.value[idx] = { ...task, completed: true, updatedAt: now() }
      const autoList = []
      cascadeComplete(id, autoList)
      if (autoList.length > 0) autoCompletedBy.set(id, autoList)
    } else {
      // Uncompleting → restore session-auto-completed descendants
      cascadeUncomplete(id)
      tasks.value[idx] = { ...task, completed: false, updatedAt: now() }
    }

    persist()
  }

  function reorderTasks(orderedIds) {
    // Recycle only the order slots that belong to the reordered tasks,
    // so tasks in other projects/filters keep their positions.
    const slots = orderedIds
      .map(id => tasks.value.find(t => t.id === id)?.order)
      .filter(o => o !== undefined)
      .sort((a, b) => a - b)
    orderedIds.forEach((id, i) => {
      const task = tasks.value.find(t => t.id === id)
      if (task) { task.order = slots[i]; task.updatedAt = now() }
    })
    persist()
  }

  // ── Graph mutations ──────────────────────────────────────────────────────
  function addParentLink(childId, parentId) {
    if (childId === parentId) return false
    const child = tasks.value.find(t => t.id === childId)
    if (!child) return false
    if (child.parentIds.includes(parentId)) return false
    // Cycle check: would adding parentId as parent of childId create a cycle?
    // i.e. is childId already an ancestor of parentId?
    const tasksById = Object.fromEntries(tasks.value.map(t => [t.id, t]))
    if (hasPath(tasksById, parentId, childId)) return false
    child.parentIds.push(parentId)
    child.updatedAt = now()
    persist()
    return true
  }

  function removeParentLink(childId, parentId) {
    const child = tasks.value.find(t => t.id === childId)
    if (!child) return
    child.parentIds = child.parentIds.filter(pid => pid !== parentId)
    child.updatedAt = now()
    persist()
  }

  function setGraphPos(id, pos) {
    const task = tasks.value.find(t => t.id === id)
    if (!task) return
    task.graphPos = { x: pos.x, y: pos.y }
    task.updatedAt = now()
    persist()
  }

  function addTaskToGraph(id) {
    const task = tasks.value.find(t => t.id === id)
    if (!task) return
    task.onGraph = true
    task.updatedAt = now()
    persist()
  }

  function removeTaskFromGraph(id) {
    const task = tasks.value.find(t => t.id === id)
    if (!task) return
    task.onGraph = false
    task.graphPos = null
    task.parentIds = []
    task.updatedAt = now()
    // remove this task from other tasks' parentIds
    for (const t of tasks.value) {
      if (t.parentIds?.includes(id)) {
        t.parentIds = t.parentIds.filter(pid => pid !== id)
      }
    }
    persist()
  }

  function createGraphTask({ title, pos, parentId = null }) {
    const task = addTask({ title })
    task.onGraph = true
    task.graphPos = { x: pos.x, y: pos.y }
    if (parentId) {
      task.parentIds = [parentId]
    }
    task.updatedAt = now()
    persist()
    return task
  }
  // ────────────────────────────────────────────────────────────────────────

  function addProject(name) {
    const colors = ['#4f46e5', '#ef4444', '#f59e0b', '#22c55e', '#06b6d4', '#8b5cf6', '#ec4899']
    const usedColors = projects.value.map(p => p.color)
    const color = colors.find(c => !usedColors.includes(c)) ?? colors[0]
    const project = { id: uid(), name, color, updatedAt: now() }
    projects.value.push(project)
    persist()
    return project
  }

  function deleteProject(id) {
    if (id === 'inbox') return
    projects.value = projects.value.filter(p => p.id !== id)
    tasks.value = tasks.value.filter(t => t.projectId !== id)
    if (activeProjectId.value === id) activeProjectId.value = null
    persist()
  }

  function exportData() {
    const data = {
      tasks: tasks.value,
      projects: projects.value,
      exportedAt: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `todo-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function importData(json) {
    try {
      const data = typeof json === 'string' ? JSON.parse(json) : json
      if (data.tasks && Array.isArray(data.tasks)) {
        tasks.value = data.tasks.map(ensureUpdatedAt)
      }
      if (data.projects && Array.isArray(data.projects)) {
        projects.value = data.projects.map(ensureUpdatedAt)
      }
      persist()
      return true
    } catch {
      return false
    }
  }

  return {
    tasks,
    projects,
    activeProjectId,
    searchQuery,
    filterStatus,
    activeTaskId,
    sortBy,
    draggingTaskId,
    filteredTasks,
    recurringTasks,
    activeProject,
    agenda,
    stats,
    taskCountByProject,
    graphTaskIds,
    graphTasks,
    graphEdges,
    addTask,
    updateTask,
    deleteTask,
    toggleTask,
    reorderTasks,
    addParentLink,
    removeParentLink,
    setGraphPos,
    addTaskToGraph,
    removeTaskFromGraph,
    createGraphTask,
    addProject,
    deleteProject,
    exportData,
    importData,
  }
})
