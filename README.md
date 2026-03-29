# money-ui

Веб-интерфейс к сервису **calculations** (REST API). Репозиторий рядом: [`../calculations`](../calculations).

## Стек

- React 18, TypeScript, Vite
- Прокси в dev: запросы к `/api`, `/health`, `/docs`, `/openapi.yaml` уходят на бэкенд (по умолчанию `http://127.0.0.1:8080`)

## Запуск

1. Поднять **calculations** (Postgres, миграции, `HTTP_PORT=8080` или свой порт).
2. В каталоге `money-ui`:

```bash
npm install
npm run dev
```

Откройте в браузере URL из вывода Vite (обычно `http://localhost:5173`).

Если API на другом хосте/порту:

```bash
VITE_API_PROXY_TARGET=http://127.0.0.1:9090 npm run dev
```

## Сборка

```bash
npm run build
```

Статика в `dist/`. В проде настройте reverse-proxy: фронт раздавать как статику, пути `/api`, `/health` и т.д. — на сервис calculations (или включите CORS на Gin).

## Маршруты UI

- `/` — сводка, участники, договоры
- `/contracts/:id` — договор, платежи, пересчёт
