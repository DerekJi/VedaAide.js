# 🧪 VedaAide.js 测试指南

完整的测试文档，涵盖单元测试、集成测试、手动测试和覆盖率分析。

---

## 📊 测试概览

| 测试类型     | 文件数 | 测试数 | 覆盖率 | 执行时间 |
| ------------ | ------ | ------ | ------ | -------- |
| **单元测试** | 7      | 67     | 67.4%  | 978ms    |
| 错误处理     | 1      | 13     | 100%   | -        |
| 向量操作     | 2      | 17     | 100%   | -        |
| 分块服务     | 1      | 15     | 100%   | -        |
| Ollama 服务  | 2      | 11     | 100%   | -        |
| 向量存储     | 1      | 10     | 100%   | -        |
| RAG 管道     | 1      | 11     | 100%   | -        |

---

## 🚀 快速测试命令

### 1. 运行所有测试

```bash
npm test
```

**输出示例：**

```
✓ src/lib/vector-store/cosine-similarity.test.ts (7 tests) 123ms
✓ src/lib/errors.test.ts (13 tests) 45ms
✓ src/lib/services/chunking.service.test.ts (15 tests) 234ms
✓ src/lib/services/ollama-embedding.service.test.ts (6 tests) 189ms
✓ src/lib/services/ollama-chat.service.test.ts (5 tests) 156ms
✓ src/lib/vector-store/sqlite-vector-store.test.ts (10 tests) 178ms
✓ src/lib/services/rag.service.test.ts (11 tests) 73ms

Test Files  7 passed (7)
Tests      67 passed (67)
Duration   978ms
```

### 2. 监视模式（推荐开发中使用）

```bash
npm run test:watch
```

这将在你修改代码时自动重新运行相关测试。按下列按键进行操作：

- `r` - 重新运行所有测试
- `f` - 只运行失败的测试
- `q` - 退出

### 3. 生成覆盖率报告

```bash
npm run test:coverage
```

**输出示例：**

```
✓ src/lib/vector-store/cosine-similarity.test.ts (7)
✓ src/lib/errors.test.ts (13)
✓ src/lib/services/chunking.service.test.ts (15)
✓ src/lib/services/ollama-embedding.service.test.ts (6)
✓ src/lib/services/ollama-chat.service.test.ts (5)
✓ src/lib/vector-store/sqlite-vector-store.test.ts (10)
✓ src/lib/services/rag.service.test.ts (11)

Coverage Summary
────────────────────────────────────────────────────────────────
File                   | % Stmts | % Branch | % Funcs | % Lines |
────────────────────────────────────────────────────────────────
All files              |  67.41  |  74.39   |  89.13  |  67.41  |
 lib/services          |  78.24  |  81.44   |  95.12  |  78.24  |
 lib/vector-store      |  72.15  |  68.92   |  85.71  |  72.15  |
 lib/errors.ts         | 100     | 100      | 100     | 100     |
────────────────────────────────────────────────────────────────
```

### 4. 特定测试文件

```bash
# 只运行错误处理测试
npm test src/lib/errors.test.ts

# 向量相似度测试
npm test src/lib/vector-store/cosine-similarity.test.ts

# RAG 管道测试
npm test src/lib/services/rag.service.test.ts
```

---

## 📋 单元测试详解

### 1️⃣ 错误处理测试 (`src/lib/errors.test.ts`)

**目的**：验证自定义错误类和错误追踪

**测试场景**（13个）：

```bash
✓ VedaError: creates error with traceId
✓ VedaError: toJSON() sanitizes sensitive fields
✓ VedaError: child error inherits traceId
✓ RagError: wraps RAG-specific failures
✓ VectorStoreError: handles vector store operations
✓ EmbeddingError: handles embedding failures
✓ ChatError: handles chat service failures
✓ AzureConnectionError: handles Azure connectivity
... 等5项
```

**运行方式**：

```bash
npm test src/lib/errors.test.ts
```

---

### 2️⃣ 向量相似度测试 (`src/lib/vector-store/cosine-similarity.test.ts`)

**目的**：验证余弦相似度计算的正确性

**测试场景**（7个）：

