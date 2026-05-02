状态：current
文档类型：architecture
适用范围：`apps/frontend/knowledge`
最后核对：2026-05-02

# Knowledge 前端架构

`apps/frontend/knowledge` 是独立的知识库前端项目，面向知识库、文档上传、RAG 对话、观测、评测和账号设置工作流。它不是 `agent-chat` 或 `agent-admin` 的副本。

## API 边界

UI 只能通过 `KnowledgeApiProvider` 获取 `KnowledgeFrontendApi`，页面和 hooks 不直接 new 真实 client，也不直接 import mock 数据。默认装配在 `src/main.tsx`：

- `VITE_KNOWLEDGE_API_MODE=mock`：使用 `MockKnowledgeApiClient`，仅用于本地 demo。
- 其他情况：使用 `KnowledgeApiClient`，默认 base URL 为 `http://127.0.0.1:3020/api`。

`KnowledgeApiClient` 统一走 fetch 路径。请求前通过 `AuthClient.ensureValidAccessToken()` 取 access token；业务接口返回 `401 + code=auth_token_expired` 时，调用 `AuthClient.refreshTokensOnce()` 并重试原请求一次。

前端 DTO 以 `docs/contracts/api/knowledge.md` 为准；稳定共享模型优先从 `@agent/knowledge` 消费，例如 `KnowledgeBase` 继承 SDK core contract。新增字段时先更新 API contract / SDK schema，再更新前端类型和实现。

## Backend Connection

The Knowledge frontend defaults to the real backend path:

```bash
VITE_AUTH_SERVICE_BASE_URL=http://127.0.0.1:3010/api
VITE_KNOWLEDGE_SERVICE_BASE_URL=http://127.0.0.1:3020/api
```

Mock mode is explicit:

```bash
VITE_KNOWLEDGE_API_MODE=mock
```

Do not make mock data the default production path.

## 登录与 Token

登录使用 JWT 双 token：

- `LoginPage` 调用 `AuthProvider.login()`。
- `AuthProvider.login()` 调 `AuthClient.login()`，后者请求 `/auth/login` 并保存 tokens。
- 登录页展示账号和密码，初始值必须为空，不再预填 `dev@example.com` / `secret`。
- 当后端存在 `DATABASE_URL` 或显式 `KNOWLEDGE_REPOSITORY=postgres` 时，Knowledge 登录会校验数据库里的超管账号；当前请求字段仍沿用 `email`，但前端 UI 和后端语义按账号名处理。
- `AuthClient` 和 `KnowledgeApiClient` 默认使用绑定到 `globalThis` 的 fetch，避免浏览器原生 fetch 被类字段调用时出现 `Illegal invocation`。
- `AuthClient` 调用 `auth-server /api/auth/login` 和 `/api/auth/refresh`；`KnowledgeApiClient` 调用 `knowledge-server /api/knowledge/bases` 等业务接口。
- `/login` 是唯一规范登录入口。未登录访问任何受保护业务路径时，`ProtectedRoute` 必须 `Navigate` 到 `/login`，不能在原业务 URL 下直接渲染登录页。
- 已登录用户访问 `/login` 时必须重定向回工作台；如果登录页带有 `location.state.from`，登录成功后优先回到原受保护路径，否则回到 `/`。
- token 存在本地浏览器 storage；退出登录只删除本地 token。
- `AuthClient` 支持 `setAuthLostHandler()`，refresh token 过期或 refresh 失败时清理 token，并通知 `AuthProvider` 把 UI 切回未登录状态。

## 页面工作流

- `KnowledgeBasesPage`：通过 provider 读取知识库列表。
- `DocumentsPage`：通过 provider 读取文档列表；上传使用隐藏 file input 取得真实 `File`，调用 `POST /knowledge-bases/:id/documents/upload`；失败文档可调用 `POST /documents/:id/reprocess`；页面展示处理 stage 和错误原因。
- `ChatLabPage`：通过 provider 调 `/chat`；回答 footer 展示 citation、trace link 和 feedback 按钮；feedback 调 `/messages/:id/feedback`。
- `ObservabilityPage`：读取 metrics、trace list 和 trace detail；trace table 点击调用 `selectTrace()`；`/observability?traceId=<id>` 会自动打开对应 trace。
- `EvalsPage`：读取 datasets/runs，并在至少两次 run 存在时调用 `/eval/runs/compare` 展示回归差异。

## 并发与状态

数据 hooks 使用 request id 和 mounted guard 防止 stale response 覆盖：

- `useKnowledgeChat` 分别保护 send 和 feedback。
- `useKnowledgeObservability` 拆分 list/metrics reload 与 trace detail 防覆盖逻辑，避免用户选择 trace 时 reload 卡住或覆盖选择。
- `useKnowledgeDocuments` 将 upload/reprocess 的 action error 合并到页面 error 展示。

新增工作流必须先补 provider 层方法，再由 hook 消费，最后页面接线；不要让页面绕过 provider。
