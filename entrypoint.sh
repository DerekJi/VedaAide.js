#!/bin/bash
set  -e

#!/bin/bash
set  -e

echo "[entrypoint.sh] $(date -u '+%Y-%m-%dT%H:%M:%SZ') Starting VedaAide application..."
echo "[entrypoint.sh] Current directory: $(pwd)"

MIGRATION_COUNT=$(ls -la prisma/migrations 2>/dev/null | wc -l)
echo "[entrypoint.sh] Available migrations: $MIGRATION_COUNT"

if [ "$MIGRATION_COUNT" -gt 0 ]; then
  echo "[entrypoint.sh] Running prisma migrate deploy..."
  if npx prisma migrate deploy; then
    echo "[entrypoint.sh] $(date -u '+%Y-%m-%dT%H:%M:%SZ') Migrations deployed successfully"
  else
    EXIT_CODE=$?
    echo "[entrypoint.sh] $(date -u '+%Y-%m-%dT%H:%M:%SZ') Migration deployment exited with code $EXIT_CODE"
    echo "[entrypoint.sh] Falling back to prisma db push..."
    npx prisma db push --accept-data-loss || echo "[entrypoint.sh] prisma db push also failed, continuing anyway"
  fi
else
  echo "[entrypoint.sh] No migration files found. Using prisma db push to sync schema..."
  if npx prisma db push --accept-data-loss; then
    echo "[entrypoint.sh] $(date -u '+%Y-%m-%dT%H:%M:%SZ') Schema pushed successfully"
  else
    EXIT_CODE=$?
    echo "[entrypoint.sh] $(date -u '+%Y-%m-%dT%H:%M:%SZ') Schema push exited with code $EXIT_CODE, continuing anyway"
  fi
fi

echo "[entrypoint.sh] $(date -u '+%Y-%m-%dT%H:%M:%SZ') Generating Prisma Client..."
npx prisma generate

echo "[entrypoint.sh] $(date -u '+%Y-%m-%dT%H:%M:%SZ') Database initialization complete"
echo "[entrypoint.sh] Starting Next.js server on port ${PORT:-3000}..."

# Start the Next.js server
exec node server.js
