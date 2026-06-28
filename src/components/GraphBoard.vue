<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { VueFlow, useVueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { useTasksStore } from '../stores/tasks.js'
import { layoutWithDagre, forceLayoutWithDagre } from '../composables/useGraphLayout.js'
import GraphTaskNode from './GraphTaskNode.vue'

const emit = defineEmits(['edit'])
const store = useTasksStore()

// ── VueFlow instance ───────────────────────────────────────────────────────
const { project, fitView } = useVueFlow()

// ── Hide-completed filter (#9) ─────────────────────────────────────────────
const hideCompleted = ref(false)

const visibleTasks = computed(() =>
  hideCompleted.value
    ? store.graphTasks.filter(t => !t.completed)
    : store.graphTasks
)

const visibleTaskIds = computed(() => new Set(visibleTasks.value.map(t => t.id)))

const visibleEdges = computed(() =>
  store.graphEdges.filter(
    e => visibleTaskIds.value.has(e.source) && visibleTaskIds.value.has(e.target)
  )
)

// ── Node/edge state ────────────────────────────────────────────────────────
const nodes = ref([])
const edges = ref([])
let initialised = false

function buildEdges(storeEdges) {
  return storeEdges.map(e => ({
    ...e,
    type: 'smoothstep',
    animated: false,
    markerEnd: { type: 'arrowclosed', width: 20, height: 20, color: 'var(--accent)' },
    style: { stroke: 'var(--accent)', strokeWidth: 2 },
    selectable: true,
  }))
}

// ── Watch #1: ID-set changes → add/remove nodes (no position jitter) (#2/#7)
watch(
  () => visibleTasks.value.map(t => t.id).sort().join(','),
  () => {
    const tasks = visibleTasks.value
    const taskIds = new Set(tasks.map(t => t.id))
    const existingIds = new Set(nodes.value.map(n => n.id))

    // Remove nodes that left visible set
    const removedIds = [...existingIds].filter(id => !taskIds.has(id))
    if (removedIds.length > 0) {
      nodes.value = nodes.value.filter(n => !removedIds.includes(n.id))
    }

    // Add new nodes
    const newTasks = tasks.filter(t => !existingIds.has(t.id))
    if (newTasks.length > 0) {
      // Run dagre once for position assignment
      const dagrePositions = layoutWithDagre(tasks)
      for (const t of newTasks) {
        const pos = t.graphPos ?? dagrePositions.get(t.id) ?? { x: 0, y: 0 }
        nodes.value.push({
          id: t.id,
          type: 'task',
          position: { x: pos.x, y: pos.y },
          data: { task: t },
        })
        // Persist dagre-computed positions so they become sticky
        if (!t.graphPos) {
          store.setGraphPos(t.id, pos)
        }
      }
    }

    // fitView once on first non-empty render
    if (!initialised && nodes.value.length > 0) {
      initialised = true
      nextTick(() => fitView({ padding: 0.2 }))
    }
  },
  { immediate: true }
)

// ── Watch #2: task data changes (toggle/edit) → update node.data only (#7)
watch(
  () => store.graphTasks,
  (tasks) => {
    if (nodes.value.length === 0) return
    const taskMap = new Map(tasks.map(t => [t.id, t]))
    for (let i = 0; i < nodes.value.length; i++) {
      const node = nodes.value[i]
      const t = taskMap.get(node.id)
      if (t && t !== node.data.task) {
        // Replace node object (preserves position) so Vue detects change
        nodes.value[i] = { ...node, data: { task: t } }
      }
    }
  }
)

// ── Watch #3: edge set changes ─────────────────────────────────────────────
watch(
  visibleEdges,
  () => { edges.value = buildEdges(visibleEdges.value) },
  { immediate: true }
)

// ── Events ─────────────────────────────────────────────────────────────────
function onConnect({ source, target }) {
  const ok = store.addParentLink(target, source)
  if (!ok) {
    alert('Нельзя создать связь: получится цикл или связь уже существует.')
  }
}

function onNodeDragStop({ node }) {
  store.setGraphPos(node.id, node.position)
}

function onNodeDoubleClick({ node }) {
  emit('edit', node.id)
}

// #1 — Edge click → confirm delete
function onEdgeClick({ edge }) {
  if (confirm('Удалить связь?')) {
    store.removeParentLink(edge.target, edge.source)
  }
}

// #1 — Delete key on selected edge
function onEdgesChange(changes) {
  for (const ch of changes) {
    if (ch.type === 'remove') {
      const edge = store.graphEdges.find(e => e.id === ch.id)
      if (edge) store.removeParentLink(edge.target, edge.source)
    }
  }
}

// ── Pane click → create node ───────────────────────────────────────────────
const newNodeInput = ref(null)
const newNodePos = ref({ x: 0, y: 0 })
const newNodeTitle = ref('')
const showNewNodeInput = ref(false)
const newNodeScreenPos = ref({ x: 0, y: 0 })

let lastClickTime = 0
let lastClickPos = null
const DOUBLE_CLICK_MS = 300

function onPaneClick(e) {
  const now = Date.now()
  const pos = { x: e.clientX, y: e.clientY }

  if (lastClickPos && now - lastClickTime < DOUBLE_CLICK_MS &&
      Math.abs(pos.x - lastClickPos.x) < 5 && Math.abs(pos.y - lastClickPos.y) < 5) {
    lastClickTime = 0
    lastClickPos = null
    return
  }
  lastClickTime = now
  lastClickPos = pos

  setTimeout(() => {
    if (Date.now() - lastClickTime < DOUBLE_CLICK_MS) return
    const graphPos = project({ x: e.clientX, y: e.clientY })
    newNodePos.value = graphPos
    newNodeScreenPos.value = { x: e.clientX, y: e.clientY }
    newNodeTitle.value = ''
    showNewNodeInput.value = true
    nextTick(() => newNodeInput.value?.focus())
  }, DOUBLE_CLICK_MS + 10)
}

function confirmNewNode() {
  const title = newNodeTitle.value.trim()
  if (title) {
    store.createGraphTask({ title, pos: newNodePos.value })
  }
  cancelNewNode()
}

function cancelNewNode() {
  showNewNodeInput.value = false
  newNodeTitle.value = ''
}

// ── Toolbar actions ────────────────────────────────────────────────────────
function createRootNode() {
  store.createGraphTask({ title: 'Новая цель', pos: { x: 200, y: 80 } })
}

// #2 — Auto-layout: force dagre positions → write directly to nodes + persist
function autoLayout() {
  const tasks = visibleTasks.value
  if (tasks.length === 0) return
  const positions = forceLayoutWithDagre(tasks)
  nodes.value = nodes.value.map(node => {
    const pos = positions.get(node.id)
    if (pos) {
      store.setGraphPos(node.id, pos)
      return { ...node, position: { x: pos.x, y: pos.y } }
    }
    return node
  })
  nextTick(() => fitView({ padding: 0.2 }))
}

// ── #3 — Add existing task: Teleport dropdown ─────────────────────────────
const showAddExisting = ref(false)
const addExistingBtn = ref(null)

const nonGraphTasks = computed(() =>
  store.tasks.filter(t => !store.graphTaskIds.has(t.id) && !t.completed)
)

function toggleAddExisting() {
  showAddExisting.value = !showAddExisting.value
}

function addExistingToGraph(id) {
  store.addTaskToGraph(id)
  showAddExisting.value = false
}

function onAddExistingKey(e) {
  if (e.key === 'Escape') showAddExisting.value = false
}

function onOutsideClick(e) {
  if (
    showAddExisting.value &&
    !e.target.closest?.('.tb-add-wrapper')
  ) {
    showAddExisting.value = false
  }
}

onMounted(() => document.addEventListener('click', onOutsideClick))
onUnmounted(() => document.removeEventListener('click', onOutsideClick))
</script>

<template>
  <div class="graph-board">
    <!-- Toolbar -->
    <div class="graph-toolbar">
      <button class="tb-btn" @click="createRootNode">✚ Цель</button>
      <button class="tb-btn" @click="autoLayout">⤢ Авто-раскладка</button>
      <div class="tb-add-wrapper">
        <button
          ref="addExistingBtn"
          class="tb-btn"
          @click.stop="toggleAddExisting"
        >＋ С доски…</button>
        <div
          v-if="showAddExisting"
          class="tbd-dropdown"
          @keydown="onAddExistingKey"
          @click.stop
        >
          <div v-if="nonGraphTasks.length === 0" class="tbd-hint">
            Все задачи уже на доске
          </div>
          <button
            v-for="t in nonGraphTasks"
            :key="t.id"
            type="button"
            class="tbd-item"
            @click="addExistingToGraph(t.id)"
          >{{ t.title }}</button>
        </div>
      </div>
      <!-- #9 — Hide completed toggle -->
      <button
        class="tb-btn"
        :class="{ active: hideCompleted }"
        @click="hideCompleted = !hideCompleted"
        :title="hideCompleted ? 'Показать завершённые' : 'Скрыть завершённые'"
      >{{ hideCompleted ? '👁 Завершённые скрыты' : '👁 Скрыть завершённые' }}</button>
    </div>

    <!-- Vue Flow canvas -->
    <VueFlow
      :nodes="nodes"
      :edges="edges"
      :delete-key-code="['Delete', 'Backspace']"
      :elements-selectable="true"
      :min-zoom="0.2"
      :max-zoom="2"
      fit-view-on-init
      class="vf-canvas"
      @connect="onConnect"
      @node-drag-stop="onNodeDragStop"
      @node-double-click="onNodeDoubleClick"
      @edge-click="onEdgeClick"
      @edges-change="onEdgesChange"
      @pane-click="onPaneClick"
      @pane-mouse-down.stop
    >
      <template #node-task="nodeProps">
        <GraphTaskNode
          :data="nodeProps.data"
          @edit="emit('edit', $event)"
        />
      </template>

      <Background pattern-color="var(--border)" :gap="24" />
      <Controls />
    </VueFlow>

    <!-- Inline new-node input -->
    <Teleport to="body">
      <div
        v-if="showNewNodeInput"
        class="new-node-overlay"
        @click.self="cancelNewNode"
      >
        <div
          class="new-node-input-wrap"
          :style="{ left: newNodeScreenPos.x + 'px', top: newNodeScreenPos.y + 'px' }"
        >
          <input
            ref="newNodeInput"
            v-model="newNodeTitle"
            class="new-node-input"
            placeholder="Название цели..."
            @keyup.enter="confirmNewNode"
            @keyup.escape="cancelNewNode"
          />
          <button class="new-node-ok" @click="confirmNewNode">✓</button>
        </div>
      </div>
    </Teleport>

    <!-- Empty state -->
    <div v-if="nodes.length === 0" class="graph-empty">
      <div class="graph-empty-icon">🗺️</div>
      <h3>Карта целей пуста</h3>
      <p>Нажмите «✚ Цель» чтобы добавить первую цель,<br>или кликните прямо на доске</p>
    </div>
  </div>
</template>

<style scoped>
.graph-board {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  min-height: 0;
}

.graph-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  background: var(--bg-secondary);
  z-index: 10;
  flex-wrap: wrap;
}

