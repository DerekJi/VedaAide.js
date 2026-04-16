#!/bin/bash
set  -e

echo "[entrypoint.sh] Starting VedaAide application..."
echo "[entrypoint.sh] Running Prisma migrations..."

# Run Prisma migrations - this will create/update the database schema
npx prisma migrate deploy 2>&1 || echo "[entrypoint.sh] Migration warning (may be expected if already deployed)"

echo "[entrypoint.sh] Database initialization complete"
echo "[entrypoint.sh] Starting Next.js server..."

# Start the Next.js server
exec node server.js
