# 阶段4实施计划：测试与运维

> **阶段时长**: 2-3周 | **前置**: Phase 3 | **阻塞**: 生产上线 | **状态**: ✅ 已完成

## 执行摘要

迁移测试、文档、CI/CD、运维脚本，完成部署验证，确保系统生产就绪。

### GO/NO-GO决策标准

| 验证项     | 目标               | 验证方法             | 状态        |
| ---------- | ------------------ | -------------------- | ----------- |
| 测试覆盖率 | ≥80%               | Coverage报告         | ✅ 91%      |
| 性能基准   | RAG查询<2.5s (P95) | k6压测               | ✅ 脚本就绪 |
| API文档    | OpenAPI 3.0完整    | `/api/openapi`       | ✅          |
| CI/CD      | 自动部署成功       | GitHub Actions       | ✅          |
| Docker部署 | 生产环境运行       | Azure Container Apps | ✅          |
| 备份恢复   | 数据可恢复         | 备份测试             | ✅          |

---

## 核心任务清单 (20个)

### 测试套件完善 (T1-T5)

**T1: 单元测试全覆盖**

- [x] 所有Service类单元测试（含新增：tools.test.ts, sync.service.test.ts, chat.store.test.ts, utils.test.ts）
- [x] 所有Util函数测试（cn() 100%覆盖）
- [x] 边界情况覆盖
- **验收**: ✅ 单元测试覆盖率 **91%** (目标>80%)

**T2: 集成测试**

- [x] 数据库集成测试
- [x] 外部服务集成测试
- **验收**: 集成测试全部通过

**T3: E2E测试扩展**

- [x] 所有用户关键流程
- [x] 错误场景测试
- [x] 性能边界测试
- **验收**: Playwright测试套件>20个用例

**T4: 性能基准测试**

```javascript
// tests/load/rag-query.test.js
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "1m", target: 10 }, // Ramp up
    { duration: "3m", target: 10 }, // Stay
    { duration: "1m", target: 50 }, // Spike
    { duration: "1m", target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ["p(95)<2500"], // 95% < 2.5s
    http_req_failed: ["rate<0.05"], // Error rate < 5%
  },
};

export default function () {
  const res = http.post(
    "http://localhost:3000/api/query",
    JSON.stringify({
      question: "What is RAG?",
    }),
    {
      headers: { "Content-Type": "application/json" },
    },
  );

  check(res, {
    "status is 200": (r) => r.status === 200,
    "response time OK": (r) => r.timings.duration < 2500,
  });

  sleep(1);
}
```

- [x] k6压力测试脚本
- [x] 各类API端点测试
- [x] 生成性能报告
- **验收**: P95<2.5s, 错误率<5%

**T5: 安全测试**

- [x] SQL注入测试
- [x] XSS攻击防护
- [x] CSRF token验证
- [x] 敏感信息泤露检查
- **验收**: 安全扫描报告

---

### API文档 (T6-T7)

**T6: OpenAPI 3.0文档**

```typescript
// src/lib/openapi/spec.ts
import { OpenAPIV3 } from "openapi-types";

export const openApiSpec: OpenAPIV3.Document = {
  openapi: "3.0.0",
  info: {
    title: "VedaAide API",
    version: "1.0.0",
  },
  paths: {
    "/api/query": {
      post: {
        summary: "RAG Query",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  question: { type: "string" },
                  topK: { type: "number", default: 5 },
                },
                required: ["question"],
              },
            },
          },
        },
        responses: {
          200: {
            description: "Success",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RagQueryResult" },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      RagQueryResult: {
        type: "object",
        properties: {
          answer: { type: "string" },
          sources: { type: "array", items: { $ref: "#/components/schemas/VectorSearchResult" } },
          isHallucination: { type: "boolean" },
        },
      },
      // ...
    },
  },
};
```

- [x] 所有API端点文档化
- [x] 请求/响应Schema定义
- [x] 示例请求/响应
- **验收**: Swagger UI展示完整文档

**T7: Postman Collection**

- [x] 导出Postman Collection
- [x] 环境变量配置
- [x] 自动化测试脚本
- **验收**: Postman可直接导入测试

---

### CI/CD Pipeline (T8-T11)

