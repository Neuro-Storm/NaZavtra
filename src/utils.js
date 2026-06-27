export function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
}

export function now() {
  return new Date().toISOString()
}

export function getNextDueDate(task) {
  if (!task.recurring || !task.dueDate) return null
  const d = new Date(task.dueDate + 'T00:00:00Z')
  const r = task.recurring

  if (r.type === 'daily') {
    d.setUTCDate(d.getUTCDate() + 1)
  } else if (r.type === 'interval') {
    d.setUTCDate(d.getUTCDate() + (r.interval || 1))
  } else if (r.type === 'weekdays') {
    const days = r.weekdays?.length ? r.weekdays : [1, 2, 3, 4, 5]
    for (let i = 1; i <= 7; i++) {
      const next = new Date(d)
      next.setUTCDate(d.getUTCDate() + i)
      if (days.includes(next.getUTCDay())) return next.toISOString().slice(0, 10)
    }
  } else if (r.type === 'weekly') {
    d.setUTCDate(d.getUTCDate() + 7 * (r.interval || 1))
  } else if (r.type === 'monthly') {
    const day = d.getUTCDate()
    const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 2, 0)).getUTCDate()
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, Math.min(day, lastDay)))
      .toISOString().slice(0, 10)
  }
  return d.toISOString().slice(0, 10)
}