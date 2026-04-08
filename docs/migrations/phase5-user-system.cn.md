# Phase 5 实施计划：用户系统与会话管理

> **耗时**：2-3 周 | **分支**：`feature/5-user-system`  
> **前置条件**：第四阶段已完成  
> **阻断**：第六、七阶段

## 概述

第五阶段为多用户 SaaS 平台奠定基础。所有后续功能都依赖此层。

### 核心 Epic

| Epic           | 任务    | 范围                             |
| -------------- | ------- | -------------------------------- |
| 认证与多用户   | T1-T5   | NextAuth、按用户隔离、角色、限流 |
| 聊天会话持久化 | T11-T12 | CRUD API、消息历史、侧边栏 UI    |
| Token 用量追踪 | T13     | 按用户月度/累计统计              |

**总计**：12-13 个任务 | **目标**：所有 GO 标准达成后启动第六阶段

---

## 任务详情

### Epic 1 — 认证与多用户（T1–T5）

**T1：集成 NextAuth.js**

- 安装 `next-auth@5`（Auth.js），审查与 Next.js 15 的 peer-dependency
- Provider：
  - Azure AD（生产）：`@auth/azure-ad-b2c` 或 `@auth/azure-ad`
  - Credentials（开发/测试）：本地用户名/密码
- 在服务端组件和 Route Handler 中暴露 `auth()`，使用 `getServerSession()`
- 首次登录时创建用户档案 → `User` 表（id、email、name、avatar、createdAt、role）
- 验收标准：
  - 未认证请求受保护路由返回 401
  - 登录后→重定向认证用户
  - API 路由中提供会话对象

**T2：`getCurrentUser` 服务端工具**

- 创建 `src/lib/auth/current-user.ts`：
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
- 导出 `requireUserId()` 辅助函数，无用户时抛出 401
- 对标 .NET 的 `ICurrentUserService` 模式
- 验收标准：所有后续 API 路由使用此工具函数

**T3：按用户数据隔离**

- 更新 Prisma Schema：
  - 为 `SyncedFile`、`VectorChunk`、`ChatSession` 添加 `ownerId: String`
  - 必要时添加唯一约束（如按用户文档名称）
- 更新 Ingest 流程：
  - 从所有 Ingest 路由中提取 `ownerId`
  - 将 `ownerId` 传入 `RagService.ingest()` 和 `VectorStore` 操作
- 更新查询/检索：
  - 所有向量搜索调用过滤 `where: { ownerId }`
  - 文档列表应用相同过滤
  - Admin 绕过：如果用户是 Admin，允许查询任何用户数据（需显式 `?userId=xxx` 参数）
- 验收标准：
  - 用户 A 的文档/会话对用户 B 不可见
  - 自动化测试：用户 A 无法查询用户 B 的向量

**T4：Admin 角色与授权**

- 更新 `User` 模型：添加 `role` 枚举（USER | ADMIN）
- 创建授权中间件（`src/lib/auth/require-admin.ts`）：
  ```typescript
  export async function requireAdmin() {
    const user = await getCurrentUser();
    if (!user?.isAdmin) throw new Error("Unauthorized", { status: 403 });
    return user;
  }
  ```
- 保护路由：
  - 仅 Admin：`/api/admin/*`、`/api/governance/*`、`/api/evaluation/*`、`/api/prompts/*`
  - 受保护中间件：在 Route Handler 中检查 `requireAdmin()`
- 验收标准：
  - 非 Admin 访问 `/api/admin/stats` 返回 403
  - Admin 可访问

**T5：限流（公开端点）**

- 安装 `@upstash/ratelimit` + Redis 集成（Upstash 免费层）
- 配置环境变量：
  ```
  UPSTASH_REDIS_REST_URL=https://...
  UPSTASH_REDIS_REST_TOKEN=...
  RATE_LIMIT_REQUESTS=100
  RATE_LIMIT_WINDOW=1h
  ```
- 应用于公开简历定制端点（即将推出 T9）：
  - 策略：基于 IP 的固定窗口（100 请求/小时）
  - 超出阈值返回 429
- 验收标准：匿名脚本访问端点 100+ 次 → 返回 429

### Epic 4 — 聊天会话持久化（T11–T12）

**T11：聊天会话 CRUD API**

- 扩展 Prisma Schema：

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

