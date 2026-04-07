# Phase 4 Implementation Plan: Testing & Operations

> **Duration**: 2-3 weeks | **Prerequisites**: Phase 3 | **Blocks**: Production Launch

## Executive Summary

Migrate tests, documentation, CI/CD, and ops scripts. Complete deployment validation to ensure production readiness.

### GO/NO-GO Decision Criteria

| Criterion | Target | Verification Method |
|-----------|--------|---------------------|
| Test Coverage | ≥80% | Coverage report |
| Performance Benchmark | RAG query <2.5s (P95) | k6 load testing |
| API Documentation | Complete OpenAPI 3.0 | Swagger UI |
| CI/CD | Automated deployment success | GitHub Actions |
| Docker Deployment | Production environment running | Azure Container Apps |
| Backup & Recovery | Data recoverable | Backup testing |

---

## Core Task Checklist (20 Tasks)

### Test Suite Enhancement (T1-T5)

**T1: Unit Test Full Coverage**
```typescript
// tests/unit/services/deduplication.service.test.ts
import { describe, it, expect } from 'vitest';
import { DeduplicationService } from '@/lib/services/deduplication.service';

describe('DeduplicationService', () => {
  describe('checkHashDuplicate', () => {
    it('should return true for duplicate hash', async () => {
      // ... mock prisma
      const result = await service.checkHashDuplicate('content');
      expect(result).toBe(true);
    });

    it('should return false for new content', async () => {
      // ...
    });
  });
});
```
- [ ] All Service class unit tests
- [ ] All Util function tests
- [ ] Edge case coverage
- **Acceptance**: Unit test coverage >80%

**T2: Integration Tests**
```typescript
// tests/integration/rag.test.ts
import { describe, it, beforeAll, afterAll } from 'vitest';

describe('RAG E2E Integration', () => {
  beforeAll(async () => {
    await setupTestDatabase();
    await startTestServer();
  });

  it('should ingest and query document', async () => {
    // 1. Ingest
    await fetch('http://localhost:3000/api/ingest', {
      method: 'POST',
      body: JSON.stringify({ content: 'Test content', documentName: 'test.txt' }),
    });

    // 2. Query
    const res = await fetch('http://localhost:3000/api/query', {
      method: 'POST',
      body: JSON.stringify({ question: 'What is the content?' }),
    });

    const result = await res.json();
    expect(result.answer).toContain('Test');
  });
});
```
- [ ] API endpoint integration tests
- [ ] Database integration tests
- [ ] External service integration tests
- **Acceptance**: All integration tests pass

**T3: E2E Test Extension**
- [ ] All user key flows
- [ ] Error scenario tests
- [ ] Performance boundary tests
- **Acceptance**: Playwright test suite >20 cases

**T4: Performance Benchmark Testing**
```javascript
// tests/load/rag-query.test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Ramp up
    { duration: '3m', target: 10 },   // Stay
    { duration: '1m', target: 50 },   // Spike
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2500'], // 95% < 2.5s
    http_req_failed: ['rate<0.05'],    // Error rate < 5%
  },
};

export default function () {
  const res = http.post('http://localhost:3000/api/query', JSON.stringify({
    question: 'What is RAG?',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time OK': (r) => r.timings.duration < 2500,
  });

  sleep(1);
}
```
- [ ] k6 load test scripts
- [ ] Test all API endpoints
- [ ] Generate performance reports
- **Acceptance**: P95<2.5s, error rate<5%

**T5: Security Testing**
- [ ] SQL injection tests
- [ ] XSS attack protection
- [ ] CSRF token validation
- [ ] Sensitive info leakage checks
- **Acceptance**: Security scan report

---

### API Documentation (T6-T7)

**T6: OpenAPI 3.0 Documentation**
```typescript
// src/lib/openapi/spec.ts
import { OpenAPIV3 } from 'openapi-types';

export const openApiSpec: OpenAPIV3.Document = {
  openapi: '3.0.0',
  info: {
    title: 'VedaAide API',
    version: '1.0.0',
  },
  paths: {
    '/api/query': {
      post: {
        summary: 'RAG Query',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  question: { type: 'string' },
                  topK: { type: 'number', default: 5 },
                },
                required: ['question'],
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RagQueryResult' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      RagQueryResult: {
        type: 'object',
        properties: {
          answer: { type: 'string' },
          sources: { type: 'array', items: { $ref: '#/components/schemas/VectorSearchResult' } },
          isHallucination: { type: 'boolean' },
        },
      },
      // ...
    },
  },
};
```
- [ ] Document all API endpoints
- [ ] Define request/response schemas
- [ ] Example requests/responses
- **Acceptance**: Swagger UI shows complete documentation

