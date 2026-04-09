# Phase 5 Implementation Plan: User System & Session Management

> **Duration**: 2-3 weeks | **Branch**: `feature/5-user-system`  
> **Prerequisites**: Phase 4 completed  
> **Blocks**: Phase 6, 7

## Overview

Phase 5 establishes the foundation for a multi-user SaaS platform. All subsequent features depend on this layer.

### Core Epics

| Epic                        | Tasks   | Scope                                              |
| --------------------------- | ------- | -------------------------------------------------- |
| Authentication & Multi-User | T1-T5   | NextAuth, per-user isolation, roles, rate limiting |
| Chat Session Persistence    | T11-T12 | CRUD API, message history, sidebar UI              |
| Token Usage Tracking        | T13     | Per-user monthly/cumulative stats                  |

**Total**: 12-13 tasks | **Target**: All GO criteria met before Phase 6

---

## Tasks

### Epic 1 — Authentication & Multi-User (T1–T5)

**T1: NextAuth.js Integration**

- Install `next-auth@5` (Auth.js) with peer-dependency audit for Next.js 15
- Providers:
  - Azure AD (production): `@auth/azure-ad-b2c` or `@auth/azure-ad`
  - Credentials (dev/test): local username/password
- Expose `auth()` in server components and Route Handlers via `getServerSession()`
- Create user profile on first login → `User` table (id, email, name, avatar, createdAt, role)
- Acceptance:
  - Unauthenticated request to protected route: 401
  - Login → redirect authenticated
  - Session object available in API routes

**T2: `getCurrentUser` Server Utility**

- Create `src/lib/auth/current-user.ts`:
  ```typescript
  export async function getCurrentUser() {
    const session = await auth();
    if (!session?.user?.email) return null;

    return {
      userId: session.user.id,
      email: session.user.email,
      isAdmin: session.user.role === "ADMIN",
    };
  }
  ```
- Export helper `requireUserId()` that throws 401 if no user
- Mirrors `ICurrentUserService` pattern from .NET
- Acceptance: All subsequent API routes use this helper

**T3: Per-User Data Isolation**

- Update Prisma schema:
  - Add `ownerId: String` to `SyncedFile`, `VectorChunk`, `ChatSession` models
  - Add unique constraint where applicable (e.g., per-user document names)
- Update ingest pipeline:
  - Extract `ownerId` from `getCurrentUser()` in all ingest routes
  - Pass `ownerId` into `RagService.ingest()` and `VectorStore` operations
- Update query/retrieval:
  - All vector search calls filter by `where: { ownerId }`
  - Document listing applies same filter
  - Admin bypass: if user is Admin, allow querying any user's data (with explicit `?userId=xxx` param)
- Acceptance:
  - User A documents/sessions not visible to User B
  - Automated test: User A cannot query User B's vectors

**T4: Admin Role & Authorization**

- Update `User` model: add `role` enum (USER | ADMIN)
- Create authorization middleware (`src/lib/auth/require-admin.ts`):
  ```typescript
  export async function requireAdmin() {
    const user = await getCurrentUser();
    if (!user?.isAdmin) throw new Error("Unauthorized", { status: 403 });
    return user;
  }
  ```
- Protect routes:
  - Admin only: `/api/admin/*`, `/api/governance/*`, `/api/evaluation/*`, `/api/prompts/*`
  - Protected middleware: check `requireAdmin()` in route handler
- Acceptance:
  - Non-admin accessing `/api/admin/stats` returns 403
  - Admin can access

**T5: Rate Limiting (Public Endpoints)**

- Install `@upstash/ratelimit` + Redis integration (Upstash free tier)
- Configure env vars:
  ```
  UPSTASH_REDIS_REST_URL=https://...
  UPSTASH_REDIS_REST_TOKEN=...
  RATE_LIMIT_REQUESTS=100
  RATE_LIMIT_WINDOW=1h
  ```
- Apply to public resume tailoring endpoint (upcoming T9):
  - Strategy: per-IP fixed window (100 requests/hour)
  - Return 429 when exceeded
- Acceptance: Anonymous script hitting endpoint 100+ times → 429

### Epic 4 — Chat Session Persistence (T11–T12)

**T11: Chat Session CRUD API**

- Extend Prisma schema:

  ```prisma
  model ChatSession {
    id        String   @id @default(cuid())
    userId    String   @db.VarChar(255)
    title     String   @default("New Chat")
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt
    messages  ChatMessage[]

    @@unique([userId, id])
  }

  model ChatMessage {
    id        String   @id @default(cuid())
    sessionId String
    session   ChatSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
    role      String   @default("user") // "user" | "assistant"
    content   String   @db.Text
    sources   Json?    // VectorSearchResult[]
    createdAt DateTime @default(now())
  }
  ```

