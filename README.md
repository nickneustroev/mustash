# Spotify Track Console Notifier

Локальное CLI-приложение для одного пользователя:

1. При смене трека в Spotify выводит в консоль:

`Исполнитель - Название трека`

2. Сохраняет полную историю прослушиваний в SQLite через Prisma.
3. Опционально поддерживает набор плейлистов по последним `Liked Songs` (например 20/50/100).

Текущий статус: MVP реализован.

## Требования

1. Spotify-аккаунт (Free или Premium).
2. Созданное приложение в Spotify Developer Dashboard.
3. Node.js 20+ (рекомендуется LTS).
4. Терминал PowerShell или любой совместимый shell.

## Настройка Spotify App

1. Создай приложение в Spotify Developer Dashboard.
2. Получи `Client ID` и `Client Secret`.
3. Добавь Redirect URI для локальной авторизации, например:
`http://127.0.0.1:3000/callback`
4. Сохрани изменения в настройках приложения.

При первом OAuth-логине приложение запросит scopes:

1. `user-read-currently-playing`
2. `user-read-playback-state`
3. `user-read-recently-played`
4. `user-library-read`
5. `ugc-image-upload`
6. `playlist-modify-private`
7. `playlist-read-private`

## Переменные окружения

Скопируй `.env.example` в `.env` и заполни реальными значениями:

```env
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/callback
SPOTIFY_LISTEN_PORT=3000

POLL_INTERVAL_MS=2500
PRINT_ON_START=true
TOKEN_STORAGE_PATH=.spotify-tokens.json

DATABASE_URL=file:/data/history.db
BACKFILL_INTERVAL_MS=60000
BACKFILL_LIMIT=50

LIKED_RECENT_ENABLED=false
LIKED_RECENT_WINDOWS=20,50,100
LIKED_RECENT_PLAYLIST_PREFIX=LIKED RECENT
LIKED_RECENT_PLAYLIST_SUFFIX=[AUTO]
LIKED_RECENT_SYNC_INTERVAL_MS=15000
LIKED_RECENT_PLAYLIST_PRIVATE=true

SPOTIFY_PROXY_ENABLED=false
SPOTIFY_PROXY_URL=
SPOTIFY_PROXY_ON_GEO_BLOCK_ONLY=true
```

Описание переменных:

1. `SPOTIFY_CLIENT_ID` - идентификатор приложения Spotify.
2. `SPOTIFY_CLIENT_SECRET` - секрет приложения Spotify.
3. `SPOTIFY_REDIRECT_URI` - callback URL, должен совпадать с настройкой в Spotify.
4. `SPOTIFY_LISTEN_PORT` - внутренний порт HTTP-сервера приложения (актуально для Docker/Coolify; обычно `3000`).
5. `POLL_INTERVAL_MS` - интервал опроса API в миллисекундах.
6. `PRINT_ON_START` - печатать текущий трек сразу при старте (`true/false`, по умолчанию `true`).
7. `TOKEN_STORAGE_PATH` - путь к локальному файлу хранения токенов.
8. `DATABASE_URL` - путь к SQLite-базе для полной истории (пример: `file:/data/history.db`).
9. `BACKFILL_INTERVAL_MS` - интервал добора пропусков из recently played.
10. `BACKFILL_LIMIT` - количество элементов recently played за один backfill.
11. `LIKED_RECENT_ENABLED` - включить/выключить авто-плейлисты liked-треков.
12. `LIKED_RECENT_WINDOWS` - размеры окон через запятую (пример: `20,50,100`).
13. `LIKED_RECENT_PLAYLIST_PREFIX` - префикс имени liked-плейлиста.
14. `LIKED_RECENT_PLAYLIST_SUFFIX` - суффикс имени liked-плейлиста.
15. `LIKED_RECENT_SYNC_INTERVAL_MS` - интервал синхронизации liked-плейлистов.
16. `LIKED_RECENT_PLAYLIST_PRIVATE` - делать liked-плейлисты приватными.
17. `SPOTIFY_PROXY_ENABLED` - включить поддержку прокси для запросов к Spotify API.
18. `SPOTIFY_PROXY_URL` - URL прокси (пример: `http://user:pass@host:port`).
19. `SPOTIFY_PROXY_ON_GEO_BLOCK_ONLY` - использовать прокси только после geo-block `403` (`true`) или сразу для всех запросов (`false`).

## Установка и запуск

### Локальный запуск (рекомендуется)

1. Установить зависимости:
`npm install`

2. Сгенерировать Prisma Client:
`npm run prisma:generate`

3. Применить миграции для локальной БД:
`npm run prisma:migrate:dev`

4. Убедиться, что в `.env` для локальной разработки задана БД, например:
`DATABASE_URL=file:./dev.db`

5. Запустить приложение:
`npm run dev`

### Production-запуск

1. Сборка:
`npm run build`

2. Запуск:
`npm run start`

Ожидаемое поведение:

1. При первом запуске откроется авторизация Spotify.
2. После успешного входа приложение начнет отслеживание.
3. При смене трека в консоли появится строка вида:
`Artist - Track`
4. Все события прослушивания сохраняются в SQLite-базу.
5. Backfill периодически добирает пропущенные события из recently played.

## Команды

1. `npm run dev` - запуск в режиме разработки.
2. `npm run build` - сборка TypeScript в `dist/`.
3. `npm run start` - запуск собранного приложения.
4. `npm test` - запуск unit-тестов.
5. `npm run lint` - проверка линтером.
6. `npm run prisma:generate` - генерация Prisma Client.
7. `npm run prisma:migrate:dev` - запуск dev-миграций Prisma.
8. `npm run prisma:studio` - запуск Prisma Studio на порту `5555`.

## Примечания по безопасности

1. Не коммить `.env` и файлы токенов в git.
2. Не публикуй `Client Secret`.
3. Используй приложение только локально.

## Ограничения MVP

1. Нет webhook-событий, используется polling.
2. Нет поддержки нескольких пользователей.
3. История хранится локально в SQLite (без отдельного серверного DBMS).
4. Нет UI, только консольный вывод и Prisma Studio для админ-доступа к данным.
5. Для liked-плейлистов применяется полная синхронизация окна.

## Как Работает LIKED RECENT

1. Сервис периодически читает `Liked Songs` через Spotify API.
2. Берет последние треки и формирует окна из `LIKED_RECENT_WINDOWS`.
3. Для каждого окна поддерживает отдельный плейлист (`LIKED RECENT {N} [AUTO]`).
4. При создании нового liked-плейлиста автоматически выставляется обложка (`N recent`).
5. При добавлении или удалении из избранного плейлисты обновляются автоматически.

## Документация

1. Дизайн-док: `DESIGN.md`
2. План реализации: `IMPLEMENTATION_PLAN.md`
3. Addon-дизайн плейлиста: `DESIGN_ADDON_PLAYLIST.md`
4. План реализации плейлиста: `IMPLEMENTATION_PLAN_PLAYLIST.md`
5. Addon-дизайн liked-плейлистов: `DESIGN_ADDON_LIKED_RECENT.md`
6. План реализации liked-плейлистов: `IMPLEMENTATION_PLAN_LIKED_RECENT.md`
