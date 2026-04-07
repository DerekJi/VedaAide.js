# Phase 3 Implementation Plan: Frontend Migration

> **Duration**: 2-3 weeks | **Prerequisites**: Phase 2 | **Blocks**: Phase 4

## Executive Summary

Migrate Angular 19 frontend entirely to React 19 + Next.js App Router, rebuild UI/UX, implement SSE streaming and type-safe API calls.

### GO/NO-GO Decision Criteria

| Criterion | Target | Verification Method |
|-----------|--------|---------------------|
| Page Rendering | All main pages accessible | Manual testing |
| SSE Streaming | Word-by-word answer display | E2E tests |
| Type Safety | End-to-end type checking | `tsc --noEmit` |
| Responsive Design | Mobile adaptation | Lighthouse |
| Performance Score | Lighthouse ≥90 | Lighthouse CI |
| E2E Tests | Key flows pass | Playwright |

---

## Core Task Checklist (18 Tasks)

### React Component Foundation (T1-T4)

**T1: UI Component Library Selection**
```bash
npx shadcn@latest init
npx shadcn@latest add button card input textarea
```
- [ ] shadcn/ui initialization (recommended)
- [ ] Configure Tailwind CSS theme
- [ ] Install common components
- [ ] Dark mode support
- **Acceptance**: Component library demo page

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
- [ ] Responsive sidebar
- [ ] Top navigation bar
- [ ] Mobile hamburger menu
- **Acceptance**: Multi-size adaptation

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
- [ ] Create all route pages
- [ ] Route groups (e.g., `(chat)` shared layout)
- [ ] Loading/Error boundaries
- **Acceptance**: Route navigation works

**T4: State Management**
```typescript
// src/lib/stores/chat.store.ts
import { create } from 'zustand';

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
- [ ] Zustand state library installation
- [ ] Chat message state
- [ ] Ingestion state (loading/error)
- **Acceptance**: State changes update UI

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
- [ ] Message list component
- [ ] Chat input component
- [ ] Send button and shortcuts
- **Acceptance**: Basic chat UI functional

**T6: SSE Streaming Response**
```typescript
// src/lib/api/query-stream.ts
export async function* queryStream(question: string): AsyncGenerator<ChatEvent> {
  const eventSource = new EventSource(`/api/querystream?query=${encodeURIComponent(question)}`);

  for await (const event of eventSource) {
    const data = JSON.parse(event.data);
    
    if (data.type === 'sources') {
      yield { type: 'sources', data: data.data };
    } else if (data.type === 'token') {
      yield { type: 'token', token: data.token };
    } else if (data.type === 'done') {
      yield { type: 'done', isHallucination: data.isHallucination };
      break;
    }
  }
}
```
- [ ] EventSource API integration
- [ ] Stream event parsing
- [ ] Word-by-word animation
- **Acceptance**: Answer streams output

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
- [ ] Collapsible sources panel
- [ ] Similarity score display
- [ ] Source content preview
- **Acceptance**: Click to expand/collapse

**T8: Hallucination Warning Badge**
- [ ] Warning Badge component
- [ ] Conditional rendering (isHallucination=true)
- [ ] Tooltip explanation
- **Acceptance**: Hallucination answers show warning

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
- [ ] react-dropzone integration
- [ ] Drag-and-drop upload  support
- [ ] File type restrictions
- **Acceptance**: Upload file successfully

**T10: Ingestion History Table**
- [ ] Use Tanstack Table
- [ ] Display document name, status, time
- [ ] Pagination and sorting
- **Acceptance**: Table data loads and displays

**T11: Manual Sync Button**
- [ ] Trigger `POST /api/datasources/sync`
- [ ] Loading state display
- [ ] Toast success/failure notification
- **Acceptance**: Click sync executes

---

### Prompt Management Page (T12-T13)

**T12: Prompt Template CRUD Interface**
- [ ] Template list display
- [ ] Create/edit dialog
- [ ] Delete confirmation
- **Acceptance**: CRUD operations work

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
- [ ] Code editor integration
- [ ] Syntax highlighting
- [ ] Real-time preview
- **Acceptance**: Edit and save prompts

---

### Type-Safe API Calls (T14-T15)

**T14: tRPC Integration (Recommended)**
```typescript
// src/server/routers/_app.ts
import { router, publicProcedure } from '../trpc';
import { z } from 'zod';

export const appRouter = router({
  query: publicProcedure
    .input(z.object({ question: z.string(), topK: z.number().default(5) }))
    .mutation(async ({ input }) => {
      return await ragService.query(input.question, input.topK);
    }),
});

export type AppRouter = typeof appRouter;
```
- [ ] tRPC server configuration 
- [ ] tRPC React Query hooks
- [ ] Type exports
- **Acceptance**: End-to-end type hints

**T15: Server Actions (Alternative)**
```typescript
// src/app/actions.ts
'use server';

export async function queryAction(question: string): Promise<RagQueryResult> {
  return await ragService.query(question);
}
```
- [ ] Server Actions definitions
- [ ] useFormState hook
- [ ] Error boundary handling
- **Acceptance**: Form submission calls

---

### E2E Testing (T16-T18)

**T16: Playwright Configuration**
```bash
npm install -D @playwright/test
npx playwright install
```
```typescript
// tests/e2e/chat.spec.ts
import { test, expect } from '@playwright/test';

test('Chat flow', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.fill('textarea[name="message"]', 'What is RAG?');
  await page.click('button[type="submit"]');
  await expect(page.locator('.message-assistant')).toContainText('Retrieval');
});
```
- [ ] Playwright installation
- [ ] Test configuration file
- [ ] Basic test cases
- **Acceptance**: `npx playwright test` passes

**T17: Key Flow Tests**
- [ ] Complete chat flow
- [ ] Document upload flow
- [ ] Prompt editing flow
- **Acceptance**: All key flows automated

**T18: Visual Regression Testing**
- [ ] Playwright screenshot comparison
- [ ] CI integration
- [ ] Failure screenshot upload
- **Acceptance**: UI changes detected

---

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| SSE streaming fails in edge environments | Medium | Low | Fallback to polling |
| React 19 concurrency issues | Low | Low | Use Suspense boundaries |
| E2E test flakiness | Medium | Medium | Retry mechanism + wait for elements |

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
