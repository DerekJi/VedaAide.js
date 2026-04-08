# Phase 6 实施计划：企业级功能与知识治理

> **耗时**：3-4 周 | **分支**：`feature/6-enterprise`  
> **前置条件**：第五阶段（稳定门控已通过）  
> **阻断**：第七阶段

## 概述

第六阶段引入知识治理、文档共享、公开 API 能力、Admin 基础设施和反馈驱动的个性化。所有功能都依赖第五阶段的用户系统。

### 核心 Epic

| Epic                 | 任务    | 范围                                     |
| -------------------- | ------- | ---------------------------------------- |
| 知识可见性与治理     | T6-T8   | 可见性作用域、共享组、共识审核           |
| 公开简历定制         | T9-T10  | 匿名 SSE 端点、CORS、UI                  |
| 用户反馈与个性化     | T14-T15 | 行为追踪、反馈权重检索                   |
| 文档差异与临时上下文 | T16-T17 | 变更检测、临时提取                       |
| Azure 集成与管理     | T21-T24 | Blob 连接器、管理后台、Demo 库、自动同步 |

**总计**：14-15 个任务 | **目标**：所有 GO 标准达成后启动第七阶段

---

## 任务详情

### Epic 2 — 知识可见性与治理（T6–T8）

**T6：知识作用域——可见性级别**

- 扩展 Prisma `VectorChunk` 模型：
  ```prisma
  model VectorChunk {
    // ... 现有字段
    visibility  String  @default("PRIVATE")  // PRIVATE | SHARED | PUBLIC
    @@index([visibility])
  }
  ```
- 更新 Ingest API（`POST /api/ingest`）：
  - 接受可选 `visibility` 查询参数（默认：PRIVATE）
  - 验证：普通用户只能 PRIVATE；Admin 可设 PUBLIC
- 更新 `RagService` 中的向量搜索：
  - 过滤逻辑：
    ```typescript
    const scope = new KnowledgeScope(
      visibility: user.isAdmin ? null : Visibility.Public,
      ownerId: user.userId  // 或 null if admin 查询 public
    );
    ```
- 验收标准：
  - 普通用户 Ingest：Chunk 默认 PRIVATE
  - PRIVATE Chunk 仅所有者可见
  - PUBLIC Chunk 所有用户可见
  - Admin 可通过管理端点切换 Chunk 可见性（第六阶段 T23）

**T7：共享组**

- 添加 Prisma 表：

  ```prisma
  model SharingGroup {
    id          String   @id @default(cuid())
    name        String
    ownerId     String   // 创建组的 Admin
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
    documentId String // 文档名称或 Chunk 所有者
    groupId   String
    group     SharingGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
    @@unique([documentId, groupId])
  }
  ```

- 创建路由（仅 Admin）：
  - `POST /api/governance/groups`
    - 请求体：`{ name, memberIds: string[] }`
    - 返回：`{ id, name, members }`
  - `GET /api/governance/groups` — 列出所有组
  - `PUT /api/governance/groups/:id/members` — 添加/移除成员
  - `PUT /api/governance/documents/:docId/share`
    - 请求体：`{ groupId: string }`
    - 将文档添加到组的共享列表
- 更新检索：
  - 查询时，检查用户是否在拥有该文档的组中
  - 过滤：`visibility IN (PRIVATE if owner, SHARED if in group, PUBLIC)`
- 验收标准：
  - Admin 创建含成员的组
  - 所有者可与组共享文档
  - 组成员可查询共享文档

**T8：共识候选审核**

- 添加 Prisma 表：
  ```prisma
  model ConsensusCandidate {
    id         String   @id @default(cuid())
    chunkId    String   // 或被投票的实体
    status     String   @default("PENDING")  // PENDING | APPROVED | REJECTED
    votesFor   Int      @default(0)
    votesAgainst Int    @default(0)
    proposedAt DateTime @default(now())
    decidedAt  DateTime?
  }
  ```
- 创建路由（仅 Admin）：
  - `GET /api/governance/consensus/pending` — 列出待审核项
  - `POST /api/governance/consensus/:id/approve` — 标记为 PUBLIC
  - `POST /api/governance/consensus/:id/reject` — 标记为 REJECTED
- 逻辑：
  - 审批候选：更新对应 Chunk 的可见性为 PUBLIC
  - 拒绝候选：保持不变
- 验收标准：
  - Admin 审查待审核项
  - 审批 → Chunk 变为 PUBLIC

