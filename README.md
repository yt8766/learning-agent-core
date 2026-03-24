# AI 自主学习代理系统

这是一个基于 `NestJS + TypeScript + LangGraph + LangChain` 的多 Agent monorepo，用于承载：

- 聊天式 Agent 会话
- 主 Agent / 子 Agent 协作
- 工具调用与审批
- 记忆、规则、技能实验区
- 运行观测与管理台

## 目录说明

- `apps/backend/agent-server`：后端主服务，提供 `/api` 接口
- `apps/worker`：异步执行、恢复与学习任务 worker
- `apps/frontend/agent-chat`：聊天入口前端
- `apps/frontend/agent-admin`：观测与运维控制台
- `skills/*`：仓库级代理技能目录，给 Codex / Claude Code 这类代码代理读取
- `packages/agent-core`：Agent 运行时核心，内部拆为 `models / agents / session / graph / runtime / types`
- `packages/shared`：共享 DTO、领域类型、事件模型
- `packages/config`：运行时配置与路径解析
- `packages/memory`：memory、rules、runtime state 本地存储
- `packages/tools`：工具注册、审批规则、执行器
- `packages/skills`：运行时技能注册与技能卡领域包
- `packages/evals`：评估与复盘
- `data/*`：仓库根级本地运行数据（与 `apps/`、`packages/` 同级）
- `docs/*`：项目规范与模板文档

## 开发入口

- 后端开发：`pnpm --dir apps/backend/agent-server start:dev`
- 后端生产：`pnpm --dir apps/backend/agent-server start:prod`
- 聊天前端：`pnpm --dir apps/frontend/agent-chat dev`
- 管理前端：`pnpm --dir apps/frontend/agent-admin dev`
- 库构建：`pnpm build:lib`
- 单元测试：`pnpm test`
- 测试监听：`pnpm test:watch`

## CI 说明

仓库当前使用两套 GitHub Actions 工作流：

- `PR 检查`：对应 [`.github/workflows/pr-check.yml`](./.github/workflows/pr-check.yml)
- `main 检查`：对应 [`.github/workflows/main-check.yml`](./.github/workflows/main-check.yml)

### PR 检查

`pull_request -> main` 时会触发 `PR 检查`，并拆成 4 个独立状态：

- `Lint`
- `Typecheck`
- `Test`
- `Build`

这套检查会结合 `changed-files` 做路径过滤：

- 只改前端目录时：
  - 优先跑前端类型检查
  - 只跑前端构建
- 改到后端、worker、packages 或根级工程配置时：
  - 跑后端与共享包类型检查
  - 跑测试
  - 跑后端和共享库构建
- 只改文档时：
  - 不强制跑整套代码检查

这样可以减少 monorepo 中无关目录改动带来的重复校验时间。

### main 检查

`push -> main` 时会触发 `main 检查`，执行完整校验：

- `ESLint`
- `Prettier --check`
- `TypeScript typecheck`
- `Vitest`
- `build`

同时会启用这几层缓存来提升速度：

- `pnpm` 依赖缓存
- `Turbo` 缓存：`.turbo/cache`
- 构建产物缓存：
  - `apps/**/dist`
  - `packages/**/build`

## 分支保护建议

建议在 GitHub 仓库设置里为 `main` 分支开启以下规则：

- 禁止直接推送到 `main`
- 必须通过 Pull Request 合并
- 必须等待状态检查通过后才能合并
- 必须通过以下 4 个 PR 检查：
  - `Lint`
  - `Typecheck`
  - `Test`
  - `Build`
- 建议开启“需要分支为最新状态后才能合并”
- 建议开启“新提交后自动失效旧审批”

如果团队后续还会继续扩大规模，建议再补两条：

- 限制谁可以直接修改分支保护规则
- 对 `main` 启用合并队列或 squash merge 策略，保持提交历史整洁

## 规范入口

- [给 Codex / Agents 的规范](./AGENTS.md)
- [后端规范](./docs/backend-conventions.md)
- [前端规范](./docs/frontend-conventions.md)
- [GitHub Flow 规范](./docs/github-flow.md)
- [模板示例](./docs/project-templates.md)
- [测试规范](./docs/test-conventions.md)
- [agent-core 结构报告](./docs/agent-core-structure-report.md)
- [架构总览](./docs/ARCHITECTURE.md)
- [前后端对接文档](./docs/frontend-backend-integration.md)
- [规范总览](./PROJECT_CONVENTIONS.md)

## For Codex / Agents

如果你是进入本仓库工作的代码代理，请先阅读：

1. [AGENTS.md](./AGENTS.md)
2. [架构总览](./docs/ARCHITECTURE.md)
3. [前后端对接文档](./docs/frontend-backend-integration.md)

最重要的当前约束：

- `agent-chat` 采用 OpenClaw 模态，作为前线作战面
- `agent-admin` 做平台控制台，作为后台指挥面
- 审批、Evidence、Learning、Think、ThoughtChain 不要从消息主链移出去
- 共享包改动后，优先执行 `pnpm build:lib`
- 仓库级代理技能放在 `skills/*/SKILL.md`，不要和 `packages/skills` 混用

## 工程原则

- 应用通过 `@agent/*` 使用共享包，不直连 `packages/*/src`
- `packages/*/src` 只保留 `.ts` 源码
- 应用输出使用 `dist/`
- 共享包输出使用 `build/cjs`、`build/esm`、`build/types`
- 本地运行数据统一进入仓库根级 `data/`
- 规范以文档为主，配少量根级检查，不为每个子项目重复堆配置
