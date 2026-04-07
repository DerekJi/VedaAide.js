# 阶段二实施计划：后端核心 + 最小可行性 UI

> **阶段时长**: 3-4周 | **前置**: Phase 1 | **阻塞**: Phase 3

## 执行摘要

**核心策略：采用"垂直切片"模式，而非传统的"先后端后前端"分层**

使用 LangChain.js 重写 RAG、Agent、MCP 核心服务，同时搭建**最小可行性 UI**，确保在本阶段结束时拥有：
1. 完整的 LangChain 后端逻辑（无头服务）
2. 一个极简的聊天界面（验证流式响应和端到端链路）
3. Next.js 全栈链路的通畅性（从浏览器到数据库再到 LLM）

这种方式的优势：
- ✅ 避免到 Phase 3 才发现前后端集成问题
- ✅ 提前验证 SSE 流式响应（AI 应用的核心体验）
- ✅ 利用 Next.js 的 Server Actions 实现端到端类型安全
- ✅ 可以边开发后端边在 UI 上观察 AI 输出效果

### GO/NO-GO决策标准

| 验证项 | 目标 | 验证方法 |
|-------|------|----------|
| LangChain RAG链 | 成功检索+生成 | E2E测试 |
| 双层去重 | Hash+相似度去重生效 | 单元测试 |
| 幻觉检测 | 识别错误答案 | 集成测试 |
| **Re-ranking** | 检索结果质量提升 | A/B 对比测试 |
| Agent编排 | LLM自主调用工具 | 功能测试 |
| **Agent 协议** | SK Function Calling 兼容 | 协议文档验证 |
| MCP Server | 外部客户端连接 | Postman测试 |
| MCP Client | 读取外部数据源 | 集成测试 |
| **流式响应 UI** | 浏览器逐字显示 | 手动测试 |
| **Server Actions** | 端到端类型安全 | `tsc --noEmit` |
| 测试覆盖率 | ≥75% | Coverage报告 |

---

## 核心任务清单 (22个)

### LangChain RAG链迁移 (T1-T5)

**T1: LangChain核心依赖安装**
```bash
npm install @langchain/core @langchain/community \
  @langchain/ollama @langchain/openai \
  langchain
```
- [ ] 安装LangChain核心包
- [ ] 安装Ollama/OpenAI连接器
- [ ] LangSmith追踪配置(可选)
- **验收**: 所有导入无类型错误

**T2: 文档加载器(Document Loaders)**
```typescript
import { TextLoader } from '@langchain/community/document_loaders/fs/text';
import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';

export class DocumentLoaderService {
  async load(filePath: string): Promise<Document[]> {
    const ext = path.extname(filePath);
    switch (ext) {
      case '.txt': return new TextLoader(filePath).load();
      case '.pdf': return new PDFLoader(filePath).load();
      // ...
    }
  }
}
```
- [ ] Text/Markdown加载器
- [ ] PDF加载器(可选)
- [ ] 统一`Document`对象转换
- **验收**: 加载各类型文档成功

**T3: 文本分割器(Text Splitters)**
```typescript
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 512,
  chunkOverlap: 50,
});
```
- [ ] 递归分割器集成
- [ ] Markdown分割器
- [ ] 动态策略选择
- **验收**: 分块边界检查

**T4: 向量存储集成(VectorStore)**
```typescript
import { PrismaVectorStore } from '@langchain/community/vectorstores/prisma';

const vectorStore = new PrismaVectorStore(embeddings, {
  prisma: prismaClient,
  tableName: 'VectorChunk',
  vectorColumnName: 'embedding',
  columns: { id: PrismaVectorStore.IdColumn, content: PrismaVectorStore.ContentColumn },
});
```
- [ ] Prisma VectorStore适配器
- [ ] 添加文档方法
- [ ] 相似度搜索方法
- **验收**: 存储并检索向量

**T5: RAG链构建(RetrievalQAChain)**
```typescript
import { RetrievalQAChain } from 'langchain/chains';
import { ChatOllama } from '@langchain/ollama';

const chain = RetrievalQAChain.fromLLM(
  new ChatOllama({ model: 'qwen3:8b' }),
  vectorStore.asRetriever(5)
);

const result = await chain.invoke({ query: question });
```
- [ ] 构建`RetrievalQAChain`
- [ ] Prompt模板自定义
- [ ] 返回来源文档
- **验收**: E2E RAG查询测试