.tb-btn {
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  transition: all var(--transition);
  white-space: nowrap;
}
.tb-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.tb-btn.active {
  background: var(--accent-bg);
  color: var(--accent);
}

.vf-canvas {
  flex: 1;
  min-height: 0;
}

/* Add-existing dropdown — inline, no Teleport */
.tb-add-wrapper {
  position: relative;
}

.tbd-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 220px;
  max-width: 320px;
  max-height: 300px;
  overflow-y: auto;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-lg);
  z-index: 9999;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tbd-hint {
  font-size: 0.85rem;
  color: var(--text-secondary);
  padding: 8px 12px;
}

.tbd-item {
  flex-shrink: 0; /* prevent flex container from squashing items to slivers */
  display: block;
  width: 100%;
  box-sizing: border-box;
  padding: 7px 12px;
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.5;
  color: var(--text-primary);
  background: transparent;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  transition: background var(--transition);
}
.tbd-item:hover {
  background: var(--bg-hover);
}
.tbd-item:focus-visible {
  background: var(--bg-hover);
  outline: none;
}

/* Empty state */
.graph-empty {
  position: absolute;
  inset: 60px 0 0 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-secondary);
  text-align: center;
  pointer-events: none;
}
.graph-empty-icon { font-size: 3rem; }
.graph-empty h3 { font-size: 1.1rem; color: var(--text-primary); font-weight: 600; }
.graph-empty p { font-size: 0.9rem; line-height: 1.5; }

