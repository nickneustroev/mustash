# Spotify Track Console Notifier

Локальное CLI-приложение для одного пользователя:

1. При смене трека в Spotify выводит в консоль:

`Исполнитель - Название трека`

2. Автоматически поддерживает плейлист `HISTORY [AUTO]` с последними 100 прослушанными треками.

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
4. `playlist-modify-private`
5. `playlist-read-private`

## Переменные окружения

Скопируй `.env.example` в `.env` и заполни реальными значениями:

```env
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/callback

POLL_INTERVAL_MS=2500
PRINT_ON_START=true
TOKEN_STORAGE_PATH=.spotify-tokens.json

HISTORY_PLAYLIST_NAME=HISTORY [AUTO]
HISTORY_MAX_ITEMS=100
HISTORY_STATE_PATH=.history-state.json
PLAYLIST_SYNC_DEBOUNCE_MS=7000
BACKFILL_INTERVAL_MS=60000
BACKFILL_LIMIT=50
```

Описание переменных:

1. `SPOTIFY_CLIENT_ID` - идентификатор приложения Spotify.
2. `SPOTIFY_CLIENT_SECRET` - секрет приложения Spotify.
3. `SPOTIFY_REDIRECT_URI` - callback URL, должен совпадать с настройкой в Spotify.
4. `POLL_INTERVAL_MS` - интервал опроса API в миллисекундах.
5. `PRINT_ON_START` - печатать текущий трек сразу при старте (`true/false`, по умолчанию `true`).
6. `TOKEN_STORAGE_PATH` - путь к локальному файлу хранения токенов.
7. `HISTORY_PLAYLIST_NAME` - имя автоподдерживаемого плейлиста истории.
8. `HISTORY_MAX_ITEMS` - размер rolling-истории (рекомендуется `100`).
9. `HISTORY_STATE_PATH` - путь к локальному state-файлу истории.
10. `PLAYLIST_SYNC_DEBOUNCE_MS` - debounce синхронизации плейлиста.
11. `BACKFILL_INTERVAL_MS` - интервал добора пропусков из recently played.
12. `BACKFILL_LIMIT` - количество элементов recently played за один backfill.

## Установка и запуск

1. Установить зависимости:
`npm install`
2. Запустить приложение:
`npm run dev`
3. Запуск production-сборки:
`npm run build && npm run start`

Ожидаемое поведение:

1. При первом запуске откроется авторизация Spotify.
2. После успешного входа приложение начнет отслеживание.
3. При смене трека в консоли появится строка вида:
`Artist - Track`
4. Плейлист `HISTORY [AUTO]` будет создан автоматически (если его нет).
5. Плейлист будет обновляться по rolling-окну последних 100 прослушиваний.

## Команды

1. `npm run dev` - запуск в режиме разработки.
2. `npm run build` - сборка TypeScript в `dist/`.
3. `npm run start` - запуск собранного приложения.
4. `npm test` - запуск unit-тестов.
5. `npm run lint` - проверка линтером.

## Примечания по безопасности

1. Не коммить `.env` и файлы токенов в git.
2. Не публикуй `Client Secret`.
3. Используй приложение только локально.

## Ограничения MVP

1. Нет webhook-событий, используется polling.
2. Нет поддержки нескольких пользователей.
3. История хранится локально в файле (без БД).
4. Нет UI, только консольный вывод.
5. При ручном редактировании `HISTORY [AUTO]` следующая sync может перезаписать изменения.

## Как Работает HISTORY [AUTO]

1. Live-события из текущего воспроизведения попадают в локальную rolling-историю.
2. Периодический backfill из `recently played` добирает пропущенные треки.
3. В плейлисте всегда поддерживаются последние 100 прослушиваний.
4. Дубликаты разрешены и сохраняются.

## Документация

1. Дизайн-док: `DESIGN.md`
2. План реализации: `IMPLEMENTATION_PLAN.md`
3. Addon-дизайн плейлиста: `DESIGN_ADDON_PLAYLIST.md`
4. План реализации плейлиста: `IMPLEMENTATION_PLAN_PLAYLIST.md`
