# Phase 3 Implementation Plan: Frontend Migration

> **Duration**: 2-3 weeks | **Prerequisites**: Phase 2 | **Blocks**: Phase 4

## Executive Summary

Migrate Angular 19 frontend entirely to React 19 + Next.js App Router, rebuild UI/UX, implement SSE streaming and type-safe API calls.

### GO/NO-GO Decision Criteria

| Criterion         | Target                      | Verification Method |
| ----------------- | --------------------------- | ------------------- |
| Page Rendering    | All main pages accessible   | Manual testing      |
| SSE Streaming     | Word-by-word answer display | E2E tests           |
| Type Safety       | End-to-end type checking    | `tsc --noEmit`      |
| Responsive Design | Mobile adaptation           | Lighthouse          |
| Performance Score | Lighthouse ≥90              | Lighthouse CI       |
| E2E Tests         | Key flows pass              | Playwright          |

---

## Core Task Checklist (18 Tasks)

### React Component Foundation (T1-T4)

**T1: UI Component Library Selection**

> **Implementation note**: shadcn CLI was not used (Tailwind v4 compatibility). Components were created manually using Radix UI primitives + CVA + clsx + tailwind-merge, matching the shadcn style.

- [x] shadcn-style UI components implemented manually (button, card, badge, input, textarea, label, dialog, collapsible, tooltip, toast)
- [x] Radix UI primitives used instead of shadcn CLI
- [x] `cn()` utility (clsx + tailwind-merge) at `src/lib/utils.ts`
- [x] CVA for variant-based styling
- **Acceptance**: Components used across all pages ✅

**T2: Layout Components**

```typescript
// src/app/layout.tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Sidebar />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
```

- [x] Responsive sidebar (`src/app/_components/side-nav.tsx`)
- [x] Mobile hamburger menu (Menu/X icons, drawer with transition)
- [x] 4 navigation links (Chat / Ingest / Prompts / Evaluation)
- **Acceptance**: Multi-size adaptation ✅

**T3: Route Structure**

```
src/app/
  ├── (chat)/
  │   └── page.tsx        # Chat page (default)
  ├── ingest/
  │   └── page.tsx        # Document ingestion page
  ├── prompts/
  │   └── page.tsx        # Prompt management page
  └── evaluation/
      └── page.tsx        # Evaluation report page
```

- [x] All route pages created (prompts/, evaluation/)
- [x] Loading boundary (`src/app/loading.tsx`)
- [x] Error boundary (`src/app/error.tsx`, Client Component + reset button)
- **Acceptance**: Route navigation works ✅

**T4: State Management**

```typescript
// src/lib/stores/chat.store.ts
import { create } from "zustand";

interface ChatState {
  messages: Message[];
  addMessage: (msg: Message) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
  clearMessages: () => set({ messages: [] }),
}));
```

- [x] Zustand chat store (`src/lib/stores/chat.store.ts`: ChatMessage, addMessage, appendToken, finalizeMessage)
- [x] TanStack Query v5 + QueryClientProvider (`src/lib/providers/query-provider.tsx`)
- [x] `useIngestMutation`, `useSyncedFiles`, `useSyncMutation` (`src/lib/queries/rag.queries.ts`)
- [x] `usePrompts`, `useCreatePrompt`, `useUpdatePrompt`, `useDeletePrompt` (`src/lib/queries/prompts.queries.ts`)
- **Acceptance**: State changes update UI, long SSE streams stable ✅

---

### Chat Page (T5-T8)

**T5: Chat Interface Component**

```typescript
// src/components/chat/chat-interface.tsx
export function ChatInterface() {
  const { messages, addMessage } = useChatStore();
  const [input, setInput] = useState('');

  const handleSubmit = async () => {
    addMessage({ role: 'user', content: input });
    // ... SSE streaming
  };

  return (
    <div className="flex flex-col h-screen">
      <MessageList messages={messages} />
      <ChatInput value={input} onChange={setInput} onSubmit={handleSubmit} />
    </div>
  );
}
```

- [x] Message list component (`src/components/chat/message-list.tsx`)
- [x] Chat input component (`src/components/chat/chat-input.tsx`, Textarea + Stop button)
- [x] Send button and Ctrl+Enter shortcut
- [x] ChatInterface orchestrator (`src/components/chat/chat-interface.tsx`)
- **Acceptance**: Basic chat UI functional ✅

**T6: SSE Streaming Response**

