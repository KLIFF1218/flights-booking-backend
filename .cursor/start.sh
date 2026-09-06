#!/usr/bin/env bash
# Cloud Agent start phase: per-boot service reconciliation.
# - Starts the Docker daemon (no systemd in the Cloud Agent VM).
# - Brings up local infra containers and waits for health.
# - Ensures the MinIO bucket exists, applies Prisma migrations, seeds demo data.
# The NestJS API itself runs in the "api" terminal defined in environment.json.
# Idempotent: safe to run on every boot.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

log() { printf '\n=== %s ===\n' "$1"; }

# ---------------------------------------------------------------------------
# 1. Docker daemon
# ---------------------------------------------------------------------------
if ! sudo docker info >/dev/null 2>&1; then
  log "Starting Docker daemon"
  sudo nohup dockerd >/tmp/dockerd.log 2>&1 &
  for _ in $(seq 1 60); do
    sudo docker info >/dev/null 2>&1 && break
    sleep 1
  done
fi
sudo docker info >/dev/null 2>&1 || { echo "Docker daemon failed to start" >&2; tail -20 /tmp/dockerd.log >&2 || true; exit 1; }

# ---------------------------------------------------------------------------
# 2. Infra containers
# ---------------------------------------------------------------------------
log "Starting infra containers"
sudo docker compose up -d postgres redis rabbitmq minio redpanda

# ---------------------------------------------------------------------------
# 3. Wait for health
# ---------------------------------------------------------------------------
log "Waiting for infra to become healthy"
for svc in postgres redis rabbitmq minio; do
  cid="$(sudo docker compose ps -q "$svc")"
  for _ in $(seq 1 60); do
    status="$(sudo docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo starting)"
    [ "$status" = "healthy" ] && break
    sleep 2
  done
  echo "  $svc: ${status:-unknown}"
done

# ---------------------------------------------------------------------------
# 4. MinIO bucket (inter-container networking is unreliable in the nested VM,
#    so create it from the host network instead of the compose init job).
# ---------------------------------------------------------------------------
log "Ensuring MinIO bucket"
MINIO_USER="$(grep -E '^MINIO_ROOT_USER=' .env | cut -d= -f2- || echo minio)"
MINIO_PW="$(grep -E '^MINIO_ROOT_PASSWORD=' .env | cut -d= -f2- || echo minio123)"
S3_BUCKET="$(grep -E '^S3_BUCKET=' .env | cut -d= -f2- || echo my-tickets)"
sudo docker run --rm --network host --entrypoint sh minio/mc:latest -c \
  "mc alias set local http://127.0.0.1:9000 '${MINIO_USER}' '${MINIO_PW}' && mc mb 'local/${S3_BUCKET}' --ignore-existing" || true

# ---------------------------------------------------------------------------
# 5. Database migrations + demo data
# ---------------------------------------------------------------------------
log "Applying Prisma migrations"
pnpm exec prisma migrate deploy

log "Seeding demo data"
pnpm seed:demo

log "start.sh complete — API will start in the 'api' terminal"