| 场景       | 输入                     | 预期输出 | 用途     |
| ---------- | ------------------------ | -------- | -------- |
| 相同向量   | [1,0,0] vs [1,0,0]       | 1.0      | 完全匹配 |
| 正交向量   | [1,0,0] vs [0,1,0]       | 0.0      | 无相关性 |
| 相反向量   | [1,0,0] vs [-1,0,0]      | -1.0     | 完全相反 |
| 零向量处理 | [0,0,0] vs [1,1,1]       | 0.0      | 边界情况 |
| 单位向量   | [0.6, 0.8] vs [0.6, 0.8] | 1.0      | 标准化   |
| 小数精度   | 浮点数运算               | ±0.0001  | 数值精度 |
| 大维度     | 1000维向量               | 正确值   | 性能     |

**运行方式**：

```bash
npm test src/lib/vector-store/cosine-similarity.test.ts
```

---

### 3️⃣ 文档分块测试 (`src/lib/services/chunking.service.test.ts`)

**目的**：验证三种分块策略的正确性

**三种分块策略**：

#### A. 固定大小分块 (Fixed-Size Chunking)

```typescript
// 输入：1000字符文本，块大小200，重叠50
// 预期：5个块，每个块在150-250字符范围内
```

**测试场景**：

- ✓ 正确分割长文本
- ✓ 遵守重叠配置
- ✓ 处理小文本
- ✓ 验证边界

#### B. 段落感知分块 (Paragraph-Aware)

```typescript
// 输入：多段落文本，块大小300
// 预期：在段落边界处分割
```

**测试场景**：

- ✓ 在段落边界分割
- ✓ 保留完整段落
- ✓ 处理大段落

#### C. Markdown感知分块 (Markdown-Aware)

```typescript
// 输入：Markdown文本（标题、列表、代码块）
// 预期：在Markdown边界处分割
```

**测试场景**：

- ✓ 在标题级别分割
- ✓ 保留代码块完整性
- ✓ 处理列表结构

**运行方式**：

```bash
npm test src/lib/services/chunking.service.test.ts
```

**场景验证**：

```bash
# 运行特定测试
npm test src/lib/services/chunking.service.test.ts -t "fixed-size"
npm test src/lib/services/chunking.service.test.ts -t "paragraph"
npm test src/lib/services/chunking.service.test.ts -t "markdown"
```

---

### 4️⃣ Ollama 嵌入测试 (`src/lib/services/ollama-embedding.service.test.ts`)

**目的**：验证 Ollama 嵌入服务的功能

**测试场景**（6个）：

| 测试         | 最小单位              | 预期结果                  |
| ------------ | --------------------- | ------------------------- |
| 单个查询嵌入 | "Python 是什么？"     | 384维向量                 |
| 批量文档嵌入 | ["doc1", "doc2", ...] | 多个向量                  |
| 空文本处理   | ""                    | 异常处理                  |
| 连接失败     | Ollama 离线           | VedaError 异常            |
| 模型超时     | 响应过慢              | 超时异常                  |
| 向量维度     | 嵌入输出              | 384维（nomic-embed-text） |

**运行方式**：

```bash
# 需要 Ollama 运行
npm test src/lib/services/ollama-embedding.service.test.ts
```

---

### 5️⃣ Ollama 聊天测试 (`src/lib/services/ollama-chat.service.test.ts`)

**目的**：验证 Ollama 聊天和流式响应

**测试场景**（5个）：

| 测试         | 输入          | 预期输出         |
| ------------ | ------------- | ---------------- |
| 基本聊天     | 一条消息      | 非空回复         |
| 系统提示注入 | 系统提示+消息 | 遵循系统提示     |
| 流式响应     | 流式选项      | AsyncIterable 流 |
| 消息历史     | 多轮对话      | 上下文一致       |
| 连接失败     | Ollama 离线   | ChatError 异常   |

**运行方式**：

```bash
npm test src/lib/services/ollama-chat.service.test.ts
```

---

### 6️⃣ SQLite 向量存储测试 (`src/lib/vector-store/sqlite-vector-store.test.ts`)

**目的**：验证向量存储的 CRUD 和搜索操作

**测试场景**（10个）：

