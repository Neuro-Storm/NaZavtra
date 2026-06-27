<script setup>
import { ref } from 'vue'
import { useTasksStore } from './stores/tasks.js'
import { useTheme } from './composables/useTheme.js'
import { useKeyboardShortcuts } from './composables/useKeyboardShortcuts.js'
import Sidebar from './components/Sidebar.vue'
import TaskList from './components/TaskList.vue'
import GraphBoard from './components/GraphBoard.vue'
import StatsPanel from './components/StatsPanel.vue'
import ThemeToggle from './components/ThemeToggle.vue'
import TaskForm from './components/TaskForm.vue'
import SettingsPage from './components/SettingsPage.vue'

const store = useTasksStore()
const { theme, toggle } = useTheme()
const showForm = ref(false)
const editingTask = ref(null)
const menuOpen = ref(false)
const showSettings = ref(false)
const initialTitle = ref('')

function openNewTask(title) {
  editingTask.value = null
  initialTitle.value = typeof title === 'string' ? title : ''
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
  initialTitle.value = ''
}

function toggleMenu() {
  menuOpen.value = !menuOpen.value
}

function closeMenu() {
  menuOpen.value = false
}

function openSettings() {
  showSettings.value = true
  menuOpen.value = false
}

function closeSettings() {
  showSettings.value = false
}

useKeyboardShortcuts({
  n: openNewTask,
  escape: closeForm,
})
</script>

<template>
  <Sidebar :open="menuOpen" @close="closeMenu" @new-task="openNewTask" @settings="openSettings" />
  <div v-if="menuOpen" class="sidebar-overlay" @click="closeMenu" />
  <main class="main">
    <header class="header">
      <div class="header-left">
        <button class="burger" @click="toggleMenu" aria-label="Меню">
          <span class="burger-line" />
          <span class="burger-line" />
          <span class="burger-line" />
        </button>
        <h1 class="title">{{ store.activeProject?.name ?? 'Все задачи' }}</h1>
        <span class="task-count">
          {{ store.activeProjectId === 'graph' ? store.graphTasks.length : store.filteredTasks.length }}
        </span>
      </div>
      <div class="header-actions">
        <ThemeToggle :theme="theme" @toggle="toggle" />
        <button class="btn btn-primary" @click="openNewTask">+</button>
      </div>
    </header>
    <GraphBoard v-if="store.activeProjectId === 'graph'" @edit="openEditTask" />
    <TaskList v-else @edit="openEditTask" @new-task="openNewTask" />
    <StatsPanel v-if="store.activeProjectId !== 'graph'" />
  </main>
  <Teleport to="body">
    <TaskForm
      v-if="showForm"
      :task="editingTask"
      :initial-title="initialTitle"
      @close="closeForm"
    />
    <SettingsPage
      v-if="showSettings"
      @close="closeSettings"
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
  min-width: 0;
}

.burger {
  display: none;
  width: 32px;
  height: 32px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}
.burger:hover {
  background: var(--bg-hover);
}
.burger-line {
  display: block;
  width: 18px;
  height: 2px;
  background: var(--text);
  border-radius: 2px;
  transition: transform var(--transition);
}

.title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.02em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-count {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  padding: 2px 8px;
  border-radius: 999px;
  flex-shrink: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.sidebar-overlay {
  display: none;
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
  .burger {
    display: flex;
  }

  .header {
    padding: 10px 12px;
  }
  .title {
    font-size: 1.05rem;
  }
  .header-actions .btn {
    padding: 8px 14px;
    font-size: 1rem;
  }
  .header-actions .btn span {
    display: none;
  }

  .sidebar-overlay {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.3);
    z-index: 90;
    backdrop-filter: blur(2px);
  }
}
</style>
