import { ref, watch } from 'vue'

const THEME_KEY = 'todo-theme'

export function useTheme() {
  const theme = ref(localStorage.getItem(THEME_KEY) ?? 'light')

  function setTheme(t) {
    theme.value = t
    localStorage.setItem(THEME_KEY, t)
    document.documentElement.setAttribute('data-theme', t)
  }

  function toggle() {
    setTheme(theme.value === 'light' ? 'dark' : 'light')
  }

  watch(theme, (t) => {
    document.documentElement.setAttribute('data-theme', t)
  }, { immediate: true })

  return { theme, toggle }
}
