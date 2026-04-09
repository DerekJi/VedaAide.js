# 🚀 VedaAide Deployment Quick Reference Card

**Use Case**: Quick check before merging PR to main  
**Read Time**: 2 minutes

---

## ❓ Quick Q&A

### Can I deploy now?

```
Current Status: ⚠️ Not yet (missing configuration)

Reasons:
  ❌ GitHub Actions Secrets not configured
  ❌ Azure resources not created
  ✅ Code is ready
  ✅ CI/CD is ready

Must Complete:
  1️⃣ Create Service Principal
  2️⃣ Configure 4-5 GitHub Secrets
  3️⃣ Create Azure Resource Group
  4️⃣ Deploy Bicep template

Estimated Time: 30 minutes
```

### Will it work after deployment?

```
Current Status: ⚠️ Partial functionality

Working:
  ✅ API can start
  ✅ Basic database
  ✅ Basic Q&A (local Ollama)

Need Extra Configuration:
  ⚠️ Azure OpenAI (LLM features)
  ⚠️ Document Intelligence (document processing)
  ⚠️ Application Insights (monitoring)

No Configuration Needed:
  ✅ Basic API endpoints
  ✅ Health checks
  ✅ Log collection
```

---

## 🔑 4 Secrets You Need

### VedaAide.NET (Backend)

```bash
# Run this to get the values
az ad sp create-for-rbac \
  --name github-actions-vedaaide \
  --role Contributor \
  --scopes /subscriptions/<SUBSCRIPTION_ID>
```

| Secret Name             | From               | Example                                |
| ----------------------- | ------------------ | -------------------------------------- |
| `AZURE_SUBSCRIPTION_ID` | Subscription ID    | `12345678-1234-1234-1234-123456789012` |
| `AZURE_TENANT_ID`       | tenantId           | `87654321-4321-4321-4321-210987654321` |
| `AZURE_CLIENT_ID`       | clientId           | `aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee` |
| `GHCR_PAT`              | GitHub Token (new) | `ghp_xxxxxxxxxxxxxxxxxxxxxxx`          |

### VedaAide.js (Frontend)

| Secret Name         | Value                  | Example   |
| ------------------- | ---------------------- | --------- |
| `AZURE_CREDENTIALS` | JSON of above 4 values | See below |

```json
{
  "clientId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "clientSecret": "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "subscriptionId": "12345678-1234-1234-1234-123456789012",
  "tenantId": "87654321-4321-4321-4321-210987654321"
}
```

---

## 📋 Pre-Deployment 10-Minute Checklist

```bash
# 1️⃣ Create Service Principal (2 min)
az ad sp create-for-rbac \
  --name github-actions-vedaaide \
  --role Contributor \
  --scopes /subscriptions/<YOUR_SUB_ID>

# 2️⃣ Create Resource Group (1 min)
az group create \
  --name vedaaide-prod-rg \
  --location australiaeast

# 3️⃣ Validate Bicep Template (1 min)
az deployment group validate \
  --resource-group vedaaide-prod-rg \
  --template-file infra/main.bicep \
  --parameters @infra/main.parameters.json

# 4️⃣ Deploy Bicep (3 min)
az deployment group create \
  --resource-group vedaaide-prod-rg \
  --template-file infra/main.bicep \
  --parameters @infra/main.parameters.json

# 5️⃣ Configure GitHub Secrets (2 min)
# Manually configure 4 Secrets in GitHub UI
# See: docs/deployment-checklist.en.md Steps 2-3

# 6️⃣ Merge PR (1 min)
git checkout main && git pull origin main
git merge feature/4-testing-devops
git push origin main

# ✅ Done! Watch GitHub Actions auto-deploy
```

---

## 🔍 Monitor Deployment Status

### GitHub Actions Location

```
VedaAide.NET:
  GitHub → Actions → "Build, Test & Deploy" → Latest run

VedaAide.js:
  GitHub → Actions → "CI/CD Pipeline" → Latest run
```

### Azure Container Apps Location

```bash
# Check deployment status
az containerapp show \
  --name vedaaide-prod-api \
  --resource-group vedaaide-prod-rg \
  --query "properties.provisioningState"

# View real-time logs
az containerapp logs show \
  --name vedaaide-prod-api \
  --resource-group vedaaide-prod-rg \
  --follow

# Test API health check
curl https://vedaaide-prod-api.azurecontainerapps.io/health
```

---

## ⚠️ Quick Error Troubleshooting

| Error Message                 | Cause                 | Solution                     |
| ----------------------------- | --------------------- | ---------------------------- |
| `Invalid credentials`         | Secrets misconfigured | Recreate Service Principal   |
| `Unhealthy`                   | Missing env vars      | Check container logs         |
| `unauthorized`                | GHCR PAT expired      | Create new PAT               |
| `Parameter validation failed` | Bicep params error    | Check parameters.json format |

---

## 📚 Full Documentation Location

For more detailed information, see:

1. **Chinese Full Guide**: `docs/deployment-checklist.md`
2. **English Full Guide**: `docs/deployment-checklist.en.md`
3. **Deployment Readiness Report**: `docs/deployment-readiness-summary-en.md`

---

## 🎯 Decision Tree

```
Ready to merge PR?
  ↓
  [Yes]
    ↓
    Are all GitHub Secrets configured?
      ↓ [No]
      → Configure Secrets per Step 2-3
      ↓ [Yes]
    Are all Azure resources created?
      ↓ [No]
      → Create Service Principal per Step 1
      → Create Resource Group per Step 1
      → Deploy Bicep per Step 1
      ↓ [Yes]
    Does code pass all tests?
      ↓ [No]
      → Run tests and fix issues
      ↓ [Yes]
    ✅ Ready to merge
    ↓
    [Merge PR]
      ↓
    GitHub Actions auto-deploys
    Monitor: GitHub → Actions → workflow status

  [No]
    → Wait
```

---

**Last Updated**: 2026-04-09
