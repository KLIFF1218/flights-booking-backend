#!/bin/sh
set -e

sh /app/scripts/docker-migrate.sh
exec "$@"