### Epic 3 — 公开简历定制（T9–T10）

**T9：公开简历定制 API**

- 创建 `POST /api/public/resume/tailor`（无需认证）
- 流程：
  1. 向量化职位描述
  2. 搜索 `visibility=PUBLIC` 的 Chunk（topK=请求值或默认 5）
  3. 从 Chunk 构建上下文
  4. 用系统提示 + 上下文 + JD 调用 LLM
  5. 以 text/event-stream（SSE）流式返回响应
- 系统提示（镜像自 .NET）：
  ```
  You are a professional resume writer. Generate a tailored Markdown resume
  using ONLY the provided candidate profile. Do NOT fabricate. No contact details.
  ```
- 限流：应用 T5 限流（~100 请求/小时 per IP）
- `next.config.ts` 中的 CORS：
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
- 验收标准：
  - 匿名 curl/fetch 到端点返回 SSE 流
  - 500 字 JD 30 秒内完成
  - 遵守限流
  - CORS 允许简历站 origin

**T10：简历定制 UI**

- 添加 `/resume-tailor` 页面（公开，无需认证）：
  ```typescript
  // src/app/resume-tailor/page.tsx
  export default async function ResumeTailorPage() {
    return (
      <div className="max-w-4xl mx-auto">
        <h1>Resume Tailoring</h1>
        <textarea placeholder="Paste job description..." />
        <button>Generate</button>
        <StreamingMarkdown /> {/* 从 API 流式获取简历 */}
      </div>
    );
  }
  ```
- 组件：`StreamingMarkdown` 用于：
  - 处理来自 `/api/public/resume/tailor` 的 SSE 事件
  - 实时渲染 Markdown
  - 显示预览（md 转 HTML）
- 验收标准：
  - 用户粘贴 JD，点击 Generate
  - Markdown 简历实时流式渲染

### Epic 6 — 用户反馈与个性化（T14–T15）

**T14：反馈记录 API**

- 添加 Prisma 表：

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

- 创建 `POST /api/feedback`（认证可选）：
  - 请求体：
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
  - 如果有会话则提取 userId，否则使用客户端提供的 userId
  - 记录事件
- 创建 `GET /api/feedback/stats`（仅 Admin）：
  - 返回：聚合统计（图表数据）
    ```json
    {
      "totalEvents": 1234,
      "byType": { "ADOPTED": 500, "REJECTED": 200, ... },
      "topDocuments": [...]
    }
    ```
- 验收标准：
  - 事件持久化到 DB
  - 统计端点返回聚合计数

**T15：反馈权重检索**

- 实现 `FeedbackBoostService`：
  ```typescript
  // src/lib/services/feedback-boost.service.ts
  export async function boostByFeedback(
    userId: string,
    results: VectorSearchResult[],
  ): Promise<VectorSearchResult[]> {
    // 加载该用户的采纳历史
    const adopted = await prisma.userBehaviorEvent.findMany({
      where: { userId, type: "ADOPTED" },
      select: { relatedChunkId: true, relatedDocumentId: true },
    });

    // 提升已采纳 Chunk 的评分
    return results.map((result) => ({
      ...result,
      score: adopted.some((a) => a.relatedChunkId === result.chunk.id)
        ? result.score * 1.5 // 50% 提升
        : result.score,
    }));
  }
  ```
- 注入 `RagService.query()`：
  - 检索后，调用 `boostByFeedback(userId, results)`
  - 按提升后评分重新排序结果
- 验收标准：
  - 同一用户查询相似内容：已采纳 Chunk 排名靠前

### Epic 7 — 文档差异与临时上下文（T16–T17）

**T16：重新 Ingest 时的文档差异分析**

- 实现 `DocumentDiffService`：
  ```typescript
  // src/lib/services/document-diff.service.ts
  export async function diffOnReIngest(oldContent: string, newContent: string, documentId: string) {
    // 词集差异
    const oldWords = getWordSet(oldContent);
    const newWords = getWordSet(newContent);
    const added = newWords.subtract(oldWords).size;
    const removed = oldWords.subtract(newWords).size;

    // 基于 LLM 的主题提取
    const topics = await extractChangedTopics(oldContent, newContent);

    return {
      addedChunks: Math.ceil(added / 50),
      removedChunks: Math.ceil(removed / 50),
      modifiedChunks: Math.ceil((added + removed) / 100),
      changedTopics: topics,
    };
  }
  ```
