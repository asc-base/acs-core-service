#!/bin/sh
set -e
# === Config (optional) ===
: "${DB_WAIT_TIMEOUT:=60}"
: "${SKIP_MIGRATE:=false}"
: "${RUN_SEED:=false}"

run_prisma() {
  if command -v bun >/dev/null 2>&1; then
    bunx --no-install prisma "$@"
  else
    npx --no-install prisma "$@"
  fi
}

# === Wait for DB (optional) ===
if [ -n "$DATABASE_HOST" ] && [ -n "$DATABASE_PORT" ]; then
  echo "Waiting for DB at $DATABASE_HOST:$DATABASE_PORT (timeout ${DB_WAIT_TIMEOUT}s)..."
  start_ts=$(date +%s)
  while ! nc -z "$DATABASE_HOST" "$DATABASE_PORT" 2>/dev/null; do
    sleep 1
    now_ts=$(date +%s)
    elapsed=$((now_ts - start_ts))
    if [ "$elapsed" -ge "$DB_WAIT_TIMEOUT" ]; then
      echo "Timed out waiting for DB after ${DB_WAIT_TIMEOUT}s"
      exit 1
    fi
  done
  echo "DB is ready."
fi
# === Prisma migrate deploy (prod) ===
if [ "$SKIP_MIGRATE" != "true" ]; then
  echo "Running Prisma migrations..."
  run_prisma migrate deploy
else
  echo "Skipping Prisma migrate deploy (SKIP_MIGRATE=true)"
fi
# === (Optional) seed ===
if [ "$RUN_SEED" = "true" ]; then
  echo "Seeding database..."
  run_prisma db seed
fi
exec "$@"
