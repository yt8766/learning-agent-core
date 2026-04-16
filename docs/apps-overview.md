# Apps 目录说明

状态：current
文档类型：overview
适用范围：`apps/*`
最后核对：2026-04-15

`apps/` 放可直接运行的应用进程，是仓库最上层的交付面。

本主题主文档：

- 本文是 `apps/*` 的总入口

本文只覆盖：

- 四个应用进程的职责分工
- 推荐进入各应用文档目录的阅读顺序

更细实现请继续看：

- 后端入口：[backend/README.md](/Users/dev/Desktop/learning-agent-core/docs/backend/README.md)
- chat 前端入口：[frontend/agent-chat/README.md](/Users/dev/Desktop/learning-agent-core/docs/frontend/agent-chat/README.md)
- admin 前端入口：[frontend/agent-admin/README.md](/Users/dev/Desktop/learning-agent-core/docs/frontend/agent-admin/README.md)

当前目录职责：

- `apps/backend/agent-server`
  - 主 API 服务，负责聊天接口、SSE、runtime/approval/learning/evidence/connectors 治理接口
- `apps/frontend/agent-chat`
  - 前线作战面，负责执行与操作
- `apps/frontend/agent-admin`
  - 后台指挥面，负责治理与运营
- `apps/worker`
  - 独立后台 worker，消费异步任务、恢复和学习相关作业

建议阅读顺序：

1. [backend 文档目录](/Users/dev/Desktop/learning-agent-core/docs/backend/README.md)
2. [agent-chat 文档目录](/Users/dev/Desktop/learning-agent-core/docs/frontend/agent-chat/README.md)
3. [agent-admin 文档目录](/Users/dev/Desktop/learning-agent-core/docs/frontend/agent-admin/README.md)
