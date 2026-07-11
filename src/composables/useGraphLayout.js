import dagre from '@dagrejs/dagre'

const NODE_WIDTH = 180
const BASE_HEIGHT = 22
const LINE_HEIGHT = 17
const CHARS_PER_LINE = 16
const META_HEIGHT = 20

function estimateNodeHeight(task) {
  const lines = Math.ceil(task.title.length / CHARS_PER_LINE) || 1
  const hasMeta = !!(task.projectId || task.dueDate || (task.parentIds && task.parentIds.length > 0))
  return BASE_HEIGHT + lines * LINE_HEIGHT + (hasMeta ? META_HEIGHT : 0)
}

/**
 * Compute dagre layout positions for nodes that don't have a saved graphPos.
 * Returns a Map<id, {x, y}> with positions for ALL nodes (either from graphPos
 * or from dagre computation).
 *
 * @param {Array} tasks - store.graphTasks (task objects with graphPos / parentIds)
 * @returns {Map<string, {x, y}>}
 */
export function layoutWithDagre(tasks) {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 100 })
  g.setDefaultEdgeLabel(() => ({}))

  const heightMap = new Map()
  for (const t of tasks) {
    const h = estimateNodeHeight(t)
    heightMap.set(t.id, h)
    g.setNode(t.id, { width: NODE_WIDTH, height: h })
  }

  for (const t of tasks) {
    for (const pid of (t.parentIds ?? [])) {
      if (g.hasNode(pid)) {
        g.setEdge(pid, t.id)
      }
    }
  }

  dagre.layout(g)

  const positions = new Map()
  for (const t of tasks) {
    if (t.graphPos) {
      positions.set(t.id, t.graphPos)
    } else {
      const node = g.node(t.id)
      const h = heightMap.get(t.id) ?? BASE_HEIGHT
      if (node) {
        positions.set(t.id, {
          x: node.x - NODE_WIDTH / 2,
          y: node.y - h / 2,
        })
      } else {
        positions.set(t.id, { x: 0, y: 0 })
      }
    }
  }

  return positions
}

/**
 * Force-recompute layout for ALL nodes, ignoring saved graphPos.
 * Used by the "Auto-layout" button.
 */
export function forceLayoutWithDagre(tasks) {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 100 })
  g.setDefaultEdgeLabel(() => ({}))

  const heightMap = new Map()
  for (const t of tasks) {
    const h = estimateNodeHeight(t)
    heightMap.set(t.id, h)
    g.setNode(t.id, { width: NODE_WIDTH, height: h })
  }

  for (const t of tasks) {
    for (const pid of (t.parentIds ?? [])) {
      if (g.hasNode(pid)) {
        g.setEdge(pid, t.id)
      }
    }
  }

  dagre.layout(g)

  const positions = new Map()
  for (const t of tasks) {
    const node = g.node(t.id)
    const h = heightMap.get(t.id) ?? BASE_HEIGHT
    positions.set(t.id, node
      ? { x: node.x - NODE_WIDTH / 2, y: node.y - h / 2 }
      : { x: 0, y: 0 })
  }

  return positions
}
