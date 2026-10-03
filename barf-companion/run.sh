#!/bin/sh
set -e

export STORAGE_BACKEND="${STORAGE_BACKEND:-json}"
export JSON_DATA_DIR="${JSON_DATA_DIR:-/config/barf-companion}"
export FLASK_DEBUG="false"
export INGRESS_PORT=8099

mkdir -p "$JSON_DATA_DIR"

exec gunicorn \
  --bind 0.0.0.0:${INGRESS_PORT} \
  --workers 1 \
  --timeout 60 \
  app:app
