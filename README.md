# Spotify Track Console Notifier

Репозиторий содержит два CLI-приложения для одного пользователя:

1. `apps/tracker`
   Отслеживает и сохраняет данные в SQLite: историю прослушиваний, зеркало `Saved Tracks`, архив удалений из избранного и связанные backup-сценарии.
2. `apps/auto-playlists`
   Автоматически поддерживает плейлисты на основе текущего списка `Saved Tracks` в Spotify. Первая реализованная стратегия: `Liked Recent`.

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
21. `BACKUP_ENABLED` - включить ежесуточный бэкап базы в S3 (`true/false`).
22. `S3_ENDPOINT` - S3 endpoint (для Timeweb Cloud: `https://s3.timeweb.cloud`).
23. `S3_BUCKET` - имя S3-бакета для хранения бэкапов.
24. `S3_PREFIX` - префикс (папка) внутри бакета, куда складываются бэкапы, например `backups` или `spotify-helper/history`.
25. `S3_ACCESS_KEY` - S3 access key.
27. `S3_SECRET_KEY` - S3 secret key.
28. `BACKUP_CRON` - cron-выражение для запуска бэкапа (по умолчанию `0 0 * * *` - ежедневно в 00:00 UTC).
29. `BACKUP_RETENTION_DAYS` - количество дней хранения бэкапов (старше удаляются автоматически).

## Установка и запуск

### Локальный запуск (рекомендуется)

1. Установить зависимости:
`npm install`

2. Для `apps/tracker` сгенерировать Prisma Client:
`npm run prisma:generate`

3. Для `apps/tracker` применить миграции для локальной БД:
`npm run prisma:migrate:dev`

4. Убедиться, что в `.env` для локальной разработки `tracker` задана БД, например:
`DATABASE_URL=file:./dev.db`

5. Запустить нужное приложение:
`npm run dev:tracker`
или
`npm run dev:auto-playlists`

### Production-запуск

1. Сборка:
`npm run build`

2. Запуск:
`npm run start:tracker`
или
`npm run start:auto-playlists`

Ожидаемое поведение:

1. При первом запуске откроется авторизация Spotify.
2. `tracker` после входа начнет отслеживание playback и синхронизацию данных в БД.
3. `auto-playlists` после входа начнет поддерживать авто-плейлисты.
4. При смене трека в консоли `tracker` появится строка вида:
`Artist - Track`
5. Все события прослушивания в `tracker` сохраняются в SQLite-базу.
6. Backfill в `tracker` периодически добирает пропущенные события из recently played.

## Команды

1. `npm run dev:tracker` - запуск `apps/tracker` в режиме разработки.
2. `npm run dev:auto-playlists` - запуск `apps/auto-playlists` в режиме разработки.
3. `npm run build` - сборка обоих приложений.
4. `npm run build:tracker` - сборка `apps/tracker` в `apps/tracker/dist/`.
5. `npm run build:auto-playlists` - сборка `apps/auto-playlists` в `apps/auto-playlists/dist/`.
6. `npm run start:tracker` - запуск собранного `tracker`.
7. `npm run start:auto-playlists` - запуск собранного `auto-playlists`.
8. `npm test` - запуск unit-тестов обоих приложений.
9. `npm run lint` - проверка линтером.
10. `npm run prisma:generate` - генерация Prisma Client для `tracker`.
11. `npm run prisma:migrate:dev` - запуск dev-миграций Prisma для `tracker`.
12. `npm run prisma:studio` - запуск Prisma Studio на порту `5555`.

## Docker-запуск

### Основное приложение

```bash
# Сборка и запуск
docker-compose up -d tracker

# Просмотр логов
docker-compose logs -f tracker
```

Примечание: warning вида `The "autKTE" variable is not set` в `docker compose` ожидаем и игнорируем. Это намеренная конфигурация для обхода бага Coolify в обработке `basicauth`-label.

Если контейнер падает на `prisma migrate deploy` с `Error: P3009`, значит в примонтированной SQLite-базе осталась незавершённая старая миграция. Для текущей squashed-миграции это обычно выглядит как failed-запись `20260314075227_init_history` в `_prisma_migrations`.

