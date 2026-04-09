#!/usr/bin/env bash
# scripts/rollback.sh
# ─────────────────────────────────────────────────────────────────────────────
# T11: One-click rollback for Azure Container Apps
# Usage:
#   bash scripts/rollback.sh                    # interactive mode
#   bash scripts/rollback.sh --revision <name>  # non-interactive
#   bash scripts/rollback.sh --env staging      # target staging environment
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP:-vedaaide-rg}"
ENV="${ENV:-prod}"
REVISION=""

# ── Argument parsing ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)       ENV="$2"; shift 2 ;;
    --revision)  REVISION="$2"; shift 2 ;;
    *)           echo "Unknown argument: $1"; exit 1 ;;
  esac
done

# Map environment to container app name
case "$ENV" in
  prod)    APP_NAME="vedaaide-prod" ;;
  staging) APP_NAME="vedaaide-staging" ;;
  *)       echo "Unknown environment: $ENV. Use 'prod' or 'staging'."; exit 1 ;;
esac

echo "=== VedaAide Rollback Script ==="
echo "Environment : $ENV"
echo "App         : $APP_NAME"
echo "Resource Grp: $RESOURCE_GROUP"
echo ""

# ── Verify Azure CLI is available ─────────────────────────────────────────────
if ! command -v az &>/dev/null; then
  echo "Error: Azure CLI (az) is not installed. Install from https://aka.ms/install-azure-cli"
  exit 1
fi

# ── List available revisions ──────────────────────────────────────────────────
echo "Available revisions:"
az containerapp revision list \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --output table \
  --query "[].{Name:name, CreatedAt:properties.createdTime, Active:properties.active, TrafficWeight:properties.trafficWeight}" \
  2>/dev/null || {
    echo "Error: Could not list revisions. Check your Azure credentials and resource group."
    exit 1
  }

echo ""

# ── Select revision ───────────────────────────────────────────────────────────
if [[ -z "$REVISION" ]]; then
  read -rp "Enter the revision name to activate (or 'q' to quit): " REVISION
  [[ "$REVISION" == "q" ]] && echo "Rollback cancelled." && exit 0
fi

if [[ -z "$REVISION" ]]; then
  echo "Error: No revision specified."
  exit 1
fi

# ── Confirm rollback ──────────────────────────────────────────────────────────
echo ""
echo "⚠️  You are about to roll back $APP_NAME to revision: $REVISION"
read -rp "Are you sure? (yes/no): " CONFIRM
if [[ "$CONFIRM" != "yes" ]]; then
  echo "Rollback cancelled."
  exit 0
fi

# ── Execute rollback ──────────────────────────────────────────────────────────
echo ""
echo "Activating revision $REVISION..."
az containerapp revision activate \
  --revision "$REVISION" \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP"

echo ""
echo "✅ Rollback completed. Verifying health..."
sleep 10

# Health check
APP_URL=$(az containerapp show \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --query "properties.configuration.ingress.fqdn" \
  --output tsv 2>/dev/null || echo "")

if [[ -n "$APP_URL" ]]; then
  if curl --silent --fail "https://${APP_URL}/api/health" >/dev/null; then
    echo "✅ Health check passed: https://${APP_URL}/api/health"
  else
    echo "⚠️  Health check failed. Please verify the application manually."
    exit 1
  fi
else
  echo "⚠️  Could not determine app URL. Verify health manually."
fi
