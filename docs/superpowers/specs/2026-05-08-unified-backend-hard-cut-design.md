# Unified Backend Hard Cut Design

状态：draft
文档类型：spec
适用范围：`apps/backend/agent-server`、`apps/backend/auth-server`、`apps/backend/knowledge-server`、`apps/frontend/agent-admin`、`apps/frontend/knowledge`、`docs/contracts/api/**`、`docs/integration/frontend-backend-integration.md`
最后核对：2026-05-08

## 1. 目标

本设计是 [Unified Agent Server Design](./2026-05-07-unified-agent-server-design.md) 的删除收口版。目标是一次性完成硬切：

- `apps/backend/agent-server` 成为唯一后端 API Host。
- 删除 `apps/backend/auth-server` 与 `apps/backend/knowledge-server` 两个 standalone backend package。
- 只保留新 canonical API 路径：`/api/identity/*` 与 `/api/knowledge/*`。
- 同步改掉所有前端、测试、脚本、文档和 contract 调用方，不保留旧路径兼容。
- 删除 `apps/backend/agent-server/src/knowledge` 旧 KnowledgeModule，避免删掉 standalone server 后仍留下第二套 knowledge 后端。

完成后，仓库内不应再把 `auth-server` 或 `knowledge-server` 描述为当前服务、启动目标、canonical API host、验证目标或前端 base URL。

## 2. 非目标

- 不保留 `/api/auth/*`、`/api/admin/auth/*`、`/api/knowledge/v1/*` 作为兼容别名。
- 不改变 `agent-chat` 的 `/api/chat/*` 核心 SSE 与 view-stream 契约。
- 不迁移 runtime graph、agent graph、prompt 或节点编排到 backend app。
- 不恢复 `packages/shared`，也不新增第二个 shared 包。
- 不通过 `git worktree` 做迁移。

## 3. Canonical API

统一后端只暴露新路径。

### 3.1 Identity

```text
POST /api/identity/login
POST /api/identity/refresh
POST /api/identity/logout
GET  /api/identity/me
```

Identity domain 还必须承载原 `auth-server` 用户管理能力，供 `agent-admin` 使用。用户管理 endpoint 应落在 `/api/identity/users*` 或同域明确子路径下，由 `src/domains/identity` 的 service/repository 实现。

### 3.2 Knowledge

```text
GET    /api/knowledge/bases
POST   /api/knowledge/bases
GET    /api/knowledge/bases/:baseId/members
POST   /api/knowledge/bases/:baseId/members
GET    /api/knowledge/documents
POST   /api/knowledge/bases/:baseId/uploads
POST   /api/knowledge/bases/:baseId/documents
GET    /api/knowledge/documents/:documentId
GET    /api/knowledge/documents/:documentId/jobs/latest
GET    /api/knowledge/documents/:documentId/chunks
POST   /api/knowledge/documents/:documentId/reprocess
DELETE /api/knowledge/documents/:documentId
GET    /api/knowledge/embedding-models
POST   /api/knowledge/chat
GET    /api/knowledge/rag/model-profiles
GET    /api/knowledge/conversations
GET    /api/knowledge/conversations/:id/messages
POST   /api/knowledge/messages/:messageId/feedback
GET    /api/knowledge/workspace/users
GET    /api/knowledge/settings/model-providers
GET    /api/knowledge/settings/api-keys
POST   /api/knowledge/settings/api-keys
GET    /api/knowledge/settings/storage
GET    /api/knowledge/settings/security
PATCH  /api/knowledge/settings/security
GET    /api/knowledge/chat/assistant-config
PATCH  /api/knowledge/chat/assistant-config
GET    /api/knowledge/observability/metrics
GET    /api/knowledge/observability/traces
GET    /api/knowledge/observability/traces/:traceId
GET    /api/knowledge/eval/datasets
GET    /api/knowledge/eval/runs
GET    /api/knowledge/eval/runs/:runId/results
POST   /api/knowledge/eval/runs/compare
GET    /api/knowledge/provider-health
```

以上 endpoint 是本次硬切后的 Knowledge App 生产闭环。旧 `evals/*` 复数 alias、`knowledge-bases/*` fixture path、`documents/:id/jobs` 历史列表 path、`knowledge/v1/auth/*` session auth path 不进入新 canonical contract。若实现过程中发现旧服务仍有未列出的真实生产 endpoint，必须先补充本 spec 与 `docs/contracts/api/knowledge.md`，再迁移实现。

## 4. 后端结构

`agent-server` 保留两条真实业务链路：

- `apps/backend/agent-server/src/api/identity/*` + `src/domains/identity/*`
- `apps/backend/agent-server/src/api/knowledge/*` + `src/domains/knowledge/*`

Controller 只负责：

- HTTP path 与 method
- request body/query/param schema parse
- Bearer token / actor 解析
- Nest exception 映射
- SSE header 与 event framing

业务规则、repository、provider、OSS、RAG、eval、trace、settings 和用户管理都必须留在 domain service/repository/provider 层。删除 standalone server 时，不允许把旧 service 代码复制成 controller 胶水。

必须删除或收敛：

- `apps/backend/agent-server/src/knowledge/*`
- `KnowledgeModule` 旧模块 import
- 旧 fixture-backed `/api/knowledge/v1/*` 行为
- 旧 knowledge auth session 体系

如果旧 `src/knowledge` 中仍有能力未迁入 `src/domains/knowledge`，实现前必须先补到新 domain，而不是保留旧模块。