**T7: Postman Collection**
- [ ] Export Postman Collection
- [ ] Environment variable configuration
- [ ] Automated test scripts
- **Acceptance**: Postman can directly import and test

---

### CI/CD Pipeline (T8-T11)

**T8: Complete GitHub Actions Configuration**
```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Type check
        run: npm run type-check
      
      - name: Lint
        run: npm run lint
      
      - name: Unit tests
        run: npm run test:unit -- --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v4

  e2e:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - name: Install Playwright
        run: npx playwright install --with-deps
      
      - name: Run E2E tests
        run: npm run test:e2e
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/

  build:
    runs-on: ubuntu-latest
    needs: e2e
    steps:
      - uses: actions/checkout@v4
      - name: Build production
        run: npm run build
      
      - name: Build Docker image
        run: docker build -t vedaaide-js:${{ github.sha }} .
      
      - name: Push to GHCR
        run: |
          echo ${{ secrets.GITHUB_TOKEN }} | docker login ghcr.io -u $GITHUB_ACTOR --password-stdin
          docker tag vedaaide-js:${{ github.sha }} ghcr.io/$GITHUB_REPOSITORY:${{ github.sha }}
          docker push ghcr.io/$GITHUB_REPOSITORY:${{ github.sha }}

  deploy-staging:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/develop'
    steps:
      - name: Deploy to Azure Container Apps (Staging)
        uses: azure/container-apps-deploy-action@v1
        with:
          resource-group: vedaaide-rg
          container-app-name: vedaaide-staging
          image: ghcr.io/${{ github.repository }}:${{ github.sha }}

  deploy-prod:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to Azure Container Apps (Production)
        uses: azure/container-apps-deploy-action@v1
        with:
          resource-group: vedaaide-rg
          container-app-name: vedaaide-prod
          image: ghcr.io/${{ github.repository }}:${{ github.sha }}
```
- [ ] Multi-stage pipeline configuration
- [ ] Automated deployment to Staging/Prod
- [ ] Failure notifications
- **Acceptance**: Push triggers all steps automatically

**T9: Version Management & Releases**
```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Create GitHub Release
        uses: actions/create-release@v1
        with:
          tag_name: ${{ github.ref }}
          release_name: Release ${{ github.ref }}
          body_path: CHANGELOG.md
```
- [ ] Semantic Versioning
- [ ] Auto-generate CHANGELOG
- [ ] Git tag triggers release
- **Acceptance**: Tagging auto-releases

**T10: Environment Separation**
- [ ] Development environment
- [ ] Staging environment
- [ ] Production environment
- [ ] Environment variable management
- **Acceptance**: 3 environments run independently

**T11: Rollback Mechanism**
```bash
# scripts/rollback.sh
#!/bin/bash
az containerapp revision list --name vedaaide-prod --resource-group vedaaide-rg --output table
echo "Enter revision name to rollback:"
read REVISION
az containerapp revision activate --revision $REVISION --name vedaaide-prod --resource-group vedaaide-rg
```
- [ ] One-command rollback script
- [ ] Version history management
- [ ] Rollback testing
- **Acceptance**: Successfully rollback to previous version

---

### Deployment & Operations (T12-T16)

**T12: Production Docker Configuration**
```dockerfile
# Dockerfile (production-optimized)
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
```
- [ ] Multi-stage build optimization
- [ ] Run as non-root user
- [ ] Image size <200MB
- **Acceptance**: Production image builds successfully

**T13: Azure Container Apps Configuration**
```yaml
# infra/container-app.yaml
properties:
  configuration:
    ingress:
      external: true
      targetPort: 3000
      allowInsecure: false
    secrets:
      - name: database-url
        value: "..."
    env:
      - name: DATABASE_URL
        secretRef: database-url
      - name: OLLAMA_BASE_URL
        value: "http://ollama-service:11434"
  template:
    containers:
      - name: vedaaide
        image: ghcr.io/user/vedaaide-js:latest
        resources:
          cpu: 1.0
          memory: 2Gi
    scale:
      minReplicas: 1
      maxReplicas: 10
      rules:
        - name: http-scale
          http:
            metadata:
              concurrentRequests: "50"
```
- [ ] Container configuration
- [ ] Auto-scaling rules
- [ ] Health checks
- **Acceptance**: Azure deployment successful

**T14: Database Backup & Recovery**
```bash
# scripts/backup.sh
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
sqlite3 /app/data/vedaaide.db ".backup /backups/vedaaide_$DATE.db"
az storage blob upload --file /backups/vedaaide_$DATE.db --container-name backups --name vedaaide_$DATE.db
echo "Backup completed: vedaaide_$DATE.db"

# Keep 30 days of backups
find /backups -name "vedaaide_*.db" -mtime +30 -delete
```
- [ ] Daily automatic backups
- [ ] Upload backups to Azure Blob
- [ ] Recovery testing
- **Acceptance**: Successfully recover from backup

