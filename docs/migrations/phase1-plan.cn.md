# 阶段一实施计划：基础设施与PoC

> **阶段时长**: 1-2周 | **前置条件**: 无 | **阻塞**: Phase 2

## 执行摘要

建立Next.js 15 + LangChain基础架构，验证所有外部依赖兼容性（Ollama、Azure OpenAI、Cosmos DB、SQLite、Blob Storage）。

**范围澄清**：
- ✅ 后端基础设施 + RAG 最小工作流
- ✅ 三种环境配置（本地开发、本地测试、部署）
- ✅ CI/CD 自动化框架
- ❌ **不包含前端开发**（前端开发在 Phase 2 最小可行性 UI + Phase 3）
- ❌ **不包含完整的 Agent 编排**（仅验证 LangChain 基础，Phase 2 完成）

### GO/NO-GO决策标准

| 验证项 | 目标 | 验证方法 |
|-------|------|----------|
| 项目构建 | TypeScript零错误 | `npm run build` |
| Ollama集成 | 嵌入+聊天成功 | 单元测试 |
| 数据库CRUD | Prisma操作正常 | 集成测试 |
| 向量搜索 | 余弦相似度≥80% | 手动测试 |
| Azure服务 | 3个服务连接成功 | 集成测试 |
| Docker | 容器启动成功 | `docker compose up` |
| 测试覆盖率 | ≥60% | Coverage报告 |

---

## 核心任务清单 (18个)

### 基础设施搭建 (T1-T5)

**T1: Next.js 15项目初始化**
- [ ] 使用App Router架构创建项目
- [ ] TypeScript strict模式配置
- [ ] ESLint + Prettier配置
- [ ] 目录结构:`src/app`, `src/lib`, `src/components`
- **验收**: `npm run build`零错误

**T2: Prisma ORM配置**
- [ ] 安装Prisma并初始化
- [ ] 设计Schema: `VectorChunk`, `PromptTemplate`, `SyncedFile`
- [ ] SQLite配置（开发/生产均使用）
- [ ] 生成首次迁移
- **验收**: `prisma migrate dev`成功

**T3: 环境变量管理**
- [ ] 创建`.env.example`模板，支持三种运行模式：
  - **本地开发（默认）**: Ollama + SQLite（无需Azure凭证）
  - **本地测试Azure服务**: 可选启用 Cosmos DB + Azure OpenAI（通过环境变量）
  - **部署环境**: Cosmos DB + Azure OpenAI（使用Managed Identity，不需环境变量）
- [ ] 使用Zod定义验证schema（根据`NODE_ENV`有条件地验证）
- [ ] 启动时自动验证
- [ ] 类型安全的env访问
- [ ] Managed Identity 配置说明（部署环境）
- **验收**: 缺少必需变量时启动失败，但部署环境可在无环境变量时正常启动（使用Managed Identity）

**T4: 项目结构与代码规范**
- [ ] 配置Git hooks (Husky + lint-staged)
- [ ] `.gitignore`包含`.env.local`
- [ ] VS Code推荐扩展配置
- **验收**: 提交时自动格式化和lint

**T5: Docker Compose配置**
- [ ] **环境模式选择**：
  - **开发模式** (默认): 定义`app`, `ollama`服务，使用 SQLite + Ollama
  - **测试模式** (可选): `docker-compose.test.yml` 配置 Cosmos DB + Azure OpenAI 连接
  - **部署环境**: 使用生产 Dockerfile，配置 Managed Identity 凭证
- [ ] Volume挂载配置（开发模式：持久化 SQLite 数据文件）
- [ ] 健康检查配置
- [ ] **网络拓扑配置**（开发模式）：确保容器内应用能访问宿主机的 Ollama 接口
  - 方案1: `network_mode: "host"` (Linux)
  - 方案2: `extra_hosts: ["host.docker.internal:host-gateway"]` (跨平台)
  - 环境变量: `OLLAMA_BASE_URL=http://host.docker.internal:11434`
- [ ] 添加服务依赖顺序 (`depends_on`)
- **验收**: 开发模式 `docker compose up`一键启动；支持切换到测试/部署模式

---

### Ollama集成 (T6-T8)

**T6: 嵌入服务实现**
```typescript
// src/lib/services/embedding.service.ts
export interface IEmbeddingService {
  embedQuery(text: string): Promise<number[]>;
  embedDocuments(texts: string[]): Promise<number[][]>;
}
```
- [ ] `OllamaEmbeddingService`类实现
- [ ] 支持批量嵌入
- [ ] 错误处理（连接失败、超时）
- [ ] 单元测试>80%覆盖
- **验收**: 集成测试连接真实Ollama

**T7: 聊天服务实现**
- [ ] `OllamaChatService`实现同步响应
- [ ] 实现流式响应(AsyncIterator)
- [ ] 系统提示词配置
- [ ] 单元测试+集成测试
- **验收**: 流式输出逐字返回

**T8:向量存储抽象层**
```typescript
export interface IVectorStore {
  addDocuments(docs: VectorDocument[]): Promise<void>;
  similaritySearch(query: number[], topK: number): Promise<VectorSearchResult[]>;
}
```
- [ ] 接口定义
- [ ] SQLite实现(应用层余弦相似度)
- [ ] 元数据过滤支持
- **验收**: 相似度搜索返回正确排序

