#!/bin/sh
set -e

MINIO_HOST="${MINIO_HOST:-minio}"
MINIO_PORT="${MINIO_PORT:-9000}"
MINIO_ROOT_USER="${MINIO_ROOT_USER:-minio}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-minio123}"
S3_BUCKET="${S3_BUCKET:-my-tickets}"

echo "Waiting for MinIO at ${MINIO_HOST}:${MINIO_PORT}..."
until mc alias set local "http://${MINIO_HOST}:${MINIO_PORT}" "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}" 2>/dev/null; do
  sleep 1
done

echo "Creating bucket ${S3_BUCKET} (if missing)..."
mc mb "local/${S3_BUCKET}" --ignore-existing

echo "MinIO init complete."
