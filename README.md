# Spotify Track Console Notifier

Локальное CLI-приложение для одного пользователя:

1. При смене трека в Spotify выводит в консоль:

`Исполнитель - Название трека`

2. Сохраняет полную историю прослушиваний в SQLite через Prisma.
3. Опционально поддерживает набор плейлистов по последним `Liked Songs` (например 20/50/100).
4. Опционально синхронизирует и хранит полный список избранных треков в БД.

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
TOKEN_STORAGE_PATH=/app/data/.spotify-tokens.json

DATABASE_URL=file:/app/data/history.db
BACKFILL_INTERVAL_MS=60000
BACKFILL_LIMIT=50

LIKED_RECENT_ENABLED=false
LIKED_RECENT_WINDOWS=20,50,100
LIKED_RECENT_PLAYLIST_PREFIX=LIKED RECENT
LIKED_RECENT_PLAYLIST_SUFFIX=[AUTO]
LIKED_RECENT_SYNC_INTERVAL_MS=15000
LIKED_RECENT_PLAYLIST_PRIVATE=true

SAVED_TRACKS_ENABLED=false
SAVED_TRACKS_SYNC_INTERVAL_MS=60000

SPOTIFY_PROXY_ENABLED=false
SPOTIFY_PROXY_URL=
SPOTIFY_PROXY_ON_GEO_BLOCK_ONLY=true

# S3 Backup Configuration (Timeweb Cloud)
BACKUP_ENABLED=false
S3_ENDPOINT=https://s3.timeweb.cloud
S3_BUCKET=backups
S3_PREFIX=backups
S3_ACCESS_KEY=your_access_key
S3_SECRET_KEY=your_secret_key
BACKUP_CRON=0 0 * * *
BACKUP_RETENTION_DAYS=7
```

Описание переменных:

1. `SPOTIFY_CLIENT_ID` - идентификатор приложения Spotify.
2. `SPOTIFY_CLIENT_SECRET` - секрет приложения Spotify.
3. `SPOTIFY_REDIRECT_URI` - callback URL, должен совпадать с настройкой в Spotify.
4. `SPOTIFY_LISTEN_PORT` - внутренний порт HTTP-сервера приложения (актуально для Docker/Coolify; обычно `3000`).
5. `POLL_INTERVAL_MS` - интервал опроса API в миллисекундах.
6. `PRINT_ON_START` - печатать текущий трек сразу при старте (`true/false`, по умолчанию `true`).
7. `TOKEN_STORAGE_PATH` - путь к локальному файлу хранения токенов. Для Docker/Coolify используй путь внутри примонтированной директории, например `/app/data/.spotify-tokens.json`.
8. `DATABASE_URL` - путь к SQLite-базе для полной истории (пример: `file:/app/data/history.db`).
9. `BACKFILL_INTERVAL_MS` - интервал добора пропусков из recently played.
10. `BACKFILL_LIMIT` - количество элементов recently played за один backfill.
11. `LIKED_RECENT_ENABLED` - включить/выключить авто-плейлисты liked-треков.
12. `LIKED_RECENT_WINDOWS` - размеры окон через запятую (пример: `20,50,100`).
13. `LIKED_RECENT_PLAYLIST_PREFIX` - префикс имени liked-плейлиста.
14. `LIKED_RECENT_PLAYLIST_SUFFIX` - суффикс имени liked-плейлиста.
15. `LIKED_RECENT_SYNC_INTERVAL_MS` - интервал синхронизации liked-плейлистов.
16. `LIKED_RECENT_PLAYLIST_PRIVATE` - делать liked-плейлисты приватными.
17. `SAVED_TRACKS_ENABLED` - включить/выключить синхронизацию избранных треков в БД.
18. `SAVED_TRACKS_SYNC_INTERVAL_MS` - интервал синхронизации избранных треков (минимум 15000 мс).
19. `SPOTIFY_PROXY_ENABLED` - включить поддержку прокси для запросов к Spotify API.
20. `SPOTIFY_PROXY_URL` - URL прокси (пример: `http://user:pass@host:port`).
21. `SPOTIFY_PROXY_ON_GEO_BLOCK_ONLY` - использовать прокси только после geo-block `403` (`true`) или сразу для всех запросов (`false`).
22. `BACKUP_ENABLED` - включить ежесуточный бэкап базы в S3 (`true/false`).
23. `S3_ENDPOINT` - S3 endpoint (для Timeweb Cloud: `https://s3.timeweb.cloud`).
24. `S3_BUCKET` - имя S3-бакета для хранения бэкапов.
25. `S3_PREFIX` - префикс (папка) внутри бакета, куда складываются бэкапы, например `backups` или `spotify-helper/history`.
26. `S3_ACCESS_KEY` - S3 access key.
27. `S3_SECRET_KEY` - S3 secret key.
28. `BACKUP_CRON` - cron-выражение для запуска бэкапа (по умолчанию `0 0 * * *` - ежедневно в 00:00 UTC).
29. `BACKUP_RETENTION_DAYS` - количество дней хранения бэкапов (старше удаляются автоматически).

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