**T5.5: Re-ranking（重排序）集成** ⭐ 新增
```typescript
import { CohereRerank } from '@langchain/cohere';

export class RerankingService {
  private reranker = new CohereRerank({
    apiKey: process.env.COHERE_API_KEY,
    model: 'rerank-english-v3.0',
  });

  async rerank(query: string, documents: Document[]): Promise<Document[]> {
    const results = await this.reranker.compressDocuments(documents, query);
    return results;
  }
}
```
- [ ] 集成 Cohere Rerank API（或开源 BGE Reranker）
- [ ] 可配置启用/禁用
- [ ] 在向量搜索后、LLM 生成前调用
- [ ] A/B 测试：对比有/无 Re-ranking 的答案质量
- **验收**: Re-ranking 后的文档顺序明显改善（人工评测或 MRR 指标）

**💡 为什么 Re-ranking 重要？**
- 向量搜索基于相似度，但语义相似 ≠ 回答相关
- Re-ranker 专门训练用于"问答相关性"判断
- 通常比单纯优化向量模型更直接有效

---

### 双层去重服务 (T6-T8)

**T6: Hash去重(Layer 1)**
```typescript
import { createHash } from 'crypto';

export class DeduplicationService {
  async checkHashDuplicate(content: string): Promise<boolean> {
    const hash = createHash('sha256').update(content).digest('hex');
    const existing = await prisma.vectorChunk.findUnique({ where: { contentHash: hash } });
    return !!existing;
  }
}
```
- [ ] SHA-256哈希计算
- [ ] 数据库哈希查询
- [ ] 单元测试覆盖
- ** 验收**: 重复内容被识别

**T7: 向量相似度去重(Layer 2)**
```typescript
async checkSimilarityDuplicate(
  embedding: number[],
  threshold: number = 0.95
): Promise<boolean> {
  const results = await vectorStore.similaritySearchVectorWithScore(embedding, 1);
  return results[0]?.[1] >= threshold;
}
```
- [ ] 余弦相似度计算
- [ ] 可配置阈值(0.95)
- [ ] 性能优化(索引)
- **验收**: 语义重复被识别

**T8: 集成到摄取流程**
```typescript
async ingestWithDedup(content: string, metadata: DocumentMetadata): Promise<IngestResult> {
  // Layer 1: Hash check
  if (await this.dedupService.checkHashDuplicate(content)) {
    return { skipped: true, reason: 'hash_duplicate' };
  }

  // Layer 2: Similarity check
  const embedding = await this.embeddings.embedQuery(content);
  if (await this.dedupService.checkSimilarityDuplicate(embedding)) {
    return { skipped: true, reason: 'similarity_duplicate' };
  }

  // Store
  await this.vectorStore.addDocuments([{ content, embedding, metadata }]);
  return { skipped: false, id: '...' };
}
```
- [ ] 双层检查逻辑
- [ ] 跳过统计记录
- [ ] E2E测试验证
- **验收**: 重复文档不被重复存储

---

### 双层幻觉检测 (T9-T11)

**T9: 嵌入相似度检查(Layer 1)**
```typescript
export class HallucinationGuardService {
  async checkAnswerGrounding(
    answer: string,
    threshold: number = 0.3
  ): Promise<{ isHallucination: boolean; confidence: number }> {
    const answerEmbedding = await this.embeddings.embedQuery(answer);
    const results = await this.vectorStore.similaritySearchVectorWithScore(answerEmbedding, 1);
    const maxSimilarity = results[0]?.[1] ?? 0;

    return {
      isHallucination: maxSimilarity < threshold,
      confidence: maxSimilarity,
    };
  }
}
```
- [ ] 答案向量化
- [ ] 与知识库对比
- [ ] 阈值配置(0.3)
- **验收**: 错误答案被标记

