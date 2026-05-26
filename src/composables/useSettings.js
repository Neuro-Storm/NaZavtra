import { reactive, watch } from 'vue'

const SETTINGS_KEY = 'todo-settings'

const defaults = {
  firebaseConfig: null,
  firebaseEnabled: false,
  mcpEnabled: true,
  port: 5174,
  encryptEnabled: false,
}

function loadRaw() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveRaw(data) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(data))
}

function syncToServer(data) {
  if (import.meta.env.DEV) {
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).catch(() => {})
  }
}

export function useSettings() {
  const raw = loadRaw()
  const settings = reactive({ ...defaults, ...raw })

  let saving = false
  watch(
    () => ({ ...settings }),
    (val) => {
      if (saving) return
      saving = true
      saveRaw(val)
      syncToServer(val)
      saving = false
    },
    { deep: true }
  )

  function updateSettings(patch) {
    Object.assign(settings, patch)
  }

  return { settings, updateSettings }
}