Исправление для локальной базы:

```bash
npx prisma migrate resolve --rolled-back 20260314075227_init_history
docker-compose up -d tracker
```

Если данные в `./data/history.db` не нужны, проще удалить файл базы и запустить контейнер заново, чтобы Prisma создала чистую БД.

Для Coolify не используй отдельный mount на файл токена. Храни токен внутри persistent storage директории, например:

```env
TOKEN_STORAGE_PATH=/app/data/.spotify-tokens.json
```

Если `TOKEN_STORAGE_PATH` указывает на директорию или на путь вне persistent storage, после OAuth авторизация может завершаться в браузере, но токен не сохранится и контейнер снова запросит логин при следующем старте.

### Запуск с бэкапом

`backup-cron` теперь входит в обычный `docker-compose up -d`. Его поведение определяется переменной `BACKUP_ENABLED`:

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
docker-compose logs -f backup-cron
```

Backup работает по cron (по умолчанию в 00:00 UTC) и:
1. Копирует SQLite-базу во временный файл.
2. Загружает в S3 в префикс `S3_PREFIX` с timestamp в имени файла.
3. Удаляет бэкапы старше `BACKUP_RETENTION_DAYS` (по умолчанию 7 дней).

Для ручного запуска бэкапа:

```bash
# С хоста: зайти в контейнер
docker-compose exec backup-cron /bin/bash

# Внутри контейнера:
/bin/bash /app/scripts/backup-s3.sh
```

Команда через `bash` полезна, если прямой запуск `/app/scripts/backup-s3.sh` даёт `Permission denied`.

### Восстановление БД при деплое

При старте `tracker` перед миграциями выполняется проверка SQLite-файла в mounted volume:

1. Если файл БД уже существует и не пустой - восстановление пропускается.
2. Если файла нет (или он пустой) - сервис смотрит в `s3://S3_BUCKET/S3_PREFIX/`, находит самый новый бэкап и восстанавливает его.
3. Если бэкапов в бакете нет - сервис запускается с пустой новой SQLite-базой.

Управляется флагом:

```env
S3_RESTORE_ON_EMPTY_DB=true
```

- `true` (по умолчанию) - автопопытка восстановления из S3 при пустой/отсутствующей БД.
- `false` - восстановление отключено.

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

## Как Работает LIKED RECENT (`apps/auto-playlists`)

1. Сервис периодически читает `Liked Songs` через Spotify API.
2. Берет последние треки и формирует окна из `LIKED_RECENT_WINDOWS`.
3. Для каждого окна поддерживает отдельный плейлист (`LIKED RECENT {N} [AUTO]`).
4. При создании нового liked-плейлиста автоматически выставляется обложка (`N recent`).
5. При добавлении или удалении из избранного плейлисты обновляются автоматически.

## Как Работает SAVED TRACKS (`apps/tracker`)

1. Сервис синхронизирует полный список избранных треков в локальную SQLite-базу.
2. При запуске выполняет полную синхронизацию (загружает все треки из Spotify).
3. По таймеру обновляет изменения:
   - Новые лайки → добавляются в БД
   - Снятые лайки → удаляются из БД
   - Изменившиеся метаданные → обновляются
4. Хранит: trackId, trackUri, trackName, artistName, addedAt.
5. Включается через `SAVED_TRACKS_ENABLED=true`.

## Документация

1. Дизайн-док: `DESIGN.md`
2. План реализации: `IMPLEMENTATION_PLAN.md`
3. Addon-дизайн плейлиста: `DESIGN_ADDON_PLAYLIST.md`
4. План реализации плейлиста: `IMPLEMENTATION_PLAN_PLAYLIST.md`
5. Addon-дизайн liked-плейлистов: `DESIGN_ADDON_LIKED_RECENT.md`
6. План реализации liked-плейлистов: `IMPLEMENTATION_PLAN_LIKED_RECENT.md`
7. Дизайн Saved Tracks: `DESIGN_SAVED_TRACKS.md`
