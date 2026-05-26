# НаЗавтра

TODO-лист на Vue 3 с проектами, приоритетами, сроками и тёмной темой.

## Фичи

- Создание, редактирование, удаление и завершение задач
- Проекты для группировки задач
- Приоритеты (Низкий / Средний / Высокий)
- Сроки выполнения с подсветкой просроченных
- Подзадачи с чекбоксами
- Описание с поддержкой Markdown
- Поиск и фильтрация (Все / Активные / Завершённые)
- Dark / Light тема
- Перемещение задач между проектами
- Статистика: всего, активных, готово, просрочено
- Горячие клавиши: `N` — новая задача, `Esc` — закрыть
- Импорт / экспорт JSON
- PWA: установка как приложение на телефон или ПК

## Стек

- [Vue 3](https://vuejs.org/) (Composition API)
- [Vite](https://vitejs.dev/)
- [Pinia](https://pinia.vuejs.org/) — состояние
- [localStorage](https://developer.mozilla.org/ru/docs/Web/API/Window/localStorage) — хранение данных
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) — PWA

## Запуск

```bash
npm install
npm run dev
```

Открой http://localhost:5174 в браузере.

Или просто запусти `назавтра.bat` — откроется сразу в браузере.

## Сборка

```bash
npm run build
npm run preview
```

## Деплой на GitHub Pages

При пуше в ветку `main` GitHub Actions автоматически собирает проект и публикует на GitHub Pages.

## Структура

```
src/
├── main.js              # Точка входа
├── App.vue              # Основной layout
├── style.css            # Токены дизайна (light/dark)
├── stores/tasks.js      # Хранилище задач и проектов
├── composables/
│   ├── useTheme.js
│   └── useKeyboardShortcuts.js
└── components/
    ├── Sidebar.vue      # Проекты, импорт/экспорт
    ├── TaskList.vue     # Поиск, фильтры, список
    ├── TaskCard.vue     # Карточка задачи
    ├── TaskForm.vue     # Модалка создания/редактирования
    ├── ThemeToggle.vue  # Переключатель темы
    └── StatsPanel.vue   # Статистика
```
