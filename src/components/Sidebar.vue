<script setup>
import { ref, computed } from 'vue'
import Sortable from 'sortablejs'
import { useTasksStore } from '../stores/tasks.js'

const props = defineProps({
  open: { type: Boolean, default: false },
})
const emit = defineEmits(['new-task', 'close', 'settings'])
const store = useTasksStore()

const newProjectName = ref('')
const showInput = ref(false)

function addProject() {
  const name = newProjectName.value.trim()
  if (!name) return
  store.addProject(name)
  newProjectName.value = ''
  showInput.value = false
}

function handleFileImport(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    store.importData(reader.result)
  }
  reader.readAsText(file)
  e.target.value = ''
}

function confirmDeleteProject(id, name) {
  const count = store.tasks.filter(t => t.projectId === id).length
  let msg = `Удалить проект «${name}»?`
  if (count > 0) {
    msg += `\n${count} задач${count === 1 ? 'а' : 'и'} будет удалено.`
  }
  if (confirm(msg)) {
    store.deleteProject(id)
  }
}

const closing = ref(false)

function exitApp() {
  closing.value = true
  fetch('/api/exit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm: true }),
  }).catch(() => {})
}

const fileInput = ref(null)

const isDragging = computed(() => !!store.draggingTaskId)

// ── Drop-zone directive ────────────────────────────────────────────────────
// Attaches a bare SortableJS instance to the element so it can accept drops
// from the 'tasks' group (TaskList draggable). The dropped DOM node is removed
// immediately in onAdd before Vue reconciles, avoiding vdom conflicts.
const vDropZone = {
  mounted(el, binding) {
    el.__dropCallback = binding.value
    el.__dropSortable = Sortable.create(el, {
      group: { name: 'tasks', put: true, pull: false },
      sort: false,
      onAdd(evt) {
        const id = evt.item?.dataset?.id
        if (evt.item.parentNode === el) el.removeChild(evt.item)
        if (id) el.__dropCallback(id)
      },
    })
  },
  updated(el, binding) {
    el.__dropCallback = binding.value
  },
  beforeUnmount(el) {
    el.__dropSortable?.destroy()
    delete el.__dropSortable
    delete el.__dropCallback
  },
}
</script>

<template>
  <aside class="sidebar" :class="{ open: props.open }">
    <div class="sidebar-header">
      <h2 class="logo">НаЗавтра</h2>
      <button class="close-sidebar" @click="emit('close')">×</button>
    </div>

    <nav class="nav">
      <!-- Карта целей — drop zone -->
      <div
        v-drop-zone="(id) => store.addTaskToGraph(id)"
        class="nav-item"
        :class="{ active: store.activeProjectId === 'graph', 'drop-ready': isDragging }"
        role="button"
        tabindex="0"
        @click="store.activeProjectId = 'graph'; emit('close')"
        @keydown.enter.space.prevent="store.activeProjectId = 'graph'; emit('close')"
      >
        <span class="nav-icon">🗺️</span>
        Карта целей
        <span class="nav-count">{{ store.graphTasks.length }}</span>
      </div>

      <!-- Сегодня — no drop zone -->
      <button
        class="nav-item"
        :class="{ active: store.activeProjectId === 'today' }"
        @click="store.activeProjectId = 'today'; emit('close')"
      >
        <span class="nav-icon">📅</span>
        Сегодня
        <span class="nav-count">{{ store.agenda.overdue.length + store.agenda.timed.length + store.agenda.untimed.length }}</span>
      </button>

      <!-- Все задачи — drop zone to remove project -->
      <div
        v-drop-zone="(id) => store.updateTask(id, { projectId: null })"
        class="nav-item"
        :class="{ active: !store.activeProjectId, 'drop-ready': isDragging }"
        role="button"
        tabindex="0"
        @click="store.activeProjectId = null; emit('close')"
        @keydown.enter.space.prevent="store.activeProjectId = null; emit('close')"
      >
        <span class="nav-icon">📋</span>
        Все задачи
        <span class="nav-count">{{ store.tasks.length }}</span>
      </div>

      <!-- Повторяющиеся — no drop zone -->
      <button
        class="nav-item"
        :class="{ active: store.activeProjectId === 'recurring' }"
        @click="store.activeProjectId = 'recurring'; emit('close')"
      >
        <span class="nav-icon">🔄</span>
        Повторяющиеся
        <span class="nav-count">{{ store.recurringTasks.length }}</span>
      </button>

      <!-- Projects — drop zones to assign project -->
      <div
        v-for="project in store.projects"
        :key="project.id"
        v-drop-zone="(id) => store.updateTask(id, { projectId: project.id })"
        class="nav-item"
        :class="{ active: store.activeProjectId === project.id, 'drop-ready': isDragging }"
        role="button"
        tabindex="0"
        @click="store.activeProjectId = project.id; emit('close')"
        @keydown.enter.space.prevent="store.activeProjectId = project.id; emit('close')"
      >
        <span class="nav-dot" :style="{ background: project.color }" />
        <span class="truncate">{{ project.name }}</span>
        <span class="nav-count">{{ store.taskCountByProject[project.id] ?? 0 }}</span>
        <button
          v-if="project.id !== 'inbox'"
          class="nav-delete"
          @click.stop="confirmDeleteProject(project.id, project.name)"
          title="Удалить проект"
        >×</button>
      </div>
    </nav>

    <div class="sidebar-section">
      <template v-if="!showInput">
        <button class="btn-add" @click="showInput = true">
          + Новый проект
        </button>
      </template>
      <div v-else class="add-project-form">
        <input
          v-model="newProjectName"
          class="input"
          placeholder="Название проекта"
          @keyup.enter="addProject"
          @keyup.escape="showInput = false"
          ref="projectInput"
          autofocus
        />
        <div class="add-project-actions">
          <button class="btn btn-sm btn-primary" @click="addProject">Добавить</button>
          <button class="btn btn-sm" @click="showInput = false">Отмена</button>
        </div>
      </div>
    </div>

    <div class="sidebar-footer">
      <label class="footer-btn" title="Импорт JSON">
        📥 Импорт
        <input
          ref="fileInput"
          type="file"
          accept=".json"
          class="file-input"
          @change="handleFileImport"
        />
      </label>
      <button class="footer-btn" @click="store.exportData" title="Экспорт JSON">
        📤 Экспорт
      </button>
      <button class="footer-btn" @click="emit('settings')" title="Настройки">
        ⚙️ Настройки
      </button>
      <button class="footer-btn exit-btn" @click="exitApp" title="Закрыть приложение">
        ⏻ Выход
      </button>
    </div>
  </aside>
  <Teleport to="body">
    <div v-if="closing" class="closing-overlay">
      <div class="closing-card">
        <div class="closing-icon">⏻</div>
        <p>Приложение закрыто.</p>
        <p class="closing-hint">Закройте вкладку браузера.</p>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
}

