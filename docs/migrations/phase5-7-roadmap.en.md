# Phase 5-7 Implementation Roadmap: Complete Framework

> **Total Duration**: 7-9 weeks  
> **Goal**: Close feature gap between VedaAide.js and VedaAide.NET  
> **Path to Production**: Phased delivery, stable gates between phases

---

## Phase Breakdown & Dependencies

```
Phase 5: User System (2-3 weeks)
  ├─ T1-T5: Authentication, multi-user, Admin, rate limiting
  ├─ T11-T12: Chat session persistence
  └─ T13: Token usage tracking
       ↓
Phase 6: Enterprise Features (3-4 weeks) — Depends on Phase 5 ✅
  ├─ T6-T8: Knowledge governance (scopes, sharing, consensus)
  ├─ T9-T10: Public resume tailoring
  ├─ T14-T15: User feedback & personalization
  ├─ T16-T17: Document diff & ephemeral context
  └─ T21-T24: Azure integration, admin panel, demo library
       ↓
Phase 7: Optimization (2 weeks) — Depends on Phase 5 & 6 ✅
  ├─ T18: LLM router (multi-model)
  ├─ T19: Hybrid retrieval (RRF)
  ├─ T20: Semantic cache
  └─ T25: Personal vocabulary enhancement
       ↓
Production Launch
```

---

## Quick Navigation

| Phase | Detail Document                  | Tasks                    | Duration | Key Features                               |
| ----- | -------------------------------- | ------------------------ | -------- | ------------------------------------------ |
| **5** | `phase5-user-system.{cn,en}.md`  | T1-T5, T11-T13           | 2-3 wks  | Auth, multi-user, sessions, token tracking |
| **6** | `phase6-enterprise.{cn,en}.md`   | T6-T10, T14-T17, T21-T24 | 3-4 wks  | Governance, resume API, admin, feedback    |
| **7** | `phase7-optimization.{cn,en}.md` | T18-T20, T25             | 2 wks    | LLM router, RRF, cache, personalization    |

---

## Features: VedaAide.NET → VedaAide.js Mapping

| Feature                  | .NET Status              | Phase 5    | Phase 6    | Phase 7           |
| ------------------------ | ------------------------ | ---------- | ---------- | ----------------- |
| **Authentication**       | ✅ JWT + Azure AD        | ✅ T1-T5   | —          | —                 |
| **Multi-User Isolation** | ✅ Per-user data         | ✅ T3      | —          | —                 |
| **Chat Sessions**        | ✅ CRUD + history        | ✅ T11-T12 | —          | —                 |
| **Token Usage Tracking** | ✅ Monthly/cumulative    | ✅ T13     | —          | —                 |
| **Knowledge Visibility** | ✅ Private/Shared/Public | —          | ✅ T6      | —                 |
| **Sharing Groups**       | ✅ Group management      | —          | ✅ T7      | —                 |
| **Consensus Review**     | ✅ Admin approval        | —          | ✅ T8      | —                 |
| **Public Resume**        | ✅ Anon SSE endpoint     | —          | ✅ T9-T10  | —                 |
| **User Feedback**        | ✅ Behavior tracking     | —          | ✅ T14-T15 | —                 |
| **Document Diff**        | ✅ LLM-based changes     | —          | ✅ T16     | —                 |
| **Ephemeral RAG**        | ✅ Temp extraction       | —          | ✅ T17     | —                 |
| **Admin Panel**          | ✅ Stats + management    | —          | ✅ T23     | —                 |
| **Demo Library**         | ✅ Pre-loaded docs       | —          | ✅ T24     | —                 |
| **Azure Blob Connector** | ✅ Auto-sync             | —          | ✅ T21     | —                 |
| **LLM Router**           | ✅ Multi-model           | —          | —          | ✅ T18            |
| **Hybrid Retrieval**     | ✅ Vector + keyword      | —          | —          | ✅ T19            |
| **Semantic Cache**       | ✅ Query dedup           | —          | —          | ✅ T20            |
| **Personal Vocabulary**  | ✅ Term boosting         | —          | —          | ⚠️ T25 (optional) |

---

## GO/NO-GO Criteria

### Phase 5 ✓

- [ ] Zero cross-user data leakage (auto test)
- [ ] Chat history persists after refresh
- [ ] Token counts accurate (≤ 5% error)
- [ ] Rate limiting enforced on public endpoints
- [ ] Test coverage ≥ 80%
- [ ] **All T1-T13 tasks complete**

### Phase 6 ✓

- [ ] Resume tailoring SSE completes in ≤ 30 sec (500-word JD)
- [ ] Knowledge governance (groups + sharing + consensus) end-to-end
- [ ] Admin panel displays correct stats
- [ ] Ephemeral extraction doesn't write vectors (verified)
- [ ] Demo library one-click ingest works
- [ ] Public resume endpoint respects CORS + rate limits
- [ ] Feedback events recorded, stats computed
- [ ] Test coverage ≥ 80%
- [ ] **All T6-T10, T14-T17, T21-T24 tasks complete**

### Phase 7 ✓

