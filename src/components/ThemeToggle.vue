<script setup>
defineProps({
  theme: { type: String, required: true },
})
defineEmits(['toggle'])
</script>

<template>
  <button class="theme-btn" @click="$emit('toggle')" :title="theme === 'light' ? 'Тёмная тема' : 'Светлая тема'">
    <span v-if="theme === 'light'">🌙</span>
    <span v-else>☀️</span>
  </button>
</template>

<style scoped>
.theme-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  font-size: 1.1rem;
  transition: all var(--transition);
}
.theme-btn:hover {
  background: var(--bg-hover);
}
</style>
