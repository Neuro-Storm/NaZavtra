<script setup>
import { ref, watch, computed, nextTick } from 'vue'
import { useTasksStore } from '../stores/tasks.js'

const props = defineProps({
  task: { type: Object, default: null },
  initialTitle: { type: String, default: '' },
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
const errorMsg = ref('')
const titleRef = ref(null)

const recurringType = ref(null)
const recurringInterval = ref(1)
const recurringWeekdays = ref([1, 2, 3, 4, 5])
const recurringTime = ref('')
const recurringDuration = ref(null)

const presets = [
  { label: 'Каждый день', type: 'daily' },
  { label: 'По будням', type: 'weekdays', weekdays: [1, 2, 3, 4, 5] },
  { label: 'Пн Ср Пт', type: 'weekdays', weekdays: [1, 3, 5] },
  { label: 'Каждую неделю', type: 'weekly', interval: 1 },
  { label: 'Каждые 2 дня', type: 'interval', interval: 2 },
  { label: 'Каждый месяц', type: 'monthly' },
]

const weekdayLabels = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

function applyPreset(preset) {
  recurringType.value = preset.type
  recurringInterval.value = preset.interval ?? 1
  recurringWeekdays.value = preset.weekdays ?? [1, 2, 3, 4, 5]
  if (!dueDate.value) {
    dueDate.value = new Date().toISOString().slice(0, 10)
  }
}

function clearRecurring() {
  recurringType.value = null
  recurringInterval.value = 1
  recurringWeekdays.value = [1, 2, 3, 4, 5]
  recurringTime.value = ''
  recurringDuration.value = null
}

function toggleWeekday(d) {
  const idx = recurringWeekdays.value.indexOf(d)
  if (idx >= 0) {
    recurringWeekdays.value.splice(idx, 1)
  } else {
    recurringWeekdays.value.push(d)
    recurringWeekdays.value.sort()
  }
}

const isPresetActive = (p) => {
  if (recurringType.value !== p.type) return false
  if (p.weekdays && JSON.stringify(recurringWeekdays.value) !== JSON.stringify(p.weekdays)) return false
  if (p.interval && recurringInterval.value !== p.interval) return false
  if (p.weekdays || p.interval) return true
  return true
}

const recurringObject = computed(() => {
  if (!recurringType.value) return null
  const obj = { type: recurringType.value }
  if (recurringType.value === 'interval' || recurringType.value === 'weekly') {
    obj.interval = recurringInterval.value || 1
  }
  if (recurringType.value === 'weekdays' || recurringType.value === 'weekly') {
    obj.weekdays = [...recurringWeekdays.value]
  }
  if (recurringTime.value) obj.time = recurringTime.value
  if (recurringDuration.value) obj.duration = recurringDuration.value
  return obj
})

watch(() => props.task, (task) => {
  errorMsg.value = ''
  if (task) {
    isEditing.value = true
    title.value = task.title
    description.value = task.description ?? ''
    priority.value = task.priority ?? 1
    projectId.value = task.projectId ?? null
    dueDate.value = task.dueDate ? task.dueDate.slice(0, 10) : ''
    subtasks.value = task.subtasks?.map(s => ({ ...s })) ?? []
    if (task.recurring) {
      recurringType.value = task.recurring.type
      recurringInterval.value = task.recurring.interval ?? 1
      recurringWeekdays.value = task.recurring.weekdays ?? [1, 2, 3, 4, 5]
      recurringTime.value = task.recurring.time ?? ''
      recurringDuration.value = task.recurring.duration ?? null
    } else {
      clearRecurring()
    }
  } else {
    isEditing.value = false
    title.value = props.initialTitle || ''
    description.value = ''
    priority.value = 1
    projectId.value = store.activeProjectId ?? null
    dueDate.value = ''
    subtasks.value = []
    clearRecurring()
  }
  nextTick(() => titleRef.value?.focus())
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
  if (recurringObject.value && !dueDate.value) {
    errorMsg.value = 'Для повторяющейся задачи нужно указать срок'
    return
  }
  errorMsg.value = ''

  const data = {
    title: title.value.trim(),
    description: description.value.trim(),
    priority: priority.value,
    projectId: projectId.value,
    dueDate: dueDate.value || null,
    subtasks: subtasks.value,
    recurring: recurringObject.value,
  }

  if (isEditing.value) {
    store.updateTask(props.task.id, data)
  } else {
    store.addTask(data)
  }

  emit('close')
}

watch(dueDate, () => { errorMsg.value = '' })

function handleBackdropClick(e) {
  if (e.target === e.currentTarget) emit('close')
}

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
            <span v-if="errorMsg" class="field-error">{{ errorMsg }}</span>
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
          <label class="label">Повтор</label>
          <div class="recurring-presets">
            <button
              v-for="p in presets"
              :key="p.label"
              type="button"
              class="chip"
              :class="{ active: isPresetActive(p) }"
              @click="applyPreset(p)"
            >{{ p.label }}</button>
            <button
              type="button"
              class="chip"
              :class="{ active: !recurringType }"
              @click="clearRecurring"
            >Не повторять</button>
          </div>
          <template v-if="recurringType">
            <div v-if="recurringType === 'interval'" class="recurring-detail">
              <label class="sublabel">Каждые</label>
              <input
                v-model.number="recurringInterval"
                type="number"
                class="input input-sm"
                min="1"
                max="365"
              />
              <span class="sublabel">дн.</span>
            </div>
            <div v-if="recurringType === 'weekly'" class="recurring-detail">
              <label class="sublabel">Каждые</label>
              <input
                v-model.number="recurringInterval"
                type="number"
                class="input input-sm"
                min="1"
                max="52"
              />
              <span class="sublabel">нед.</span>
            </div>
            <div v-if="recurringType === 'weekdays' || recurringType === 'weekly'" class="weekday-picker">
              <button
                v-for="(label, idx) in weekdayLabels"
                :key="idx"
                type="button"
                class="weekday-btn"
                :class="{ active: recurringWeekdays.includes(idx) }"
                @click="toggleWeekday(idx)"
              >{{ label }}</button>
            </div>
            <div class="recurring-detail">
              <label class="sublabel">Время</label>
              <input v-model="recurringTime" type="time" class="input input-sm" />
              <label class="sublabel" style="margin-left:8px">Мин.</label>
              <input
                v-model.number="recurringDuration"
                type="number"
                class="input input-sm"
                min="1"
                max="480"
                placeholder="—"
              />
            </div>
          </template>
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

.field-error {
  font-size: 0.78rem;
  color: var(--priority-high);
  font-weight: 500;
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

.recurring-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
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

.recurring-detail {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}

.sublabel {
  font-size: 0.8rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.input-sm {
  width: 70px;
  padding: 6px 8px;
  font-size: 0.85rem;
}

.weekday-picker {
  display: flex;
  gap: 4px;
  margin-top: 8px;
}

.weekday-btn {
  width: 36px;
  height: 32px;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  transition: all var(--transition);
}
.weekday-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.weekday-btn.active {
  background: var(--accent);
  color: white;
}

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
