# План продолжения AI Marketer Platform

## Текущий проект и ограничения

Работаю в уже существующей plain-local копии `C:\Users\user\Desktop\AI-Marketer-Platform`: React 18/Vite, FastAPI, SQLAlchemy async, SQLite по умолчанию, единый FastAPI-процесс на `http://localhost:8000`. Путь `C:\AI-Marketer-Platform` существует отдельно и используется для запрошенных итоговых отчётов; исходники не дублируются и не перезаписываются. Сохраняются пользовательские данные и работающее API. Изменения схемы ограничиваются новыми таблицами бесед/сообщений/реакций. AI остаётся строго на `apodex/apodex-1.1-mini:free`; без fallback-моделей.

## Подход к реализации

1. Сопоставить исходный brief и дополнение с действующим приложением; собрать статические и браузерные наблюдения по публичным, workspace- и project-страницам и исправлять только подтверждённые дефекты.
2. Сохранить архитектуру `sidebar + topbar + content`, React Router, React Query, FastAPI и single-process запуск. Для чатов добавить отдельные SQLAlchemy-модели, API-маршруты, WebSocket, защищённую загрузку файлов и ограниченный публичными адресами Open Graph fetch.
3. На frontend добавить страницу `/app/chats`, отдельные компоненты списка/беседы/сообщения/вложения/реакций, Zustand store + WebSocket hook, unread/typing состояния, infinite scroll, link previews, Markdown и работу с файлами. Подключить личные чаты из Team, чат проекта из ProjectDetail и бейджи навигации.
4. Общий редизайн вести поверх существующих UI-примитивов: MotionPage/MotionCard/MotionList/MotionButton, sonner, cmdk, Inter Variable, OKLCH accent, skeleton, плавные модалки, focus glow, keyboard support, `prefers-reduced-motion` и адаптивность. Крупные визуальные иллюстрации не добавлять; empty states оформлять собственными лёгкими CSS/SVG-формами.
5. Сохранять backend serving: `frontend/dist` отдаётся FastAPI; сборка `npm run build`, запуск `start.bat`. Не завершать чужие Python-процессы и не выводить `.env`, токены или пароли.

## Структура проекта

- `main.py`: FastAPI lifespan, health, API registry, static build и `/uploads`.
- `app/models.py`, `app/database.py`: существующие таблицы плюс только Conversation, ConversationMember, Message, MessageReaction.
- `app/api/routes/chats.py`: права доступа, direct/project chats, сообщения, пагинация, реакции, read state, upload и WebSocket manager.
- `app/api/routes/project_members.py`, `projects.py`: управление проектными участниками и синхронизация состава группового чата при создании/переименовании/добавлении/удалении участника.
- `app/services/link_preview.py`: HTTP(S)-only metadata preview, проверка публичного DNS/IP, pinned DNS, ограничения redirect/bytes/timeouts.
- `frontend/src/App.jsx`, `components/layout/`: route, app shell, навигация, workspace и command palette.
- `frontend/src/components/motion/`: повторно используемые анимированные primitives.
- `frontend/src/components/chat/`, `pages/Chats.jsx`, `hooks/useWebSocket.js`, `lib/chat.js`: интерфейс и realtime чат.
- `frontend/src/pages/` и `frontend/src/components/Kanban/`: сохранение текущих маркетинговых инструментов с исправлением только подтверждённых дефектов и применением общих motion states.
- `frontend/public/manus-routes.json`: синхронизированный список страниц.

## Дизайн-система

- **Движение:** сдержанный Linear-inspired dark analytics SaaS; плотность B2B-инструмента сочетается с ясной иерархией и аккуратной типографикой.
- **Принципы:** данные и действия на первом плане; повторяемые состояния важнее декоративных деталей; короткие подписи/контрастные цифры; анимация подтверждает действие и остаётся быстрой.
- **Цветовая философия:** почти чёрный фон и поверхности Zinc дают спокойный рабочий контекст; индиго — сигнал активного состояния и аналитической точности, а не сплошная заливка. Акцент задан `oklch(0.55 0.22 275)`; большие яркие градиенты запрещены, hero допускает только мягкий OKLCH glow.
- **Компоновка:** сохраняются закреплённые sidebar и topbar, основное пространство fluid; содержимое контейнерно-адаптивно. В чатах — 320 px список и широкая лента, на мобильном список/беседа переключаются в одну колонку.
- **Фирменные элементы:** тонкая индиго-полоска фокуса/активной навигации; компактные unread-маркеры и табличные цифры; лёгкий blur только у меню и модалок.
- **Интеракции:** клавиатурные shortcuts, заметные focus-visible состояния, понятные pending/empty/error states; действие не блокируется анимацией. Поддерживать `prefers-reduced-motion`.
- **Анимация:** короткие spring-переходы примерно 160–260 ms для press/hover/drag; entrance fade+slide небольшого смещения; stagger только для списков, появляющихся впервые; без bounce на каждом рендере. View Transitions и scroll-driven effects включать только при поддержке и без нарушения reduced-motion.
- **Типографика:** Inter Variable; H1–H4 weight 600, letter spacing `-0.02em`; H1 `clamp(28px, 4vw, 40px)`; цифры метрик weight 600, tabular nums, letter spacing `-0.03em`.
- **Бренд:** операционный центр для российских маркетинговых команд — точный, спокойный, аналитичный. Голос короткий и предметный: «Проверьте гипотезу на данных.» и «Соберите задачи кампании в одном месте.»
- **Знак и цвет бренда:** собственный знак из двух смещённых вертикальных аналитических полос и точки-сигнала; не использовать символ по умолчанию. Фирменный цвет — глубокий индиго `oklch(0.55 0.22 275)`, узнаваемый на тёмной Zinc-палитре.

## Референс

Публичный каталог `https://motionsites.ai/`, категория SaaS. В превью найдены Peakline Redshift (тёмная аналитическая панель с плотными метриками), Growth Analytics (sidebar и график KPI) и Intelligent Performance (компактные карточки показателей). Защищённые промпты и поведение недоступных preview-макетов не считаются проверенными; источник и пределы наблюдений фиксируются в `AUDIT.md`. Переиспользовать только совместимые визуальные паттерны, не копировать чужой шаблон целиком.
