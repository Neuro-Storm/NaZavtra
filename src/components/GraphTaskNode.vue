<script setup>
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { useTasksStore } from '../stores/tasks.js'
import { localDateStr } from '../utils.js'

const props = defineProps({
  data: { type: Object, required: true },
})

const emit = defineEmits(['edit'])

const store = useTasksStore()
// Read directly from reactive store so any store mutation (toggle, edit)
// is immediately reflected without relying on VueFlow to propagate slot props.
const task = computed(() => store.tasks.find(t => t.id === props.data.task.id) ?? props.data.task)

const project = computed(() =>
  store.projects.find(p => p.id === task.value.projectId)
)

const childCount = computed(() =>
  store.tasks.filter(t => t.parentIds?.includes(task.value.id)).length
)

// Priority: 0=low(grey), 1=medium(amber), 2=high(red)
const priorityColors = ['#6b7280', '#f59e0b', '#ef4444']
const priorityColor = computed(() => priorityColors[task.value.priority ?? 1])

const isOverdue = computed(() => {
  if (!task.value.dueDate || task.value.completed) return false
  return task.value.dueDate.slice(0, 10) < localDateStr(new Date())
})

const isMeta = computed(() => task.value.type === 'meta')

const dueDateFormatted = computed(() => {
  if (!task.value.dueDate) return null
  return task.value.dueDate.slice(5).replace('-', '.')
})

function toggle() {
  store.toggleTask(task.value.id)
}

function removeFromGraph() {
  const hasChildren = childCount.value > 0
  const hasParents = task.value.parentIds?.length > 0
  const msg = (hasChildren || hasParents)
    ? `Убрать «${task.value.title}» с доски? Все связи будут удалены.`
    : `Убрать «${task.value.title}» с доски?`
  if (confirm(msg)) {
    store.removeTaskFromGraph(task.value.id)
  }
}
</script>

<template>
  <div
    class="graph-node"
    :class="{ completed: task.completed, 'is-meta': isMeta }"
    :style="isMeta && task.color ? { '--meta-color': task.color, '--meta-bg': task.color + '22' } : {}"
  >
    <!-- Priority colour stripe -->
    <div v-if="!isMeta" class="priority-stripe" :style="{ background: priorityColor }" />

    <!-- Incoming connection handle -->
    <Handle type="target" :position="Position.Top" class="graph-handle" />

    <div class="node-inner">
      <!-- Checkbox (hidden for meta-goals) -->
      <label v-if="!isMeta" class="node-check" @click.stop>
        <input type="checkbox" :checked="task.completed" @change="toggle" />
        <span class="checkmark" />
      </label>

      <!-- Content -->
      <div class="node-body" @dblclick.stop="emit('edit', task.id)">
        <div class="node-title" :class="{ done: task.completed }">
          <span v-if="isMeta" class="meta-icon">🎯</span>{{ task.title }}
        </div>
        <div class="node-meta" v-if="!isMeta && (project || childCount > 0 || task.dueDate)">
          <span
            v-if="project"
            class="meta-dot"
            :style="{ background: project.color }"
            :title="project.name"
          />
          <span v-if="childCount > 0" class="meta-chip children-chip">
            {{ childCount }} ↓
          </span>
          <span
            v-if="task.dueDate"
            class="meta-chip due-chip"
            :class="{ overdue: isOverdue }"
          >{{ dueDateFormatted }}</span>
        </div>
        <div class="node-meta" v-if="isMeta && childCount > 0">
          <span class="meta-chip children-chip">{{ childCount }} ↓</span>
        </div>
      </div>

      <!-- Remove button -->
      <button class="node-remove" @click.stop="removeFromGraph" title="Убрать с доски">×</button>
    </div>

    <!-- Outgoing connection handle -->
    <Handle type="source" :position="Position.Bottom" class="graph-handle" />
  </div>
</template>

<style scoped>
.graph-node {
  width: 180px;
  min-height: 64px;
  background: var(--bg);
  border: 1.5px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  transition: border-color var(--transition), box-shadow var(--transition), opacity var(--transition);
  position: relative;
  overflow: hidden;
  cursor: default;
}
.graph-node:hover {
  border-color: var(--accent);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12), 0 0 0 3px var(--accent-bg);
}
.graph-node.completed {
  opacity: 0.45;
}

/* Meta-goal styling */
.graph-node.is-meta {
  border-radius: 999px;
  border: 2px solid var(--meta-color, var(--accent));
  background: var(--meta-bg, var(--accent-bg));
}
.graph-node.is-meta:hover {
  border-color: var(--meta-color, var(--accent));
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12), 0 0 0 3px var(--meta-bg, var(--accent-bg));
}
.meta-icon {
  margin-right: 3px;
}

/* Priority colour strip at top */
.priority-stripe {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  border-radius: 10px 10px 0 0;
}

.node-inner {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 14px 8px 8px 10px; /* top padding accounts for stripe */
}

/* Circle checkbox */
.node-check {
  position: relative;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-top: 1px;
  cursor: pointer;
}
.node-check input {
  position: absolute;
  opacity: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
}
.checkmark {
  position: absolute;
  inset: 0;
  border: 2px solid var(--border);
  border-radius: 50%;
  transition: all var(--transition);
}
.node-check:hover .checkmark {
  border-color: var(--complete);
}
.node-check input:checked + .checkmark {
  background: var(--complete);
  border-color: var(--complete);
}
.node-check input:checked + .checkmark::after {
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

.node-body {
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.node-title {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.35;
  word-break: break-word;
}
.node-title.done {
  text-decoration: line-through;
  color: var(--text-secondary);
}

.node-meta {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 5px;
  flex-wrap: wrap;
}

.meta-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  display: inline-block;
}

.meta-chip {
  font-size: 0.66rem;
  font-weight: 600;
  padding: 2px 5px;
  border-radius: 999px;
}

.children-chip {
  background: var(--accent-bg);
  color: var(--accent);
}

.due-chip {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}
.due-chip.overdue {
  background: rgba(239, 68, 68, 0.12);
  color: var(--priority-high);
}

/* Remove button */
.node-remove {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  font-size: 1rem;
  line-height: 1;
  color: var(--text-secondary);
  opacity: 0;
  transition: opacity var(--transition), background var(--transition);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 0;
}
.graph-node:hover .node-remove {
  opacity: 0.5;
}
.node-remove:hover {
  opacity: 1 !important;
  color: var(--priority-high);
  background: rgba(239, 68, 68, 0.12);
}

/* Connection handles — visible on hover */
.graph-handle {
  width: 12px;
  height: 12px;
  background: var(--accent);
  border: 2.5px solid var(--bg);
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.15s, transform 0.15s;
}
.graph-node:hover .graph-handle {
  opacity: 1;
}
.graph-node:hover .graph-handle:hover {
  transform: scale(1.3);
}
</style>
