import { onMounted, onUnmounted } from 'vue'

export function useKeyboardShortcuts(shortcuts) {
  function handler(e) {
    const key = e.key === 'Escape' ? 'Escape' : e.key.toLowerCase()
    if (shortcuts[key]) {
      if (key !== 'escape' && isInputFocused(e)) return
      e.preventDefault()
      shortcuts[key]()
    }
  }

  function isInputFocused(e) {
    const tag = e.target.tagName
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
  }

  onMounted(() => window.addEventListener('keydown', handler))
  onUnmounted(() => window.removeEventListener('keydown', handler))
}