**T15: Monitoring & Alerting**
```typescript
// src/lib/monitoring/application-insights.ts
import appInsights from 'applicationinsights';

appInsights.setup(env.APPLICATIONINSIGHTS_CONNECTION_STRING)
  .setAutoDependencyCorrelation(true)
  .setAutoCollectRequests(true)
  .setAutoCollectPerformance(true)
  .setAutoCollectExceptions(true)
  .start();

export const trackEvent = (name: string, properties?: Record<string, any>) => {
  appInsights.defaultClient.trackEvent({ name, properties });
};
```
- [ ] Application Insights integration
- [ ] Custom metric tracking
- [ ] Alert rule configuration
- **Acceptance**: Dashboard shows real-time metrics

**T16: Log Aggregation**
- [ ] Structured log output
- [ ] Trace ID correlation
- [ ] Log query interface
- **Acceptance**: Full-chain logs queryable

---

### Documentation Cleanup (T17-T20)

**T17: Technical Documentation Migration**
- [ ] README.md update
- [ ] Architecture design docs
- [ ] API documentation
- [ ] Deployment documentation
- **Acceptance**: All docs align with Next.js

**T18: Operations Manual**
```markdown
# Operations Manual

## Common Issues

### Service Startup Failure
- Check if environment variables are complete
- View container logs: `az containerapp logs show`

### Database Connection Failure
- Verify DATABASE_URL
- Check network connectivity

## Monitoring Dashboards
- Application Insights: https://portal.azure.com/...
- Container Apps Metrics: https://portal.azure.com/...

## Emergency Contacts
- On-call: @oncall-engineer
- Slack: #vedaaide-alerts
```
- [ ] Common issue troubleshooting
- [ ] Monitoring links
- [ ] Emergency contacts
- **Acceptance**: Operations manual actionable

**T19: Developer Documentation**
- [ ] Local development environment setup
- [ ] Code conventions
- [ ] PR process
- **Acceptance**: New developers can onboard from docs

**T20: Migration Acceptance Checklist**
```markdown
# Migration Acceptance Checklist

## Functional Completeness
- [x] Document ingestion (Txt/Markdown/PDF)
- [x] RAG retrieval + LLM generation
- [x] Dual-layer dedup
- [x] Dual-layer hallucination detection
- [x] Agent orchestration
- [x] MCP Server/Client
- [x] SSE streaming response
- [x] Prompt version management

## Performance Metrics
- [x] RAG query latency (P95) < 2.5s
- [x] Document ingestion throughput > 40 docs/min
- [x] Vector search < 150ms
- [x] Lighthouse performance score > 90

## Quality Standards
- [x] Test coverage > 80%
- [x] TypeScript strict mode
- [x] ESLint rules pass
- [x] API documentation complete
- [x] Docker image < 200MB

## Deployment Validation
- [x] Staging environment stable
- [x] Production deployment successful
- [x] Backup/recovery tested
- [x] Monitoring & alerting working
```
- [ ] Complete checklist
- [ ] Each item verified
- [ ] Sign-off for launch
- **Acceptance**: All items checked

---

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Production environment failure | High | Low | Multiple instances + fast rollback |
| Data migration loss | High | Low | Dual-write validation + backups |
| Performance doesn't meet standards | Medium | Low | Early load testing + optimization |

---

## Timeline

```
Week 1: T1-T5 (Test suite) + T6-T7 (API docs)
Week 2: T8-T11 (CI/CD) + T12-T13 (Deployment config)
Week 3: T14-T16 (Ops config) + T17-T20 (Docs cleanup)
```

---

## GitHub Issue Template

```markdown
# [Phase 4] Testing & Operations

## 🎯 Goal
Complete testing, docs, CI/CD, ops configuration to ensure production readiness

## ✅ Task Checklist
- [ ] T1-T5: Test suite enhancement
- [ ] T6-T7: API documentation
- [ ] T8-T11: CI/CD Pipeline
- [ ] T12-T13: Deployment configuration
- [ ] T14-T16: Operations configuration
- [ ] T17-T20: Documentation cleanup

## 📊 Definition of Done
- [x] Test coverage ≥ 80%
- [x] CI/CD automated deployment
- [x] Production environment running
- [x] Migration checklist all pass

## 🔗 Related: [Phase 3](./phase3-plan.en.md) | [Feasibility Analysis](./feasibility-analysis.en.md)
## 👥 Assigned: @devops-engineer @qa-engineer
```

---

**Document Maintainer**: VedaAide Migration Team | **Status**: Waiting for Phase 1-3 completion