---

### 最小RAG工作流 (T9-T12)

**T9: 文档分块服务**
- [ ] 固定大小分块(带重叠)
- [ ] 递归分割(段落/句子)
- [ ] Token计数(tiktoken)
- [ ] Markdown感知分块
- **验收**: 单元测试覆盖边界情况

**T10: 摄取流程实现**
```
文本 → 分块 → 嵌入 → 去重(简化) → 存储
```
- [ ] `RagService.ingest()`方法
- [ ] REST API: `POST /api/ingest`
- [ ] 请求/响应类型定义
- **验收**: E2E测试摄取文档成功

**T11: 查询流程实现**
```
问题 → 嵌入 → 检索topK → 构建prompt → LLM生成 → 返回
```
- [ ] `RagService.query()`方法
- [ ] REST API: `POST /api/query`
- [ ] 返回答案+来源
- **验收**: E2E测试查询返回相关答案

**T12: 类型定义**
```typescript
export interface RagQueryRequest {
  question: string;
  topK?: number;
}

export interface RagQueryResult {
  answer: string;
  sources: VectorSearchResult[];
  isHallucination: boolean;  // Phase 2实现
}
```
- [ ] 核心领域模型类型
- [ ] API请求/响应类型
- [ ] 禁用`any`类型
- **验收**: `npm run type-check`通过

---

### Azure服务集成 (T13-T15, 可选)

**T13: Azure OpenAI集成**
- [ ] `AzureOpenAIChatService`实现
- [ ] 实现`IChatService`接口
- [ ] 自动回退到Ollama
- **验收**: 集成测试验证Azure连接

**T14: Cosmos DB兼容性测试**
- [ ] `@azure/cosmos` SDK安装
- [ ] CRUD操作验证
- [ ] 性能基准测试
- **验收**: 文档记录迁移路径

**T15: Blob Storage连接器**
- [ ] 列举容器文件
- [ ] 下载文件内容
- [ ] 错误处理
- **验收**: 集成测试读取Blob文件

---

### 质量保障 (T16-T18)

**T16: 测试框架(Vitest)**
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      lines: 60,
      functions: 60,
    },
  },
});
```
- [ ] Vitest配置
- [ ] Mock工具设置
- [ ] 覆盖率报告
- **验收**: `npm run test:coverage` ≥60%

**T17: 错误处理与日志**
- [ ] 自定义错误类(`RagError`, `VectorStoreError`)
- [ ] 结构化日志(pino)
- [ ] 敏感信息过滤
- **验收**: 日志输出包含trace ID

**T18: CI/CD Pipeline**
```yaml
# .github/workflows/ci.yml
jobs:
  test:
    - TypeScript type check
    - ESLint
    - Vitest (coverage ≥60%)
    - Docker build test
```
- [ ] GitHub Actions配置
- [ ] 每次push运行测试
- [ ] 覆盖率上传到Codecov
- **验收**: PR检查全部通过

---

## 风险评估

| 风险 | 影响 | 概率 | 缓解措施 |
|-----|------|------|----------|
| Ollama本地连接失败（仅本地开发） | 中 | 低 | Azure OpenAI回退方案，或先使用模式2（本地测试Azure） |
| sqlite-vec性能不达标 | 中 | 低 | 提前性能测试,监控向量搜索延迟 |
| 类型安全覆盖不足 | 中 | 中 | 严格tsconfig + CI检查 |

**注**：Ollama 仅用于本地开发环境（模式1），不涉及部署，因此无生产环境风险。

---

## 时间线

```
Week 1:
  Day 1-2: T1-T5 (基础设施)
  Day 3-4: T6-T8 (Ollama集成)
  Day 5:   T9-T11 (RAG工作流)

Week 2:
  Day 1:   T12 (类型定义)
  Day 2:   T13-T15 (Azure服务, 可选)
  Day 3-4: T16-T18 (质量保障)
  Day 5:   验收测试与文档
```

---

## GitHub Issue模板

```markdown
# [Phase 1] 基础设施与PoC

## 🎯 目标
验证Next.js + LangChain + 所有外部依赖的兼容性

## ✅ 任务清单
- [ ] T1-T5: 基础设施搭建
- [ ] T6-T8: Ollama集成
- [ ] T9-T12: 最小RAG工作流
- [ ] T13-T15: Azure服务(可选)
- [ ] T16-T18: 质量保障

## 📊 完成标准
- [x] 所有GO/NO-GO测试通过 (7/7)
- [x] 测试覆盖率 ≥ 60%
- [x] Docker Compose一键启动
- [x] E2E RAG演示可用

## 🔗 相关文档
- [可行性分析](./feasibility-analysis.cn.md)
- [Phase 2计划](./phase2-plan.cn.md)

## 👥 指派: @ai-developer @fullstack-engineer
```

---

**文档维护**: VedaAide迁移团队 | **下一步**: [Phase 2计划](./phase2-plan.cn.md)
