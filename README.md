# НаЗавтра

TODO-лист на Vue 3 с проектами, приоритетами, сроками, тёмной темой и AI-управлением через MCP.

## Фичи

- Создание, редактирование, удаление и завершение задач
- Проекты для группировки задач
- Приоритеты (Низкий / Средний / Высокий)
- Сроки выполнения с подсветкой просроченных
- Подзадачи с чекбоксами
- Описание с поддержкой Markdown
- Поиск и фильтрация (Все / Активные / Завершённые / Просроченные)
- Dark / Light тема
- Перемещение задач между проектами
- Статистика: всего, активных, готово, просрочено
- Горячие клавиши: `N` — новая задача, `Esc` — закрыть
- Импорт / экспорт JSON
- PWA: установка как приложение на телефон или ПК
- **MCP сервер** — AI-агенты (opencode, OpenClaw) управляют задачами через 10 инструментов
- ⚙️ **Настройки**: MCP toggle, смена порта, опциональное AES-256-GCM шифрование
- 🔀 **Синхронизация вкладок** одного браузера (storage event)

## Стек

- [Vue 3](https://vuejs.org/) (Composition API)
- [Vite](https://vitejs.dev/)
- [Pinia](https://pinia.vuejs.org/) — состояние
- [localStorage](https://developer.mozilla.org/ru/docs/Web/API/Window/localStorage) + File System — хранение данных
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) — опциональное AES-256-GCM шифрование
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) — PWA
- [MCP](https://modelcontextprotocol.io/) (Model Context Protocol) — AI-интеграция

## Данные

В режиме разработки (`npm run dev`) данные хранятся в `~/.nazavtra/data.json`
и автоматически синхронизируются с localStorage браузера.
На GitHub Pages используется только localStorage.

При включённом шифровании `data.json` шифруется AES-256-GCM через Web Crypto API.
Ключ хранится в `~/.nazavtra/.nazavtra.key` (chmod 600) и не попадает в git.

Изменения на одной вкладке автоматически применяются на всех других (storage event).

## MCP сервер

В режиме разработки Vite-плагин (`vite-plugin-nazavtra-mcp.js`) запускает
MCP-совместимый JSON-RPC endpoint на `/mcp`.

Порт по умолчанию — `5174`, можно изменить в настройках (⚙️ → Порт).
В конфигурации агента указывай актуальный порт:

### Подключение AI-агента

**opencode** — добавь в `opencode.json`:
```json
{
  "mcp": {
    "nazavtra": {
      "type": "remote",
      "url": "http://localhost:5174/mcp"
    }
  }
}
```

**OpenClaw** — укажи в интерфейсе подключения URL `http://localhost:5174/mcp`.

### Инструменты

| Инструмент | Что делает |
|-----------|-----------|
| `nazavtra_list_projects` | Список проектов |
| `nazavtra_list_tasks` | Задачи с фильтрацией (project, status: all/active/completed/overdue, search) |
| `nazavtra_get_task` | Детали задачи по ID с именем проекта |
| `nazavtra_create_task` | Создать задачу (title, priority, dueDate, project, description, subtasks) |
| `nazavtra_update_task` | Обновить поля задачи |
| `nazavtra_delete_task` | Удалить задачу |
| `nazavtra_toggle_task` | Переключить выполнение |
| `nazavtra_create_project` | Создать проект |
| `nazavtra_delete_project` | Удалить проект и все его задачи (кроме "Входящие") |
| `nazavtra_get_stats` | Статистика: total, active, completed, overdue |

Все инструменты возвращают JSON с полями `success`, `data` / `error`.

## Запуск

```bash
npm install
npm run dev
```

Открой http://localhost:5174 в браузере (или порт из настроек).

Или просто запусти `назавтра.bat` — откроется сразу в браузере без окна терминала.

## Сборка

```bash
npm run build
npm run preview
```

## Деплой на GitHub Pages

При пуше в ветку `main` GitHub Actions автоматически собирает проект
и публикует на GitHub Pages: https://neuro-storm.github.io/NaZavtra/

## Структура

```
src/
├── main.js                    # Точка входа
├── App.vue                    # Основной layout
├── style.css                  # Токены дизайна (light/dark)
├── stores/tasks.js            # Хранилище задач и проектов
├── composables/
│   ├── useTheme.js
│   ├── useKeyboardShortcuts.js
│   └── useSettings.js         # Настройки (MCP, порт, шифрование)
└── components/
    ├── Sidebar.vue            # Проекты, импорт/экспорт
    ├── TaskList.vue           # Поиск, фильтры, список
    ├── TaskCard.vue           # Карточка задачи
    ├── TaskForm.vue           # Модалка создания/редактирования
    ├── ThemeToggle.vue        # Переключатель темы
    ├── StatsPanel.vue         # Статистика
    └── SettingsPage.vue       # Модалка настроек
vite-plugin-nazavtra-mcp.js    # MCP сервер (Vite plugin)
```