- 创建路由：
  - `POST /api/chat/sessions`（需认证）
    - 请求体：`{ title?: string }`
    - 返回：`{ id, userId, title, createdAt }`
  - `GET /api/chat/sessions`（需认证）
    - 返回：按 createdAt 降序排列的当前用户会话数组
  - `DELETE /api/chat/sessions/:id`（需认证）
    - 会话不属于用户时返回 403
  - `GET /api/chat/sessions/:id/messages`（需认证）
    - 返回：按顺序排列的消息数组，不是所有者则 403
  - `POST /api/chat/sessions/:id/messages`（认证可选，供未来使用）
    - 向会话添加消息
- 验收标准：
  - 已登录用户的创建、列表、删除可用
  - 跨用户访问返回 403
  - 消息跨页面刷新持久化

**T12：聊天 UI 集成**

- 更新 `src/lib/stores/chat.store.ts`：
  - 添加 `sessionId` 和 `sessions` 状态
  - 挂载时从 API 加载会话
  - 新消息时：保存到 API（未来功能）
  - 切换会话时：从 API 加载消息
- 添加侧边栏组件：
  - 用户会话列表及标题
  - "New Chat" 按钮创建会话
  - 删除按钮（确认对话框）
  - 点击切换会话 → 清除本地状态，从 API 加载消息
- 更新聊天 UI 布局（如需要）
- 验收标准：
  - 用户可创建会话、输入消息、刷新页面，历史持久化
  - 可在会话之间切换

### Epic 5 — Token 用量追踪（T13）

**T13：Token 用量 API**

- 扩展 Prisma Schema：

  ```prisma
  model TokenUsage {
    id              String   @id @default(cuid())
    userId          String   @db.VarChar(255)
    model           String   // "gpt-4o-mini", "deepseek-chat" 等
    inputTokens     Int
    outputTokens    Int
    totalTokens     Int      @default(0)
    month           String   // "2026-04"
    createdAt       DateTime @default(now())

    @@index([userId])
    @@index([userId, month])
  }
  ```

- 对 LLM 服务进行检测：
  - 在 `src/lib/services/ollama-chat.service.ts`、`azure-openai-chat.service.ts` 等：
    - 每次聊天完成后，从响应中提取 Token 计数
    - 调用 `recordUsage(userId, model, inputTokens, outputTokens)`
  - `src/lib/services/token-usage.service.ts` 中的辅助函数：
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
- 创建 `GET /api/usage/summary`（需认证）：
  - 查询参数：`?userId=xxx`（仅 Admin，否则使用当前用户）
  - 返回：`{ currentMonth: { total, byModel }, cumulative: { total, byModel }, history: [] }`
  - 计算：按月份分组并汇总 Token
- 创建 `GET /api/usage/history`（需认证）：
  - 详细视图的分页每日拆分（第五阶段可选）
- 验收标准：
  - 每次 LLM 调用后记录 Token 计数
  - 摘要正确聚合当月数据
  - Admin 可查询任何用户；非 Admin 仅查看自己的
  - 历史数据正确累计

---

## 阶段级验收标准（GO/NO-GO）

- **零跨用户数据泄漏**：自动化测试验证用户 A 无法查询用户 B 的文档
- **会话持久化**：刷新页面后消息历史恢复
- **Token 准确性**：与实际 LLM Token 计数误差 ≤ 5%
- **限流**：公开端点强制限流（手动测试）
- **测试覆盖率**：≥ 80%（单元 + 集成）
- **所有 T1-T13 任务**：已完成并验证

---

## 依赖与前置条件

- **Next.js 15**：已安装；确认 `next-auth@5` peer-dependency
- **Prisma**：Schema 更新；Schema 变更后运行 `prisma migrate dev`
- **Upstash**：免费层 Redis（用于限流）；配置约 1 分钟
- **Azure AD**（第五阶段可选）：开发中使用 credentials provider；Azure AD 设置推迟到生产上线

---

## 说明

- 除显式标记为 `@AllowAnonymous` 的路由外，所有路由都需要认证（第六阶段出现）
- `getCurrentUser()` 无会话时返回 null；路由必须选择是否需要认证
- Token 记录是**异步的**（不要在聊天响应上阻塞 Token 日志）
- 第五阶段是**稳定门控**：第六阶段无法开始，除非第五阶段 GO 标准达成