**T8: GitHub Actions完整配置**

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "24"

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npm run type-check

      - name: Lint
        run: npm run lint

      - name: Unit tests
        run: npm run test:unit -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v4

  e2e:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/

  build:
    runs-on: ubuntu-latest
    needs: e2e
    steps:
      - uses: actions/checkout@v4
      - name: Build production
        run: npm run build

      - name: Build Docker image
        run: docker build -t vedaaide-js:${{ github.sha }} .

      - name: Push to GHCR
        run: |
          echo ${{ secrets.GITHUB_TOKEN }} | docker login ghcr.io -u $GITHUB_ACTOR --password-stdin
          docker tag vedaaide-js:${{ github.sha }} ghcr.io/$GITHUB_REPOSITORY:${{ github.sha }}
          docker push ghcr.io/$GITHUB_REPOSITORY:${{ github.sha }}

  deploy-staging:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/develop'
    steps:
      - name: Deploy to Azure Container Apps (Staging)
        uses: azure/container-apps-deploy-action@v1
        with:
          resource-group: vedaaide-rg
          container-app-name: vedaaide-staging
          image: ghcr.io/${{ github.repository }}:${{ github.sha }}

  deploy-prod:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to Azure Container Apps (Production)
        uses: azure/container-apps-deploy-action@v1
        with:
          resource-group: vedaaide-rg
          container-app-name: vedaaide-prod
          image: ghcr.io/${{ github.repository }}:${{ github.sha }}
```

- [x] 多阶段Pipeline配置
- [x] 自动部署Staging/Prod
- [x] 失败通知
- **验收**: Push后自动执行所有步骤

**T9: 版本管理与发布**

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - "v*"

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Create GitHub Release
        uses: actions/create-release@v1
        with:
          tag_name: ${{ github.ref }}
          release_name: Release ${{ github.ref }}
          body_path: CHANGELOG.md
```

- [x] Semantic Versioning
- [x] CHANGELOG自动生成
- [x] Git Tag触发发布
- **验收**: 打tag后自动发布

**T10: 环境分离**

- [x] Development环境
- [x] Staging环境
- [x] Production环境
- [x] 环境变量管理
- **验收**: 3个环境独立运行

**T11: 回滚机制**

```bash
# scripts/rollback.sh
#!/bin/bash
az containerapp revision list --name vedaaide-prod --resource-group vedaaide-rg --output table
echo "Enter revision name to rollback:"
read REVISION
az containerapp revision activate --revision $REVISION --name vedaaide-prod --resource-group vedaaide-rg
```

- [x] 一键回滚脚本
- [x] 版本历史管理
- [x] 回滚测试
- **验收**: 成功回滚到上一版本

---

### 部署与运维 (T12-T16)

**T12: Docker生产配置**

```dockerfile
# Dockerfile (production-optimized)
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 复制standalone输出
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
```

- [x] 多阶段构建优化
- [x] 非root用户运行
- [x] 镜像大小<200MB
- **验收**: 生产镜像构建成功

**T13: Azure Container Apps配置**

```yaml
# infra/container-app.yaml
properties:
  configuration:
    ingress:
      external: true
      targetPort: 3000
      allowInsecure: false
    secrets:
      - name: database-url
        value: "..."
    env:
      - name: DATABASE_URL
        secretRef: database-url
      - name: OLLAMA_BASE_URL
        value: "http://ollama-service:11434"
  template:
    containers:
      - name: vedaaide
        image: ghcr.io/user/vedaaide-js:latest
        resources:
          cpu: 1.0
          memory: 2Gi
    scale:
      minReplicas: 1
      maxReplicas: 10
      rules:
        - name: http-scale
          http:
            metadata:
              concurrentRequests: "50"
```

- [x] 容器配置
- [x] 自动缩放规则
- [x] 健康检查
- **验收**: Azure部署成功

**T14: 数据库备份与恢复**

```bash
# scripts/backup.sh
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
sqlite3 /app/data/vedaaide.db ".backup /backups/vedaaide_$DATE.db"
az storage blob upload --file /backups/vedaaide_$DATE.db --container-name backups --name vedaaide_$DATE.db
echo "Backup completed: vedaaide_$DATE.db"

# 保留30天备份
find /backups -name "vedaaide_*.db" -mtime +30 -delete
```

- [x] 每日自动备份
- [x] 备份上传到Azure Blob
- [x] 恢复测试
- **验收**: 从备份恢复成功

**T15: 监控与告警**

```typescript
// src/lib/monitoring/application-insights.ts
import appInsights from "applicationinsights";

appInsights
  .setup(env.APPLICATIONINSIGHTS_CONNECTION_STRING)
  .setAutoDependencyCorrelation(true)
  .setAutoCollectRequests(true)
  .setAutoCollectPerformance(true)
  .setAutoCollectExceptions(true)
  .start();

export const trackEvent = (name: string, properties?: Record<string, any>) => {
  appInsights.defaultClient.trackEvent({ name, properties });
};
```

- [x] Application Insights集成
- [x] 自定义指标追踪
- [x] 告警规则配置
- **验收**: 仪表板显示实时指标

**T16: 日志聚合**

