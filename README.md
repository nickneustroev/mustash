# Spotify Helper

Репозиторий содержит одно CLI-приложение `apps/auto-playlists` для одного пользователя Spotify.

Приложение:

1. отслеживает текущее воспроизведение и сохраняет live history в Postgres, если настроена БД;
2. поддерживает авто-плейлисты на основе текущего списка `Saved Tracks`;
3. архивирует треки, которые были удалены из избранного.

## Требования

1. Spotify-аккаунт (Free или Premium).
2. Созданное приложение в Spotify Developer Dashboard.
3. Node.js 20+.
4. PowerShell или любой совместимый shell.

## Настройка Spotify App

1. Создай приложение в Spotify Developer Dashboard.
2. Получи `Client ID` и `Client Secret`.
3. Добавь Redirect URI для запускаемого приложения:
   - `http://127.0.0.1:3000/callback`
   - при необходимости отдельный callback-порт, например `http://127.0.0.1:3001/callback`
4. Сохрани изменения.

При первом OAuth-логине приложение может запросить scopes из обоих сценариев:

1. `user-read-currently-playing`
2. `user-library-read`
3. `ugc-image-upload`
4. `playlist-modify-private`
5. `playlist-read-private`

## Переменные окружения

Конфигурация хранится в одном файле `.env`.

Порядок применения:

1. системные env-переменные
2. `.env`

Можно использовать один из двух шаблонов:

1. `.env.full.example` - полный
2. `.env.minimal.example` - минимальный

Скопируй выбранный шаблон в `.env`:

```env
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/callback
SPOTIFY_LISTEN_PORT=3000

# Optional. If set, the app validates the proxy at startup and uses it when available.
SPOTIFY_PROXY_URL=
# Optional. Leave empty to run without DB-backed history and removed-track archive.
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/spotify_helper
POLL_INTERVAL_MS=2500
SPOTIFY_MIN_REQUEST_GAP_MS=100

AUTO_PLAYLISTS_PLAYLIST_PREFIX=
AUTO_PLAYLISTS_PLAYLIST_SUFFIX=[AUTO]
# Default: 10 minutes (600000 ms)
AUTO_PLAYLISTS_FREQUENT_SYNC_INTERVAL_MS=600000
# Default: 3 hours (10800000 ms)
AUTO_PLAYLISTS_RARE_SYNC_INTERVAL_MS=10800000

SAVED_RECENT_COVER_COLOR=000000
SAVED_IN_YEAR_COVER_COLOR=060E73

SAVED_RECENT_WINDOWS=50,200
SAVED_IN_YEAR_YEARS=2024,2025
```

`SPOTIFY_LISTEN_PORT` используется OAuth-слоем для локального callback-сервера. Если не задан, порт берется из `SPOTIFY_REDIRECT_URI`.

`auto-playlists` использует из `.env`:

1. Postgres (`DATABASE_URL`) для live history, архива удаленных треков и постоянного `AppState`
2. playback polling (`POLL_INTERVAL_MS`)
3. runtime авто-плейлистов (`AUTO_PLAYLISTS_*`)
4. оформление обложек (`SAVED_RECENT_COVER_COLOR`, `SAVED_IN_YEAR_COVER_COLOR`)
5. правила авто-плейлистов (`SAVED_RECENT_WINDOWS`, `SAVED_IN_YEAR_YEARS`)
6. Spotify OAuth / proxy настройки

`SPOTIFY_PROXY_URL` опционален. Если он пустой, приложение ничего не пишет про прокси и сразу проверяет обычное подключение к Spotify.

Если `SPOTIFY_PROXY_URL` задан, приложение при запуске:

1. проверяет прокси;
2. при успехе пишет, что прокси указан и проверен, и использует его;
3. при неуспехе пишет, что прокси указан, но не работает, и переключается на обычное подключение;
4. перед стартом runtime обязательно валидирует обычное подключение к Spotify, и если Spotify недоступен полноценно или доступ ограничен по региону, завершает запуск с явной ошибкой.