/* Inline new-node input */
.new-node-overlay {
  position: fixed;
  inset: 0;
  z-index: 999;
}
.new-node-input-wrap {
  position: fixed;
  transform: translate(-50%, -50%);
  display: flex;
  gap: 4px;
  background: var(--bg);
  border: 1.5px solid var(--accent);
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  padding: 6px 8px;
  z-index: 1000;
}
.new-node-input {
  width: 200px;
  font-size: 0.9rem;
  outline: none;
  background: transparent;
  color: var(--text-primary);
}
.new-node-ok {
  font-size: 1rem;
  color: var(--accent);
  padding: 0 4px;
  border-radius: 3px;
  transition: background var(--transition);
}
.new-node-ok:hover {
  background: var(--accent-bg);
}
</style>

<!-- VueFlow theme overrides (global, not scoped) -->
<style>
/* Override Vue Flow theme */
.vf-canvas .vue-flow__background {
  background: var(--bg-secondary);
}
.vf-canvas .vue-flow__controls {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-sm);
}
.vf-canvas .vue-flow__controls-button {
  background: var(--bg);
  border-color: var(--border);
  color: var(--text-secondary);
}
.vf-canvas .vue-flow__controls-button:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.vf-canvas .vue-flow__edge-path {
  stroke: var(--accent);
  stroke-width: 2;
}
.vf-canvas .vue-flow__edge.selected .vue-flow__edge-path,
.vf-canvas .vue-flow__edge:hover .vue-flow__edge-path {
  stroke-width: 3;
  cursor: pointer;
}
.vf-canvas .vue-flow__handle {
  border-color: var(--bg);
}
</style>
