# Критерии продолжения работ — статус 2026-10-14

## Завершено

- [x] Frontend production build: `npm run build`.
- [x] Python compile check: `venv\Scripts\python.exe -m compileall -q main.py app`.
- [x] Сервер запускается из `venv` и отвечает на `/api/healthz`.
- [x] SPA route shell проверен для главной, auth, app, projects, tasks, chats, team, reports и settings; 500 не обнаружено.
- [x] Login UI проверен в In-App Browser: поля, labels, CTA и ссылка регистрации присутствуют.
- [x] Browser console на публичной login-странице без красных ошибок.
- [x] Изолированный API smoke-test на отдельной SQLite-базе: registration, auth/me, project, project chat, chat list, messages, pagination, reply, reactions, edit, soft-delete, read-state и validation.
- [x] Финальные отчёты созданы в `C:\AI-Marketer-Platform\AUDIT.md` и `C:\AI-Marketer-Platform\CHANGELOG_v2.md`.

## Реализовано в исходниках

- [x] Backend chat models, access control, direct/project chat API, message lifecycle, reactions, upload, Open Graph preview и WebSocket route.
- [x] Project chat creation and membership synchronization.
- [x] `/app/chats` и chat components: list, window, bubbles, composer, attachments, link preview, typing, reactions.
- [x] Unread state, read state, reply, pagination, Markdown/linkify и drag/drop/paste attachments.
- [x] Motion primitives, Sonner, Cmd+K, Inter Variable, OKLCH accent, dark Zinc surfaces, responsive layout и reduced motion.

## Ограничения, оставленные намеренно

- [ ] Полный двупользовательский WebSocket-прогон требует двух реальных пользователей с membership в одном workspace; текущий изолированный прогон подтвердил CRUD и broadcast code path без изменения пользовательской базы.
- [ ] Полный ручной прогон всех authenticated project tabs в браузере не выполнялся, чтобы не создавать постоянные тестовые данные в `data.db`; route shell, login UI и backend smoke проверены.

См. подробности и доказательства в `C:\AI-Marketer-Platform\AUDIT.md`.
