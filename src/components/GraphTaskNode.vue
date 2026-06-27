<script setup>
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { useTasksStore } from '../stores/tasks.js'

const props = defineProps({
  data: { type: Object, required: true },
})

const emit = defineEmits(['edit'])

const store = useTasksStore()
const task = computed(() => props.data.task)

const project = computed(() =>
  store.projects.find(p => p.id === task.value.projectId)
)

const childCount = computed(() =>
  store.tasks.filter(t => t.parentIds?.includes(task.value.id)).length
)

const priorityClass = ['low', 'medium', 'high']
const priorityColors = ['#6b7280', '#f59e0b', '#ef4444']

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
  <div class="graph-node" :class="{ completed: task.completed }">
    <!-- Target handle (incoming edges from parent) -->
    <Handle type="target" :position="Position.Top" class="graph-handle" />

    <div class="node-inner">
      <label class="node-check" @click.stop>
        <input type="checkbox" :checked="task.completed" @change="toggle" />
        <span class="checkmark" />
      </label>

      <div class="node-body" @dblclick.stop="emit('edit', task.id)">
        <div class="node-title" :class="{ done: task.completed }">{{ task.title }}</div>
        <div class="node-meta">
          <span
            v-if="project"
            class="node-badge project-dot"
            :style="{ background: project.color }"
          />
          <span
            v-if="task.priority !== undefined"
            class="node-priority"
            :style="{ background: priorityColors[task.priority] }"
          />
          <span v-if="childCount > 0" class="node-badge child-count">
            {{ childCount }} ↓
          </span>
          <span v-if="task.dueDate" class="node-badge due-badge">
            {{ task.dueDate.slice(5) }}
          </span>
        </div>
      </div>

      <button class="node-remove" @click.stop="removeFromGraph" title="Убрать с доски">×</button>
    </div>

    <!-- Source handle (outgoing edges to children) -->
    <Handle type="source" :position="Position.Bottom" class="graph-handle" />
  </div>
</template>

<style scoped>
.graph-node {
  width: 180px;
  min-height: 64px;
  background: var(--bg);
  border: 1.5px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  transition: border-color var(--transition), box-shadow var(--transition);
  position: relative;
  cursor: default;
}
.graph-node:hover {
  border-color: var(--accent);
  box-shadow: var(--shadow-lg);
}
.graph-node.completed {
  opacity: 0.55;
  background: var(--bg-secondary);
}

.node-inner {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  padding: 10px 10px 8px;
}

.node-check {
  position: relative;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-top: 2px;
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
  border-radius: 3px;
  transition: all var(--transition);
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
  font-size: 0.82rem;
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
  margin-top: 4px;
  flex-wrap: wrap;
}

.node-badge {
  font-size: 0.68rem;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 999px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.project-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  padding: 0;
}

.node-priority {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.child-count {
  background: var(--accent-bg);
  color: var(--accent);
}

.due-badge {
  background: var(--bg-tertiary);
}

.node-remove {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  border-radius: 3px;
  font-size: 1rem;
  line-height: 1;
  color: var(--text-secondary);
  opacity: 0;
  transition: opacity var(--transition);
  display: flex;
  align-items: center;
  justify-content: center;
}
.graph-node:hover .node-remove {
  opacity: 0.5;
}
.node-remove:hover {
  opacity: 1 !important;
  color: var(--priority-high);
  background: var(--priority-high-bg);
}

.graph-handle {
  width: 10px;
  height: 10px;
  background: var(--accent);
  border: 2px solid var(--bg);
  border-radius: 50%;
  opacity: 0;
  transition: opacity var(--transition);
}
.graph-node:hover .graph-handle {
  opacity: 1;
}
</style>
