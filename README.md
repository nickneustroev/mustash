# Spotify Track Console Notifier

Репозиторий содержит два отдельных CLI-приложения для одного пользователя Spotify:

1. `apps/tracker`
   Отслеживает и сохраняет данные в SQLite: историю прослушиваний, зеркало `Saved Tracks`, архив удалений из избранного и связанные backup-сценарии.
2. `apps/auto-playlists`
   Автоматически поддерживает плейлисты на основе текущего списка `Saved Tracks`. Текущие стратегии: `Saved Recent` и `Saved In Year`.

Текущий статус: MVP реализован.

## Требования

1. Spotify-аккаунт (Free или Premium).
2. Созданное приложение в Spotify Developer Dashboard.
3. Node.js 20+.
4. PowerShell или любой совместимый shell.

## Настройка Spotify App

1. Создай приложение в Spotify Developer Dashboard.
2. Получи `Client ID` и `Client Secret`.
3. Добавь Redirect URI для тех приложений, которые собираешься запускать:
   - `http://127.0.0.1:3000/callback` для `tracker`
   - `http://127.0.0.1:3001/callback` для `auto-playlists`, если он работает отдельно в Docker рядом с `tracker`
4. Сохрани изменения.

При первом OAuth-логине приложение может запросить scopes из обоих сценариев:

1. `user-read-currently-playing`
2. `user-read-playback-state`
3. `user-read-recently-played`
4. `user-library-read`
5. `ugc-image-upload`
6. `playlist-modify-private`
7. `playlist-read-private`

## Переменные окружения

Конфигурация разделена на три уровня:

1. `.env` - общие переменные для обоих приложений.
2. `.env.tracker` - опциональные override только для `apps/tracker`.
3. `.env.auto-playlists` - опциональные override только для `apps/auto-playlists`.

Порядок применения:

1. системные env-переменные
2. `.env.tracker` или `.env.auto-playlists`
3. `.env`

### Общие переменные

Скопируй `.env.example` в `.env`:

```env
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/callback
SPOTIFY_LISTEN_PORT=3000

SPOTIFY_PROXY_ENABLED=false
SPOTIFY_PROXY_URL=
```

`SPOTIFY_LISTEN_PORT` используется OAuth-слоем для локального callback-сервера. Если не задан, порт берется из `SPOTIFY_REDIRECT_URI`.

### Контракт `tracker`

Если `tracker` должен иметь свои значения, скопируй `.env.tracker.example` в `.env.tracker`:

```env
TOKEN_STORAGE_PATH=data/.spotify-tokens.tracker.json
DATABASE_URL=file:./dev.db

POLL_INTERVAL_MS=2500
PRINT_ON_START=true
BACKFILL_INTERVAL_MS=60000
BACKFILL_LIMIT=50

SAVED_TRACKS_ENABLED=true
SAVED_TRACKS_SYNC_INTERVAL_MS=120000

BACKUP_ENABLED=false
S3_ENDPOINT=https://s3.timeweb.cloud
S3_BUCKET=backups
S3_PREFIX=backups
S3_ACCESS_KEY=your_access_key
S3_SECRET_KEY=your_secret_key
S3_RESTORE_ON_EMPTY_DB=true
BACKUP_CRON=0 0 * * *
BACKUP_RETENTION_DAYS=14
```

`tracker` использует:

1. OAuth-токены (`TOKEN_STORAGE_PATH`)
2. SQLite (`DATABASE_URL`)
3. playback polling (`POLL_INTERVAL_MS`, `PRINT_ON_START`)
4. backfill (`BACKFILL_INTERVAL_MS`, `BACKFILL_LIMIT`)
5. sync `Saved Tracks`
6. backup и restore из S3

### Контракт `auto-playlists`

Если `auto-playlists` должен иметь свои значения, скопируй `.env.auto-playlists.example` в `.env.auto-playlists`:

```env
TOKEN_STORAGE_PATH=data/.spotify-tokens.auto-playlists.json

# Если нужен отдельный callback-порт:
# SPOTIFY_REDIRECT_URI=http://127.0.0.1:3001/callback
# SPOTIFY_LISTEN_PORT=3001

AUTO_PLAYLISTS_PLAYLIST_PREFIX=SAVED
AUTO_PLAYLISTS_PLAYLIST_SUFFIX=[AUTO]
AUTO_PLAYLISTS_SYNC_INTERVAL_MS=15000

SAVED_RECENT_COVER_COLOR=000000
SAVED_IN_YEAR_COVER_COLOR=000000

SAVED_RECENT_WINDOWS=20,50,100
SAVED_IN_YEAR_YEARS=
```

`auto-playlists` использует:

1. OAuth-токены (`TOKEN_STORAGE_PATH`)
2. общий runtime авто-плейлистов (`AUTO_PLAYLISTS_*`)
3. оформление обложек (`SAVED_RECENT_COVER_COLOR`, `SAVED_IN_YEAR_COVER_COLOR`)
4. правила авто-плейлистов (`SAVED_RECENT_WINDOWS`, `SAVED_IN_YEAR_YEARS`)
3. общие Spotify OAuth / proxy настройки из `.env`

## Локальный запуск

### `tracker`

1. Установить зависимости:
`npm install`
2. Сгенерировать Prisma Client:
`npm run prisma:generate`
3. Применить миграции:
`npm run prisma:migrate:dev`
4. Запустить dev-режим:
`npm run dev:tracker`

### `auto-playlists`

1. Установить зависимости:
`npm install`
2. При необходимости создать `.env.auto-playlists`
3. Запустить dev-режим:
`npm run dev:auto-playlists`

### Production-запуск

1. Сборка:
`npm run build`
2. Запуск нужного приложения:
`npm run start:tracker`
или
`npm run start:auto-playlists`