```typescript
✓ addDocuments() - 插入向量
✓ similaritySearch() - 找到相似向量
✓ deleteByFileId() - 删除特定文件的向量
✓ topK 限制 - 只返回前K个结果
✓ 空搜索结果 - 处理无匹配
✓ 重复向量处理
✓ 边界情况
✓ 数据一致性
✓ 并发操作（如适用）
✓ 性能（<100ms 搜索）
```

**运行方式**：

```bash
npm test src/lib/vector-store/sqlite-vector-store.test.ts
```

---

### 7️⃣ RAG 管道测试 (`src/lib/services/rag.service.test.ts`)

**目的**：验证完整的 RAG 摄入和查询流程

**测试场景**（11个）：

#### 摄入测试：

```typescript
✓ ingest() - 文档分块和嵌入
✓ ingest() - SHA-256 去重
✓ ingest() - 重新摄入相同源（upsert）
✓ ingest() - 嵌入失败处理
✓ ingest() - 数据库异常处理
```

#### 查询测试：

```typescript
✓ query() - 嵌入问题并搜索
✓ query() - 返回相关源文档
✓ query() - RAG 提示构建
✓ query() - 流式响应支持
✓ query() - 嵌入失败处理
✓ query() - 无结果处理
```

**关键场景：文档重新摄入**

```bash
# 第一次摄入
POST /api/ingest {
  "source": "resume.pdf",
  "content": "John Doe, Senior Engineer..."
}
# 返回: fileId="resume.pdf", chunksCreated=5

# 第二次摄入相同源
POST /api/ingest {
  "source": "resume.pdf",
  "content": "Jane Doe, Principal Engineer..."
}
# 预期:
# 1. 删除所有旧的 resume.pdf 向量
# 2. 创建5个新向量
# 3. 返回成功而不是唯一性约束错误
```

**运行方式**：

```bash
npm test src/lib/services/rag.service.test.ts

# 只运行特定测试
npm test src/lib/services/rag.service.test.ts -t "ingest"
npm test src/lib/services/rag.service.test.ts -t "re-ingest"
```

---

## 🧪 手动集成测试

### 前置条件

```bash
# 终端1：启动 Ollama
ollama serve

# 终端2：初始化数据库
npm run db:migrate

# 终端3：启动 API
npm run dev
```

### 测试场景一：健康检查

```bash
curl -s http://localhost:3000/api/health | jq
```

**预期响应**：

```json
{
  "status": "healthy",
  "timestamp": "2026-04-07T10:45:30.000Z",
  "version": "0.1.0"
}
```

### 测试场景二：单个文档摄入

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Python是一种高级编程语言。它易于学习且功能强大。",
    "source": "intro-python",
    "metadata": { "language": "zh-CN", "type": "educational" }
  }' | jq