**T10: LLM自校验(Layer 2)**
```typescript
async verifySelfCheck(answer: string, context: string): Promise<boolean> {
  const prompt = `上下文: ${context}\n\n答案: ${answer}\n\n请判断答案是否与上下文一致。只回复 YES 或 NO。`;
  
  const result = await this.llm.invoke([{ role: 'user', content: prompt }]);
  return result.toLowerCase().includes('yes');
}
```
- [ ] 上下文一致性问答
- [ ] 可配置启用/禁用
- [ ] Prompt模板管理
- **验收**: LLM正确识别不一致

**T11: 集成到查询流程**
```typescript
async queryWithGuard(question: string): Promise<RagQueryResult> {
  const answer = await this.ragChain.invoke({ query: question });
  
  // Layer 1 check
  const { isHallucination, confidence } = await this.guardService.checkAnswerGrounding(answer);
  
  // Layer 2 check (optional)
  if (config.enableSelfCheck) {
    const consistent = await this.guardService.verifySelfCheck(answer, context);
    // ...
  }

  return { answer, isHallucination, confidence };
}
```
- [ ] 双层检查逻辑
- [ ] 警告标记返回
- [ ] E2E测试
- **验收**: 幻觉答案被检测出来

---

### Agent 编排 (T12-T15)

**T11.5: Agent 协议定义** ⭐ 新增
```markdown
# Agent Function Calling 协议兼容性文档

## Semantic Kernel vs LangChain Tool Calling 对比

| 特性 | Semantic Kernel (.NET) | LangChain.js |
|-----|------------------------|--------------|
| 函数注册 | `[KernelFunction]` 注解 | `DynamicStructuredTool` 类 |
| 参数验证 | C# 类型系统 | Zod schema |
| 函数描述 | `Description` 属性 | `description` 字段 |
| 返回值 | 强类型 `Task<T>` | `Promise<string>` JSON |

## 迁移映射表

| .NET 函数 | 参数 | LangChain.js 等价 |
|----------|------|-------------------|
| `SearchKnowledgeBaseAsync` | `query: string, topK: int` | `search_knowledge_base` |
| `IngestDocumentAsync` | `documentPath: string, ...` | `ingest_document` |
| `GetPromptTemplateAsync` | `name: string` | `get_prompt_template` |

## Prompt 兼容性检查

确保从 SK 迁移的 Prompt 中的占位符语法兼容：
- SK: `{{$input}}`
- LangChain: `{input}` (使用标准模板引擎)
```
- [ ] 编写 SK 到 LangChain 的协议映射文档
- [ ] 验证所有现有函数的参数类型兼容性
- [ ] 确定 Prompt 占位符迁移策略
- [ ] 单元测试：验证函数调用签名一致
- **验收**: 协议文档评审通过，无兼容性盲点

**T12: Agent工具定义**
```typescript
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

const searchKnowledgeBaseTool = new DynamicStructuredTool({
  name: 'search_knowledge_base',
  description: 'Search the VedaAide knowledge base',
  schema: z.object({
    query: z.string().describe('Search query'),
    topK: z.number().default(5),
  }),
  func: async ({ query, topK }) => {
    const results = await vectorStore.similaritySearch(query, topK);
    return JSON.stringify(results);
  },
});
```
- [ ] 定义`search_knowledge_base`工具
- [ ] 定义`ingest_document`工具
- [ ] Zod schema验证
- **验收**: 工具独立调用测试

**T13: ReAct Agent构建**
```typescript
import { createReactAgent } from '@langchain/langgraph/prebuilt';

const agent = createReactAgent({
  llm: new ChatOllama({ model: 'qwen3:8b' }),
  tools: [searchKnowledgeBaseTool, ingestDocumentTool],
});

const result = await agent.invoke({
  messages: [{ role: 'user', content: 'Search for documents about RAG' }],
});
```
- [ ] 使用LangGraph构建ReAct Agent
- [ ] 工具调用循环
- [ ] 中间步骤追踪
- **验收**: Agent自主决策调用工具

**T14: Agent API端点**
- [ ] `POST /api/orchestrate/query`
- [ ] `POST /api/orchestrate/ingest`
- [ ] 返回中间步骤trace
- **验收**: Postman测试Agent调用

