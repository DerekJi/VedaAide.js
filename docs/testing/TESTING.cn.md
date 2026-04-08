# 测试指南

VedaAide.js 使用 [Vitest](https://vitest.dev/) 进行单元和集成测试，使用 [Playwright](https://playwright.dev/) 进行端到端测试。

---

## 测试套件

| 套件                | 命令                    | 说明                           |
| ------------------- | ----------------------- | ------------------------------ |
| 全部 (单元+集成)    | `npm test`              | 运行所有 Vitest 测试           |
| 含覆盖率            | `npm run test:coverage` | 生成 `coverage/lcov.info`      |
| 监听模式            | `npm run test:watch`    | 文件变更时自动重运行           |
| 端到端 (Playwright) | `npm run test:e2e`      | 完整浏览器测试（需运行服务器） |
| 端到端 (交互式)     | `npm run test:e2e:ui`   | Playwright UI 模式             |

---

## 运行单元和集成测试

不需要任何外部服务 — 所有测试都使用模拟依赖。

```bash
# 运行所有测试
npm test

# 运行单个文件
npx vitest run src/app/api/integration.test.ts

# 运行详细输出
npx vitest run --reporter verbose
```

### CI 环境变量

CI 工作流设置：

```
NODE_ENV=test
DATABASE_URL=file:./test.db
```

这些会自动被读取；测试运行无需 `.env` 文件。

---

## 测试文件结构

```
src/
  lib/
    services/
      rag.service.test.ts          # RagService 单元测试（吸收+查询）
      langchain-rag.service.test.ts
      chunking.service.test.ts
      deduplication.service.test.ts
      hallucination-guard.service.test.ts
      prompt.service.test.ts
      ollama-embedding.service.test.ts
      ollama-chat.service.test.ts
    vector-store/
      sqlite-vector-store.test.ts
    agent/
      veda-agent.test.ts
    datasources/
      file-system.connector.test.ts
  app/
    api/
      integration.test.ts          # 所有 API 路由的集成测试
```

---

## 集成测试

`src/app/api/integration.test.ts` 在进程内测试完整的 API 路由处理，不需要真实数据库或 Ollama。

**模拟的内容：**

- `@/lib/db` — Prisma 客户端（内存模拟）
- `@/lib/vector-store/sqlite-vector-store` — SqliteVectorStore 类
- `@/lib/services/ollama-embedding.service` — 嵌入服务
- `@/lib/services/ollama-chat.service` — 聊天服务
- `@/lib/services/prompt.service` — 提示词服务

**测试的端点：**

| 端点                | 测试用例                           |
| ------------------- | ---------------------------------- |
| `GET /api/health`   | 200 返回 `{ status: "ok" }`        |
| `GET /api/prompts`  | 200 返回数组                       |
| `POST /api/prompts` | 201 创建成功；400 无效请求体       |
| `GET /api/ingest`   | 200 返回数组                       |
| `POST /api/query`   | 200 返回答案 + 源；400 空/缺失问题 |

---

## 覆盖率

运行 `npm run test:coverage` 后，在浏览器中打开 `coverage/index.html` 查看报告。

CI 自动将覆盖率上传到 [Codecov](https://codecov.io/)。

---

## 端到端测试 (Playwright)

端到端测试需要应用运行中：

```bash
# 终端 1：启动应用
npm run dev

# 终端 2：运行端到端测试
npm run test:e2e
```

或使用 Playwright 交互式 UI：

```bash
npm run test:e2e:ui
```

> **注意:** 端到端测试也需要本地 Ollama 运行并拉取模型。  
> 详见 [快速开始](../guides/GETTING_STARTED.cn.md)。

---

## 编写新测试

### 单元测试（服务/库代码）

- 并置测试文件：`src/lib/services/my.service.test.ts`
- 使用 `vi.mock()` 模拟所有 I/O 依赖
- 模拟声明**必须**在任何会触发模块初始化的 `import` **之前**

### 集成测试（API 路由）

- 添加到 `src/app/api/integration.test.ts`
- 使用 `NextRequest` 直接调用路由处理程序
- 在服务边界处模拟（嵌入、聊天、数据库）

### 模拟在导入时有副作用的模块的模式

```typescript
// 必须在任何会传递加载 PrismaClient 的 import 之前：
vi.mock("@/lib/db", () => ({
  prisma: {
    vectorChunk: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

// 在模拟之后导入：
import { MyService } from "./my.service";
```
