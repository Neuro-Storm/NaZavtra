<script setup>
import { useTasksStore } from '../stores/tasks.js'

const store = useTasksStore()
</script>

<template>
  <div class="stats">
    <div class="stat">
      <span class="stat-value">{{ store.stats.total }}</span>
      <span class="stat-label">Всего</span>
    </div>
    <div class="stat">
      <span class="stat-value active">{{ store.stats.active }}</span>
      <span class="stat-label">Активных</span>
    </div>
    <div class="stat">
      <span class="stat-value done">{{ store.stats.completed }}</span>
      <span class="stat-label">Готово</span>
    </div>
    <div v-if="store.stats.overdue > 0" class="stat">
      <span class="stat-value overdue">{{ store.stats.overdue }}</span>
      <span class="stat-label">Просрочено</span>
    </div>
  </div>
</template>

<style scoped>
.stats {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 32px;
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.stat {
  display: flex;
  align-items: center;
  gap: 6px;
}

.stat-value {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-primary);
  background: var(--bg-tertiary);
  padding: 2px 8px;
  border-radius: 999px;
  min-width: 24px;
  text-align: center;
}
.stat-value.active { color: var(--accent); background: var(--accent-bg); }
.stat-value.done { color: var(--complete); background: var(--priority-low-bg); }
.stat-value.overdue { color: var(--priority-high); background: var(--priority-high-bg); }

.stat-label {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-weight: 500;
}
</style>