---

### MCP Server实现 (T15-T17)

**T15: MCP SDK集成**
```bash
npm install @modelcontextprotocol/sdk
```
```typescript
// src/app/api/mcp/route.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamable.js';

const server = new McpServer({ name: 'vedaaide', version: '1.0.0' });
```
- [ ] 安装MCP SDK
- [ ] 创建 MCP Server实例
- [ ] HTTP transport配置
- **验收**: MCP服务器启动

**T16: MCP工具注册**
```typescript
server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: 'search_knowledge_base',
      description: 'Search VedaAide knowledge base',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          topK: { type: 'number', default: 5 },
        },
      },
    },
    // ...
  ],
}));

server.setRequestHandler('tools/call', async (request) => {
  if (request.params.name === 'search_knowledge_base') {
    const results = await ragService.search(request.params.arguments.query);
    return { content: [{ type: 'text', text: JSON.stringify(results) }] };
  }
});
```
- [ ] 注册`tools/list`处理器
- [ ] 注册`tools/call`处理器
- [ ] 实现所有工具逻辑
- **验收**: MCP客户端调用成功

**T17: VS Code MCP集成测试**
```json
// .vscode/mcp.json
{
  "servers": {
    "vedaaide": {
      "type": "http",
      "url": "http://localhost:3000/api/mcp"
    }
  }
}
```
- [ ] `.vscode/mcp.json`配置
- [ ] VS Code Copilot调用测试
- [ ] 日志验证工具调用
- **验收**: Copilot成功调用VedaAide工具

---

### MCP Client实现 (T18-T20)

**T18: 文件系统连接器**
```typescript
import { DirectoryLoader } from '@langchain/community/document_loaders/fs/directory';

export class FileSystemConnector implements IDataSourceConnector {
  async sync(): Promise<SyncResult> {
    const loader = new DirectoryLoader(this.config.path, {
      '.txt': (path) => new TextLoader(path),
      '.md': (path) => new TextLoader(path),
    });

    const docs = await loader.load();
    
    for (const doc of docs) {
      // Check sync state (contentHash)
      const hash = this.computeHash(doc.pageContent);
      const synced = await this.syncStateStore.get(this.name, doc.metadata.source);
      
      if (synced?.contentHash === hash) continue; // Skip unchanged
      
      await this.ragService.ingest(doc.pageContent, doc.metadata);
      await this.syncStateStore.set(this.name, doc.metadata.source, hash);
    }
    
    return { filesProcessed: docs.length };
  }
}
```
- [ ] 递归目录扫描
- [ ] Hash对比跳过未变文件
- [ ] Prisma `SyncedFile`表更新
- **验收**: 只摄取新增/修改文件

**T19: Blob Storage连接器**
- [ ] 列举容器Blob
- [ ] 下载并摄取
- [ ] 同步状态跟踪
- **验收**: Azure Blob文件被摄取

** T20: 定时同步服务**
```typescript
// 后台服务，每小时运行
export class DataSourceSyncService {
  @Cron('0 * * * *') // Every hour
  async syncAll() {
    const connectors = this.getEnabledConnectors();
    for (const connector of connectors) {
      await connector.sync();
    }
  }
}
```
- [ ] 定时任务配置
- [ ] 手动触发API: `POST /api/datasources/sync`
- [ ] 日志记录
- **验收**: 定时任务执行成功

---

### Prompt版本管理 (T21-T22)

**T21: Prompt模板 CRUD API**
- [ ] `GET /api/prompts` - 列表
- [ ] `POST /api/prompts` - 创建
- [ ] `PUT /api/prompts/:id` - 更新
- [ ] `DELETE /api/prompts/:id` - 删除
- **验收**: Postman CRUD测试通过

**T22: 动态Prompt加载**
```typescript
export class PromptService {
  async getActivePrompt(name: string): Promise<string> {
    const template = await prisma.promptTemplate.findFirst({
      where: { name, isActive: true },
      orderBy: { version: 'desc' },
    });
    return template?.content ?? DEFAULT_PROMPTS[name];
  }
}
```
- [ ] 从数据库加载Prompt
- [ ] 版本选择逻辑
- [ ] Fallback到默认Prompt
- **验收**: 修改Prompt后查询结果变化