Если `DATABASE_URL` пустой или подключение к БД недоступно, приложение продолжит работу без сохранения прослушанных треков и архива удаленных треков.
В таком режиме `AppState`, включая OAuth-токены Spotify, сохраняется локально в `temp/app-state.json`.

`AUTO_PLAYLISTS_PLAYLIST_PREFIX` можно оставить пустым:

```env
AUTO_PLAYLISTS_PLAYLIST_PREFIX=
```

Тогда имена будут без префикса, например `RECENT 50 [AUTO]` или `2024 [AUTO]`.

Если `AUTO_PLAYLISTS_PLAYLIST_SUFFIX` не задан или пустой, используется дефолтный суффикс `[AUTO]`.

## Локальный запуск

1. Установить зависимости:
`npm install`
2. Сгенерировать Prisma Client:
`npm run prisma:generate`
3. Применить миграции:
`npm run prisma:migrate:dev`
4. Запустить dev-режим:
`npm run dev:auto-playlists`

### Production-запуск

1. Сборка:
`npm run build`
2. Запуск приложения:
`npm run start:auto-playlists`

Ожидаемое поведение:

1. При первом запуске откроется авторизация Spotify.
2. `auto-playlists` начнет отслеживание playback, сохранять live history и поддерживать авто-плейлисты.

## Команды

### Общие

1. `npm run build` - сборка приложения.
2. `npm test` - запуск unit-тестов.
3. `npm run lint` - проверка линтером.

### `auto-playlists`

1. `npm run dev:auto-playlists`
2. `npm run build:auto-playlists`
3. `npm run start:auto-playlists`
4. `npm run start:docker:auto-playlists`
5. `npm run test:auto-playlists`
6. `npm run test:watch:auto-playlists`

## Docker

### `auto-playlists`

```bash
docker-compose up -d auto-playlists
docker-compose logs -f auto-playlists
```

По умолчанию compose поднимает `auto-playlists` так:

1. callback-сервер внутри контейнера слушает порт из `SPOTIFY_LISTEN_PORT` или `3000` по умолчанию
2. наружу публикуется тот же порт
3. переменные приложения передаются внутрь контейнера через секцию `environment`
4. при доступной БД runtime-состояние сохраняется в таблице `AppState` в Postgres

Локально `docker-compose` по-прежнему может брать значения из корневого `.env`, потому что Compose сам использует этот файл для подстановки переменных. В PaaS-окружении можно передавать те же переменные через интерфейс провайдера, без файла `.env`.

Если нужно изменить значения для Docker, используй обычные переменные приложения:

1. `SPOTIFY_REDIRECT_URI`
2. `SPOTIFY_LISTEN_PORT`

## Как работают `SAVED` авто-плейлисты (`apps/auto-playlists`)

1. Сервис читает `Saved Tracks` через Spotify API.
2. Если задан `SAVED_RECENT_WINDOWS`, формирует плейлисты `SAVED RECENT {N} [AUTO]`.
3. Если задан `SAVED_IN_YEAR_YEARS`, формирует плейлисты `SAVED {YEAR} [AUTO]`.
4. Для каждого definition поддерживает отдельный плейлист.
5. При создании `saved recent` плейлиста автоматически выставляется обложка.
6. При удалении трека из избранного сервис сохраняет его в архив, если БД подключена.

## Примечания по безопасности

1. Не коммить `.env`.
2. Не публикуй `Client Secret`.
3. Используй приложение только локально или в доверенном окружении.

## Ограничения MVP

1. Нет webhook-событий, используется polling.
2. Нет поддержки нескольких пользователей.
3. История и архив включаются только при доступном `DATABASE_URL`.
4. Нет UI, только консольный вывод и Prisma Studio для админ-доступа к данным.
5. Для saved-плейлистов `frequent` цикл обновляет только `RECENT {N}` плейлисты по последним `max(SAVED_RECENT_WINDOWS)` трекам, а `rare` цикл отдельно перечитывает весь каталог, обновляет годовые плейлисты и архив удалённых треков.
