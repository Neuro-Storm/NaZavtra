<script setup>
import { ref } from 'vue'
import { useTasksStore } from './stores/tasks.js'
import { useTheme } from './composables/useTheme.js'
import { useKeyboardShortcuts } from './composables/useKeyboardShortcuts.js'
import Sidebar from './components/Sidebar.vue'
import TaskList from './components/TaskList.vue'
import StatsPanel from './components/StatsPanel.vue'
import ThemeToggle from './components/ThemeToggle.vue'
import TaskForm from './components/TaskForm.vue'

const store = useTasksStore()
const { theme, toggle } = useTheme()
const showForm = ref(false)
const editingTask = ref(null)

function openNewTask() {
  editingTask.value = null
  showForm.value = true
}

function openEditTask(id) {
  const task = store.tasks.find(t => t.id === id)
  if (task) {
    editingTask.value = task
    showForm.value = true
  }
}

function closeForm() {
  showForm.value = false
  editingTask.value = null
}

useKeyboardShortcuts({
  n: openNewTask,
  Escape: closeForm,
})
</script>

<template>
  <Sidebar @new-task="openNewTask" />
  <main class="main">
    <header class="header">
      <div class="header-left">
        <h1 class="title">{{ store.activeProject?.name ?? 'Все задачи' }}</h1>
        <span class="task-count">{{ store.filteredTasks.length }}</span>
      </div>
      <div class="header-actions">
        <ThemeToggle :theme="theme" @toggle="toggle" />
        <button class="btn btn-primary" @click="openNewTask">+ Новая задача</button>
      </div>
    </header>
    <TaskList @edit="openEditTask" @new-task="openNewTask" />
    <StatsPanel />
  </main>
  <Teleport to="body">
    <TaskForm
      v-if="showForm"
      :task="editingTask"
      @close="closeForm"
    />
  </Teleport>
</template>

<style scoped>
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 32px 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.task-count {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  padding: 2px 8px;
  border-radius: 999px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  font-weight: 500;
  font-size: 0.9rem;
  transition: all var(--transition);
}

.btn-primary {
  background: var(--accent);
  color: white;
}
.btn-primary:hover {
  background: var(--accent-hover);
}

@media (max-width: 768px) {
  .header {
    padding: 14px 16px 12px;
  }
  .title {
    font-size: 1.2rem;
  }
  .header-actions .btn {
    padding: 6px 12px;
    font-size: 0.8rem;
  }
}
</style>