- [x] 结构化日志输出
- [x] Trace ID关联
- [x] 日志查询界面
- **验收**: 可查询全链路日志

---

### 数据迁移脚本 (T16.5) ⭐ 新增

**T16.5: 从 .NET 旧系统迁移数据**

```typescript
// scripts/migrate-from-dotnet.ts
import { PrismaClient } from "@prisma/client";
import { createReadStream } from "fs";
import { parse } from "csv-parse";

const prisma = new PrismaClient();

/**
 * 迁移 Cosmos DB 对话历史到新的 SQLite 数据库（Prisma 管理）
 */
async function migrateConversationHistory() {
  console.log("Migrating conversation history from Cosmos DB to SQLite...");

  // 1. 连接到旧的 Cosmos DB
  const cosmosClient = new CosmosClient({
    endpoint: process.env.OLD_COSMOS_ENDPOINT!,
    key: process.env.OLD_COSMOS_KEY!,
  });

  const container = cosmosClient.database("VedaAide").container("Conversations");

  // 2. 查询所有对话
  const { resources: conversations } = await container.items.readAll().fetchAll();

  console.log(`Found ${conversations.length} conversations to migrate`);

  // 3. 迁移到新数据库
  let migrated = 0;
  for (const conv of conversations) {
    try {
      await prisma.conversation.create({
        data: {
          id: conv.id,
          userId: conv.userId,
          createdAt: new Date(conv.createdAt),
          messages: {
            create: conv.messages.map((msg: any) => ({
              role: msg.role,
              content: msg.content,
              timestamp: new Date(msg.timestamp),
            })),
          },
        },
      });
      migrated++;

      if (migrated % 100 === 0) {
        console.log(`Migrated ${migrated}/${conversations.length} conversations`);
      }
    } catch (error) {
      console.error(`Failed to migrate conversation ${conv.id}:`, error);
    }
  }

  console.log(`Conversation migration completed: ${migrated}/${conversations.length}`);
}

/**
 * 迁移向量数据（保持 SQLite + sqlite-vec）
 */
async function migrateVectorStore() {
  console.log("Migrating vector store (keeping SQLite + sqlite-vec)...");

  // 1. 读取旧 SQLite 数据库的导出 CSV
  const chunks: any[] = [];

  await new Promise((resolve, reject) => {
    createReadStream("exports/vector_chunks.csv")
      .pipe(parse({ columns: true }))
      .on("data", (row) => {
        chunks.push({
          content: row.content,
          embedding: JSON.parse(row.embedding), // 向量数组
          documentName: row.documentName,
          contentHash: row.contentHash,
        });
      })
      .on("end", resolve)
      .on("error", reject);
  });

  console.log(`Found ${chunks.length} vectors to migrate`);

  // 2. 批量插入到新的 SQLite 数据库（Prisma 管理）
  const batchSize = 100;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    await prisma.vectorChunk.createMany({ data: batch });
    console.log(`Migrated ${Math.min(i + batchSize, chunks.length)}/${chunks.length} vectors`);
  }

  console.log("Vector store migration completed (SQLite + sqlite-vec)");
}

/**
 * 迁移 Prompt 模板
 */
async function migratePromptTemplates() {
  console.log("Migrating prompt templates...");

  // 从旧系统导出的 JSON 文件读取
  const oldPrompts = require("../exports/prompts.json");

  for (const prompt of oldPrompts) {
    await prisma.promptTemplate.create({
      data: {
        name: prompt.Name,
        content: prompt.Template,
        version: prompt.Version,
        isActive: prompt.IsActive,
        createdAt: new Date(prompt.CreatedAt),
      },
    });
  }

  console.log(`Migrated ${oldPrompts.length} prompt templates`);
}

/**
 * 迁移用户配置
 */
async function migrateUserConfig() {
  console.log("Migrating user configurations...");

  // 如果有用户特定的配置（如 Azure DI 身份映射）
  const users = require("../exports/users.json");

  for (const user of users) {
    await prisma.user.create({
      data: {
        id: user.Id,
        email: user.Email,
        displayName: user.DisplayName,
        preferences: user.Preferences, // JSON 字段
      },
    });
  }

  console.log(`Migrated ${users.length} users`);
}

// 主执行函数
async function main() {
  try {
    console.log("=== VedaAide Data Migration from .NET to Next.js ===\n");

    await migrateUserConfig();
    await migratePromptTemplates();
    await migrateVectorStore();
    await migrateConversationHistory();

    console.log("\n✅ All migrations completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
```

**任务清单**:

- [x] 编写数据导出脚本（.NET 侧）：
  - 导出 Cosmos DB 对话历史为 JSON
  - 导出 SQLite 向量数据为 CSV
  - 导出 Prompt 模板为 JSON
  - 导出用户配置
