<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import draggable from 'vuedraggable'
import { useTasksStore } from '../stores/tasks.js'
import TaskCard from './TaskCard.vue'

const emit = defineEmits(['edit', 'new-task'])
const store = useTasksStore()

// Local copy of filtered tasks for vuedraggable (computed refs are read-only)
const localTasks = ref([...store.filteredTasks])
watch(() => store.filteredTasks, (val) => { localTasks.value = [...val] })

// Reorder is only meaningful in manual mode without search/completed filter.
// Dragging OUT to sidebar drop-zones always works (drag is never disabled).
const reorderEnabled = computed(() =>
  store.sortBy === 'manual' && !store.searchQuery && store.filterStatus !== 'completed'
)

function handleDragStart(evt) {
  store.draggingTaskId = evt.item?.dataset?.id ?? null
}

function handleDragEnd(evt) {
  store.draggingTaskId = null
  // Only persist order on same-list reorder, not cross-list (drag-to-sidebar)
  if (reorderEnabled.value && evt.from === evt.to) {
    store.reorderTasks(localTasks.value.map(t => t.id))
  }
}

// Sort dropdown
const showSort = ref(false)
const sortOptions = [
  { value: 'manual', label: 'Вручную' },
  { value: 'due', label: 'По сроку' },
  { value: 'priority', label: 'По приоритету' },
  { value: 'name', label: 'По имени' },
  { value: 'created', label: 'По дате добавл.' },
]
const sortLabels = Object.fromEntries(sortOptions.map(o => [o.value, o.label]))

function closeSortDropdown(e) {
  if (!e?.target?.closest?.('.sort-wrapper')) {
    showSort.value = false
  }
}

onMounted(() => document.addEventListener('click', closeSortDropdown))
onUnmounted(() => document.removeEventListener('click', closeSortDropdown))

// Agenda total count
const agendaTotal = computed(() => {
  const a = store.agenda
  return a.overdue.length + a.timed.length + a.untimed.length
})
</script>

<template>
  <div class="task-list-container">

    <!-- Search bar (hidden in today view) -->
    <div v-if="store.activeProjectId !== 'today'" class="search-bar">
      <div class="search-wrapper">
        <input
          v-model="store.searchQuery"
          class="search-input"
          type="text"
          placeholder="Поиск задач..."
        />
        <button
          v-if="store.searchQuery"
          class="search-clear"
          @click="store.searchQuery = ''"
          title="Очистить поиск"
        >×</button>
      </div>
      <div class="filter-chips">
        <button
          class="chip"
          :class="{ active: store.filterStatus === 'all' }"
          @click="store.filterStatus = 'all'"
        >Все</button>
        <button
          class="chip"
          :class="{ active: store.filterStatus === 'active' }"
          @click="store.filterStatus = 'active'"
        >Активные</button>
        <button
          class="chip"
          :class="{ active: store.filterStatus === 'completed' }"
          @click="store.filterStatus = 'completed'"
        >Завершённые</button>
      </div>
      <div class="sort-wrapper">
        <button
          class="chip sort-btn"
          :class="{ active: store.sortBy !== 'manual' }"
          @click.stop="showSort = !showSort"
        >⇅ {{ sortLabels[store.sortBy] }}</button>
        <div v-if="showSort" class="sort-dropdown">
          <button
            v-for="opt in sortOptions"
            :key="opt.value"
            class="sort-option"
            :class="{ active: store.sortBy === opt.value }"
            @click="store.sortBy = opt.value; showSort = false"
          >{{ opt.label }}</button>
        </div>
      </div>
    </div>

    <!-- Today agenda view -->
    <div v-if="store.activeProjectId === 'today'" class="task-list">
      <div v-if="agendaTotal === 0" class="empty-state">
        <div class="empty-icon">✅</div>
        <h3>На сегодня задач нет</h3>
        <p>Всё сделано!</p>
      </div>
      <template v-else>
        <div v-if="store.agenda.overdue.length > 0" class="agenda-section">
          <div class="agenda-label overdue-label">⚠️ Просрочено</div>
          <TaskCard
            v-for="task in store.agenda.overdue"
            :key="task.id"
            :task="task"
            :show-drag-handle="false"
            :show-graph-badge="store.graphTaskIds.has(task.id)"
            @toggle="store.toggleTask(task.id)"
            @edit="emit('edit', task.id)"
            @delete="store.deleteTask(task.id)"
          />
        </div>
        <div v-if="store.agenda.timed.length > 0" class="agenda-section">
          <div class="agenda-label">🕐 По времени</div>
          <TaskCard
            v-for="task in store.agenda.timed"
            :key="task.id"
            :task="task"
            :show-drag-handle="false"
            :show-graph-badge="store.graphTaskIds.has(task.id)"
            @toggle="store.toggleTask(task.id)"
            @edit="emit('edit', task.id)"
            @delete="store.deleteTask(task.id)"
          />
        </div>
        <div v-if="store.agenda.untimed.length > 0" class="agenda-section">
          <div class="agenda-label">📌 Без времени</div>
          <TaskCard
            v-for="task in store.agenda.untimed"
            :key="task.id"
            :task="task"
            :show-drag-handle="false"
            :show-graph-badge="store.graphTaskIds.has(task.id)"
            @toggle="store.toggleTask(task.id)"
            @edit="emit('edit', task.id)"
            @delete="store.deleteTask(task.id)"
          />
        </div>
      </template>
    </div>

    <!-- Regular task list -->
    <div v-else class="task-list">
      <div v-if="localTasks.length === 0" class="empty-state">
        <template v-if="store.searchQuery">
          <div class="empty-icon">🔍</div>
          <h3>Ничего не найдено</h3>
          <p>По запросу «{{ store.searchQuery }}» задач нет</p>
          <button class="btn btn-primary" @click="emit('new-task', store.searchQuery)">+ Добавить «{{ store.searchQuery }}»</button>
        </template>
        <template v-else>
          <div class="empty-icon">☑️</div>
          <h3>Задач пока нет</h3>
          <p>Создайте новую задачу, чтобы начать</p>
          <button class="btn btn-primary" @click="emit('new-task')">+ Новая задача</button>
        </template>
      </div>

      <draggable
        v-model="localTasks"
        item-key="id"
        handle=".drag-handle"
        :sort="reorderEnabled"
        :animation="150"
        ghost-class="drag-ghost"
        :group="{ name: 'tasks', pull: 'clone', put: false }"
        @start="handleDragStart"
        @end="handleDragEnd"
      >
        <template #item="{ element: task }">
          <TaskCard
            :task="task"
            :show-drag-handle="true"
            :show-graph-badge="store.graphTaskIds.has(task.id)"
            @toggle="store.toggleTask(task.id)"
            @edit="emit('edit', task.id)"
            @delete="store.deleteTask(task.id)"
          />
        </template>
      </draggable>
    </div>
  </div>
