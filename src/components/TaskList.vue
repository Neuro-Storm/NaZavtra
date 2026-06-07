<script setup>
import { useTasksStore } from '../stores/tasks.js'
import TaskCard from './TaskCard.vue'

const emit = defineEmits(['edit', 'new-task'])
const store = useTasksStore()

function handleDragEnd(evt) {
  const ids = evt.clone.map(el => el.__vueParentComponent?.props?.task?.id)
  // vuedraggable handles the DOM reorder, we just persist new order
  const ordered = [...store.filteredTasks].sort((a, b) => a.order - b.order)
  store.reorderTasks(ordered.map(t => t.id))
}
</script>

<template>
  <div class="task-list-container">
    <div class="search-bar">
      <input
        v-model="store.searchQuery"
        class="search-input"
        type="text"
        placeholder="Поиск задач..."
      />
      <div class="filter-chips">
        <button
          class="chip"
          :class="{ active: store.filterStatus === 'all' }"
          @click="store.filterStatus = 'all'"
        >Все</button>
        <button
          class="chip"
          :class="{ active: store.filterStatus === 'active' }"
          @click="store.filterStatus = 'active'"
        >Активные</button>
        <button
          class="chip"
          :class="{ active: store.filterStatus === 'completed' }"
          @click="store.filterStatus = 'completed'"
        >Завершённые</button>
        <button
          class="chip"
          :class="{ active: store.filterStatus === 'recurring' }"
          @click="store.filterStatus = 'recurring'"
        >Повторяющиеся</button>
      </div>
    </div>

    <div class="task-list">
      <div v-if="store.filteredTasks.length === 0" class="empty-state">
        <div class="empty-icon">☑️</div>
        <h3>Задач пока нет</h3>
        <p>Создайте новую задачу, чтобы начать</p>
        <button class="btn btn-primary" @click="emit('new-task')">+ Новая задача</button>
      </div>

      <TaskCard
        v-for="task in store.filteredTasks"
        :key="task.id"
        :task="task"
        @toggle="store.toggleTask(task.id)"
        @edit="emit('edit', task.id)"
        @delete="store.deleteTask(task.id)"
      />
    </div>
  </div>
</template>

<style scoped>
.task-list-container {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.search-bar {
  padding: 12px 32px 8px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  outline: none;
  transition: all var(--transition);
  font-size: 0.9rem;
}
.search-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-bg);
}
.search-input::placeholder {
  color: var(--text-secondary);
}

.filter-chips {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .search-bar {
    padding: 8px 12px;
    gap: 8px;
    flex-wrap: wrap;
  }
  .search-input {
    min-width: 0;
    width: 100%;
  }
  .filter-chips {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    width: 100%;
  }
  .filter-chips::-webkit-scrollbar {
    display: none;
  }
  .task-list {
    padding: 4px 12px 12px;
  }
  .empty-state {
    padding: 32px 16px;
  }
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

.task-list {
  padding: 8px 32px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 48px 32px;
  color: var(--text-secondary);
  text-align: center;
}
.empty-icon {
  font-size: 3rem;
}
.empty-state h3 {
  font-size: 1.1rem;
  color: var(--text-primary);
  font-weight: 600;
}
.empty-state p {
  font-size: 0.9rem;
  margin-bottom: 8px;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  font-weight: 500;
  font-size: 0.9rem;
  transition: all var(--transition);
}
.btn-primary {
  background: var(--accent);
  color: white;
}
.btn-primary:hover {
  background: var(--accent-hover);
}
</style>
