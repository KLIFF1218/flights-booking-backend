#!/usr/bin/env bash
# Cloud Agent install phase: durable, idempotent repository setup.
# - Installs Docker Engine (used to run local infra: Postgres/Redis/RabbitMQ/MinIO/Redpanda).
# - Configures the fuse-overlayfs storage driver, required for nested-VM Docker.
# - Creates a local dev .env with throwaway credentials when one is not present.
# - Installs Node dependencies and generates the Prisma client.
# Safe to run repeatedly; each step is guarded.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

log() { printf '\n=== %s ===\n' "$1"; }

# ---------------------------------------------------------------------------
# 1. Docker Engine
# ---------------------------------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
  log "Installing Docker Engine"
  curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
  sudo sh /tmp/get-docker.sh
fi

# ---------------------------------------------------------------------------
# 2. fuse-overlayfs storage driver (Docker's default overlayfs cannot handle
#    image whiteout files inside the nested Cloud Agent VM).
# ---------------------------------------------------------------------------
if ! command -v fuse-overlayfs >/dev/null 2>&1; then
  log "Installing fuse-overlayfs"
  sudo DEBIAN_FRONTEND=noninteractive apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    -o Dpkg::Options::=--force-confold fuse-overlayfs
fi

log "Configuring Docker daemon (fuse-overlayfs)"
sudo mkdir -p /etc/docker
if [ ! -f /etc/docker/daemon.json ]; then
  printf '%s\n' '{ "storage-driver": "fuse-overlayfs", "features": { "containerd-snapshotter": false } }' \
    | sudo tee /etc/docker/daemon.json >/dev/null
fi

# ---------------------------------------------------------------------------
# 3. Local dev environment file (never overwrite an existing one).
#    Must exist before `prisma generate`, which reads DATABASE_URL via dotenv.
# ---------------------------------------------------------------------------
if [ ! -f .env ]; then
  log "Creating local dev .env (random throwaway credentials)"
  PG_PW="$(openssl rand -hex 16)"
  REDIS_PW="$(openssl rand -hex 16)"
  RABBIT_PW="$(openssl rand -hex 16)"
  JWT_SECRET="$(openssl rand -base64 32)"
  JWT_ACCESS="$(openssl rand -base64 32)"
  JWT_REFRESH="$(openssl rand -base64 32)"
  cat > .env <<EOF
# Auto-generated local dev config (infra in Docker, app on host).
GITHUB_REPOSITORY=kliff1218/max-airline
NODE_ENV=development
LOG_LEVEL=info
HTTP_HOST=0.0.0.0
HTTP_PORT=3001
APP_HOST=http://localhost:3001
SWAGGER_ENABLED=true
HTTP_CORS=http://localhost,http://localhost:80,http://localhost:3111
COOKIES_DOMAIN=localhost

POSTGRES_DB=maxairline
POSTGRES_USER=admin
POSTGRES_PASSWORD=${PG_PW}
POSTGRES_HOST=localhost
POSTGRES_PORT=5433
DATABASE_URL=postgresql://admin:${PG_PW}@localhost:5433/maxairline

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PW}
REDIS_URL=redis://:${REDIS_PW}@localhost:6379
REDIS_TLS=false

JWT_SECRET=${JWT_SECRET}
JWT_ACCESS_SECRET=${JWT_ACCESS}
JWT_REFRESH_SECRET=${JWT_REFRESH}
JWT_EXPIRES_ACCESS_TOKEN=15m
JWT_EXPIRES_REFRESH_TOKEN=7d

VK_CLIENT_ID=YOUR_VK_CLIENT_ID
VK_CLIENT_SECRET=YOUR_VK_CLIENT_SECRET
VK_GRANT_TYPE=authorization_code
VK_REDIRECT_URI=http://localhost

PAYMENT_PROVIDER_DEFAULT=STRIPE
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
APP_URL=http://localhost
YOOKASSA_SHOP_ID=
YOOKASSA_API_KEY=
YOOKASSA_CAPTURE=false

RESEND_API_KEY=re_YOUR_RESEND_API_KEY
MAIL_FROM=onboarding@resend.dev

QUEUE_PREFIX=dev

RABBITMQ_USER=admin
RABBITMQ_PASSWORD=${RABBIT_PW}
RABBITMQ_URI=amqp://admin:${RABBIT_PW}@localhost:5672
RABBITMQ_EXCHANGE=booking.events
RABBITMQ_QUEUE=booking.ticketing
RABBITMQ_DLX=booking.events.dlx

KAFKA_BROKERS=localhost:19092
KAFKA_CLIENT_ID=max-airline
KAFKA_AUDIT_CONSUMER_GROUP=booking-audit
KAFKA_NOTIFICATIONS_CONSUMER_GROUP=booking-notifications
KAFKA_ANALYTICS_CONSUMER_GROUP=booking-analytics
KAFKA_DOMAIN_TOPICS=booking.created,booking.expired,booking.paid,booking.canceled,booking.ticketing.failed,ticket.issued,payment.failed,payment.reconciliation.refunded,flight.delayed,flight.cancelled

MINIO_ROOT_USER=minio
MINIO_ROOT_PASSWORD=minio123
S3_ENDPOINT=http://localhost:9000
S3_PUBLIC_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_BUCKET=my-tickets
S3_ACCESS_KEY=minio
S3_SECRET_KEY=minio123
S3_FORCE_PATH_STYLE=true

SEED_DEMO=false

FX_API_URL=https://api.frankfurter.app/latest?from=USD
FX_CACHE_TTL_SECONDS=3600
FX_FALLBACK_RATES={"USD":1,"EUR":0.92,"RUB":90}

MIN_DOMESTIC_TURNAROUND_MINUTES=120
MIN_INTERNATIONAL_TURNAROUND_MINUTES=180

FARE_TAX_YQ_RATE=0.08
FARE_TAX_YR_RATE=0.05
BOOKING_SERVICE_FEE=5

SENTRY_DSN=
SENTRY_SEND_DEFAULT_PII=false
SENTRY_TRACES_SAMPLE_RATE=0
SENTRY_DEBUG=0

GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=admin
EOF
fi

# ---------------------------------------------------------------------------
# 4. Node dependencies + Prisma client
# ---------------------------------------------------------------------------
log "Installing Node dependencies"
corepack enable >/dev/null 2>&1 || true
pnpm install --frozen-lockfile

log "Generating Prisma client"
pnpm exec prisma generate

log "install.sh complete"
