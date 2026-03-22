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
- `packages/agent-core`：Agent 运行时核心，内部拆为 `models / agents / session / graph / runtime / types`
- `packages/shared`：共享 DTO、领域类型、事件模型
- `packages/config`：运行时配置与路径解析
- `packages/memory`：memory、rules、runtime state 本地存储
- `packages/tools`：工具注册、审批规则、执行器
- `packages/skills`：技能实验区与稳定区
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

## 规范入口

- [后端规范](./docs/backend-conventions.md)
- [前端规范](./docs/frontend-conventions.md)
- [模板示例](./docs/project-templates.md)
- [测试规范](./docs/test-conventions.md)
- [agent-core 结构报告](./docs/agent-core-structure-report.md)
- [前后端对接文档](./docs/frontend-backend-integration.md)
- [规范总览](./PROJECT_CONVENTIONS.md)

## 工程原则

- 应用通过 `@agent/*` 使用共享包，不直连 `packages/*/src`
- `packages/*/src` 只保留 `.ts` 源码
- 应用输出使用 `dist/`
- 共享包输出使用 `build/cjs`、`build/esm`、`build/types`
- 本地运行数据统一进入仓库根级 `data/`
- 规范以文档为主，配少量根级检查，不为每个子项目重复堆配置