## Docker-запуск

### Основное приложение

```bash
# Сборка и запуск
docker-compose up -d app

# Просмотр логов
docker-compose logs -f app
```

Для Coolify не используй отдельный mount на файл токена. Храни токен внутри persistent storage директории, например:

```env
TOKEN_STORAGE_PATH=/app/data/.spotify-tokens.json
```

Если `TOKEN_STORAGE_PATH` указывает на директорию или на путь вне persistent storage, после OAuth авторизация может завершаться в браузере, но токен не сохранится и контейнер снова запросит логин при следующем старте.

### Запуск с бэкапом

`backup` теперь входит в обычный `docker-compose up -d`. Его поведение определяется переменной `BACKUP_ENABLED`:

- `BACKUP_ENABLED=true` - контейнер запускает cron и отправляет бэкапы в S3.
- `BACKUP_ENABLED=false` - контейнер остаётся запущенным, но ничего не бэкапит.

Для включения бэкапов:

```bash
# В .env добавить:
BACKUP_ENABLED=true
S3_ENDPOINT=https://s3.timeweb.cloud
S3_BUCKET=your-bucket-name
S3_PREFIX=backups
S3_ACCESS_KEY=your_access_key
S3_SECRET_KEY=your_secret_key
BACKUP_CRON=0 0 * * *

# Запустить все сервисы
docker-compose up -d

# Просмотр логов бэкапа
docker-compose logs -f backup
```

Backup работает по cron (по умолчанию в 00:00 UTC) и:
1. Копирует SQLite-базу во временный файл.
2. Загружает в S3 в префикс `S3_PREFIX` с timestamp в имени файла.
3. Удаляет бэкапы старше `BACKUP_RETENTION_DAYS` (по умолчанию 7 дней).

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

## Как Работает SAVED TRACKS

1. Сервис синхронизирует полный список избранных треков в локальную SQLite-базу.
2. При запуске выполняет полную синхронизацию (загружает все треки из Spotify).
3. По таймеру обновляет изменения:
   - Новые лайки → добавляются в БД
   - Снятые лайки → удаляются из БД
   - Изменившиеся метаданные → обновляются
4. Хранит: trackId, trackUri, trackName, artistName, addedAtEpochMs.
5. Включается через `SAVED_TRACKS_ENABLED=true`.

## Документация

1. Дизайн-док: `DESIGN.md`
2. План реализации: `IMPLEMENTATION_PLAN.md`
3. Addon-дизайн плейлиста: `DESIGN_ADDON_PLAYLIST.md`
4. План реализации плейлиста: `IMPLEMENTATION_PLAN_PLAYLIST.md`
5. Addon-дизайн liked-плейлистов: `DESIGN_ADDON_LIKED_RECENT.md`
6. План реализации liked-плейлистов: `IMPLEMENTATION_PLAN_LIKED_RECENT.md`
7. Дизайн Saved Tracks: `DESIGN_SAVED_TRACKS.md`
