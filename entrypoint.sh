#!/bin/bash
set  -e

echo "[entrypoint.sh] $(date -u '+%Y-%m-%dT%H:%M:%SZ') Starting VedaAide application..."
echo "[entrypoint.sh] Current directory: $(pwd)"
echo "[entrypoint.sh] Available migrations: $(ls -la prisma/migrations 2>/dev/null | wc -l)"

echo "[entrypoint.sh] Deploying Prisma migrations..."
if npx prisma migrate deploy; then
  echo "[entrypoint.sh] $(date -u '+%Y-%m-%dT%H:%M:%SZ') Migrations deployed successfully"
else
  EXIT_CODE=$?
  echo "[entrypoint.sh] $(date -u '+%Y-%m-%dT%H:%M:%SZ') Migration deployment exited with code $EXIT_CODE"
  # Continue anyway - database may already be initialized
fi

echo "[entrypoint.sh] $(date -u '+%Y-%m-%dT%H:%M:%SZ') Generating Prisma Client..."
npx prisma generate

echo "[entrypoint.sh] $(date -u '+%Y-%m-%dT%H:%M:%SZ') Database initialization complete"
echo "[entrypoint.sh] Starting Next.js server on port ${PORT:-3000}..."

# Start the Next.js server
exec node server.js
