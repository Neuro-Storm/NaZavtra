<script setup>
import { ref, watch } from 'vue'
import { useTasksStore } from '../stores/tasks.js'

const props = defineProps({
  task: { type: Object, default: null },
})
const emit = defineEmits(['close'])

const store = useTasksStore()

const title = ref('')
const description = ref('')
const priority = ref(1)
const projectId = ref(null)
const dueDate = ref('')
const subtasks = ref([])
const newSubtaskTitle = ref('')
const isEditing = ref(false)

watch(() => props.task, (task) => {
  if (task) {
    isEditing.value = true
    title.value = task.title
    description.value = task.description ?? ''
    priority.value = task.priority ?? 1
    projectId.value = task.projectId ?? null
    dueDate.value = task.dueDate ? task.dueDate.slice(0, 10) : ''
    subtasks.value = task.subtasks?.map(s => ({ ...s })) ?? []
  } else {
    isEditing.value = false
    title.value = ''
    description.value = ''
    priority.value = 1
    projectId.value = store.activeProjectId ?? null
    dueDate.value = ''
    subtasks.value = []
  }
}, { immediate: true })

function addSubtask() {
  const t = newSubtaskTitle.value.trim()
  if (!t) return
  subtasks.value.push({ id: Date.now().toString(36), title: t, completed: false })
  newSubtaskTitle.value = ''
}

function removeSubtask(id) {
  subtasks.value = subtasks.value.filter(s => s.id !== id)
}

function handleSubmit() {
  if (!title.value.trim()) return

  const data = {
    title: title.value.trim(),
    description: description.value.trim(),
    priority: priority.value,
    projectId: projectId.value,
    dueDate: dueDate.value || null,
    subtasks: subtasks.value,
  }

  if (isEditing.value) {
    store.updateTask(props.task.id, data)
  } else {
    store.addTask(data)
  }

  emit('close')
}

function handleBackdropClick(e) {
  if (e.target === e.currentTarget) emit('close')
}

const titleRef = ref(null)
watch(() => props.task, () => {
  setTimeout(() => titleRef.value?.focus(), 50)
}, { immediate: true })
</script>

<template>
  <div class="backdrop" @click="handleBackdropClick">
    <div class="modal">
      <div class="modal-header">
        <h2>{{ isEditing ? 'Редактировать задачу' : 'Новая задача' }}</h2>
        <button class="close-btn" @click="emit('close')">x</button>
      </div>

      <form class="modal-body" @submit.prevent="handleSubmit">
        <div class="field">
          <label class="label">Название</label>
          <input
            ref="titleRef"
            v-model="title"
            class="input"
            placeholder="Что нужно сделать?"
            autofocus
            required
          />
        </div>

        <div class="field-row">
          <div class="field">
            <label class="label">Приоритет</label>
            <select v-model="priority" class="input">
              <option :value="0">Низкий</option>
              <option :value="1">Средний</option>
              <option :value="2">Высокий</option>
            </select>
          </div>
          <div class="field">
            <label class="label">Срок</label>
            <input v-model="dueDate" class="input" type="date" />
          </div>
        </div>

        <div class="field">
          <label class="label">Проект</label>
          <select v-model="projectId" class="input">
            <option :value="null">Без проекта</option>
            <option
              v-for="p in store.projects"
              :key="p.id"
              :value="p.id"
            >{{ p.name }}</option>
          </select>
        </div>

        <div class="field">
          <label class="label">Описание (поддерживает Markdown)</label>
          <textarea
            v-model="description"
            class="input textarea"
            placeholder="Добавить заметки..."
            rows="3"
          />
        </div>

        <div class="field">
          <label class="label">Подзадачи</label>
          <div class="subtask-list">
            <div v-for="st in subtasks" :key="st.id" class="subtask-row">
              <label class="checkbox-wrapper">
                <input
                  type="checkbox"
                  class="checkbox"
                  v-model="st.completed"
                />
                <span class="checkmark" />
              </label>
              <span class="subtask-title" :class="{ done: st.completed }">{{ st.title }}</span>
              <button type="button" class="subtask-remove" @click="removeSubtask(st.id)">x</button>
            </div>
          </div>
          <div class="add-subtask">
            <input
              v-model="newSubtaskTitle"
              class="input"
              placeholder="Добавить подзадачу..."
              @keyup.enter.prevent="addSubtask"
            />
            <button type="button" class="btn btn-sm" @click="addSubtask">+</button>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn" @click="emit('close')">Отмена</button>
          <button type="submit" class="btn btn-primary">
            {{ isEditing ? 'Сохранить' : 'Создать' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 16px;
  backdrop-filter: blur(2px);
}

.modal {
  background: var(--bg);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-width: 520px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 0;
}
.modal-header h2 {
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  font-size: 1.3rem;
  color: var(--text-secondary);
  transition: all var(--transition);
}
.close-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.modal-body {
  padding: 20px 24px 24px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  outline: none;
  transition: border-color var(--transition);
  font-size: 0.9rem;
}
.input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-bg);
}

.textarea {
  resize: vertical;
  min-height: 60px;
  line-height: 1.5;
}

select.input {
  cursor: pointer;
}

.subtask-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}

.subtask-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  background: var(--bg-secondary);
}

.checkbox-wrapper {
  position: relative;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  cursor: pointer;
}

.checkbox {
  position: absolute;
  opacity: 0;
  width: 100%;
  height: 100%;
}

.checkmark {
  position: absolute;
  inset: 0;
  border: 2px solid var(--border);
  border-radius: 3px;
  transition: all var(--transition);
}
.checkbox:checked + .checkmark {
  background: var(--complete);
  border-color: var(--complete);
}
.checkbox:checked + .checkmark::after {
  content: '';
  position: absolute;
  left: 3px;
  top: 0;
  width: 4px;
  height: 8px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.subtask-title {
  flex: 1;
  font-size: 0.85rem;
}
.subtask-title.done {
  text-decoration: line-through;
  color: var(--text-secondary);
}

.subtask-remove {
  font-size: 1.1rem;
  color: var(--text-secondary);
  opacity: 0;
  transition: opacity var(--transition);
  line-height: 1;
}
.subtask-row:hover .subtask-remove {
  opacity: 0.6;
}
.subtask-remove:hover {
  opacity: 1 !important;
  color: var(--priority-high);
}

.add-subtask {
  display: flex;
  gap: 6px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
  margin-top: 4px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  font-weight: 500;
  font-size: 0.9rem;
  transition: all var(--transition);
}
.btn-sm { padding: 6px 10px; font-size: 0.8rem; }
.btn-primary { background: var(--accent); color: white; }
.btn-primary:hover { background: var(--accent-hover); }

@media (max-width: 640px) {
  .backdrop {
    padding: 0;
    backdrop-filter: none;
    background: var(--bg);
  }
  .modal {
    max-width: none;
    max-height: none;
    height: 100dvh;
    border-radius: 0;
    box-shadow: none;
  }
  .modal-header {
    padding: 16px 20px 0;
  }
  .modal-body {
    padding: 16px 20px 20px;
  }
}
</style>