Ожидаемое поведение:

1. При первом запуске откроется авторизация Spotify.
2. `tracker` начнет отслеживание playback и синхронизацию данных в БД.
3. `auto-playlists` начнет поддерживать авто-плейлисты.

## Команды

### Общие

1. `npm run build` - сборка обоих приложений.
2. `npm test` - запуск unit-тестов обоих приложений.
3. `npm run lint` - проверка линтером.

### `tracker`

1. `npm run dev:tracker`
2. `npm run build:tracker`
3. `npm run start:tracker`
4. `npm run start:docker:tracker`
5. `npm run test:tracker`
6. `npm run test:watch:tracker`
7. `npm run prisma:generate`
8. `npm run prisma:migrate:dev`
9. `npm run prisma:studio`

### `auto-playlists`

1. `npm run dev:auto-playlists`
2. `npm run build:auto-playlists`
3. `npm run start:auto-playlists`
4. `npm run start:docker:auto-playlists`
5. `npm run test:auto-playlists`
6. `npm run test:watch:auto-playlists`

## Docker

### `tracker`

```bash
docker-compose up -d tracker
docker-compose logs -f tracker
```

В Docker `tracker` использует:

1. `DATABASE_URL=file:/app/data/history.db`
2. `TOKEN_STORAGE_PATH=/app/data/.spotify-tokens.tracker.json`

Если раньше `tracker` использовал общий токен-файл `/app/data/.spotify-tokens.json`, после этого разделения ему потребуется повторная авторизация один раз.

### `auto-playlists`

```bash
docker-compose up -d auto-playlists
docker-compose logs -f auto-playlists
```

По умолчанию compose поднимает `auto-playlists` отдельно от `tracker`:

1. callback-сервер внутри контейнера слушает `3000`
2. наружу публикуется `3001`
3. `SPOTIFY_REDIRECT_URI` внутри сервиса переопределяется в `http://127.0.0.1:3001/callback`
4. токены хранятся в `/app/data/.spotify-tokens.auto-playlists.json`

Если нужно изменить значения, используй compose-переменные:

1. `AUTO_PLAYLISTS_HOST_PORT`
2. `AUTO_PLAYLISTS_SPOTIFY_REDIRECT_URI`
3. `AUTO_PLAYLISTS_SPOTIFY_LISTEN_PORT`

### `backup-cron`

`backup-cron` относится к данным `tracker` и запускается отдельно:

```bash
docker-compose up -d backup-cron
docker-compose logs -f backup-cron
```

Для включения бэкапов в `tracker`:

```env
BACKUP_ENABLED=true
S3_ENDPOINT=https://s3.timeweb.cloud
S3_BUCKET=your-bucket-name
S3_PREFIX=backups
S3_ACCESS_KEY=your_access_key
S3_SECRET_KEY=your_secret_key
BACKUP_CRON=0 0 * * *
```

Backup работает по cron и:

1. копирует SQLite-базу во временный файл
2. загружает ее в S3
3. удаляет бэкапы старше `BACKUP_RETENTION_DAYS`

Для ручного запуска:

```bash
docker-compose exec backup-cron /bin/bash
/bin/bash /app/scripts/backup-s3.sh
```

### `prisma-studio`

```bash
docker-compose up -d prisma-studio
docker-compose logs -f prisma-studio
```

Примечание: warning вида `The "autKTE" variable is not set` в `docker compose` ожидаем и игнорируем. Это побочный эффект label с `basicauth`.

### Восстановление БД и миграции `tracker`

Если контейнер `tracker` падает на `prisma migrate deploy` с `Error: P3009`, в SQLite могла остаться незавершенная старая миграция. Для текущей squashed-миграции это обычно failed-запись `20260314075227_init_history` в `_prisma_migrations`.

Исправление:

```bash
npx prisma migrate resolve --rolled-back 20260314075227_init_history
docker-compose up -d tracker
```

Если данные в `./data/history.db` не нужны, проще удалить файл базы и запустить контейнер заново.

При старте `tracker` перед миграциями выполняется восстановление SQLite-файла из S3, если локальной БД нет или она пуста. Это управляется флагом:

```env
S3_RESTORE_ON_EMPTY_DB=true
```

## Как работают `SAVED` авто-плейлисты (`apps/auto-playlists`)

1. Сервис читает `Saved Tracks` через Spotify API.
2. Если задан `SAVED_RECENT_WINDOWS`, формирует плейлисты `SAVED RECENT {N} [AUTO]`.
3. Если задан `SAVED_IN_YEAR_YEARS`, формирует плейлисты `SAVED {YEAR} [AUTO]`.
4. Для каждого definition поддерживает отдельный плейлист.
5. При создании `saved recent` плейлиста автоматически выставляется обложка.
6. При добавлении или удалении из избранного плейлисты обновляются автоматически.

## Как работает `SAVED TRACKS` (`apps/tracker`)

1. Сервис синхронизирует полный список избранных треков в SQLite.
2. При запуске выполняет полную синхронизацию.
3. По таймеру обновляет изменения:
   - новые лайки
   - снятые лайки
   - изменившиеся метаданные
4. Включается через `SAVED_TRACKS_ENABLED=true`.

## Примечания по безопасности

1. Не коммить `.env`, `.env.tracker`, `.env.auto-playlists` и файлы токенов.
2. Не публикуй `Client Secret`.
3. Используй приложение только локально или в доверенном окружении.

## Ограничения MVP

1. Нет webhook-событий, используется polling.
2. Нет поддержки нескольких пользователей.
3. История хранится локально в SQLite.
4. Нет UI, только консольный вывод и Prisma Studio для админ-доступа к данным.
5. Для saved-плейлистов применяется полная синхронизация набора треков.