- 更新 Ingest 流程：
  - 检查文档名是否已存在
  - 如果重新 Ingest：计算差异，添加到响应
  - 删除旧 Chunk，Ingest 新 Chunk
- Ingest 响应包含：
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
- 验收标准：
  - 重新 Ingest 同名文档返回差异摘要
  - 旧 Chunk 被删除，新 Chunk 被存储

**T17：临时上下文提取**

- 创建 `POST /api/context/extract`（需认证）：
  - Multipart 表单：`file`（PDF、图片、文本）
  - 最大大小：20 MB
  - 通过以下方式提取文本：
    - PDF：Azure Document Intelligence
    - 图片：Azure Vision API
    - 文本：直接读取
  - **不**写入向量 DB
  - 返回：`{ text: "...", fileName: "...", extractedAt: "2026-04-08T..." }`
- 用例：用户上传文件到上下文，聊天使用提取的文本用于一个会话
- 验收标准：
  - 上传返回提取的文本
  - 无向量写入 DB
  - 提取内容仅在该会话可用于聊天上下文

### Epic 9 — Azure 集成与管理（T21–T24）

**T21：Azure Blob 存储连接器**

- 实现 `src/lib/datasources/azure-blob.connector.ts`（如果 Azure 凭证可用）：
  ```typescript
  export class AzureBlobConnector implements IDataSourceConnector {
    readonly id: string;
    constructor() {
      /* 初始化客户端 */
    }

    async sync(): Promise<SyncResult> {
      // 列出 Blob，获取内容，调用 Ingest
    }
  }
  ```
- 在 `POST /api/datasources/sync` 中注册：
  - 检查 `env.azure.blob.isConfigured`
  - 实例化并运行同步
- 验收标准：
  - 已配置 Blob 文档在触发同步时同步

**T22：后台自动同步任务**

- 创建 Cron 触发器（Vercel Cron 或定时作业）：
  - 路由：`/api/datasources/sync/scheduled`（由外部 Cron 调用）
  - 间隔：30 分钟（可配置）
  - 调用已注册的连接器
  - 记录结果，优雅处理错误
- 配置环境变量：
  ```
  DATA_SYNC_INTERVAL_MINUTES=30
  DATA_SYNC_ENABLED=true
  ```
- 验收标准：
  - 每 30 分钟自动同步，无需手动触发
  - 错误不阻塞其他连接器

**T23：管理员后台 API**

- 路由（仅 Admin）：
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
  - `DELETE /api/admin/documents/:documentId` — 删除所有 Chunk
  - `DELETE /api/admin/cache` — 清除语义缓存（第七阶段）
- 验收标准：
  - Admin 可查看全面的 DB 统计
  - 可删除文档和清除缓存

**T24：Demo 文档库**

- 在资源中存储预置示例文档（`public/docs/` 或 Azure Blob）：
  - 示例：样本简历、案例研究 PDF 等
- 创建路由：
  - `GET /api/demo/documents`（认证可选）
    ```json
    [
      { "name": "Derek's Resume", "description": "...", "size": 5000 },
      { "name": "Case Study", "description": "..." }
    ]
    ```
  - `POST /api/demo/documents/:name/ingest`（需认证）
    - 将命名的 Demo 文档 Ingest 到用户的知识库
    - 返回同普通 Ingest 相同的响应
- UI：在 Ingest 页面添加"尝试 Demo"部分
- 验收标准：
  - 新用户可一键 Ingest 示例
  - 示例立即可查询

---

## 阶段级验收标准（GO/NO-GO）

- **简历定制**：SSE 流在 500 字 JD 30 秒内完成
- **知识共享**：组 + 共享 + 共识审核端到端可用
- **反馈追踪**：事件记录且统计计算正确
- **管理后台**：所有统计正确；可管理数据
- **临时上下文**：文件提取但未存储（通过 DB 检查）
- **Demo 库**：用户可 Ingest 示例
- **测试覆盖率**：≥ 80%

---

## 依赖

- **第五阶段**：稳定门控已通过（认证、用户隔离）
- **Azure Blob**（T21）：可选；如无凭证可跳过
- **Upstash**（来自第五阶段）：已配置
- **LLM API**：Ollama 或 Azure OpenAI（已可用）

---

## 说明

- 除 `POST /api/public/resume/tailor` 和 `GET /api/demo/documents` 外，所有端点**需要认证**
- 第六阶段是**稳定化阶段**：启动第七阶段前，确保所有功能端到端可用
- Admin 路由在继续前必须验证角色
