# Phase 6 Implementation Plan: Enterprise Features & Knowledge Governance

> **Duration**: 3-4 weeks | **Branch**: `feature/6-enterprise`  
> **Prerequisites**: Phase 5 (stable gate passed)  
> **Blocks**: Phase 7

## Overview

Phase 6 introduces knowledge governance, document sharing, public API capabilities, admin infrastructure, and feedback-driven personalization. All features depend on Phase 5 user system.

### Core Epics

| Epic                              | Tasks   | Scope                                                |
| --------------------------------- | ------- | ---------------------------------------------------- |
| Knowledge Visibility & Governance | T6-T8   | Visibility scopes, sharing groups, consensus review  |
| Public Resume Tailoring           | T9-T10  | Anonymous SSE endpoint, CORS, UI                     |
| User Feedback & Personalization   | T14-T15 | Behavior tracking, feedback-boosted retrieval        |
| Document Diff & Ephemeral RAG     | T16-T17 | Change detection, temporary extraction               |
| Azure Integration & Admin         | T21-T24 | Blob connector, admin panel, demo library, auto-sync |

**Total**: 14-15 tasks | **Target**: All GO criteria met before Phase 7

---

## Tasks

### Epic 2 — Knowledge Visibility & Governance (T6–T8)

**T6: Knowledge Scope — Visibility Levels**

- Extend Prisma `VectorChunk` model:
  ```prisma
  model VectorChunk {
    // ... existing fields
    visibility  String  @default("PRIVATE")  // PRIVATE | SHARED | PUBLIC
    @@index([visibility])
  }
  ```
- Update ingest API (`POST /api/ingest`):
  - Accept optional `visibility` query param (default: PRIVATE)
  - Validate: only PRIVATE allowed for regular users; ADMIN sets PUBLIC
- Update vector search in `RagService`:
  - Filter logic:
    ```typescript
    const scope = new KnowledgeScope(
      visibility: user.isAdmin ? null : Visibility.Public,
      ownerId: user.userId  // or null if admin querying public
    );
    ```
- Acceptance:
  - Regular user ingests: chunks default to PRIVATE
  - PRIVATE chunks only visible to owner
  - PUBLIC chunks visible to all users
  - Admin can toggle chunk visibility via admin endpoint (Phase 6 T23)

**T7: Sharing Groups**

- Add Prisma tables:

  ```prisma
  model SharingGroup {
    id          String   @id @default(cuid())
    name        String
    ownerId     String   // admin who created group
    createdAt   DateTime @default(now())
    members     GroupMembership[]
    shares      DocumentShare[]
  }

  model GroupMembership {
    id      String @id @default(cuid())
    groupId String
    group   SharingGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
    userId  String
    @@unique([groupId, userId])
  }

  model DocumentShare {
    id        String @id @default(cuid())
    documentId String // document name or chunk owner
    groupId   String
    group     SharingGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
    @@unique([documentId, groupId])
  }
  ```

- Create routes (admin only):
  - `POST /api/governance/groups`
    - Body: `{ name, memberIds: string[] }`
    - Returns: `{ id, name, members }`
  - `GET /api/governance/groups` — list all groups (admin)
  - `PUT /api/governance/groups/:id/members` — add/remove members
  - `PUT /api/governance/documents/:docId/share`
    - Body: `{ groupId: string }`
    - Add document to group's shared list
- Update retrieval:
  - When querying with scope, check if user is in a group that owns the document
  - Filter: `visibility IN (PRIVATE if owner, SHARED if in group, PUBLIC)`
- Acceptance:
  - Admin creates group with members
  - Owner can share document with group
  - Group members can query shared documents

**T8: Consensus Candidate Review**

- Add Prisma table:
  ```prisma
  model ConsensusCandidate {
    id         String   @id @default(cuid())
    chunkId    String   // or entity being voted on
    status     String   @default("PENDING")  // PENDING | APPROVED | REJECTED
    votesFor   Int      @default(0)
    votesAgainst Int    @default(0)
    proposedAt DateTime @default(now())
    decidedAt  DateTime?
  }
  ```
- Create routes (admin only):
  - `GET /api/governance/consensus/pending` — list pending candidates
  - `POST /api/governance/consensus/:id/approve` — mark PUBLIC
  - `POST /api/governance/consensus/:id/reject` — mark REJECTED
- Logic:
  - Approved candidates: update corresponding chunk's visibility to PUBLIC
  - Rejected candidates: remain as-is
- Acceptance:
  - Admin reviews pending items
  - Approve → chunk becomes PUBLIC

### Epic 3 — Public Resume Tailoring (T9–T10)

**T9: Public Resume Tailoring API**

- Create `POST /api/public/resume/tailor` (no auth required)
- Pipeline:
  1. Embed job description
  2. Search `visibility=PUBLIC` chunks (topK=requested or default 5)
  3. Build context from chunks
  4. Call LLM with system prompt + context + JD
  5. Stream response as text/event-stream (SSE)