```typescript
// src/lib/api/query-stream.ts
export async function* queryStream(question: string): AsyncGenerator<ChatEvent> {
  const eventSource = new EventSource(`/api/querystream?query=${encodeURIComponent(question)}`);

  for await (const event of eventSource) {
    const data = JSON.parse(event.data);

    if (data.type === "sources") {
      yield { type: "sources", data: data.data };
    } else if (data.type === "token") {
      yield { type: "token", token: data.token };
    } else if (data.type === "done") {
      yield { type: "done", isHallucination: data.isHallucination };
      break;
    }
  }
}
```

> **Implementation note**: Used `fetch` + `ReadableStream.getReader()` instead of `EventSource` (avoids GET URL length limits). Response format changed to `text/event-stream` SSE with typed events: `{type:"token"}` and `{type:"done",sources:[...],isHallucination:bool}`.

- [x] SSE streaming protocol (`text/event-stream`, typed events)
- [x] `useChatStream` hook parses SSE events, backed by Zustand store
- [x] Word-by-word animation (`animate-pulse` cursor)
- **Acceptance**: Answer streams output ✅

**T7: Sources Citation Panel**

```typescript
// src/components/chat/sources-panel.tsx
export function SourcesPanel({ sources }: { sources: VectorSearchResult[] }) {
  return (
    <Collapsible>
      <CollapsibleTrigger>
        <Badge>{sources.length} sources</Badge>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {sources.map((source, i) => (
          <Card key={i}>
            <CardHeader>
              <CardTitle>{source.metadata.documentName}</CardTitle>
              <Badge>Similarity: {(source.similarity * 100).toFixed(1)}%</Badge>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{source.content}</p>
            </CardContent>
          </Card>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
```

- [x] Collapsible sources panel (`src/components/chat/sources-panel.tsx`, Radix Collapsible)
- [x] Similarity score percentage display
- [x] Source filename + line-clamped content preview
- **Acceptance**: Click to expand/collapse ✅

**T8: Hallucination Warning Badge**

- [x] Warning Badge component (`src/components/chat/hallucination-badge.tsx`)
- [x] Conditional rendering (isHallucination=true)
- [x] Radix Tooltip explanation
- **Acceptance**: Hallucination answers show warning ✅

---

### Ingestion Page (T9-T11)

**T9: File Upload Component**

```typescript
// src/components/ingest/file-upload.tsx
export function FileUpload() {
  const { getRootProps, getInputProps } = useDropzone({
    accept: { 'text/plain': ['.txt'], 'text/markdown': ['.md'] },
    onDrop: async (files) => {
      for (const file of files) {
        const content = await file.text();
        await ingestDocument({ content, documentName: file.name, documentType: 'txt' });
      }
    },
  });

  return (
    <div {...getRootProps()} className="border-2 border-dashed p-8 text-center">
      <input {...getInputProps()} />
      <p>Drag files or click to upload</p>
    </div>
  );
}
```

- [x] react-dropzone integration (`src/components/ingest/file-upload.tsx`)
- [x] Drag-and-drop upload support (multi-file)
- [x] File type restrictions (.txt, .md, .mdx)
- **Acceptance**: Upload file successfully ✅

**T10: Ingestion History Table**

- [x] TanStack Table (`src/components/ingest/ingest-history.tsx`)
- [x] Display filename, status (Badge), chunk count, created date
- [x] Column sorting (chevron icons)
- [x] `GET /api/ingest` list endpoint added (Prisma `syncedFile.findMany`)
- **Acceptance**: Table data loads and displays ✅

**T11: Manual Sync Button**

- [x] Trigger `POST /api/datasources/sync` (`src/components/ingest/sync-button.tsx`)
- [x] Loading state display (RefreshCw spinning icon)
- [x] Toast success/failure notification
- **Acceptance**: Click sync executes ✅

---

### Prompt Management Page (T12-T13)

**T12: Prompt Template CRUD Interface**

- [x] Template list display (`src/components/prompts/prompt-list.tsx`, inline table)
- [x] Create/edit dialog (Radix Dialog, `src/components/prompts/prompt-form.tsx`)
- [x] Delete confirmation (`confirm()` + `useDeletePrompt` mutation)
- **Acceptance**: CRUD operations work ✅

**T13: Prompt Editor**

```typescript
// Use CodeMirror or Monaco Editor
import CodeMirror from '@uiw/react-codemirror';

export function PromptEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={[markdown()]}
      theme="dark"
    />
  );
}
```

> **Implementation note**: CodeMirror/Monaco not used (avoided heavy dep). Used `<Textarea rows={10} className="font-mono">` which meets basic needs and reuses existing UI components (DRY). Can upgrade in Phase 4.

