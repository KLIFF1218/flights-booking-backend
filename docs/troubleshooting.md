# Troubleshooting

Common local development issues. For payment-specific symptoms (Stripe / YooKassa), see [payment.md](./payment.md#local-walkthrough-stripe-test).

## Port already in use (EADDRINUSE)

```bash
# Windows
netstat -ano | findstr :3001
# macOS / Linux
lsof -i :3001
```

Stop the conflicting process or change `HTTP_PORT` in `.env`.

## PostgreSQL connection errors

| Setup | `DATABASE_URL` host | Port |
|-------|---------------------|------|
| App in Docker Compose | `postgres` | `5432` (internal) |
| App on host, DB in Docker | `localhost` | `5433` (published) |

```bash
docker compose ps && docker compose logs postgres
```

## Two API processes on the same database

If logs show `Connection terminated due to connection timeout` every ~5s (scheduler / outbox), you often have **both** `docker compose` `app` **and** `pnpm start:dev` running against one Postgres. Keep a single API process.

Do not run **Full Docker** (mode A) and **local app** (mode B/C) at the same time on `:3001`.

## Redis

```bash
docker compose exec redis redis-cli -a YOUR_REDIS_PASSWORD ping
# PONG
```

## CORS

Frontend origin must be listed in `HTTP_CORS`:

```env
HTTP_CORS=http://localhost:3111,http://localhost
```

## Swagger does not open

Set `SWAGGER_ENABLED=true` and open http://localhost:3001/docs (not `/api/docs` — that redirects).

## MinIO / S3 (ticketing PDF)

- Console: http://localhost:9001 (default dev credentials in `.env.example`)
- Check `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`
- If PAID but no ticket: verify RabbitMQ, MinIO, and `GET /health/ready`

## Docker production build: husky / prepare script

Production image uses `pnpm install --prod --ignore-scripts` so the `prepare` / husky hook does not run without devDependencies.

## Payment redirect OK but booking stays `PAYMENT_PENDING`

Webhook did not reach the API. For Stripe use `stripe listen`; for YooKassa use a public HTTPS URL (e.g. ngrok). See [payment.md](./payment.md).

## No ticket email after `PAID`

SMTP / Resend may be unset. PDF can still exist in MinIO. Configure `RESEND_API_KEY` or `MAILEXAM_*` in `.env`.
