<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useTasksStore } from '../stores/tasks.js'

const props = defineProps({
  task: { type: Object, required: true },
})

const emit = defineEmits(['toggle', 'edit', 'delete'])
const store = useTasksStore()

const showMove = ref(false)

function closeMove(e) {
  if (!e?.target?.closest?.('.move-wrapper')) {
    showMove.value = false
  }
}

onMounted(() => document.addEventListener('click', closeMove))
onUnmounted(() => document.removeEventListener('click', closeMove))

const priorityLabels = { 0: 'Низкий', 1: 'Средний', 2: 'Высокий' }
const priorityClass = ['low', 'medium', 'high']

const otherProjects = ref([])

function toggleMove(e) {
  otherProjects.value = store.projects.filter(p => p.id !== props.task.projectId)
  showMove.value = !showMove.value
  e.stopPropagation()
}

function moveTo(projectId) {
  store.updateTask(props.task.id, { projectId })
  showMove.value = false
}

function formatDate(iso) {
  if (!iso) return null
  const d = new Date(iso)
  const today = new Date(new Date().toDateString())
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dateOnly = new Date(d.toDateString())

  if (dateOnly.getTime() === today.getTime()) return 'Сегодня'
  if (dateOnly.getTime() === tomorrow.getTime()) return 'Завтра'

  return d.toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' })
}

function isOverdue(iso) {
  if (!iso) return false
  const due = new Date(iso)
  const today = new Date(new Date().toDateString())
  return due < today
}

function completedSubtasks(task) {
  return task.subtasks.filter(s => s.completed).length
}
</script>

<template>
  <div
    class="task-card"
    :class="{ completed: task.completed }"
  >
    <label class="checkbox-wrapper">
      <input
        type="checkbox"
        class="checkbox"
        :checked="task.completed"
        @change="emit('toggle')"
      />
      <span class="checkmark" />
    </label>

    <div class="task-content" @click="emit('edit')">
      <div class="task-title" :class="{ done: task.completed }">{{ task.title }}</div>
      <div class="task-meta">
        <span
          v-if="task.projectId"
          class="project-badge"
          :style="{ '--dot-color': store.projects.find(p => p.id === task.projectId)?.color }"
        >{{ store.projects.find(p => p.id === task.projectId)?.name }}</span>
        <span
          v-if="task.priority !== undefined"
          class="priority-badge"
          :class="priorityClass[task.priority]"
        >
          {{ priorityLabels[task.priority] }}
        </span>
        <span v-if="task.dueDate" class="due-date" :class="{ overdue: isOverdue(task.dueDate) && !task.completed }">
          {{ formatDate(task.dueDate) }}
        </span>
        <span v-if="task.subtasks.length > 0" class="subtask-count">
          {{ completedSubtasks(task) }}/{{ task.subtasks.length }}
        </span>
      </div>
    </div>

    <div class="task-actions">
      <button class="action-btn edit-btn" @click="emit('edit')" title="Редактировать">✏️</button>
      <button class="action-btn delete-btn" @click="emit('delete')" title="Удалить">🗑️</button>
      <div class="move-wrapper">
        <button class="action-btn move-btn" @click="toggleMove" title="Переместить">📂</button>
        <div v-if="showMove" class="move-dropdown" @click.stop>
          <button
            v-for="p in otherProjects"
            :key="p.id"
            class="move-option"
            @click="moveTo(p.id)"
          >
            <span class="nav-dot" :style="{ background: p.color }" />
            {{ p.name }}
          </button>
          <button v-if="otherProjects.length === 0" class="move-option empty" disabled>
            Нет других проектов
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  border-radius: var(--radius);
  background: var(--bg);
  border: 1px solid var(--border);
  transition: all var(--transition);
  cursor: default;
}
.task-card:hover {
  border-color: var(--accent);
  box-shadow: var(--shadow-sm);
}
.task-card.completed {
  opacity: 0.6;
  background: var(--bg-secondary);
}

.checkbox-wrapper {
  position: relative;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  margin-top: 2px;
  cursor: pointer;
}

.checkbox {
  position: absolute;
  opacity: 0;
  cursor: pointer;
  width: 100%;
  height: 100%;
}

.checkmark {
  position: absolute;
  inset: 0;
  border: 2px solid var(--border);
  border-radius: 4px;
  transition: all var(--transition);
}
.checkbox:checked + .checkmark {
  background: var(--complete);
  border-color: var(--complete);
}
.checkbox:checked + .checkmark::after {
  content: '';
  position: absolute;
  left: 5px;
  top: 1px;
  width: 5px;
  height: 9px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}
.checkbox:focus-visible + .checkmark {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.task-content {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.task-title {
  font-size: 0.95rem;
  color: var(--text-primary);
  font-weight: 500;
  line-height: 1.4;
  word-break: break-word;
}
.task-title.done {
  text-decoration: line-through;
  color: var(--text-secondary);
}

.task-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  flex-wrap: wrap;
}

.project-badge {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 1px 7px 1px 14px;
  border-radius: 999px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  position: relative;
}
.project-badge::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 50%;
  transform: translateY(-50%);
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--dot-color);
}

.priority-badge {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 999px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.priority-badge.low {
  background: var(--priority-low-bg);
  color: var(--priority-low);
}
.priority-badge.medium {
  background: var(--priority-medium-bg);
  color: var(--priority-medium);
}
.priority-badge.high {
  background: var(--priority-high-bg);
  color: var(--priority-high);
}

.due-date {
  font-size: 0.8rem;
  color: var(--text-secondary);
}
.due-date.overdue {
  color: var(--priority-high);
  font-weight: 600;
}

.subtask-count {
  font-size: 0.75rem;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  padding: 1px 6px;
  border-radius: 999px;
}

.task-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
  position: relative;
}

.action-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition: all var(--transition);
  font-size: 0.8rem;
  opacity: 0.5;
}
.task-card:hover .action-btn {
  opacity: 1;
}
.action-btn:hover {
  background: var(--bg-hover);
  opacity: 1;
}
.delete-btn:hover {
  background: var(--priority-high-bg);
}

@media (max-width: 768px) {
  .action-btn {
    opacity: 1;
    width: 36px;
    height: 36px;
    font-size: 1rem;
  }
  .task-card {
    padding: 10px 12px;
  }
}
.task-card:hover .task-actions {
  opacity: 1;
}

@media (max-width: 768px) {
  .task-actions {
    opacity: 1;
  }
  .action-btn {
    width: 36px;
    height: 36px;
    font-size: 1rem;
  }
  .task-card {
    padding: 10px 12px;
  }
}

.action-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition: all var(--transition);
  font-size: 0.8rem;
}
.action-btn:hover {
  background: var(--bg-hover);
}
.delete-btn:hover {
  background: var(--priority-high-bg);
}

.move-wrapper {
  position: relative;
}

.move-dropdown {
  position: absolute;
  right: 0;
  top: 100%;
  margin-top: 4px;
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

.move-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  color: var(--text);
  text-align: left;
  width: 100%;
  transition: background var(--transition);
}
.move-option:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.move-option.empty {
  color: var(--text-secondary);
  cursor: default;
}

.nav-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
</style>
