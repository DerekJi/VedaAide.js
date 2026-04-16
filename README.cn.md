# VedaAide.js

一个由 Next.js 和 LangChain 驱动的智能 AI 应用，用于文档处理、向量嵌入和上下文感知的问答。

## 📋 目录

- [功能特性](#功能特性)
- [系统要求](#系统要求)
- [安装](#安装)
- [配置](#配置)
- [开发](#开发)
- [测试](#测试)
- [构建](#构建)
- [部署](#部署)
- [项目结构](#项目结构)
- [贡献指南](#贡献指南)
- [许可证](#许可证)

## ✨ 功能特性

- **AI 赋能处理**: 集成 LangChain 和 OpenAI 进行智能文档处理
- **向量嵌入**: 存储和搜索带有向量嵌入的文档片段
- **现代化 UI**: 基于 Next.js 15 和 React 19 构建，使用 Radix UI 组件
- **类型安全**: 完整的 TypeScript 支持，确保开发稳健性
- **数据库集成**: 使用 Prisma ORM 进行无缝数据库管理
- **API 路由**: 基于 Next.js App Router 的 RESTful API
- **完整测试**: 使用 Vitest 进行单元测试，Playwright 进行端到端测试
- **代码质量**: 采用 ESLint 和 Prettier 进行代码标准化
- **错误处理**: 内置错误边界和 Pino 结构化日志

## 📦 系统要求

- **Node.js**: 18.0.0 或更高版本
- **npm**: 9.0.0 或更高版本（或 yarn/pnpm 等价版本）
- **数据库**: SQLite（默认）或自定义数据库
- **Git**: 用于版本管理

### 可选

- **Docker**: 用于容器化部署
- **Docker Compose**: 用于多服务编排

## 🚀 安装

### 1. 克隆仓库

```bash
git clone https://github.com/yourusername/VedaAide.js.git
cd VedaAide.js
```

### 2. 安装依赖

```bash
npm install
```

### 3. 设置环境变量

复制 `.env.example` 文件（如果存在）或创建 `.env.local` 文件：

```bash
cp .env.example .env.local
```

配置必要的环境变量（参见[配置](#配置)部分）。

### 4. 初始化数据库

```bash
npm run db:generate
npm run db:migrate
```

这将生成 Prisma 客户端并运行数据库迁移。

## ⚙️ 配置

### 环境变量

在项目根目录创建 `.env.local` 文件，并配置以下变量：

```env
# 数据库
DATABASE_URL="file:./dev.db"

# API 密钥
OPENAI_API_KEY="your-api-key-here"
LANGCHAIN_API_KEY="your-api-key-here"

# 应用配置
NEXT_PUBLIC_API_URL="http://localhost:3000"
NODE_ENV="development"
```

### 数据库配置

项目默认使用 Prisma 配合 SQLite。如需使用其他数据库：

1. 更新 `prisma/schema.prisma` 中的 `provider`
2. 更新 `.env.local` 中的 `DATABASE_URL`
3. 运行迁移：`npm run db:migrate`

## 💻 开发

### 启动开发服务器

```bash
npm run dev
```

应用将在 `http://localhost:3000` 上运行

### 可用的开发命令

```bash
# 运行类型检查
npm run type-check

# 格式化代码
npm run format

# 检查代码格式
npm run format:check

# 启动 Prisma Studio（数据库 UI）
npm run db:studio
```

### 开发指南

- 遵循[架构指南](docs/guides/GETTING_STARTED.cn.md)
- 使用 TypeScript 保证类型安全
- 将组件放在 `src/components/` 目录
- 将业务逻辑放在 `src/lib/` 目录
- 使用 Prisma 进行所有数据库操作
- 遵守 ESLint 和 Prettier 规则

## 🧪 测试

### 运行单元测试

```bash
# 运行一次测试
npm run test

# 以监听模式运行测试
npm run test:watch

# 运行测试并生成覆盖率报告
npm run test:coverage
```

### 运行端到端测试

```bash
# 运行端到端测试
npm run test:e2e

# 使用 UI 运行端到端测试
npm run test:e2e:ui
```

### 测试最佳实践

- 为所有新功能编写测试
- 目标代码覆盖率 >80%
- 使用描述性的测试名称
- 使用 `describe` 块组织相关测试
- 测试正常路径和边界情况
- 为外部依赖（API 调用、数据库查询）使用 mock

### 测试结构

```
tests/
├── e2e/              # 端到端测试
├── load/             # 负载测试脚本
└── [feature].test.ts # 单元测试
```

## 🏗️ 构建

### 生产构建

```bash
npm run build
```

### 启动生产服务器

```bash
npm start
```

### 检查构建大小

```bash
npm run build
# 检查 `.next` 目录的大小
```

## 📦 部署

### Docker 部署

使用 Docker 构建和运行：

```bash
# 构建镜像
docker build -t vedaaide-js:latest .

# 运行容器
docker run -p 3000:3000 vedaaide-js:latest
```

### Docker Compose

```bash
# 启动服务
docker-compose up -d

# 停止服务
docker-compose down
```

### Azure 部署

详见[部署指南](docs/DEPLOYMENT-GUIDE.md)。

## 📁 项目结构

```
VedaAide.js/
├── src/
│   ├── app/                    # Next.js App Router 页面和布局
│   │   ├── api/               # API 路由
│   │   ├── actions/           # 服务器端操作
│   │   ├── _components/       # 应用级组件
│   │   ├── evaluation/        # 评估模块
│   │   ├── ingest/            # 文档摄入模块
│   │   └── prompts/           # 提示管理
│   ├── components/            # 可复用 React 组件
│   ├── lib/                   # 工具函数和服务
│   │   ├── agent/            # AI 代理逻辑
│   │   ├── datasources/      # 数据源集成
│   │   ├── services/         # 业务逻辑服务
│   │   ├── stores/           # 状态管理
│   │   └── vector-store/     # 向量嵌入存储
│   └── langchain.d.ts        # LangChain 类型定义
├── prisma/
│   ├── schema.prisma         # 数据库架构
│   └── migrations/           # 数据库迁移
├── tests/
│   ├── e2e/                  # 端到端测试
│   └── load/                 # 负载测试
├── docs/                     # 文档
├── infra/                    # 基础设施（Bicep、Docker）
├── scripts/                  # 工具脚本
├── public/                   # 静态文件
└── 配置文件                   # tsconfig.json、vitest.config.ts 等
```

## 🔧 关键技术栈

- **前端**: React 19 + Next.js 15 App Router
- **样式**: Tailwind CSS + PostCSS
- **数据库**: Prisma ORM + SQLite
- **AI/ML**: LangChain + OpenAI 集成
- **测试**: Vitest 单元测试，Playwright 端到端测试
- **代码质量**: ESLint、Prettier、TypeScript
- **日志**: Pino 结构化日志
- **UI 组件**: Radix UI 可访问组件库

## 📚 文档

- [快速开始指南](docs/guides/GETTING_STARTED.cn.md)
- [快速参考](docs/guides/QUICK_START.cn.md)
- [部署指南](docs/DEPLOYMENT-GUIDE.md)
- [常见问题](docs/faq/FAQ.cn.md)

## 🤝 贡献指南

欢迎贡献！请按以下步骤操作：

1. 创建功能分支：`git checkout -b feature/your-feature-name`
2. 提交更改：`git commit -m "feat: add your feature (#issue_number)"`
3. 推送到分支：`git push origin feature/your-feature-name`
4. 开启 Pull Request，目标分支为 `origin/main`

### 代码风格

- 遵循现有代码风格
- 提交前运行 `npm run lint`
- 运行 `npm run format` 自动格式化代码
- 确保 `npm run test` 通过
- 确保 `npm run type-check` 通过

### 提交信息格式

使用以下格式：`type: description (#issue_number)`

示例：

- `feat: add user authentication (#1)`
- `fix: correct data validation logic (#2)`
- `docs: update README (#3)`

## 🐛 问题反馈

发现了 bug？请创建一个 issue，包含：

- 问题描述
- 复现步骤
- 预期行为
- 实际行为
- 你的环境（操作系统、Node 版本等）

## 📄 许可证

本项目采用 MIT 许可证 - 详见 LICENSE 文件。

## 📞 支持

- 在 GitHub 上创建 issue 报告 bug 或请求功能
- 先检查已有的 issue 和讨论
- 查阅 `docs/` 文件夹中的文档

## 🔗 链接

- [项目仓库](https://github.com/yourusername/VedaAide.js)
- [问题追踪](https://github.com/yourusername/VedaAide.js/issues)
- [讨论区](https://github.com/yourusername/VedaAide.js/discussions)

---

**最后更新**: 2026 年 4 月