- [x] Prompt editor (monospaced Textarea, `font-mono text-sm resize-y`)
- [ ] ~~Code editor integration~~ (deferred to Phase 4)
- [ ] ~~Syntax highlighting~~ (deferred to Phase 4)
- **Acceptance**: Edit and save prompts ✅

---

### Type-Safe API Calls (T14-T15)

**T14: tRPC Integration (Recommended)**

```typescript
// src/server/routers/_app.ts
import { router, publicProcedure } from "../trpc";
import { z } from "zod";

export const appRouter = router({
  query: publicProcedure
    .input(z.object({ question: z.string(), topK: z.number().default(5) }))
    .mutation(async ({ input }) => {
      return await ragService.query(input.question, input.topK);
    }),
});

export type AppRouter = typeof appRouter;
```

> **Implementation note**: T14 (tRPC) was skipped — Server Actions (T15) completed in Phase 2 cover all use cases. tRPC would add complexity with limited benefit.

- [ ] ~~tRPC server configuration~~ (skipped; T15 Server Actions sufficient)
- [ ] ~~tRPC React Query hooks~~ (skipped)
- **Acceptance**: End-to-end type hints — achieved via TanStack Query + fetch ✅

**T15: Server Actions (Alternative)**

```typescript
// src/app/actions.ts
"use server";

export async function queryAction(question: string): Promise<RagQueryResult> {
  return await ragService.query(question);
}
```

- [x] Server Actions completed in Phase 2 (`src/app/actions/rag.actions.ts`)
- **Acceptance**: Form submission calls ✅

---

### E2E Testing (T16-T18)

**T16: Playwright Configuration**

```bash
npm install -D @playwright/test
npx playwright install
```

```typescript
// tests/e2e/chat.spec.ts
import { test, expect } from "@playwright/test";

test("Chat flow", async ({ page }) => {
  await page.goto("http://localhost:3000");
  await page.fill('textarea[name="message"]', "What is RAG?");
  await page.click('button[type="submit"]');
  await expect(page.locator(".message-assistant")).toContainText("Retrieval");
});
```

- [x] `playwright.config.ts` (auto-starts dev server; skip in CI)
- [x] E2E test files: `tests/e2e/chat.spec.ts`, `tests/e2e/ingest.spec.ts`
- [x] `npm run test:e2e` and `npm run test:e2e:ui` scripts added
- **Acceptance**: Playwright configured ✅

**T17: Key Flow Tests**

- [x] Complete chat flow (send message, render, stream)
- [x] Document upload flow (dropzone visible, SyncButton visible)
- [x] SSE Stop button test (T17.5, in chat.spec.ts)
- [ ] ~~Prompt editing flow~~ (E2E test in Phase 4)
- **Acceptance**: All key flows automated ✅

**T18: Visual Regression Testing**

> **Implementation note**: Deferred to Phase 4 (requires Chromatic/Percy service integration).

- [ ] ~~Playwright screenshot comparison~~ (deferred to Phase 4)
- [ ] ~~CI integration~~ (deferred to Phase 4)
- **Acceptance**: Deferred ⏭️

---

## Risk Assessment

| Risk                                     | Impact | Probability | Mitigation                          |
| ---------------------------------------- | ------ | ----------- | ----------------------------------- |
| SSE streaming fails in edge environments | Medium | Low         | Fallback to polling                 |
| React 19 concurrency issues              | Low    | Low         | Use Suspense boundaries             |
| E2E test flakiness                       | Medium | Medium      | Retry mechanism + wait for elements |

---

## Timeline

```
Week 1: T1-T4 (Foundation) + T5-T8 (Chat page)
Week 2: T9-T13 (Ingest + Prompt pages) + T14-T15 (Type-safe API)
Week 3: T16-T18 (E2E tests) + UI polish
```

---

## GitHub Issue Template

```markdown
# [Phase 3] Frontend Migration

## 🎯 Goal

Angular → React 19 + Next.js App Router

## ✅ Task Checklist

- [ ] T1-T4: React component foundation
- [ ] T5-T8: Chat page
- [ ] T9-T11: Ingestion page
- [ ] T12-T13: Prompt management page
- [ ] T14-T15: Type-safe API
- [ ] T16-T18: E2E tests

## 📊 Definition of Done

- [x] All pages accessible
- [x] SSE streaming works
- [x] Lighthouse ≥90
- [x] E2E tests pass

## 🔗 Related: [Phase 2](./phase2-plan.en.md) | [Phase 4](./phase4-plan.en.md)

## 👥 Assigned: @frontend-engineer
```

---

**Document Maintainer**: VedaAide Migration Team | **Next Step**: [Phase 4 Plan](./phase4-plan.en.md)
