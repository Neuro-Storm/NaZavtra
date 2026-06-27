import dagre from '@dagrejs/dagre'

const NODE_WIDTH = 180
const NODE_HEIGHT = 64

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
  g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 60 })
  g.setDefaultEdgeLabel(() => ({}))

  for (const t of tasks) {
    g.setNode(t.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
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
      if (node) {
        positions.set(t.id, {
          x: node.x - NODE_WIDTH / 2,
          y: node.y - NODE_HEIGHT / 2,
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
  g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 60 })
  g.setDefaultEdgeLabel(() => ({}))

  for (const t of tasks) {
    g.setNode(t.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
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
    positions.set(t.id, node
      ? { x: node.x - NODE_WIDTH / 2, y: node.y - NODE_HEIGHT / 2 }
      : { x: 0, y: 0 })
  }

  return positions
}