- System prompt (mirror .NET):
  ```
  You are a professional resume writer. Generate a tailored Markdown resume
  using ONLY the provided candidate profile. Do NOT fabricate. No contact details.
  ```
- Rate limiting: Apply T5 limit (~100 req/hr per IP)
- CORS in `next.config.ts`:
  ```typescript
  headers: async () => [
    {
      source: "/api/public/resume/tailor",
      headers: [
        { key: "Access-Control-Allow-Origin", value: "https://derekji.github.io" },
        { key: "Access-Control-Allow-Methods", value: "POST, OPTIONS" },
      ],
    },
  ];
  ```
- Acceptance:
  - Anonymous curl/fetch to endpoint returns SSE stream
  - 30 seconds to complete 500-word JD
  - Respects rate limit
  - CORS allows resume site origin

**T10: Resume Tailor UI**

- Add `/resume-tailor` page (public, no auth):
  ```typescript
  // src/app/resume-tailor/page.tsx
  export default async function ResumeTailorPage() {
    return (
      <div className="max-w-4xl mx-auto">
        <h1>Resume Tailoring</h1>
        <textarea placeholder="Paste job description..." />
        <button>Generate</button>
        <StreamingMarkdown /> {/* streams resume from API */}
      </div>
    );
  }
  ```
- Component: `StreamingMarkdown` that:
  - Handles SSE events from `/api/public/resume/tailor`
  - Renders Markdown in real-time
  - Shows preview (md to HTML)
- Acceptance:
  - User pastes JD, clicks Generate
  - Markdown resume streams and renders in real-time

### Epic 6 — User Feedback & Personalization (T14–T15)

**T14: Feedback Recording API**

- Add Prisma table:

  ```prisma
  model UserBehaviorEvent {
    id               String   @id @default(cuid())
    userId           String
    sessionId        String
    type             String   // ADOPTED | REJECTED | MODIFIED | COPIED | RATED
    relatedDocumentId String?
    relatedChunkId   String?
    query            String?
    rating           Int?     // 1-5 if RATED
    occurredAt       DateTime @default(now())

    @@index([userId])
    @@index([sessionId])
  }
  ```

- Create `POST /api/feedback` (auth optional):
  - Body:
    ```json
    {
      "type": "ADOPTED",
      "sessionId": "...",
      "relatedDocumentId": "...",
      "relatedChunkId": "...",
      "query": "...",
      "rating": 4
    }
    ```
  - Extract userId from session if available, fallback to client-supplied userId
  - Record event
- Create `GET /api/feedback/stats` (admin only):
  - Returns: aggregated stats (charts data)
    ```json
    {
      "totalEvents": 1234,
      "byType": { "ADOPTED": 500, "REJECTED": 200, ... },
      "topDocuments": [...]
    }
    ```
- Acceptance:
  - Events persisted to DB
  - Stats endpoint returns aggregated counts

**T15: Feedback-Boosted Retrieval**

- Implement `FeedbackBoostService`:
  ```typescript
  // src/lib/services/feedback-boost.service.ts
  export async function boostByFeedback(
    userId: string,
    results: VectorSearchResult[],
  ): Promise<VectorSearchResult[]> {
    // Load adoption history for this user
    const adopted = await prisma.userBehaviorEvent.findMany({
      where: { userId, type: "ADOPTED" },
      select: { relatedChunkId: true, relatedDocumentId: true },
    });

    // Boost scores of previously-adopted chunks
    return results.map((result) => ({
      ...result,
      score: adopted.some((a) => a.relatedChunkId === result.chunk.id)
        ? result.score * 1.5 // 50% boost
        : result.score,
    }));
  }
  ```
- Inject into `RagService.query()`:
  - After retrieval, call `boostByFeedback(userId, results)`
  - Re-sort results by boosted score
- Acceptance:
  - Same user querying similar content: previously-adopted chunks rank higher

### Epic 7 — Document Diff & Ephemeral Context (T16–T17)

**T16: Document Diff on Re-Ingest**

- Implement `DocumentDiffService`:
  ```typescript
  // src/lib/services/document-diff.service.ts
  export async function diffOnReIngest(oldContent: string, newContent: string, documentId: string) {
    // Word-set diff
    const oldWords = getWordSet(oldContent);
    const newWords = getWordSet(newContent);
    const added = newWords.subtract(oldWords).size;
    const removed = oldWords.subtract(newWords).size;

    // LLM-based topic extraction
    const topics = await extractChangedTopics(oldContent, newContent);

    return {
      addedChunks: Math.ceil(added / 50),
      removedChunks: Math.ceil(removed / 50),
      modifiedChunks: Math.ceil((added + removed) / 100),
      changedTopics: topics,
    };
  }
  ```
