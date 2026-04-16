# backend 文档目录

状态：current
文档类型：index
适用范围：`docs/backend/`
最后核对：2026-04-15

本目录用于沉淀 `apps/backend/*` 相关文档。

首次接手建议按这个顺序阅读：

1. [agent-server-overview.md](/Users/dev/Desktop/learning-agent-core/docs/backend/agent-server-overview.md)
2. [runtime-module-notes.md](/Users/dev/Desktop/learning-agent-core/docs/backend/runtime-module-notes.md)
3. [worker-overview.md](/Users/dev/Desktop/learning-agent-core/docs/backend/worker-overview.md)

改接口、SSE、审批恢复前，优先同时阅读：

- [docs/integration/frontend-backend-integration.md](/Users/dev/Desktop/learning-agent-core/docs/integration/frontend-backend-integration.md)
- [docs/integration/approval-recovery.md](/Users/dev/Desktop/learning-agent-core/docs/integration/approval-recovery.md)

本目录主文档：

- `agent-server` 总体入口：[agent-server-overview.md](/Users/dev/Desktop/learning-agent-core/docs/backend/agent-server-overview.md)
- runtime 模块边界：[runtime-module-notes.md](/Users/dev/Desktop/learning-agent-core/docs/backend/runtime-module-notes.md)
- worker 链路入口：[worker-overview.md](/Users/dev/Desktop/learning-agent-core/docs/backend/worker-overview.md)

当前主要对应目录：

- `apps/backend/agent-server/src/chat`
  - 聊天接口、SSE 与 direct reply / workflow 入口
- `apps/backend/agent-server/src/runtime`
  - runtime 中心、briefings、actions、services、skills、tools 等后台治理主链
- `apps/backend/agent-server/src/approvals`
  - 审批接口与恢复链路
- `apps/backend/agent-server/src/evidence`、`src/learning`、`src/memory`、`src/rules`、`src/skills`
  - 证据、学习、记忆、规则与技能治理相关模块
- `apps/backend/agent-server/src/templates`
  - 模板查询与模板接口
- `apps/worker/src`
  - 后台任务消费、恢复、learning queue、health 与 bootstrap

约定：

- 后端 controller、service、SSE、运行时装配、鉴权和接口契约相关文档统一放在 `docs/backend/`
- 新增接口、修改流协议、调整运行时装配或兼容策略后，需同步更新本目录文档

当前文档：

- [agent-server-overview.md](/Users/dev/Desktop/learning-agent-core/docs/backend/agent-server-overview.md)
- [worker-overview.md](/Users/dev/Desktop/learning-agent-core/docs/backend/worker-overview.md)
- [runtime-module-notes.md](/Users/dev/Desktop/learning-agent-core/docs/backend/runtime-module-notes.md)
