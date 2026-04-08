#!/usr/bin/env bash
# scripts/backup.sh
# ─────────────────────────────────────────────────────────────────────────────
# T14: Database backup to Azure Blob Storage
# Usage:
#   bash scripts/backup.sh                     # live backup
#   DB_PATH=/custom/path.db bash scripts/backup.sh
#
# Required environment variables (or defaults):
#   DB_PATH                  - SQLite database file path (default: /app/data/vedaaide.db)
#   AZURE_BLOB_ACCOUNT_NAME  - Azure Storage account name
#   AZURE_BLOB_ACCOUNT_KEY   - Azure Storage account key
#   BACKUP_CONTAINER_NAME    - Azure Blob container (default: backups)
#   BACKUP_RETENTION_DAYS    - Days to keep backups (default: 30)
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

DB_PATH="${DB_PATH:-/app/data/vedaaide.db}"
BACKUP_DIR="${BACKUP_DIR:-/tmp/vedaaide-backups}"
BACKUP_CONTAINER_NAME="${BACKUP_CONTAINER_NAME:-backups}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="vedaaide_${DATE}.db"

echo "=== VedaAide Database Backup ==="
echo "Source DB    : $DB_PATH"
echo "Backup file  : $BACKUP_FILE"
echo "Container    : $BACKUP_CONTAINER_NAME"
echo ""

# ── Validate source database ──────────────────────────────────────────────────
if [[ ! -f "$DB_PATH" ]]; then
  echo "Error: Database file not found: $DB_PATH"
  exit 1
fi

# ── Create local backup directory ─────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"

# ── Create SQLite backup ───────────────────────────────────────────────────────
echo "Creating SQLite backup..."
if command -v sqlite3 &>/dev/null; then
  sqlite3 "$DB_PATH" ".backup ${BACKUP_DIR}/${BACKUP_FILE}"
else
  # Fallback: copy file (requires brief lock — use during low traffic)
  cp "$DB_PATH" "${BACKUP_DIR}/${BACKUP_FILE}"
fi
echo "✅ Local backup created: ${BACKUP_DIR}/${BACKUP_FILE}"

# ── Upload to Azure Blob Storage ───────────────────────────────────────────────
if [[ -n "${AZURE_BLOB_ACCOUNT_NAME:-}" && -n "${AZURE_BLOB_ACCOUNT_KEY:-}" ]]; then
  echo "Uploading to Azure Blob Storage..."

  if command -v az &>/dev/null; then
    az storage blob upload \
      --account-name "$AZURE_BLOB_ACCOUNT_NAME" \
      --account-key "$AZURE_BLOB_ACCOUNT_KEY" \
      --container-name "$BACKUP_CONTAINER_NAME" \
      --name "$BACKUP_FILE" \
      --file "${BACKUP_DIR}/${BACKUP_FILE}" \
      --overwrite false

    echo "✅ Uploaded to blob: ${BACKUP_CONTAINER_NAME}/${BACKUP_FILE}"
  else
    echo "⚠️  Azure CLI not available. Skipping upload."
  fi
else
  echo "⚠️  AZURE_BLOB_ACCOUNT_NAME/KEY not set. Skipping upload (local backup only)."
fi

# ── Prune old local backups ────────────────────────────────────────────────────
echo "Pruning backups older than ${BACKUP_RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "vedaaide_*.db" -mtime "+${BACKUP_RETENTION_DAYS}" -delete
echo "✅ Pruning complete"

echo ""
echo "✅ Backup completed: $BACKUP_FILE"