- Create routes:
  - `POST /api/chat/sessions` (auth required)
    - Body: `{ title?: string }`
    - Returns: `{ id, userId, title, createdAt }`
  - `GET /api/chat/sessions` (auth required)
    - Returns: array of sessions for current user, ordered by createdAt DESC
  - `DELETE /api/chat/sessions/:id` (auth required)
    - 403 if session doesn't belong to user
  - `GET /api/chat/sessions/:id/messages` (auth required)
    - Returns: array of messages in order, 403 if not owner
  - `POST /api/chat/sessions/:id/messages` (auth optional, for future use)
    - Adds a message to session
- Acceptance:
  - Create, list, delete work for logged-in user
  - Cross-user access returns 403
  - Messages persist across page reloads

**T12: Chat UI Integration**

- Update `src/lib/stores/chat.store.ts`:
  - Add `sessionId` and `sessions` state
  - Load sessions on mount from API
  - On new message: save to API (future)
  - On session switch: load messages from API
- Add sidebar component:
  - List of user's sessions with titles
  - "New Chat" button to create session
  - Delete button (confirm dialog)
  - Click to switch session → clear local state, load messages from API
- Update chat UI layout (if needed)
- Acceptance:
  - User can create session, type messages, refresh page, history persists
  - Can switch between sessions

### Epic 5 — Token Usage Tracking (T13)

**T13: Token Usage API**

- Extend Prisma schema:

  ```prisma
  model TokenUsage {
    id              String   @id @default(cuid())
    userId          String   @db.VarChar(255)
    model           String   // "gpt-4o-mini", "deepseek-chat", etc.
    inputTokens     Int
    outputTokens    Int
    totalTokens     Int      @default(0)
    month           String   // "2026-04"
    createdAt       DateTime @default(now())

    @@index([userId])
    @@index([userId, month])
  }
  ```

- Instrument LLM services:
  - In `src/lib/services/ollama-chat.service.ts`, `azure-openai-chat.service.ts` etc.:
    - After every chat completion, extract token counts from response
    - Call `recordUsage(userId, model, inputTokens, outputTokens)`
  - Helper function in `src/lib/services/token-usage.service.ts`:
    ```typescript
    export async function recordUsage(
      userId: string,
      model: string,
      inputTokens: number,
      outputTokens: number,
    ) {
      const month = new Date().toISOString().slice(0, 7); // "2026-04"
      return prisma.tokenUsage.create({
        data: { userId, model, inputTokens, outputTokens, month },
      });
    }
    ```
- Create `GET /api/usage/summary` (auth required):
  - Query params: `?userId=xxx` (admin only, else use current user)
  - Returns: `{ currentMonth: { total, byModel }, cumulative: { total, byModel }, history: [] }`
  - Calculation: sum tokens grouped by month
- Create `GET /api/usage/history` (auth required):
  - Paginated daily breakdown for detailed view (optional for Phase 5)
- Acceptance:
  - Token counts recorded after every LLM call
  - Summary aggregates correctly for current month
  - Admin can query any user; non-admin sees own only
  - Historical data accumulated correctly

---

## Acceptance Criteria (Phase-Level GO/NO-GO)

- **Zero cross-user data leakage**: Automated test verifies User A cannot query User B's docs
- **Session persistence**: Message history restored after page refresh
- **Token accuracy**: ≤ 5% error margin vs. actual LLM token counts
- **Rate limiting**: Public endpoints enforce limits (manual test)
- **Test coverage**: ≥ 80% overall (unit + integration)
- **All T1-T13 tasks**: Completed and verified

---

## Dependencies & Prerequisites

- **Next.js 15**: Already installed; confirm `next-auth@5` peer-dependency
- **Prisma**: Schema updates; run `prisma migrate dev` after schema changes
- **Upstash**: Free tier Redis (for rate limiting); provisioning takes ~1 minute
- **Azure AD** (optional for Phase 5): Can use credentials provider for dev; Azure AD setup deferred to production rollout

---

## Notes

- All routes require authentication **except** those explicitly marked `@AllowAnonymous` (coming in Phase 6)
- `getCurrentUser()` returns null if no session; routes must opt-in to requiring auth
- Token recording is **asynchronous** (don't block chat response on token logging)
- Phase 5 is **stable gate**: Phase 6 cannot begin until Phase 5 GO criteria met