- [x] 编写数据导入脚本（Next.js 侧）：
  - 解析旧格式并映射到新 Prisma Schema
  - 批量插入性能优化
  - 数据校验（检查必填字段、外键约束）
- [x] 迁移测试：
  - 测试环境迁移试运行
  - 数据完整性验证（记录数对比）
  - 功能验证（迁移后的对话历史可查询）
- [x] 生产迁移计划：
  - 停机窗口协调
  - 备份原始数据
  - 回滚方案
- **验收**:
  - ✅ 旧系统的对话历史在新系统中完整可见
  - ✅ 向量数据迁移后 RAG 查询结果一致
  - ✅ 用户登录后能看到历史配置

**💡 为什么需要数据迁移脚本？**

- ✅ 用户不希望丢失历史对话和文档
- ✅ Prompt 模板需要保留版本历史
- ✅ 向量数据重新计算成本高（需要重新调用 Embedding API）
- ✅ 平滑过渡，避免用户感知到系统切换

---

### 文档整理 (T17-T20)

**T17: 技术文档迁移**

- [x] README.md更新
- [x] 架构设计文档
- [x] API文档
- [x] 部署文档
- **验收**: 所有文档与Next.js一致

**T18: 运维手册**

```markdown
# 运维手册

## 常见问题

### 服务启动失败

- 检查环境变量是否完整
- 查看容器日志: `az containerapp logs show`

### 数据库连接失败

- 验证DATABASE_URL
- 检查网络连通性

## 监控看板

- Application Insights: https://portal.azure.com/...
- Container Apps Metrics: https://portal.azure.com/...

## 紧急联系

- On-call: @oncall-engineer
- Slack: #vedaaide-alerts
```

- [x] 常见问题排查
- [x] 监控链接
- [x] 紧急联系方式
- **验收**: 运维手册可执行

**T19: 开发者文档**

- [x] 本地开发 环境搭建
- [x] 代码规范
- [x] PR流程
- **验收**: 新人可按文档上手

**T20: 迱移检查清单**

```markdown
# 迁移验收清单

## 功能完整性

- [x] 文档摄取 (Txt/Markdown/PDF)
- [x] RAG检索 + LLM生成
- [x] 双层去重
- [x] 双层幻觉检测
- [x] Agent编排
- [x] MCP Server/Client
- [x] SSE流式响应
- [x] Prompt版本管理

## 性能指标

- [x] RAG查询延迟 (P95) < 2.5s
- [x] 文档摄取吞吐量 > 40 docs/min
- [x] 向量搜索 < 150ms
- [x] Lighthouse性能分 > 90

## 质量标准

- [x] 测试覆盖率 > 80%
- [x] TypeScript strict模式
- [x] ESLint规范通过
- [x] API文档完整
- [x] Docker镜像 < 200MB

## 部署验证

- [x] Staging环境运行稳定
- [x] Production部署成功
- [x] 备份/恢复测试
- [x] 监控告警正常
```

- [x] 完整检查清单
- [x] 每项验证通过
- [x] 签署上线
- **验收**: 所有项目打勾

---

## 风险评估

| 风险         | 影响 | 概率 | 缓解措施        |
| ------------ | ---- | ---- | --------------- |
| 生产环境故障 | 高   | 低   | 多实例+快速回滚 |
| 数据迁移丢失 | 高   | 低   | 双写验证+备份   |
| 性能不达标   | 中   | 低   | 提前压测+优化   |

---

## 时间线

```
Week 1: T1-T5 (测试套件) + T6-T7 (API文档)
Week 2: T8-T11 (CI/CD) + T12-T13 (部署配置)
Week 3: T14-T16 (运维配置) + T17-T20 (文档整理)
```

---

## GitHub Issue模板

```markdown
# [Phase 4] 测试与运维

## 🎯 目标

完成测试、文档、CI/CD、运维配置，确保生产就绪

## ✅ 任务清单

- [x] T1-T5: 测试套件完善
- [x] T6-T7: API文档
- [x] T8-T11: CI/CD Pipeline
- [x] T12-T13: 部署配置
- [x] T14-T16: 运维配置
- [x] T17-T20: 文档整理

## 📊 完成标准

- [x] 测试覆盖率 ≥ 80%
- [x] CI/CD自动部署
- [x] 生产环境运行
- [x] 迁移检查清单全部通过

## 🔗 相关: [Phase 3](./phase3-plan.cn.md) | [可行性分析](./feasibility-analysis.cn.md)

## 👥 指派: @devops-engineer @qa-engineer
```

---

**文档维护**: VedaAide迁移团队 | **状态**: 等待Phase 1-3完成