.sidebar-header {
  padding: 20px 16px 12px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.close-sidebar {
  display: none;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  font-size: 1.3rem;
  color: var(--text-secondary);
}
.close-sidebar:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.logo {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: -0.03em;
}

.nav {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  color: var(--text);
  transition: all var(--transition);
  text-align: left;
  width: 100%;
  position: relative;
  cursor: pointer;
  user-select: none;
}
.nav-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.nav-item.active {
  background: var(--accent-bg);
  color: var(--accent);
  font-weight: 500;
}
.nav-item.drop-ready {
  background: var(--bg-hover);
  outline: 1px dashed var(--border);
  outline-offset: -1px;
}

.nav-icon {
  font-size: 1rem;
  flex-shrink: 0;
}

.nav-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.nav-count {
  margin-left: auto;
  font-size: 0.75rem;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  padding: 1px 6px;
  border-radius: 999px;
  flex-shrink: 0;
}
.nav-item.active .nav-count {
  background: var(--accent-bg);
  color: var(--accent);
}

.nav-delete {
  font-size: 1rem;
  line-height: 1;
  padding: 0 2px;
  opacity: 0;
  transition: opacity var(--transition);
  color: var(--text-secondary);
  flex-shrink: 0;
}
.nav-item:hover .nav-delete {
  opacity: 0.6;
}
.nav-delete:hover {
  opacity: 1 !important;
  color: var(--priority-high);
}

.sidebar-section {
  padding: 8px;
  border-top: 1px solid var(--border);
}

.btn-add {
  width: 100%;
  padding: 8px 10px;
  text-align: left;
  color: var(--text-secondary);
  font-size: 0.85rem;
  border-radius: var(--radius-sm);
  transition: all var(--transition);
}
.btn-add:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.add-project-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.add-project-actions {
  display: flex;
  gap: 6px;
}

.input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  outline: none;
  transition: border-color var(--transition);
}
.input:focus {
  border-color: var(--accent);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  font-weight: 500;
  font-size: 0.85rem;
  transition: all var(--transition);
}
.btn-sm { padding: 4px 10px; font-size: 0.8rem; }
.btn-primary { background: var(--accent); color: white; }
.btn-primary:hover { background: var(--accent-hover); }

.sidebar-footer {
  padding: 8px;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.footer-btn {
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  color: var(--text-secondary);
  transition: all var(--transition);
  text-align: left;
  cursor: pointer;
  position: relative;
}
.footer-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.exit-btn {
  border-top: 1px solid var(--border);
  margin-top: 4px;
  padding-top: 10px;
  color: var(--text-secondary);
}
.exit-btn:hover {
  color: var(--priority-high);
}

.file-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.closing-overlay {
  position: fixed;
  inset: 0;
  background: var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
  animation: fadeIn 0.3s ease;
}

.closing-card {
  text-align: center;
}

.closing-icon {
  font-size: 3rem;
  margin-bottom: 16px;
}

.closing-card p {
  font-size: 1.1rem;
  color: var(--text-primary);
  margin: 0;
}

.closing-hint {
  font-size: 0.9rem !important;
  color: var(--text-secondary) !important;
  margin-top: 8px !important;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 100;
    transform: translateX(-100%);
    transition: transform 0.25s ease;
    box-shadow: var(--shadow-lg);
  }
  .sidebar.open {
    transform: translateX(0);
  }

  .close-sidebar {
    display: flex;
  }

  .nav-delete {
    opacity: 0.6;
  }
}
</style>