```

**预期响应**：

```json
{
  "success": true,
  "message": "Document ingested successfully",
  "fileId": "intro-python",
  "chunksCreated": 1,
  "traceId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**验证**：查看数据库

```bash
npm run db:studio
# 导航到 VectorChunk 表，应该看到 1 行记录
```

### 测试场景三：多文档摄入与查询

```bash
# 摄入文档1
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "content": "JavaScript是前端开发的主要语言。",
    "source": "intro-js"
  }' | jq

# 摄入文档2
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "content": "TypeScript为JavaScript增加了静态类型。",
    "source": "intro-ts"
  }' | jq

# 现在查询
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "前端开发用什么语言？",
    "topK": 3
  }' | jq
```

**预期响应示例**：

```json
{
  "answer": "JavaScript是前端开发的主要语言。它被广泛使用在现代Web应用中。",
  "sources": [
    {
      "content": "JavaScript是前端开发的主要语言。",
      "source": "intro-js",
      "similarity": 0.92
    },
    {
      "content": "TypeScript为JavaScript增加了静态类型。",
      "source": "intro-ts",
      "similarity": 0.78
    }
  ],
  "traceId": "550e8400-e29b-41d4-a716-446655440001"
}
```

### 测试场景四：文档重新摄入

```bash
# 首次摄入
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "content": "版本1：原始内容",
    "source": "version-doc"
  }'

# 重新摄入相同源（新内容）
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "content": "版本2：更新的内容",
    "source": "version-doc"
  }'

# 验证查询返回新内容
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "question": "文档内容是什么？"
  }'
```

**预期**：查询答案应该是"版本2"的内容

### 测试场景五：错误处理

#### 情况1：Ollama 离线

```bash
# 停止 Ollama，然后查询
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{ "question": "test" }'
```

**预期**：

```json
{
  "error": "Failed to embed query",
  "traceId": "...",
  "code": "EMBEDDING_ERROR"
}
```

#### 情况2：无效的 JSON

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d 'invalid json'
```

**预期**：400 错误

---

## 🔄 CI/CD 测试流程

GitHub Actions 自动在每次推送运行：

```bash
# 1. 类型检查
npm run type-check

# 2. 代码规范
npm run lint

# 3. 单元测试 + 覆盖率
npm run test:coverage

# 4. Docker 镜像构建
docker build .
```

**查看 CI 结果**：

1. 推送代码到 feature 分支
2. 打开 GitHub Actions 标签
3. 查看最新工作流运行

---

## 📈 覆盖率目标

| 文件类型              | 目标 | 当前   | 状态    |
| --------------------- | ---- | ------ | ------- |
| 声明语句 (Statements) | ≥60% | 67.41% | ✅ 超达 |
| 分支覆盖 (Branches)   | ≥60% | 74.39% | ✅ 超达 |
| 函数覆盖 (Functions)  | ≥80% | 89.13% | ✅ 超达 |
| 代码行 (Lines)        | ≥60% | 67.41% | ✅ 超达 |

**0% 覆盖的文件**（预期）：

- `types.ts` - 纯类型定义，无运行时代码
- `vector-store.ts` - 接口定义，无实现
- `embedding.service.ts` - 接口定义，无实现
- `chat.service.ts` - 接口定义，无实现

---

## 🐛 调试测试

### 运行单个测试并输出细节

```bash
npm test -- --reporter=verbose src/lib/errors.test.ts
```

### 调试模式运行

```bash
# 在 Node 调试器中运行（需要 VS Code）
node --inspect-brk ./node_modules/vitest/vitest.mjs run
```

### 查看测试覆盖率详情

```bash
# 生成 HTML 覆盖率报告（如配置了）
npm run test:coverage
# 打开 coverage/index.html
```

---

## 📝 编写新测试

### 测试模板

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MyService } from "../my.service";

describe("MyService", () => {
  let service: MyService;

  beforeEach(() => {
    service = new MyService();
  });

  it("should perform operation correctly", () => {
    // Arrange
    const input = "test";

    // Act
    const result = service.process(input);

    // Assert
    expect(result).toBe("expected output");
  });

  it("should handle error gracefully", () => {
    // Arrange
    const input = null;

    // Act & Assert
    expect(() => service.process(input)).toThrow();
  });
});
```

### Mock 示例

```typescript
import { vi } from 'vitest';

// Mock Ollama 服务
const mockOllama = {
  embeddings: vi.fn().mockResolvedValue([0.1, 0.2, ...])
};

// 在测试中使用
test('should call Ollama', async () => {
  await service.embed('text');
  expect(mockOllama.embeddings).toHaveBeenCalled();
});
```

---

## 🎯 测试按优先级

### 高优先级（必须通过）

- ✅ 错误处理
- ✅ 向量相似度计算
- ✅ RAG 摄入/查询
- ✅ 类型检查

### 中优先级（应该通过）

- ✅ 文档分块
- ✅ Ollama 集成
- ✅ 向量存储 CRUD

### 低优先级（可选）

- Azure 服务连接（需 Azure 凭证）
- 性能基准测试

---

## ❓ 常见测试问题

### Q1: 测试超时怎么办？

```bash
# 增加超时时间
npm test -- --test-timeout 30000
```

### Q2: 怎么只运行失败的测试？

```bash
npm run test:watch
# 在 watch 模式按 'f' 键
```

### Q3: 怎么生成覆盖率 HTML 报告？

```bash
npm run test:coverage
# 检查 coverage/index.html
```

---

## 📞 需要帮助？

遇到测试问题？检查：

1. Ollama 是否运行 (`curl http://localhost:11434/api/tags`)
2. 数据库是否初始化 (`npm run db:migrate`)
3. 依赖是否安装 (`npm install`)
