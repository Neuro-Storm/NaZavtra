import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

const STORAGE_KEY = 'todo-app-data'

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

function now() {
  return new Date().toISOString()
}

function ensureUpdatedAt(item) {
  if (!item.updatedAt) item.updatedAt = now()
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

  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const data = JSON.parse(e.newValue)
        if (data.tasks) tasks.value = data.tasks.map(ensureUpdatedAt)
        if (data.projects) projects.value = data.projects.map(ensureUpdatedAt)
        if (data.activeProjectId) activeProjectId.value = data.activeProjectId
      } catch {}
    }
  })

  if (import.meta.env.DEV) {
    fetchData().then(data => {
      if (data) {
        tasks.value = (data.tasks ?? []).map(ensureUpdatedAt)
        projects.value = (data.projects ?? [...DEFAULT_PROJECTS]).map(ensureUpdatedAt)
        activeProjectId.value = data.activeProjectId ?? null
      }
    })
  }

  function persist() {
    const data = {
      tasks: tasks.value,
      projects: projects.value,
      activeProjectId: activeProjectId.value,
    }
    saveLocal(data)
    if (import.meta.env.DEV) postData(data)
  }

  const filteredTasks = computed(() => {
    let list = tasks.value

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

    return list.sort((a, b) => a.order - b.order)
  })

  const activeProject = computed(() =>
    projects.value.find(p => p.id === activeProjectId.value)
  )

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
    const task = {
      id: uid(),
      title: data.title,
      description: data.description ?? '',
      projectId: data.projectId ?? activeProjectId.value ?? null,
      priority: data.priority ?? 1,
      dueDate: data.dueDate ?? null,
      completed: false,
      subtasks: data.subtasks ?? [],
      order: tasks.value.length,
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
    if (activeTaskId.value === id) activeTaskId.value = null
    persist()
  }

  function toggleTask(id) {
    const task = tasks.value.find(t => t.id === id)
    if (!task) return
    task.completed = !task.completed
    task.updatedAt = now()
    persist()
  }

  function reorderTasks(newOrder) {
    newOrder.forEach((id, idx) => {
      const task = tasks.value.find(t => t.id === id)
      if (task) { task.order = idx; task.updatedAt = now() }
    })
    persist()
  }

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
    filteredTasks,
    activeProject,
    stats,
    addTask,
    updateTask,
    deleteTask,
    toggleTask,
    reorderTasks,
    addProject,
    deleteProject,
    exportData,
    importData,
  }
})