- [ ] Retrieval latency: Vector + hybrid << 500ms (P95)
- [ ] LLM token latency: first token < 100ms
- [ ] Cache hit rate > 30% (simulated load)
- [ ] Hybrid retrieval recall improved ≥ 10%
- [ ] No performance regression from Phase 5/6
- [ ] DeepSeek graceful fallback works
- [ ] Test coverage ≥ 80%
- [ ] Performance benchmarks met (throughput, latency)
- [ ] **All T18-T20, T25 tasks complete**

---

## Task Summary by Category

### Authentication & User Management (5 tasks)

- T1: NextAuth.js + Azure AD setup
- T2: getCurrentUser() utility
- T3: Per-user data isolation
- T4: Admin role & authorization
- T5: Rate limiting (public endpoints)

### Core User Features (5 tasks)

- T6: Knowledge visibility scopes
- T7: Sharing groups
- T8: Consensus candidate review
- T11: Chat session CRUD API
- T12: Chat UI integration

### Usage Tracking (1 task)

- T13: Token usage recorder + API

### Public APIs & Content (4 tasks)

- T9: Public resume tailoring API (anon SSE)
- T10: Resume tailoring UI
- T24: Demo library (pre-loaded docs)
- T25: Personal vocabulary enhancement

### User Personalization (3 tasks)

- T14: Feedback recording API
- T15: Feedback-boosted retrieval
- T16: Document diff on re-ingest (LLM-based)

### Data Management (4 tasks)

- T17: Ephemeral context extraction
- T21: Azure Blob Storage connector
- T22: Background auto-sync worker
- T23: Admin panel API

### Retrieval & Performance (4 tasks)

- T18: LLM router (multi-model with fallback)
- T19: Hybrid retrieval with RRF fusion
- T20: Semantic cache with TTL
- (T25 is user vocab, already listed above)

---

## Environment Variables Summary

### Phase 5 (Authentication & Basics)

```bash
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generated>
AZURE_AD_CLIENT_ID=...
AZURE_AD_CLIENT_SECRET=...
AZURE_AD_TENANT_ID=...

# Rate Limiting
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=1h
```

### Phase 6 (Enterprise)

```bash
# Azure Blob (optional)
AZURE_BLOB_ACCOUNT_NAME=...
AZURE_BLOB_ACCOUNT_KEY=...
AZURE_BLOB_CONTAINER_NAME=demo-documents

# Document Intelligence (for ephemeral extraction)
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=...
AZURE_DOCUMENT_INTELLIGENCE_KEY=...

# Vision (for image extraction)
AZURE_OPENAI_VISION_ENDPOINT=...
AZURE_OPENAI_VISION_KEY=...
```

### Phase 7 (Optimization)

```bash
# DeepSeek (optional)
DEEPSEEK_API_KEY=...
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat

# Semantic Cache
SEMANTIC_CACHE_ENABLED=true
SEMANTIC_CACHE_TTL_HOURS=24
SEMANTIC_CACHE_SIMILARITY_THRESHOLD=0.95

# Data Sync
DATA_SYNC_INTERVAL_MINUTES=30
DATA_SYNC_ENABLED=true
```

---

## Testing Strategy

### Phase 5

- **Unit**: Auth logic, user isolation, token recording
- **Integration**: Session API, multi-user queries
- **E2E**: Login flow, chat persistence

### Phase 6

- **Unit**: Governance logic, diff algorithm, cache warmup
- **Integration**: Resume API (SSE), sharing groups, admin panel
- **E2E**: End-to-end knowledge sharing, feedback flow

### Phase 7

- **Unit**: RRF scoring, semantic similarity, router fallback
- **Performance**: Load testing (k6), cache hit rate measurement
- **A/B**: Optional comparison of retrieval strategies

### Coverage Target

- Maintain ≥ 80% across all phases
- Critical paths (auth, data isolation) → 95%+
- Performance tests automated in CI/CD

---

## CI/CD Integration

### Pre-Deployment Checks (Each Phase)

- [ ] All unit tests pass
- [ ] Integration tests pass
- [ ] Linting + type checking passes
- [ ] Coverage report generated
- [ ] Performance benchmarks verified (Phase 7)
- [ ] Secrets not committed (SAST)
- [ ] Dependencies scanned (SBOM)

### Deployment

- PR to `main` triggers release build
- Successful build → tag + push to registry
- Staged rollout: canary (10%) → 50% → 100%

---

## Post-Launch Roadmap

After Phase 7 (Go-Live):

1. **Observability Setup** (Week 8-9)
   - Structured logging (ELK / Datadog)
   - Distributed tracing (OpenTelemetry)
   - Monitoring dashboards

2. **Feedback Loop** (Week 10+)
   - Gather user feedback on retrieval quality
   - A/B test different retrieval strategies
   - Iterate on ranking models

3. **Scale & Optimization** (Week 12+)
   - Multi-region deployment
   - Distributed caching (Redis Cluster)
   - Custom embedding model fine-tuning
   - Advanced features: multi-stage retrieval, re-ranking

---

## Stakeholder Handoff

- **Phase 5 Complete**: Core platform ready for internal testing
- **Phase 6 Complete**: Enterprise features ready, pre-launch QA
- **Phase 7 Complete**: Full parity with .NET, production launch

Each phase ends with:

- Feature documentation (README updates)
- API documentation (OpenAPI spec)
- Release notes
- Known limitations / deferred features
