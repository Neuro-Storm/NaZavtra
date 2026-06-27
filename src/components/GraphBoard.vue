<script setup>
import { ref, computed, watch, nextTick } from 'vue'
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

// ── Node/edge sync ─────────────────────────────────────────────────────────
function buildNodes(tasks, positions) {
  return tasks.map(t => ({
    id: t.id,
    type: 'task',
    position: positions.get(t.id) ?? { x: 0, y: 0 },
    data: { task: t },
  }))
}

function buildEdges(storeEdges) {
  return storeEdges.map(e => ({
    ...e,
    type: 'smoothstep',
    animated: false,
    markerEnd: { type: 'arrowclosed', width: 18, height: 18, color: 'var(--accent)' },
    style: { stroke: 'var(--accent)', strokeWidth: 1.5 },
  }))
}

const nodes = ref([])
const edges = ref([])
let initialised = false

function syncFromStore() {
  const tasks = store.graphTasks
  const positions = layoutWithDagre(tasks)
  nodes.value = buildNodes(tasks, positions)
  edges.value = buildEdges(store.graphEdges)
}

watch(
  [() => store.graphTasks, () => store.graphEdges],
  () => {
    // Merge: keep existing positions for nodes already on canvas, recompute new ones
    const tasks = store.graphTasks
    const positions = layoutWithDagre(tasks)
    // Preserve positions of nodes already rendered (user may have dragged them)
    const existing = new Map(nodes.value.map(n => [n.id, n.position]))
    nodes.value = tasks.map(t => ({
      id: t.id,
      type: 'task',
      position: existing.has(t.id) ? existing.get(t.id) : (positions.get(t.id) ?? { x: 0, y: 0 }),
      data: { task: t },
    }))
    edges.value = buildEdges(store.graphEdges)
    if (!initialised && tasks.length > 0) {
      initialised = true
      nextTick(() => fitView({ padding: 0.2 }))
    }
  },
  { immediate: true, deep: false }
)

// ── Events ─────────────────────────────────────────────────────────────────
function onConnect({ source, target }) {
  // source = parent, target = child
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

  // Distinguish single vs double click on pane
  if (lastClickPos && now - lastClickTime < DOUBLE_CLICK_MS &&
      Math.abs(pos.x - lastClickPos.x) < 5 && Math.abs(pos.y - lastClickPos.y) < 5) {
    // double click on pane — ignore (could extend later)
    lastClickTime = 0
    lastClickPos = null
    return
  }
  lastClickTime = now
  lastClickPos = pos

  setTimeout(() => {
    if (Date.now() - lastClickTime < DOUBLE_CLICK_MS) return
    // Convert screen coords to graph coords
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

function autoLayout() {
  const tasks = store.graphTasks
  const positions = forceLayoutWithDagre(tasks)
  for (const t of tasks) {
    const pos = positions.get(t.id)
    if (pos) store.setGraphPos(t.id, pos)
  }
  nextTick(() => fitView({ padding: 0.2 }))
}

// Add existing task to graph
const showAddExisting = ref(false)
const nonGraphTasks = computed(() =>
  store.tasks.filter(t => !store.graphTaskIds.has(t.id))
)

function addExistingToGraph(id) {
  store.addTaskToGraph(id)
  showAddExisting.value = false
}

// Close add-existing dropdown on outside click
function onAddExistingKey(e) {
  if (e.key === 'Escape') showAddExisting.value = false
}
</script>

<template>
  <div class="graph-board">
    <!-- Toolbar -->
    <div class="graph-toolbar">
      <button class="tb-btn" @click="createRootNode">✚ Цель</button>
      <button class="tb-btn" @click="autoLayout">⤢ Авто-раскладка</button>
      <div class="tb-dropdown-wrap" @keydown="onAddExistingKey">
        <button class="tb-btn" @click.stop="showAddExisting = !showAddExisting">
          ＋ С доски…
        </button>
        <div v-if="showAddExisting" class="tb-dropdown" @click.stop>
          <div class="tb-dropdown-hint" v-if="nonGraphTasks.length === 0">
            Все задачи уже на доске
          </div>
          <button
            v-for="t in nonGraphTasks"
            :key="t.id"
            class="tb-dropdown-item"
            @click="addExistingToGraph(t.id)"
          >{{ t.title }}</button>
        </div>
      </div>
    </div>

    <!-- Vue Flow canvas -->
    <VueFlow
      :nodes="nodes"
      :edges="edges"
      :delete-key-code="['Delete', 'Backspace']"
      :min-zoom="0.2"
      :max-zoom="2"
      fit-view-on-init
      class="vf-canvas"
      @connect="onConnect"
      @node-drag-stop="onNodeDragStop"
      @node-double-click="onNodeDoubleClick"
      @edges-change="onEdgesChange"
      @pane-click="onPaneClick"
      @pane-mouse-down.stop
    >
      <!-- Custom task node -->
      <template #node-task="nodeProps">
        <GraphTaskNode
          :data="nodeProps.data"
          @edit="emit('edit', $event)"
        />
      </template>

      <Background pattern-color="var(--border)" :gap="24" />
      <Controls />
    </VueFlow>

    <!-- Inline new-node input (floating over canvas) -->
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
  overflow: hidden;
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

.tb-dropdown-wrap {
  position: relative;
}
.tb-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 200px;
  max-height: 260px;
  overflow-y: auto;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-lg);
  z-index: 100;
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.tb-dropdown-hint {
  font-size: 0.8rem;
  color: var(--text-secondary);
  padding: 6px 10px;
}
.tb-dropdown-item {
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  color: var(--text);
  text-align: left;
  transition: background var(--transition);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tb-dropdown-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.vf-canvas {
  flex: 1;
  min-height: 0;
}

/* Empty state (shown when no nodes) */
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

<!-- Override Vue Flow theme to match our CSS vars (not scoped) -->
<style>
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
  stroke-width: 1.5;
}
.vf-canvas .vue-flow__edge.selected .vue-flow__edge-path {
  stroke-width: 2.5;
}
.vf-canvas .vue-flow__handle {
  border-color: var(--bg);
}
</style>
