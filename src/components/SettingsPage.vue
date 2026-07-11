<script setup>
import { ref, onMounted } from 'vue'
import { useTasksStore } from '../stores/tasks.js'
import { useSettings } from '../composables/useSettings.js'

const emit = defineEmits(['close'])
const store = useTasksStore()
const { settings } = useSettings()

const fileInput = ref(null)
const encryptedOnDisk = ref(false)
const isDev = import.meta.env.DEV

onMounted(async () => {
  if (isDev) {
    try {
      const res = await fetch('/api/settings')
      if (res.ok) {
        const data = await res.json()
        encryptedOnDisk.value = !!data.encryptedOnDisk
      }
    } catch {}
  }
})

function handleBackdropClick(e) {
  if (e.target === e.currentTarget) emit('close')
}

function triggerImport() {
  fileInput.value?.click()
}

function handleImport(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    store.importData(reader.result)
  }
  reader.readAsText(file)
  e.target.value = ''
}

const dataPath = isDev ? '~/.nazavtra/data.json' : 'localStorage'

const updateStatus = ref('')
async function checkForUpdates() {
  updateStatus.value = ''
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (!reg) {
      updateStatus.value = 'Service Worker недоступен'
      return
    }
    await reg.update()
    updateStatus.value = 'Проверка завершена. Обновления применятся при перезагрузке.'
  } catch {
    updateStatus.value = 'Не удалось проверить обновления'
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="settings-backdrop" @click="handleBackdropClick">
      <div class="settings-modal">
        <div class="settings-header">
          <h2>⚙️ Настройки</h2>
          <button class="close-btn" @click="emit('close')">✕</button>
        </div>

        <div class="settings-body">
          <!-- Синхронизация -->
          <section class="settings-section">
            <h3 class="section-title">🔀 Синхронизация</h3>
            <div class="info-row">
              <span class="status-dot online" />
              <span>Вкладки одного браузера синхронизируются автоматически</span>
            </div>
            <p class="hint" v-if="isDev">
              Для синхронизации между компьютерами — помести папку <code>.nazavtra</code> в Google Drive / Dropbox
            </p>
          </section>

          <!-- Шифрование -->
          <section class="settings-section">
            <h3 class="section-title">🔒 Шифрование файла данных</h3>
            <div class="field-row">
              <label class="toggle-label">
                <span>Шифровать data.json</span>
                <input type="checkbox" v-model="settings.encryptEnabled" class="toggle" />
              </label>
            </div>
            <div v-if="isDev" class="info-row">
              <span :class="['status-dot', encryptedOnDisk ? 'online' : 'offline']" />
              <span v-if="encryptedOnDisk">Файл зашифрован (AES-256-GCM)</span>
              <span v-else>Файл не зашифрован</span>
            </div>
            <p class="hint">Ключ: из переменной NAZAVTRA_KEY или файла ~/.nazavtra/key</p>
          </section>

          <!-- MCP -->
          <section class="settings-section">
            <h3 class="section-title">🤖 MCP сервер</h3>
            <div class="field-row">
              <label class="toggle-label">
                <span>Включён</span>
                <input type="checkbox" v-model="settings.mcpEnabled" class="toggle" />
              </label>
            </div>
            <p class="hint">Эндпоинт: http://localhost:{{ settings.port }}/mcp</p>
            <div class="field">
              <label class="label">Порт</label>
              <input type="number" v-model.number="settings.port" class="input port-input" min="1024" max="65535" />
              <p class="hint">Изменение вступит в силу после перезапуска сервера</p>
            </div>
          </section>

          <!-- Данные -->
          <section class="settings-section">
            <h3 class="section-title">💾 Данные</h3>
            <div class="btn-row">
              <button class="btn" @click="store.exportData">📤 Экспорт JSON</button>
              <button class="btn" @click="triggerImport">📥 Импорт JSON</button>
              <input ref="fileInput" type="file" accept=".json" hidden @change="handleImport" />
            </div>
          </section>

          <!-- Обновление -->
          <section class="settings-section">
            <h3 class="section-title">🔄 Обновление</h3>
            <div class="btn-row">
              <button class="btn" @click="checkForUpdates">🔄 Проверить обновления</button>
            </div>
            <p v-if="updateStatus" class="hint">{{ updateStatus }}</p>
            <p class="hint">Приложение обновляется автоматически при перезагрузке страницы</p>
          </section>

          <!-- О программе -->
          <section class="settings-section">
            <h3 class="section-title">ℹ️ О программе</h3>
            <p class="about-text">НаЗавтра v1.0</p>
            <p class="about-text">Хранилище: {{ dataPath }}</p>
          </section>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.settings-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 16px;
  backdrop-filter: blur(2px);
}

.settings-modal {
  background: var(--bg);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  width: 100%;
  max-width: 520px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px 0;
}
.settings-header h2 {
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  font-size: 1.3rem;
  color: var(--text-secondary);
  transition: all var(--transition);
}
.close-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.settings-body {
  padding: 20px 24px 24px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.settings-section {
  padding: 16px 0;
  border-bottom: 1px solid var(--border);
}
.settings-section:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.section-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
}

.info-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.9rem;
  color: var(--text);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.status-dot.online {
  background: var(--priority-low);
  box-shadow: 0 0 4px var(--priority-low);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}
.field:last-child {
  margin-bottom: 0;
}

.field-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg);
  outline: none;
  transition: border-color var(--transition);
  font-size: 0.9rem;
}
.input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-bg);
}

select.input {
  cursor: pointer;
}

.port-input {
  max-width: 120px;
}

.hint {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-top: 4px;
}
.hint code {
  font-family: monospace;
  background: var(--bg-secondary);
  padding: 1px 4px;
  border-radius: 3px;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  color: var(--text-primary);
}

.toggle {
  width: 36px;
  height: 20px;
  appearance: none;
  background: var(--border);
  border-radius: 10px;
  position: relative;
  cursor: pointer;
  transition: background var(--transition);
  flex-shrink: 0;
}
.toggle::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  background: white;
  border-radius: 50%;
  transition: transform var(--transition);
}
.toggle:checked {
  background: var(--accent);
}
.toggle:checked::after {
  transform: translateX(16px);
}

.btn-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  font-weight: 500;
  font-size: 0.9rem;
  transition: all var(--transition);
  border: 1px solid var(--border);
  color: var(--text);
  background: var(--bg);
}
.btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.btn-sm {
  padding: 6px 12px;
  font-size: 0.8rem;
}

.about-text {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

@media (max-width: 640px) {
  .settings-backdrop {
    padding: 0;
    backdrop-filter: none;
    background: var(--bg);
  }
  .settings-modal {
    max-width: none;
    max-height: none;
    height: 100dvh;
    border-radius: 0;
    box-shadow: none;
  }
  .settings-header {
    padding: 16px 20px 0;
  }
  .settings-body {
    padding: 16px 20px 20px;
  }
}
</style>