## 5. 前端迁移

`apps/frontend/knowledge`：

- 默认 `VITE_AUTH_SERVICE_BASE_URL` 与 `VITE_KNOWLEDGE_SERVICE_BASE_URL` 都指向 `http://127.0.0.1:3000/api`。
- `AuthClient` 只调用 `/identity/login`、`/identity/refresh`、`/identity/me`、`/identity/logout`。
- `KnowledgeApiClient` 只调用 `/knowledge/*`。
- 测试命名和断言不得再出现 `knowledge-server`、`3020` 或 `/knowledge/v1`。

`apps/frontend/agent-admin`：

- 登录、当前用户和用户管理统一调用 `/identity/*`。
- 不再把 `/auth/*` 作为认证主入口。

## 6. 脚本、workspace 与 lockfile

根脚本：

- `start:dev` 只启动 `server`。
- `start:dev:backends` 若保留，也必须等同于只启动 `server`。
- 不再 filter `@agent/auth-server` 或 `@agent/knowledge-server`。

删除两个 workspace package 后必须同步：

- `pnpm-lock.yaml` 移除 `apps/backend/auth-server` 与 `apps/backend/knowledge-server` importers。
- package graph、turbo smoke、runtime manifest 测试不再引用旧 package。
- docs check whitelist 不再允许新增当前态 `docs/apps/backend/auth-server` 或 `docs/apps/backend/knowledge-server` 文档。

## 7. 错误语义

Identity 错误使用 `identity_*` code：

- `identity_invalid_credentials`
- `identity_unauthorized`
- `identity_token_expired`
- `identity_refresh_token_expired`
- `identity_user_disabled`

Knowledge 错误保留 `knowledge_*` 与 `rag_*` code，但只能由 `src/domains/knowledge` 抛出并由 `src/api/knowledge` 映射。前端 refresh 逻辑只识别新的 identity 错误，不继续维护 `auth_token_expired` 或 `access_token_expired` 旧兼容分支。

SSE chat 只保留 `POST /api/knowledge/chat` 且 `stream: true` 的模式，事件 schema 继续来自 `@agent/knowledge`，controller 不定义第二套事件 contract。

## 8. 测试策略

迁移必须先改测试再改实现，确保删除不会靠人工目测兜底。

Red 阶段优先覆盖：

- root dev launcher smoke 期望只启动 `server`。
- workspace manifest / turbo typecheck 测试不包含旧 backend tsconfig。
- frontend knowledge real path 测试期望 `3000/api` 与 `/knowledge/*`。
- frontend auth client 测试期望 `/identity/*`。
- agent-admin auth API 测试期望 `/identity/*`。
- agent-server identity controller 覆盖 login / refresh / me / logout / users。
- agent-server knowledge controller 覆盖 bases、uploads、documents、chat、settings、eval、observability。
- 结构测试确认 `AppModule` 不 import 旧 `KnowledgeModule`，并且 `src/knowledge` 已删除或无当前入口。

Green 阶段只做让这些测试通过的最小迁移。Refactor 阶段再清理重复 mapper、旧 fixture、旧 docs 和死代码。

## 9. 验证

代码改动完成前，至少执行：

```bash
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm --dir apps/backend/agent-server test
pnpm exec tsc -p apps/frontend/knowledge/tsconfig.app.json --noEmit
pnpm exec tsc -p apps/frontend/agent-admin/tsconfig.app.json --noEmit
pnpm check:docs
pnpm check:architecture
```

如果迁移触达 `packages/*` contract 或 package exports，还必须补充：

```bash
pnpm build:lib
pnpm --dir apps/backend/agent-server build
```

提交前必须确认：

- `pnpm-lock.yaml` 没有旧 backend importer。
- `rg "auth-server|knowledge-server|3010|3020|/knowledge/v1|/api/auth" apps packages test scripts docs` 中没有当前态误导性引用。
- 仍保留的历史 spec 必须显式说明“历史设计 / 已被 unified backend hard cut 取代”。

## 10. 文档清理

必须更新：

- `docs/contracts/api/auth.md`
- `docs/contracts/api/knowledge.md`
- `docs/contracts/api/README.md`
- `docs/integration/frontend-backend-integration.md`
- `docs/apps/backend/agent-server/identity.md`
- `docs/apps/backend/agent-server/knowledge.md`
- `docs/apps/backend/agent-server/agent-server-overview.md`
- `docs/packages/evals/verification-system-guidelines.md` 中的 backend 启动说明

必须删除或归档：

- `docs/apps/backend/auth-server/*`
- `docs/apps/backend/knowledge-server/*`

旧设计文档如果仍有历史参考价值，保留在 `docs/superpowers/specs/`，但必须在文档顶部标注已被本设计取代，正确入口是 `agent-server` identity / knowledge 文档。

## 11. 完成条件

本迁移只有在以下条件全部满足时才算完成：

- 两个 standalone backend package 已删除。
- `agent-server` 是唯一 backend API Host。
- 所有前端调用都使用 `/api/identity/*` 与 `/api/knowledge/*`。
- 仓库测试、脚本、文档和 contract 不再把旧服务当作当前入口。
- 旧 `agent-server/src/knowledge` 影子实现已删除或彻底失去当前入口。
- 必要验证通过；若有非本轮 blocker，必须明确记录命令、失败层级和 blocker 归属。
