#!/bin/sh
set -e

# Run Prisma migrations
echo "Running Prisma migrations..."
npx prisma migrate deploy || true

# Start the Next.js server
echo "Starting Next.js server..."
exec node server.js
