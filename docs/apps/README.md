# 应用文档目录

状态：current
文档类型：index
适用范围：`docs/apps/`
最后核对：2026-04-26

本目录镜像 `apps/*` 的主要应用宿主，负责沉淀前端、后端与应用层联调说明。

当前文档：

- [backend/README.md](/docs/apps/backend/README.md)
- [frontend/README.md](/docs/apps/frontend/README.md)
- [knowledge-cli/knowledge-cli.md](/docs/apps/knowledge-cli/knowledge-cli.md)

当前优先阅读：

- 后端接口、运行时装配、审批恢复：[backend/README.md](/docs/apps/backend/README.md)
- `agent-chat`、`agent-admin`、`knowledge`、`agent-gateway`：[frontend/README.md](/docs/apps/frontend/README.md)
- Knowledge SDK 本地 CLI 闭环：[knowledge-cli/knowledge-cli.md](/docs/apps/knowledge-cli/knowledge-cli.md)

约定：

- 应用专项文档优先放入对应真实应用目录。
- 跨应用协议与 DTO 契约统一放入 [contracts](/docs/contracts/README.md)，跨应用联调链路统一放入 [integration](/docs/integration/README.md)。
