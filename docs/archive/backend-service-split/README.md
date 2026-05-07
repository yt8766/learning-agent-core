# Backend Service Split Archive

状态：archive
文档类型：archive
适用范围：历史 `apps/backend/auth-server`、历史 `apps/backend/knowledge-server`
最后核对：2026-05-07

本目录保留旧后端拆分形态的历史说明。当前 canonical backend host 是 `apps/backend/agent-server`：

- Identity 入口归属 `apps/backend/agent-server/src/domains/identity` 与 `src/api/identity`。
- Knowledge 入口归属 `apps/backend/agent-server/src/domains/knowledge` 与 `src/api/knowledge`。
- `/api/auth/*` 与 `/api/knowledge/v1/*` 只作为迁移兼容 alias，不再代表独立 backend app。

继续开发时优先阅读：

- [agent-server overview](/docs/apps/backend/agent-server/agent-server-overview.md)
- [Identity domain](/docs/apps/backend/agent-server/identity.md)
- [Knowledge domain](/docs/apps/backend/agent-server/knowledge.md)
- [frontend-backend integration](/docs/integration/frontend-backend-integration.md)