</template>

<style scoped>
.task-list-container {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.search-bar {
  padding: 12px 32px 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.search-wrapper {
  flex: 1;
  min-width: 120px;
  position: relative;
}

.search-input {
  width: 100%;
  padding: 8px 32px 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  outline: none;
  transition: all var(--transition);
  font-size: 0.9rem;
  box-sizing: border-box;
}
.search-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-bg);
}
.search-input::placeholder {
  color: var(--text-secondary);
}

.search-clear {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 50%;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity var(--transition), background var(--transition);
}
.search-wrapper:hover .search-clear,
.search-input:focus ~ .search-clear {
  opacity: 1;
}
.search-clear:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.filter-chips {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.chip {
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  transition: all var(--transition);
  white-space: nowrap;
}
.chip:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.chip.active {
  background: var(--accent);
  color: white;
}

/* Sort dropdown */
.sort-wrapper {
  position: relative;
  flex-shrink: 0;
}

.sort-btn {
  display: flex;
  align-items: center;
  gap: 4px;
}

.sort-dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-lg);
  min-width: 160px;
  z-index: 50;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sort-option {
  display: flex;
  align-items: center;
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  color: var(--text);
  text-align: left;
  width: 100%;
  transition: background var(--transition);
}
.sort-option:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.sort-option.active {
  color: var(--accent);
  font-weight: 600;
}

@media (max-width: 768px) {
  .search-bar {
    padding: 8px 12px;
    gap: 6px;
  }
  .search-input {
    width: 100%;
    min-width: 0;
    order: -1;
    flex: none;
  }
  .filter-chips {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .filter-chips::-webkit-scrollbar {
    display: none;
  }
  .task-list {
    padding: 4px 12px 12px;
  }
  .empty-state {
    padding: 32px 16px;
  }
}

.task-list {
  padding: 8px 32px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 48px 32px;
  color: var(--text-secondary);
  text-align: center;
}
.empty-icon {
  font-size: 3rem;
}
.empty-state h3 {
  font-size: 1.1rem;
  color: var(--text-primary);
  font-weight: 600;
}
.empty-state p {
  font-size: 0.9rem;
  margin-bottom: 8px;
}

/* Agenda sections (Today view) */
.agenda-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.agenda-label {
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
  padding: 4px 2px;
  margin-bottom: 2px;
}

.overdue-label {
  color: var(--priority-high);
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

:global(.drag-ghost) {
  opacity: 0.4;
  border: 1px dashed var(--accent) !important;
}
</style>
