#!/usr/bin/env bash
# scripts/restore.sh
# ─────────────────────────────────────────────────────────────────────────────
# T14: Database restore from local backup or Azure Blob Storage
# Usage:
#   bash scripts/restore.sh --file vedaaide_20260408_120000.db
#   bash scripts/restore.sh --from-blob vedaaide_20260408_120000.db
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

DB_PATH="${DB_PATH:-/app/data/vedaaide.db}"
BACKUP_DIR="${BACKUP_DIR:-/tmp/vedaaide-backups}"
BACKUP_CONTAINER_NAME="${BACKUP_CONTAINER_NAME:-backups}"
BACKUP_FILE=""
FROM_BLOB=false

# ── Argument parsing ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --file)       BACKUP_FILE="$2"; shift 2 ;;
    --from-blob)  BACKUP_FILE="$2"; FROM_BLOB=true; shift 2 ;;
    *)            echo "Unknown argument: $1"; exit 1 ;;
  esac
done

if [[ -z "$BACKUP_FILE" ]]; then
  echo "Usage:"
  echo "  bash scripts/restore.sh --file <backup-file>"
  echo "  bash scripts/restore.sh --from-blob <backup-file>"
  exit 1
fi

echo "=== VedaAide Database Restore ==="
echo "Backup file : $BACKUP_FILE"
echo "Target DB   : $DB_PATH"
echo ""

# ── Download from Azure Blob if requested ─────────────────────────────────────
if [[ "$FROM_BLOB" == "true" ]]; then
  if [[ -z "${AZURE_BLOB_ACCOUNT_NAME:-}" || -z "${AZURE_BLOB_ACCOUNT_KEY:-}" ]]; then
    echo "Error: AZURE_BLOB_ACCOUNT_NAME and AZURE_BLOB_ACCOUNT_KEY are required for --from-blob"
    exit 1
  fi

  echo "Downloading from Azure Blob Storage..."
  mkdir -p "$BACKUP_DIR"

  az storage blob download \
    --account-name "$AZURE_BLOB_ACCOUNT_NAME" \
    --account-key "$AZURE_BLOB_ACCOUNT_KEY" \
    --container-name "$BACKUP_CONTAINER_NAME" \
    --name "$BACKUP_FILE" \
    --file "${BACKUP_DIR}/${BACKUP_FILE}"

  echo "✅ Downloaded: ${BACKUP_DIR}/${BACKUP_FILE}"
fi

RESTORE_SOURCE="${BACKUP_DIR}/${BACKUP_FILE}"

if [[ ! -f "$RESTORE_SOURCE" ]]; then
  echo "Error: Backup file not found: $RESTORE_SOURCE"
  exit 1
fi

# ── Safety: backup current database ──────────────────────────────────────────
if [[ -f "$DB_PATH" ]]; then
  PRE_RESTORE_BACKUP="${DB_PATH}.pre-restore-$(date +%Y%m%d_%H%M%S)"
  echo "Backing up current database to: $PRE_RESTORE_BACKUP"
  cp "$DB_PATH" "$PRE_RESTORE_BACKUP"
fi

# ── Restore database ──────────────────────────────────────────────────────────
echo "Restoring database..."
mkdir -p "$(dirname "$DB_PATH")"
cp "$RESTORE_SOURCE" "$DB_PATH"

echo ""
echo "✅ Restore completed: $DB_PATH"
echo "   Pre-restore backup: ${PRE_RESTORE_BACKUP:-none}"
