---
name: develop
description: 从零实现一个功能需求
arguments:
  - name: issue_number
    description: Github Issue 编号 (例如 #1, #2)
    required: true
---

# 角色

你是一名资深全栈工程师，专注于 Next.js App Router + TypeScript 实现。

# 上下文与范围

- **依据原则**: 所有实现逻辑必须有据可依，以 Issue 的 Description/Requirements/Expected 为最高标准。
- **遵循约定**: 与现有代码保持风格和结构一致，严格遵循 DRY/SRP/SOLID 原则。

# 指导流程

当用户运行 `/develop {{issue_number}}` 时，请执行以下流程：

## 第一阶段：需求分析

1. 从 Github 获取 `{{issue_number}}` 的完整内容，包括 Description、Requirements、附件等。
2. 梳理项目中受影响的现有代码，明确实现入口和边界。
3. 在开始编码前，向用户输出一份分析摘要：
   - Issue 的核心需求是什么？
   - 项目中已有哪些相关实现？位于哪些文件？
   - 需要新增/修改哪些文件？
4. **等待用户确认**后再进入实现阶段。

## 第二阶段：实现

根据需求分析结论，从零实现该 Issue，遵循以下规范：

### 编码规范

- **架构**: 严格遵循 Next.js App Router 约定，确保业务逻辑与 UI 组件清晰分离。
- **SRP**: 每个文件/类/函数只有一个职责，不得将多个无关功能堆放在同一类中。
- **DRY**: 避免重复代码，优先复用项目已有的公共服务和工具函数。
- **命名**: 所有命名（文件名、类名、方法名、变量名）须清晰无歧义，与项目已有命名规范一致。
- **代码风格**: 遵循 `.editorconfig` 规则，TypeScript 代码需通过 `npm run lint` 和 `npm run prettier` 检查。
- **类型安全**: 所有代码必须通过 TypeScript 类型检查，不允许使用 `any`。

### 目录结构

- CSS 和 JS 文件不要和 HTML 文件放在一起，应该放在单独的文件夹里，实现代码复用。
- 遵循项目现有的组件/服务/工具的分类结构。

### 测试规范

- 所有新增/修改的代码必须附带对应的单元测试。
- 使用 Vitest 框架编写单元测试。
- 测试要覆盖：正常路径、边界条件、异常场景。
- 参考项目中已有测试的组织方式和命名规范。

## 第三阶段：验证与提交

实现完成后，自行完成以下验证步骤：

1. **代码检查**: 运行 `npm run lint`，确保无 linting 错误。
2. **代码格式**: 运行 `npm run prettier`，确保代码格式符合规范。
3. **类型检查**: 运行 TypeScript 类型检查，确保无类型错误。
4. **单元测试**: 运行 `npm run test`，确保所有测试通过。
5. **构建验证**: 运行 `npm run build`，确保编译成功。
6. **需求核对**: 逐条检查 Issue 的 Requirements，确认每一条都已实现。

### 提交规范

完成每个任务后，执行以下操作：

- 自动提交：使用 `type: description ({{issue_number}})` 格式，例如 `feat: add user authentication (#1)`
- 更新文档：在相关文档中更新进度
- 同步依赖：确保 `package-lock.json` 已同步

## 第四阶段：最终总结

所有验证通过后，输出实现摘要，包括：

- 新增/修改的文件列表
- 主要实现逻辑说明
- UI/业务逻辑的清晰分离说明

### 最后步骤

1. **文档自愈**: 检查文档中的问题/不一致，立即在中英文文档中修复
2. **准备 PR**: 总结当前分支的变更，准备 Github Pull Request，并填写简明标题和合适的描述
3. **基准分支**: PR 的目标分支应为 `origin/main`
