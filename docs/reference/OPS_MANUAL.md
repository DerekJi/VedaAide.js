# VedaAide Operations Manual

> **T18: Ops Manual** — Runbooks, troubleshooting, on-call procedures.

---

## Quick Reference

| Resource             | URL / Command                                                                 |
| -------------------- | ----------------------------------------------------------------------------- |
| Production App       | `https://vedaaide.azurecontainerapps.io`                                      |
| Staging App          | `https://vedaaide-staging.azurecontainerapps.io`                              |
| Health endpoint      | `/api/health`                                                                 |
| OpenAPI spec         | `/api/openapi`                                                                |
| Application Insights | Azure Portal → vedaaide-rg → Application Insights                             |
| Container Apps Logs  | `az containerapp logs show --name vedaaide-prod --resource-group vedaaide-rg` |

---

## Common Operations

### Check Service Health

```bash
curl https://vedaaide.azurecontainerapps.io/api/health
# Expected: { "status": "ok", "timestamp": "...", "version": "..." }
```

### View Container Logs

```bash
# Live logs
az containerapp logs show \
  --name vedaaide-prod \
  --resource-group vedaaide-rg \
  --follow

# Filter by level
az containerapp logs show \
  --name vedaaide-prod \
  --resource-group vedaaide-rg \
  | jq 'select(.level >= 50)'    # errors only (pino level 50 = error)
```

### Trigger Manual Data Sync

```bash
curl -X POST https://vedaaide.azurecontainerapps.io/api/datasources/sync
# Returns: { "connectors": [...], "durationMs": 1234 }
```

### Rollback a Deployment

```bash
# Interactive rollback
bash scripts/rollback.sh

# Direct rollback to specific revision
bash scripts/rollback.sh --revision vedaaide-prod--abc123 --env prod
```

### Create Database Backup

```bash
DB_PATH=/app/data/vedaaide.db \
AZURE_BLOB_ACCOUNT_NAME=vedaaideprod \
AZURE_BLOB_ACCOUNT_KEY=<key> \
BACKUP_CONTAINER_NAME=backups \
bash scripts/backup.sh
```

### Restore Database from Backup

```bash
# From local file
bash scripts/restore.sh --file vedaaide_20260408_120000.db

# From Azure Blob Storage
AZURE_BLOB_ACCOUNT_NAME=vedaaideprod \
AZURE_BLOB_ACCOUNT_KEY=<key> \
bash scripts/restore.sh --from-blob vedaaide_20260408_120000.db
```

---

## Troubleshooting

### Service fails to start

1. Check environment variables are set:
   ```bash
   az containerapp show --name vedaaide-prod --resource-group vedaaide-rg \
     --query "properties.template.containers[0].env"
   ```
2. Check container logs for startup errors (see above).
3. Verify `DATABASE_URL` points to a writable path.
4. Ensure the Prisma migration has been applied.

### RAG queries return empty or poor answers

1. Check documents are ingested: `GET /api/ingest`
2. Verify the LLM is reachable:
   ```bash
   curl -X POST /api/query -H 'Content-Type: application/json' \
     -d '{"question":"hello","topK":1}'
   ```
3. Check `AZURE_OPENAI_ENDPOINT` / `OLLAMA_BASE_URL` is correctly set.
4. Review Application Insights for dependency failures.

### SSE streaming disconnects

1. Check if there are proxy timeouts (Azure Front Door, Nginx).
2. Sticky sessions should be enabled for Container Apps (see `infra/container-app.yaml`).
3. Add a keep-alive heartbeat: the stream sends `{type:"heartbeat"}` events every 15s.

### High response times

1. Check P95 latency in Application Insights Custom Metrics.
2. Review vector search performance — large tables may need index optimization.
3. Increase Container App CPU/memory: `az containerapp update --cpu 2 --memory 4Gi`.
4. Check if the embedding model or LLM is saturated (Ollama/Azure OpenAI throttling).

### Database corruption or data loss

1. **Stop** the app immediately to prevent further writes.
2. Restore from the most recent backup:
   ```bash
   bash scripts/restore.sh --from-blob vedaaide_<latest>.db
   ```
3. Verify data integrity: `sqlite3 /app/data/vedaaide.db "PRAGMA integrity_check;"`
4. Restart the app.

---

## Monitoring & Alerts

### Key Metrics (Application Insights)

| Metric                 | Warning Threshold | Critical Threshold |
| ---------------------- | ----------------- | ------------------ |
| P95 Response Time      | > 2000ms          | > 5000ms           |
| Error Rate             | > 2%              | > 5%               |
| HTTP 5xx Count         | > 10/min          | > 50/min           |
| RAG Query Duration P95 | > 2000ms          | > 5000ms           |

### Recommended Alert Rules

Configure in Azure Monitor → Alerts:

1. **Health check failure**: HTTP availability test on `/api/health`, alert if < 100% success in 5 min.
2. **High error rate**: `requests/failed > 10` in 5-minute window.
3. **Slow responses**: `requests/duration > 5000ms` at P95 over 10 minutes.

---

## Environments

| Environment | Branch    | URL                                              | Auto-deploy   |
| ----------- | --------- | ------------------------------------------------ | ------------- |
| Production  | `main`    | `https://vedaaide.azurecontainerapps.io`         | Yes (push)    |
| Staging     | `develop` | `https://vedaaide-staging.azurecontainerapps.io` | Yes (push)    |
| Local       | any       | `http://localhost:3000`                          | `npm run dev` |

---

## Incident Response

1. **Detect**: Monitor via Application Insights alerts or health endpoint.
2. **Assess**: Check logs and metrics; determine severity.
3. **Contain**: Rollback if needed (`scripts/rollback.sh`).
4. **Diagnose**: Check Application Insights for root cause.
5. **Fix**: Deploy a patch via CI/CD or hotfix branch.
6. **Post-mortem**: Document in `docs/incidents/YYYY-MM-DD.md`.

---

_Maintained by: VedaAide Operations Team_  
_Last updated: 2026-04-08_
