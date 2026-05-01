# frontend 文档目录

状态：current
文档类型：index
适用范围：`docs/apps/frontend/`
最后核对：2026-04-22

本目录镜像 `apps/frontend/*`，向下区分 `agent-chat`、`agent-admin`、独立 `knowledge` 与私用 `llm-gateway` 应用文档。

首次接手前端时，建议按这个顺序阅读：

1. [agent-chat 文档目录](/docs/apps/frontend/agent-chat/README.md)
2. [agent-admin 文档目录](/docs/apps/frontend/agent-admin/README.md)
3. [Knowledge App 产品设计](/docs/apps/frontend/knowledge/product-design.md)
4. [llm-gateway 文档目录](/docs/apps/frontend/llm-gateway/README.md)
5. [前端规范](/docs/conventions/frontend-conventions.md)
6. [API 文档目录](/docs/contracts/api/README.md)
7. [前后端集成链路](/docs/integration/frontend-backend-integration.md)

改前端前先确认：

- 当前改动是在前线执行面 `agent-chat`，还是后台治理面 `agent-admin`
- 当前改动是否属于独立知识库前端 `knowledge`，它只面向知识库运营、RAG 验证、观测和评测闭环
- 当前改动是否属于私用中转站 `llm-gateway`，它不接入开发自治 runtime / agent 主链
- 是否会影响 SSE、审批恢复、runtime center 等跨模块协议

本目录主文档：

- 前线执行面入口：[agent-chat/README.md](/docs/apps/frontend/agent-chat/README.md)
- 后台治理面入口：[agent-admin/README.md](/docs/apps/frontend/agent-admin/README.md)
- 知识库前端入口：[knowledge/product-design.md](/docs/apps/frontend/knowledge/product-design.md)
- 私用中转站入口：[llm-gateway/README.md](/docs/apps/frontend/llm-gateway/README.md)
- API 契约入口：[api/README.md](/docs/contracts/api/README.md)
- 跨端协作入口：[integration/frontend-backend-integration.md](/docs/integration/frontend-backend-integration.md)

当前文档：

- [agent-chat 文档目录](/docs/apps/frontend/agent-chat/README.md)
- [agent-admin 文档目录](/docs/apps/frontend/agent-admin/README.md)
- [Knowledge App 产品设计](/docs/apps/frontend/knowledge/product-design.md)
- [llm-gateway 文档目录](/docs/apps/frontend/llm-gateway/README.md)
