# Скриншоты для README

UI (поиск, бронь, checkout) — в [frontend/docs/screenshots](../../../frontend/docs/screenshots/).  
Здесь — **backend / ops**: API, observability, инфраструктура.

## Что снимать

| Файл | URL / источник | Зачем в README |
|------|----------------|----------------|
| `swagger-docs.png` | http://localhost:3001/docs | OpenAPI, версии `/api/v1` |
| `health-ready.png` | http://localhost:3001/health/ready | readiness: DB + Redis + RabbitMQ |
| `grafana-dashboard.png` | http://localhost:3002 | booking / outbox метрики |
| `rabbitmq-queues.png` | http://localhost:15672 | очередь ticketing после `booking.paid` |
| `minio-tickets.png` | http://localhost:9001 | PDF билеты в bucket |

## Как снять (локально)

1. Поднять стек: `docker compose up -d` (или infra + `pnpm start:dev`).
2. `pnpm seed:demo` если нужны данные для демо-флоу.
3. Скриншоты окна браузера (1440×900) или DevTools → full page.

Автоматизация UI: `cd ../frontend && node docs/screenshots/capture.mjs` (Playwright).

## В README

```markdown
![Swagger UI](docs/screenshots/swagger-docs.png)
```

Не коммитьте скриншоты с секретами (`.env`, webhook keys, JWT в Swagger Authorize).
