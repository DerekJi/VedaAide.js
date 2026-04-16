# Multi-stage build for production

# ── Builder ───────────────────────────────────────────────────────────────────
FROM node:24-slim AS builder
WORKDIR /app

# Install OS-level deps required by Prisma query engine on Debian/Ubuntu
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma/

# Install all deps + auto-runs `prisma generate` via postinstall hook
RUN npm ci

# Copy application source (node_modules already present from previous layer)
COPY . .

# Build Next.js application
RUN npm run build

# ── Runner ────────────────────────────────────────────────────────────────────
FROM node:24-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# OpenSSL is required by Prisma at runtime
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

RUN useradd -m -u 1001 nextjs

# Create data directory for SQLite database
RUN mkdir -p /app/data && chown nextjs:nextjs /app/data

# Copy built artifacts
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Ensure nextjs user owns working directory
RUN chown -R nextjs:nextjs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