---

### Server Actions 与流协议定义 (T23-T25) ⭐ 新增

**T23: Server Actions 实现核心业务逻辑**
```typescript
// src/app/actions/rag.actions.ts
'use server';

import { z } from 'zod';

const QuerySchema = z.object({
  question: z.string().min(1),
  conversationId: z.string().optional(),
});

export async function queryAction(formData: FormData) {
  const { question, conversationId } = QuerySchema.parse({
    question: formData.get('question'),
    conversationId: formData.get('conversationId'),
  });

  const result = await ragService.query(question);
  return result;
}

export async function ingestAction(formData: FormData) {
  const file = formData.get('file') as File;
  const content = await file.text();
  
  await ragService.ingestWithDedup(content, {
    fileName: file.name,
    uploadedAt: new Date(),
  });
  
  return { success: true };
}
```
- [ ] 实现 `queryAction` (端到端类型安全)
- [ ] 实现 `ingestAction` (文件上传)
- [ ] Zod 验证所有输入
- [ ] 错误处理与类型化返回值
- **验收**: `tsc --noEmit` 零错误，前端调用有完整类型提示

**T24: SSE 流式响应协议定义**
```typescript
// src/app/api/query/stream/route.ts
import { LangChainStream, StreamingTextResponse } from 'ai';

export async function POST(req: Request) {
  const { question } = await req.json();
  
  const { stream, handlers } = LangChainStream();
  
  // 异步生成流
  (async () => {
    const llm = new ChatOllama({ 
      model: 'qwen3:8b',
      streaming: true,
      callbacks: [handlers],
    });
    
    await ragChain.invoke({ query: question }, { callbacks: [handlers] });
  })();
  
  return new StreamingTextResponse(stream);
}
```
- [ ] 安装 Vercel AI SDK: `npm install ai`
- [ ] 实现 SSE 流式端点
- [ ] LangChain 流式回调集成
- [ ] 前端消费流的协议文档（见 T26）
- **验收**: 浏览器 `EventSource` 能逐字接收响应

**T25: 流协议兼容性测试**
```typescript
// 测试环境：Docker 容器 + 网络延迟模拟
describe('SSE Streaming', () => {
  it('should handle slow network gracefully', async () => {
    // 模拟 500ms RTT 延迟
    const response = await fetch('/api/query/stream', {
      method: 'POST',
      body: JSON.stringify({ question: 'test' }),
    });
    
    const reader = response.body.getReader();
    const chunks = [];
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(new TextDecoder().decode(value));
    }
    
    expect(chunks.length).toBeGreaterThan(10); // 确保分块传输
  });
});
```
- [ ] 单元测试：正常网络条件
- [ ] 集成测试：高延迟网络（500ms RTT）
- [ ] 边缘环境测试（Vercel Edge Runtime 超时限制）
- **验收**: 所有测试通过，流不中断

---

### 最小可行性 UI (T26-T28) ⭐ 新增

**T26: 极简聊天界面（验证全栈链路）**
```typescript
// src/app/page.tsx
'use client';

import { useChat } from 'ai/react'; // Vercel AI SDK

export default function ChatPage() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/query/stream',
  });

  return (
    <div className="flex flex-col h-screen">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((m) => (
          <div key={m.id} className={m.role === 'user' ? 'text-blue-600' : 'text-gray-800'}>
            <strong>{m.role}:</strong> {m.content}
          </div>
        ))}
      </div>
      
      <form onSubmit={handleSubmit} className="p-4 border-t">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask a question..."
          className="w-full p-2 border rounded"
          disabled={isLoading}
        />
      </form>
    </div>
  );
}
```
- [ ] 使用 `useChat` hook 处理流式响应
- [ ] 消息列表实时更新
- [ ] Loading 状态显示
- [ ] 基础样式（可使用 Tailwind）
- **验收**: 在浏览器中能看到逐字显示的 AI 回答

