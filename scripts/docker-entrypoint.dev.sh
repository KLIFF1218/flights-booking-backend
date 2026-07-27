#!/bin/sh
set -e

shutdown() {
  echo "Received shutdown signal, stopping application..."
  kill -TERM "$child" 2>/dev/null || true
  wait "$child"
}

trap shutdown TERM INT

pnpm install --frozen-lockfile
pnpm exec prisma generate
sh /app/scripts/docker-migrate.sh

if [ "${SEED_DEMO}" = "true" ]; then
  echo 'Running demo seed (SEED_DEMO=true)...'
  pnpm seed:demo
fi

rm -rf dist
pnpm start:dev &
child=$!
wait "$child"
