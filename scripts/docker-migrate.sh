#!/bin/sh
set -e

run_migrate_deploy() {
  pnpm exec prisma migrate deploy
}

if run_migrate_deploy 2>/tmp/prisma-migrate.err; then
  exit 0
fi

if grep -Eq 'P3005|The database schema is not empty' /tmp/prisma-migrate.err; then
  echo 'Baselining empty migration history on existing database (init only)...'

  if [ -d prisma/migrations/20250718120000_init ]; then
    pnpm exec prisma migrate resolve --applied 20250718120000_init
  fi

  if ! run_migrate_deploy 2>/tmp/prisma-migrate.err; then
    cat /tmp/prisma-migrate.err >&2
    exit 1
  fi

  exit 0
fi

cat /tmp/prisma-migrate.err >&2
exit 1