**💡 为什么需要最小 UI？**
- ✅ 提前验证 Next.js 全栈链路（浏览器 → Server Actions → LangChain → LLM）
- ✅ 立即看到 AI 输出效果，而不是等到 Phase 3
- ✅ 调试流式响应比用 Postman 方便 100 倍
- ✅ 避免 Phase 3 集成前后端时发现架构问题

**T27: 文档摄取简易表单**
```typescript
// src/app/ingest/page.tsx
'use client';

import { ingestAction } from '@/app/actions/rag.actions';

export default function IngestPage() {
  return (
    <form action={ingestAction}>
      <input type="file" name="file" accept=".txt,.md" required />
      <button type="submit">上传并摄取</button>
    </form>
  );
}
```
- [ ] 文件上传表单
- [ ] 调用 Server Action
- [ ] 成功/失败提示
- **验收**: 上传文件后能在聊天界面查询到内容

**T28: Next.js 页面路由框架**
```
src/app/
  ├── layout.tsx          # 根布局（含侧边栏占位）
  ├── page.tsx            # 聊天页 (T26)
  └── ingest/
      └── page.tsx        # 摄取页 (T27)
```
- [ ] 创建基础路由结构
- [ ] 简易侧边栏导航（`/` 和 `/ingest` 链接）
- [ ] 响应式布局框架
- **验收**: 能在两个页面间导航

---

## 核心任务清单总结

**原有任务**: T1-T22 (后端逻辑)
**新增任务**: 
- T5.5: Re-ranking
- T11.5: Agent 协议定义
- T23-T25: Server Actions 与流协议
- T26-T28: 最小可行性 UI

**总计**: 28 个任务

---

## 风险评估

| 风险 | 影响 | 概率 | 缓解措施 |
|-----|------|------|----------|
| LangChain API变更 | 高 | 中 | 锁定版本0.3.x |
| MCP协议不兼容 | 中 | 中 | Phase 1早期PoC验证 |
| Agent调用死循环 | 中 | 低 | 设置最大迭代次数 |
| Re-ranking API 成本过高 | 中 | 中 | 使用开源 BGE Reranker 作为备选 |
| SSE 流在边缘环境超时 | 高 | 中 | T25 提前测试，必要时切换到轮询 |

---

## 时间线（更新）

```
Week 1: T1-T5.5 (LangChain RAG链 + Re-ranking)
Week 2: T6-T11.5 (去重 + 幻觉检测 + Agent 协议)
Week 3: T12-T20 (Agent + MCP Server/Client)
Week 4: T21-T28 (Prompt管理 + Server Actions + 最小UI)
```

**关键里程碑**:
- ✅ Week 2 结束：后端核心逻辑跑通（无 UI 可用 Postman 验证）
- ✅ Week 4 结束：**有一个能用的聊天界面**，完整验证全栈链路

---

## GitHub Issue模板

```markdown
# [Phase 2] 后端核心 + 最小可行性 UI

## 🎯 目标
用 LangChain 重写 RAG/Agent/MCP 核心服务，并搭建极简聊天界面验证全栈链路

## ✅ 任务清单
**后端核心**:
- [ ] T1-T5.5: LangChain RAG链 + Re-ranking
- [ ] T6-T8: 双层去重
- [ ] T9-T11: 双层幻觉检测
- [ ] T11.5: Agent 协议定义
- [ ] T12-T15: Agent编排
- [ ] T16-T20: MCP Server/Client
- [ ] T21-T22: Prompt管理

**全栈集成**:
- [ ] T23-T25: Server Actions + SSE 流协议
- [ ] T26-T28: 最小可行性 UI（聊天界面）

## 📊 完成标准
- [x] 所有 GO/NO-GO 测试通过（11项）
- [x] 测试覆盖率 ≥ 75%
- [x] Agent 自主决策工作
- [x] MCP 服务器可连接
- [x] **浏览器能看到 AI 逐字流式回答**
- [x] **Next.js 全栈链路验证完成**

## 🔗 相关: [Phase 1](./phase1-plan.cn.md) | [Phase 3](./phase3-plan.cn.md)
## 👥 指派: @ai-developer @backend-engineer @fullstack-engineer
```

---

**文档维护**: VedaAide迁移团队 | **下一步**: [Phase 3计划](./phase3-plan.cn.md)
