# MaxAirline Backend

> **REST API для платформы бронирования авиабилетов** — поиск рейсов, PNR, выбор мест, оплата (Stripe / ЮKassa), выпуск PDF-билетов и админ-панель.

[![Node.js](https://img.shields.io/badge/Node.js-22+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://docs.docker.com/compose/)
[![CI](https://github.com/KLIFF1218/flights-booking-backend/actions/workflows/ci.yml/badge.svg)](https://github.com/KLIFF1218/flights-booking-backend/actions/workflows/ci.yml)

**Стек:** NestJS 11 · Prisma 7 · PostgreSQL 16 · Redis · RabbitMQ · Kafka (Redpanda) · BullMQ · Stripe · YooKassa · S3 · Prometheus · Grafana

**Репозитории:** [Frontend (Next.js)](https://github.com/KLIFF1218/flights-booking-frontend) · [Monorepo](../README.md) · **Live UI:** [flights-booking-frontend.vercel.app](https://flights-booking-frontend.vercel.app) (нужен публичный backend; локально — `http://localhost:3111` или `http://localhost`)

---

## Содержание

- [Для резюме](#для-резюме)
- [О проекте](#о-проекте)
- [Ключевые возможности](#ключевые-возможности)
- [Архитектура](#архитектура)
- [Инженерные решения](#инженерные-решения)
- [Стек технологий](#стек-технологий)
- [Быстрый старт](#быстрый-старт)
- [Демо-доступ](#демо-доступ)
- [Скриншоты](#скриншоты)
- [Демо-сценарии](#демо-сценарии)
- [Полный флоу: Stripe](#полный-флоу-оплаты-stripe-test)
- [Полный флоу: ЮKassa](#полный-флоу-оплаты-yookassa-test)
- [Переменные окружения](#переменные-окружения)
- [Режимы запуска (детали)](#режимы-запуска-детали)
- [База данных](#база-данных)
- [Docker-сервисы](#docker-сервисы)
- [API и Swagger](#api-и-swagger)
- [Admin API](#admin-api)
- [Аутентификация и VK OAuth](#аутентификация-и-vk-oauth)
- [Мониторинг](#мониторинг)
- [Тестирование](#тестирование)
- [CI/CD](#cicd)
- [Структура проекта](#структура-проекта)
- [Ограничения и честные оговорки](#ограничения-и-честные-оговорки)
- [Что бы улучшил дальше](#что-бы-улучшил-далее)
- [Troubleshooting](#troubleshooting)
- [Безопасность](#безопасность)
- [Связанная документация](#связанная-документация)

---

## Для резюме

Готовые формулировки — можно копировать в CV, LinkedIn или рассказывать на собеседовании.

### Одна строка

> Разработал backend платформы бронирования авиабилетов на **NestJS**: поиск и инвентарь в PostgreSQL, webhook-оплата (**Stripe + ЮKassa**), transactional outbox, **RabbitMQ + Kafka**, асинхронный выпуск PDF-билетов, observability и CI/CD в production.

### Bullet points для CV

- Спроектировал **модульный монолит** на NestJS 11 с разделением domain (`modules/`) и infrastructure (`infra/`): 150+ unit-тестов, 10 e2e (Testcontainers), integration-тест цепочки payment → ticketing.
- Реализовал **webhook-first оплату**: бронь переходит в `PAID` только после подписанного webhook от PSP, с идемпотентностью на уровне booking, payment и Kafka-событий.
- Внедрил **Transactional Outbox** для надёжной доставки событий в RabbitMQ (критический путь ticketing) и Kafka (audit, уведомления, аналитика).
- Построил async pipeline: **BullMQ** (PDF через Puppeteer → S3 → email), seat holds, cron-задачи (expiry, abandonment, FX rates).
- Настроил **observability**: structured logging (Pino), Prometheus/Grafana, Sentry, health checks (DB + Redis + RabbitMQ).
- Автоматизировал **CI/CD**: lint → test → build → Docker image в GHCR → SSH deploy на VPS.

### Цифры для интервью

| Метрика | Значение |
|---------|----------|
| Unit-тесты | ~151 spec-файл |
| E2E-тесты | 10 модулей (auth, bookings, payment, webhook, admin, …) |
| Миграции Prisma | 19 |
| Docker-сервисов (dev) | 11 (API, Postgres, Redis, RabbitMQ, Redpanda, MinIO, Prometheus, Grafana, exporters) |
| Платёжные провайдеры | Stripe, YooKassa |
| Статусы брони | 9 (`PNR_CREATED` → `TICKETED`, cancel/expiry) |

### Вопросы, к которым README готовит

| Вопрос | Ответ в двух словах |
|--------|---------------------|
| Почему не микросервисы? | Модульный монолит: один deploy, чёткие границы модулей, outbox для async — проще для solo/small team |
| Почему RabbitMQ **и** Kafka? | Rabbit — критический путь `booking.paid` → ticketing; Kafka — audit, notifications, CQRS-аналитика |
| Как гарантируете оплату? | Только signed webhook + state machine + idempotency; redirect браузера не финализирует платёж |
| Как тестируете payments? | Unit + e2e + integration без mock-payment: реальный `PaymentHandler.processResult` |

---

## О проекте

**MaxAirline** — production-style backend для OTA (Online Travel Agency): пользователь ищет рейс, создаёт бронь, выбирает места, оплачивает, получает PDF-билет на email.

**Что это не является:** не GDS/ATPCO-интеграция, не live-тарифы авиакомпаний. Инвентарь и цены — **внутренняя симуляция** в PostgreSQL (fare brands LIGHT/FLEX, налоги, детские тарифы). Для портфолио это плюс: видна вся доменная логика без NDA внешних API.

**Связанные репозитории:** [frontend](https://github.com/KLIFF1218/flights-booking-frontend) · [monorepo](../README.md) · [live UI](https://flights-booking-frontend.vercel.app)

---

## Ключевые возможности

| Область | Реализация |
|---------|------------|
| **Поиск рейсов** | DB-backed search, Redis-кэш, конвертация валют — **[docs/flights.md](./docs/flights.md)** |
| **Бронирование** | PNR, travelers, infant/child fares, idempotency (`Idempotency-Key`) |
| **Места** | Layout из БД, holds, checkout |
| **Оплата** | Stripe Checkout + YooKassa, webhook fulfillment, admin confirm/cancel |

Подробный flow (create → webhook → outbox, idempotency, capture/refund): **[docs/payment.md](./docs/payment.md)**.
| **Билеты** | Puppeteer PDF + QR → S3 → Resend/BullMQ |
| **Пользователи** | JWT access/refresh, CSRF, VK OAuth, sessions, saved passengers — **[docs/users.md](./docs/users.md)** |
| **Уведомления** | In-app + SSE stream, Kafka consumer |
| **Админка** | Users, bookings, payments, flights, airports, dashboard analytics |
| **Наблюдаемость** | Metrics, Grafana, Sentry, optional OpenTelemetry |

---

## Архитектура

```mermaid
flowchart TB
  subgraph Client
    FE[Next.js Frontend]
  end

  subgraph API["NestJS API :3001"]
    FL[Flights / Bookings / Seatmaps]
    PAY[Payment + Webhooks]
    AUTH[Auth / Users]
    ADM[Admin API]
  end

  subgraph Data
    PG[(PostgreSQL)]
    RD[(Redis)]
    S3[(MinIO / S3)]
  end

  subgraph Async
    OB[Outbox Processor]
    RMQ[RabbitMQ]
    KFK[Kafka / Redpanda]
    BQ[BullMQ: mail + ticketing]
  end

  subgraph PSP
    STR[Stripe]
    YK[YooKassa]
  end

  FE --> API
  API --> PG
  API --> RD
  PAY --> STR & YK
  STR & YK -->|webhook| PAY
  PAY --> OB
  OB --> RMQ & KFK
  RMQ --> BQ
  BQ --> S3
  BQ --> FE
  KFK --> PG
```

### Жизненный цикл оплаты

```
POST /flights/search → POST /booking → seatmaps → checkout → createPayment
  → Redirect на Stripe / ЮKassa
  → POST /webhook/* (signed) → PaymentHandler → DB + Outbox
  → RabbitMQ booking.paid → BullMQ ticketing → PDF → S3 → email
  → Kafka: audit log, user notification, analytics
```

**Принцип:** успех оплаты подтверждается **только webhook'ом**, не redirect'ом на `/payment/.../success`. Mock-payment режима нет — это сознательное решение для честной демонстрации интеграции.

---

## Инженерные решения

Секция «почему так» — то, что в 2026 ожидают от сильного portfolio README ([Hyperskill](https://hyperskill.org/blog/post/building-a-developer-portfolio-in-2026-what-actually-gets-attention), [RepoClip 2026](https://repoclip.io/blog/how-to-write-a-github-readme)).

| Решение | Почему |
|---------|--------|
| **Модульный монолит** вместо микросервисов | Один deploy, транзакции в одной БД, проще отладка; границы модулей + outbox дают путь к выделению сервисов |
| **Transactional Outbox** | Атомарная запись бизнес-данных и события; at-least-once без потери при падении после commit |
| **RabbitMQ для ticketing, Kafka для остального** | Ticketing — критический путь с гарантией доставки; Kafka — event log, fan-out, CQRS read model |
| **Webhook-first payments** | Единственный надёжный источник истины от PSP; redirect может не дойти (закрытая вкладка, мобильный браузер) |
| **Два PSP (Stripe + YooKassa)** | Абстракция `PaymentProvider`; валютная политика (USD/RUB), разная верификация webhook (signature vs IP) |
| **BullMQ для PDF/email** | Тяжёлые задачи (Puppeteer) вне HTTP-request; retry, backoff, observability |
| **Zod-валидация env** | Fail-fast при старте; отдельные правила для production (secrets, Swagger off) |
| **Testcontainers для e2e** | Реальный Postgres в CI/local; без моков БД в критических флоу |
| **Prisma + PostgreSQL** | Типобезопасность, миграции, сложные связи (seat inventory, booking state) |

---

## Стек технологий

| Слой | Технологии |
|------|------------|
| Runtime | Node.js ≥ 22, pnpm ≥ 10 |
| Framework | NestJS 11, TypeScript 5.7, SWC build |
| Data | PostgreSQL 16, Prisma 7, Redis 7 |
| Messaging | RabbitMQ 3, Kafka (Redpanda), BullMQ |
| Payments | Stripe 22, nestjs-yookassa 2 |
| Storage / Email | AWS SDK S3, Resend, Puppeteer + QR |
| Auth | Passport JWT, Argon2id, VK OAuth |
| API | Swagger/OpenAPI, URI versioning `/api/v1` |
| Observability | Pino, Prometheus, Grafana, Sentry, OpenTelemetry (optional) |
| Testing | Jest 30, Supertest, Testcontainers |
| DevOps | Docker multi-stage, GitHub Actions, GHCR |

---

## Быстрый старт

### Требования

- Node.js 22+ с [corepack](https://nodejs.org/api/corepack.html)
- pnpm 10+
- Docker + Docker Compose

```bash
corepack enable
```

### Режимы запуска

| Режим | Команда | Когда использовать |
|-------|---------|-------------------|
| **A. Full Docker** | `docker compose up -d --build` | «Всё в контейнерах», ближе к prod; API на `:3001` |
| **B. Infra only** | `docker compose up -d postgres redis rabbitmq minio redpanda` | **Рекомендуется для разработки** + `pnpm start:dev` на хосте |
| **C. Local app** | Режим B + `pnpm install && pnpm prisma migrate deploy && pnpm start:dev` | Hot reload, отладка, Swagger |

> **Не запускайте A и C вместе** — два процесса на `:3001` и одна БД → таймауты Prisma, `Broken pipe` в Postgres, спам в логах scheduler/outbox.

**`DATABASE_URL` и хосты:**

| Режим | `POSTGRES_HOST` | Порт Postgres | `DATABASE_URL` host |
|-------|-----------------|---------------|---------------------|
| Full Docker (app в compose) | `postgres` (в compose `environment`) | `5432` внутри сети | `@postgres:5432` |
| Local app + infra в Docker | `localhost` | `5433` (map в compose) | `@localhost:5433` |

Пример для **режима B/C** в `.env`:

```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5433
DATABASE_URL=postgresql://admin:YOUR_PASSWORD@localhost:5433/maxairline
REDIS_HOST=localhost
RABBITMQ_URI=amqp://admin:YOUR_PASSWORD@localhost:5672
S3_ENDPOINT=http://localhost:9000
SWAGGER_ENABLED=true
```

### 3 шага (режим B — local app)

```bash
cp .env.example .env
# Пароли и секреты: openssl rand -base64 32

docker compose up -d postgres redis rabbitmq minio redpanda

pnpm install
pnpm prisma migrate deploy
pnpm seed:demo
pnpm start:dev
```

**Full Docker (режим A):**

```bash
cp .env.example .env
docker compose up -d --build
# Демо-данные: SEED_DEMO=true в .env или:
docker compose exec app pnpm seed:demo
```

| Сервис | URL |
|--------|-----|
| API | http://localhost:3001 |
| Swagger | http://localhost:3001/docs (`/api/docs` → редирект сюда) |
| OpenAPI JSON | http://localhost:3001/openapi.json |
| Health | http://localhost:3001/health/ready |
| Frontend | http://localhost:3111 или http://localhost — [frontend README](../frontend/README.md) |

### Проверка поиска (после `seed:demo`)

Маршрут **JFK → SFO**, завтра:

```bash
curl -s -X POST http://localhost:3001/api/v1/flights/search \
  -H 'Content-Type: application/json' \
  -d '{"directions":[{"origin":"JFK","destination":"SFO","dateFrom":"'"$(date -u -d '+1 day' +%F 2>/dev/null || date -u -v+1d +%F)"'"}],"passengers":{"adults":1},"travelClass":"ECONOMY","currencyCode":"USD"}'
```

---

## Демо-доступ

| | |
|--|--|
| **Данные рейсов** | `pnpm seed:demo` — JFK→SFO, 14 дней, места и тарифы |
| **Демо-пользователь (UI)** | Зарегистрируйте вручную: `demo@maxairline.local` / `Demo1234!` (используется в [frontend capture script](../frontend/docs/screenshots/capture.mjs)) |
| **Поиск без логина** | POST `/api/v1/flights/search` — работает без auth |
| **Админ** | Пользователь с `role: ADMIN` в БД (через seed/admin или SQL) |

---

## Скриншоты

| Где | Что |
|-----|-----|
| **UI** (поиск, бронь, оплата) | [frontend/docs/screenshots](../frontend/docs/screenshots/) + `capture.mjs` |
| **Backend / ops** (Swagger, Grafana, health) | [docs/screenshots](./docs/screenshots/README.md) |

Для README бэкенда обычно достаточно 2–3 кадров: **Swagger `/docs`**, **Grafana** (`:3002`), **health/ready** JSON. UI-скрины живут во frontend — не дублируйте в backend README.

---

## Демо-сценарии

| Сценарий | Что работает | Что нужно | Чего нет |
|----------|--------------|-----------|----------|
| **A. Без оплаты** | Поиск, бронь, места, checkout до redirect | `.env`, Docker, `seed:demo` | PAID, PDF, email |
| **B. Полный флоу (Stripe)** | A + test checkout → webhook → PAID → TICKETED | [Stripe test + CLI](#полный-флоу-оплаты-stripe-test), RabbitMQ, MinIO, SMTP | Production SLA |
| **C. ЮKassa sandbox** | Как B, провайдер YooKassa | [ЮKassa + ngrok](#полный-флоу-оплаты-yookassa-test) | — |

---

## Полный флоу оплаты (Stripe Test)

[Stripe test mode](https://docs.stripe.com/test) — рекомендуемый сценарий для демо на собеседовании.

### Подготовка

```bash
cp .env.example .env
docker compose up -d postgres redis rabbitmq minio redpanda
pnpm prisma migrate deploy
pnpm seed:demo
pnpm start:dev
```

В `.env`:

```env
PAYMENT_PROVIDER_DEFAULT=STRIPE
STRIPE_SECRET_KEY=sk_test_...
APP_URL=http://localhost:3111
```

MinIO console: http://localhost:9001 (`minio` / `minio123`).

### Webhook forwarding

```bash
stripe listen --forward-to localhost:3001/api/v1/webhook/stripe
```

Скопируйте `whsec_...` → `STRIPE_WEBHOOK_SECRET` в `.env`, перезапустите API.

### Зависимости ticketing

| Сервис | Зачем | Локально |
|--------|-------|----------|
| RabbitMQ | `booking.paid` → ticket job | `docker compose up -d rabbitmq` |
| MinIO | PDF в S3 | `docker compose up -d minio` |
| SMTP | Email с билетом | Mailtrap (`MAILEXAM_*`) или Resend |

### UI walkthrough

1. Поиск JFK → SFO (дата в пределах 14 дней после seed).
2. Создать бронь → travelers → места → checkout.
3. Stripe Checkout: карта `4242 4242 4242 4242`.
4. Webhook → **PAID** → RabbitMQ → **TICKETED**.
5. `/payment/{transactionId}/success` — polling до TICKETED.

### Observability

Логи с `flow: booking-ticketing`:

`payment.succeeded` → `outbox.sent` → `rabbitmq.received` → `bullmq.enqueued` → `ticket.issued`

```bash
docker compose logs -f app | grep booking-ticketing
```

### Troubleshooting (Stripe)

| Симптом | Причина |
|---------|---------|
| `Stripe is not configured` | Пустой `STRIPE_SECRET_KEY` |
| Redirect OK, статус `PAYMENT_PENDING` | Нет `stripe listen` или неверный `STRIPE_WEBHOOK_SECRET` |
| PAID, но нет билета | RabbitMQ / MinIO / S3_* — проверьте `GET /health/ready` |
| Нет email | Нет SMTP/Resend — PDF может быть в MinIO |

---

## Полный флоу оплаты (YooKassa Test)

[Документация тестового магазина](https://yookassa.ru/developers/payment-acceptance/testing-and-going-live/testing).

### Credentials

```env
PAYMENT_PROVIDER_DEFAULT=YOOKASSA
YOOKASSA_SHOP_ID=...
YOOKASSA_API_KEY=...
YOOKASSA_CAPTURE=false
APP_URL=http://localhost:3111
```

Поиск и оплата в **RUB**. USD offer + YooKassa checkout → `400`.

### Публичный webhook (обязательно)

ЮKassa шлёт webhook с фиксированных IP на **HTTPS URL**:

```bash
ngrok http 3001
```

URL в личном кабинете:

```text
https://<subdomain>.ngrok-free.app/api/v1/webhook/yookassa
```

Backend проверяет IP (`verifyWebhookIp`).

### Troubleshooting (ЮKassa)

| Симптом | Причина |
|---------|---------|
| `YooKassa is not configured` | Пустые `YOOKASSA_SHOP_ID` / `YOOKASSA_API_KEY` |
| 404 на return URL | `APP_URL` должен указывать на frontend, не API |
| `Unauthorized webhook source` | Запрос не с IP ЮKassa |
| `Invalid webhook payload` на `payment.canceled` | Старый платёж без metadata — не ваша успешная оплата |

---

## Переменные окружения

Скопируйте [.env.example](.env.example) → `.env`. Не коммитьте `.env`.

Валидация при старте: `src/config/env.schema.ts` (Zod).

### Профили

| Профиль | Когда | Ключевые значения |
|---------|-------|-------------------|
| **Docker Compose** | App в контейнере | `POSTGRES_HOST=postgres`, `DATABASE_URL=...@postgres:5432/...` |
| **Local Node** | App на хосте | `POSTGRES_HOST=localhost`, `POSTGRES_PORT=5433` |

### Основные группы

| Группа | Переменные |
|--------|------------|
| App | `NODE_ENV`, `HTTP_PORT`, `APP_URL`, `HTTP_CORS`, `COOKIES_DOMAIN` |
| Database | `DATABASE_URL`, `POSTGRES_*` |
| Redis / Queues | `REDIS_*`, `QUEUE_PREFIX` |
| JWT | `JWT_SECRET`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, TTL |
| RabbitMQ | `RABBITMQ_URI`, `RABBITMQ_EXCHANGE`, `RABBITMQ_QUEUE` |
| Kafka | `KAFKA_BROKERS`, `KAFKA_CLIENT_ID`, consumer groups |
| S3 | `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` |
| Payments | `PAYMENT_PROVIDER_DEFAULT`, `STRIPE_*`, `YOOKASSA_*` |
| Email | `RESEND_API_KEY` или `MAILEXAM_*`, `MAIL_FROM` |
| OAuth | `VK_CLIENT_ID`, `VK_CLIENT_SECRET`, `VK_REDIRECT_URI` |
| Observability | `SENTRY_DSN`, `METRICS_AUTH_TOKEN`, `OTEL_EXPORTER_OTLP_ENDPOINT` |

Полная таблица — в [.env.example](.env.example). Production: отдельные JWT secrets, Swagger off, обязательные ключи PSP и Resend.

---

## Режимы запуска (детали)

Сводная таблица режимов — в [Быстрый старт](#режимы-запуска).

```bash
# Infra only (для pnpm start:dev)
docker compose up -d postgres redis rabbitmq minio redpanda

# Полный dev-стек (app + 11 сервисов)
docker compose up -d
docker compose logs -f app

# Production-образ
docker build -t ghcr.io/<owner>/max-airline:latest --target production .
docker compose -f docker-compose.production.yml up -d
```

Миграции в production — в entrypoint контейнера (`prisma migrate deploy`).

---

## База данных

### Миграции

```bash
pnpm prisma migrate dev --name your_migration   # dev: создать + применить
pnpm prisma migrate deploy                       # prod / Docker
pnpm prisma migrate status
pnpm prisma studio                               # http://localhost:5555
```

### Seed

| Команда | Описание |
|---------|----------|
| `pnpm seed:demo` | **Рекомендуется** — JFK→SFO, 14 дней, места и тарифы |
| `pnpm seed:full` | Расширенный датасет (30 дней, много маршрутов) |
| `pnpm seed:flights` | Только шаблоны рейсов |
| `pnpm seed:instances` | Инстансы рейсов (после flights) |
| `pnpm seed:refresh-layouts` | Обновить layout ВС |
| `pnpm seed:aircraft-layouts` | Алиас на `seed:refresh-layouts` |
| `pnpm seed:seat-templates` | Шаблоны мест |
| `pnpm seed:cleanup-facilities` | Убрать пересекающиеся facility в layout |
| `pnpm analytics:rebuild` | Пересборка CQRS read model |
| `pnpm kafka:create-topics` | Создание Kafka-топиков |
| `pnpm verify:kafka` | Проверка событий в Redpanda (bash) |

### Ключевые модели (Prisma)

`User`, `Booking`, `Transaction`, `Traveler`, `FlightInstance`, `FlightSeat`, `SeatAssignment`, `Ticket`, `OutboxMessage`, `DomainEvent`, `UserNotification`, `BookingAnalyticsDaily`

### Статусы

- **Booking:** `PNR_CREATED` → `SEATS_SELECTED` → `PAYMENT_PENDING` → `PAID` → `TICKETING` → `TICKETED` (+ `CANCELED`, `EXPIRED`, `FAILED`)
- **Transaction:** `PENDING` / `AUTHORIZED` → `SUCCEED` | `FAILED` | `CANCELED`

---

## Docker-сервисы

| Сервис | Порт | Назначение |
|--------|------|------------|
| app | 3001 | NestJS API |
| postgres | 5433→5432 | PostgreSQL |
| redis | 6379 | Кэш + BullMQ |
| rabbitmq | 5672, 15672 | Ticketing events (+ UI) |
| redpanda | 19092 | Kafka-compatible broker |
| minio | 9000, 9001 | S3 для PDF |
| prometheus | 9090 | Метрики |
| grafana | 3002 | Дашборды |
| postgres-exporter | 9187 | DB metrics |
| redis-exporter | 9121 | Redis metrics |

---

## API и Swagger

При `SWAGGER_ENABLED=true`:

- **Swagger UI:** http://localhost:3001/docs
- **OpenAPI JSON:** http://localhost:3001/openapi.json

Префикс: `/api/v1`. Исключения: `/health`, `/health/ready`, `/metrics`.

### Ключевые endpoints

| Method | Path | Описание |
|--------|------|----------|
| POST | `/api/v1/flights/search` | Поиск рейсов |
| POST | `/api/v1/flight/pricing` | Цена оффера |
| POST | `/api/v1/booking` | Создать бронь (`Idempotency-Key`) |
| GET | `/api/v1/payment/transaction/:id` | Статус транзакции |
| POST | `/api/v1/webhook/stripe` | Stripe webhook |
| POST | `/api/v1/webhook/yookassa` | YooKassa webhook |
| POST | `/api/v1/auth/login` | Логин |
| POST | `/api/v1/auth/refresh` | Refresh token (cookie) |
| GET | `/api/v1/users/me/notifications` | Уведомления |

---

## Admin API

JWT с `role: ADMIN`. UI — [frontend `/dashboard`](../frontend/README.md).

| Method | Path | Описание |
|--------|------|----------|
| GET | `/api/v1/admin/dashboard` | Статистика |
| GET/PATCH | `/api/v1/admin/users/*` | Пользователи, block/unblock |
| GET/PATCH | `/api/v1/admin/bookings/*` | Брони |
| GET/POST/PATCH | `/api/v1/admin/flights/*` | Рейсы |
| POST | `/api/v1/admin/payments/:id/confirm` | Ручное подтверждение |
| POST | `/api/v1/admin/payments/:id/cancel` | Отмена pending |

---

## Аутентификация и VK OAuth

| Механизм | Детали |
|----------|--------|
| Access token | JWT в `Authorization: Bearer` |
| Refresh token | HttpOnly cookie, rotation, revoke chain |
| CSRF | `x-xsrf-token` + cookie для мутаций с cookie-auth |
| Пароли | Argon2id |
| VK OAuth | `/auth/vk/prepare`, `/auth/vk/exchange` |

| Backend `.env` | Frontend `.env` |
|----------------|-----------------|
| `VK_CLIENT_ID` | `NEXT_PUBLIC_VK_APP_ID` |
| `VK_REDIRECT_URI` | `NEXT_PUBLIC_VK_REDIRECT_URL` |

---

## Мониторинг

| Инструмент | URL |
|------------|-----|
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3002 (`admin` / `admin`) |
| App metrics | http://localhost:3001/metrics |

Structured logs: Pino с redaction чувствительных полей. Sentry — опционально через `SENTRY_DSN`.

---

## Тестирование

```bash
pnpm test              # unit (~151 spec)
pnpm test:e2e          # e2e, Testcontainers Postgres
pnpm test:integration  # payment → outbox → RabbitMQ → ticketing
pnpm test:cov          # coverage
pnpm lint && pnpm build
```

### Пирамида тестов

| Уровень | Что покрывает |
|---------|---------------|
| Unit | Providers, handlers, utils, DTO validation |
| E2E | HTTP API: auth, bookings, payment, webhook, admin |
| Integration | Полная async-цепочка с docker-compose infra |

Integration (требует postgres, redis, rabbitmq, minio):

```bash
docker compose up -d postgres redis rabbitmq minio
pnpm prisma migrate deploy && pnpm seed:demo
pnpm test:integration
```

---

## CI/CD

### CI (`.github/workflows/ci.yml`)

Триггер: push/PR в `main`.

1. `pnpm install --frozen-lockfile`
2. `prisma generate`
3. `pnpm lint`
4. `pnpm test --passWithNoTests`
5. `pnpm build`
6. (main only) Docker build → push **GHCR** (`:latest` + SHA)

### CD (`.github/workflows/cd.yml`)

После успешного CI на `main`: SSH deploy на VPS → `docker pull` → `docker compose -f docker-compose.production.yml up -d`.

---

## Структура проекта

```
src/
├── main.ts                 # Bootstrap, versioning, Swagger
├── app.module.ts
├── config/                 # Env (Zod), CORS, JWT
├── common/                 # Guards, filters, pipes, strategies
├── infra/
│   ├── db/prisma/
│   ├── redis/
│   ├── rabbitmq/           # booking.paid consumer
│   ├── kafka/              # audit, notifications, analytics
│   ├── outbox/             # Reliable message dispatch
│   ├── mail/               # BullMQ + Resend
│   ├── pdf/                # Puppeteer e-ticket
│   └── storage/s3/
├── modules/
│   ├── flights/            # Search, pricing, inventory
│   ├── bookings/           # Lifecycle, checkout, outbox handlers
│   ├── payment/            # Stripe, YooKassa, webhooks
│   ├── seatmaps/
│   ├── ticketing/
│   ├── auth/               # JWT, VK, sessions
│   ├── users/              # Profile, notifications
│   └── admin/              # Dashboard, CRUD
├── health/
└── metrics/
prisma/schema.prisma        # 19 migrations
test/                       # e2e, integration, helpers
scripts/seeds/              # Demo/full datasets
docs/screenshots/           # README для скринов Swagger/Grafana
```

Конвенции кода: [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## Ограничения и честные оговорки

Честность в README — сигнал зрелости для ревьюера ([portfolio guides 2026](https://scrimba.com/articles/how-to-build-a-web-developer-portfolio-that-gets-you-hired/)).

- **Цены симулированные** — не ATPCO/GDS; fare brands и налоги настраиваются в env.
- **Инвентарь internal** — рейсы и места из seed/migrations, не live airline APIs.
- **ЮKassa локально** — нужен ngrok или публичный URL для webhook.
- **Puppeteer в Docker** — production-образ с Chromium; увеличивает размер image.
- **Нет multi-region / HA** — один VPS deploy; outbox и idempotency закладывают основу для масштабирования.

---

## Что бы улучшил дальше

Секция self-critique — ожидается в сильных portfolio README 2026.

1. **Contract tests** для Stripe/YooKassa webhook payloads (record/replay fixtures).
2. **Dead-letter queues** и алерты на failed outbox / BullMQ jobs в Grafana.
3. **Read replicas** или materialized views для тяжёлого admin analytics.
4. **Feature flags** для переключения PSP без redeploy.
5. **OpenAPI SDK generation** для frontend (типобезопасный клиент).
6. **Chaos testing** RabbitMQ/Kafka disconnect в integration suite.
7. **Вынести ticketing** в отдельный worker-сервис при росте нагрузки.

---

## Troubleshooting

### Порт занят

```bash
# Windows
netstat -ano | findstr :3001
# macOS / Linux
lsof -i :3001
```

### Ошибка подключения к БД

- **App в Docker:** host `postgres`, port `5432` (задаётся в `docker-compose.yml`)
- **App на хосте:** host `localhost`, port `5433`

```bash
docker compose ps && docker compose logs postgres
```

### Два backend / таймауты в логах

Если в логах каждые 5 с `Connection terminated due to connection timeout` (Scheduler/outbox) — часто запущены **docker `app` + `pnpm start:dev`** на одном Postgres. Оставьте один процесс API.

### Redis

```bash
docker compose exec redis redis-cli -a YOUR_REDIS_PASSWORD ping
# PONG
```

### CORS

```env
HTTP_CORS=http://localhost:3111,http://localhost
```

### Swagger не открывается

`SWAGGER_ENABLED=true` → http://localhost:3001/docs (не `/api/docs`).

---

## Безопасность

1. Не коммитьте `.env` — только `.env.example`
2. Секреты: `openssl rand -base64 32`
3. Production: HTTPS на reverse proxy, rotate secrets
4. `METRICS_AUTH_TOKEN` обязателен в production
5. YooKassa: IP verification webhook
6. S3: предпочитать IAM roles вместо static keys

---

## Связанная документация

| Документ | Содержание |
|----------|------------|
| [../README.md](../README.md) | Обзор monorepo |
| [../frontend/README.md](../frontend/README.md) | Next.js клиент |
| [docs/payment.md](./docs/payment.md) | Payment: webhook-first flow, idempotency, capture/refund, outbox |
| [docs/seatmaps.md](./docs/seatmaps.md) | Seatmaps: availability, pricing catalog, stale read |
| [docs/ticketing.md](./docs/ticketing.md) | Ticketing: async issuance, compensation, mail ordering |
| [docs/users.md](./docs/users.md) | Users: profile, saved passengers, notifications, concurrency |
| [docs/scheduler.md](./docs/scheduler.md) | Scheduler: maintenance pipeline, cron intervals, multi-instance lock |
| [docs/flights.md](./docs/flights.md) | Flights: search cache, pricing quotes, FX, schedule sync |
| [../ARCHITECTURE.md](../ARCHITECTURE.md) | Архитектурный разбор |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Конвенции, Swagger |
| [AUTHORIZATION_SYSTEM.md](./AUTHORIZATION_SYSTEM.md) | Auth flow |
| [RABBITMQ_SUMMARY.md](./RABBITMQ_SUMMARY.md) | RabbitMQ integration |

---

## License

Private. All rights reserved.