- Update ingest pipeline:
  - Check if document name exists
  - If re-ingest: compute diff, add to response
  - Delete old chunks, ingest new ones
- Ingest response includes:
  ```json
  {
    "fileId": "...",
    "chunkCount": 42,
    "diff": {
      "addedChunks": 5,
      "removedChunks": 3,
      "modifiedChunks": 8,
      "changedTopics": ["API changes", "new features"]
    }
  }
  ```
- Acceptance:
  - Re-ingest same-named document returns diff summary
  - Old chunks removed, new chunks stored

**T17: Ephemeral Context Extraction**

- Create `POST /api/context/extract` (auth required):
  - Multipart form: `file` (PDF, image, text)
  - Max size: 20 MB
  - Extract text via:
    - PDF: Azure Document Intelligence
    - Image: Azure Vision API
    - Text: direct read
  - **Do NOT store in vector DB**
  - Return: `{ text: "...", fileName: "...", extractedAt: "2026-04-08T..." }`
- Use case: user uploads file to context, chat uses extracted text for one session
- Acceptance:
  - Upload returns extracted text
  - No vectors written to DB
  - Extracted content available for chat context only in that session

### Epic 9 — Azure Integration & Admin (T21–T24)

**T21: Azure Blob Storage Connector**

- Implement `src/lib/datasources/azure-blob.connector.ts` (if Azure credentials available):
  ```typescript
  export class AzureBlobConnector implements IDataSourceConnector {
    readonly id: string;
    constructor() {
      /* init client */
    }

    async sync(): Promise<SyncResult> {
      // List blobs, fetch content, call ingest
    }
  }
  ```
- Register in `POST /api/datasources/sync`:
  - Check `env.azure.blob.isConfigured`
  - Instantiate and run sync
- Acceptance:
  - Configured blob documents sync on trigger

**T22: Background Auto-Sync Worker**

- Create cron trigger (Vercel Cron or scheduled task):
  - Route: `/api/datasources/sync/scheduled` (called by external cron)
  - Interval: 30 minutes (configurable)
  - Call registered connectors
  - Log results, handle errors gracefully
- Config env vars:
  ```
  DATA_SYNC_INTERVAL_MINUTES=30
  DATA_SYNC_ENABLED=true
  ```
- Acceptance:
  - Sync runs every 30 minutes without manual trigger
  - Errors don't block other connectors

**T23: Admin Panel API**

- Routes (admin only):
  - `GET /api/admin/stats`
    ```json
    {
      "chunkCount": 5234,
      "documentCount": 42,
      "cacheEntries": 156,
      "syncedFileCount": 18,
      "userCount": 7
    }
    ```
  - `GET /api/admin/chunks?page=1&size=20`
    ```json
    {
      "total": 5234,
      "items": [{ "id": "...", "documentName": "...", "preview": "...", "createdAt": "..." }]
    }
    ```
  - `DELETE /api/admin/documents/:documentId` — delete all chunks
  - `DELETE /api/admin/cache` — clear semantic cache (Phase 7)
- Acceptance:
  - Admin can view comprehensive DB stats
  - Can delete documents and clear cache

**T24: Demo Library**

- Store pre-loaded sample docs in assets (`public/docs/`) or Azure Blob:
  - Examples: sample resume, case study PDF, etc.
- Create routes:
  - `GET /api/demo/documents` (auth optional)
    ```json
    [
      { "name": "Derek's Resume", "description": "...", "size": 5000 },
      { "name": "Case Study", "description": "..." }
    ]
    ```
  - `POST /api/demo/documents/:name/ingest` (auth required)
    - Ingest named demo doc into user's knowledge base
    - Returns same response as normal ingest
- UI: Add "Try Demo" section in ingest page
- Acceptance:
  - New users can one-click ingest samples
  - Samples immediately queryable

---

## Acceptance Criteria (Phase-Level GO/NO-GO)

- **Resume tailoring**: SSE stream completes within 30 seconds for 500-word JD
- **Knowledge sharing**: Groups + sharing + consensus review functional end-to-end
- **Feedback tracking**: Events recorded and stats computed correctly
- **Admin panel**: All stats correct; can manage data
- **Ephemeral RAG**: Files extracted but not stored (verified by DB check)
- **Demo library**: Users can ingest samples
- **Test coverage**: ≥ 80% overall

---

## Dependencies

- **Phase 5**: Stable gate passed (authentication, user isolation)
- **Azure Blob** (T21): Optional; can skip if credentials unavailable
- **Upstash** (from Phase 5): Already configured
- **LLM APIs**: Ollama or Azure OpenAI (already available)

---

## Notes

- All endpoints require authentication **except** `POST /api/public/resume/tailor` and `GET /api/demo/documents`
- Phase 6 is **stabilization phase**: before Phase 7, ensure all features work end-to-end
- Admin routes must verify role before proceeding
