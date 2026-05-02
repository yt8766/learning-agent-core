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

- `KnowledgeBasesPage`：通过 provider 读取知识库列表；支持新建知识库并进入 `/knowledge-bases/:baseId` 详情。
- `KnowledgeBaseDetailPage`：读取知识库、文档列表和上传状态；上传入口只接受 Markdown/TXT，并按两步协议调用 provider。
- `DocumentUploadPanel`：先调用 `uploadKnowledgeFile()`，由后端代理上传到 OSS 并返回 `KnowledgeUploadResult`；再调用 `createDocumentFromUpload()` 创建 document 和 ingestion job；非终态 job 通过 `getLatestDocumentJob()` 轮询。
- `DocumentsPage`：通过 provider 读取文档列表并进入 `/documents/:documentId` 详情；上传目标必须来自 `listKnowledgeBases()` 返回的当前用户可访问知识库，不能硬编码 `kb_frontend` 这类 mock / fixture id；保留旧 `uploadDocument()` 兼容方法只用于迁移期，内部必须转到 `uploadKnowledgeFile()` + `createDocumentFromUpload()` 两步协议，不能再请求旧单步 `/knowledge-bases/:id/documents/upload` 路径；删除操作必须先通过行内确认提示，再走 `deleteDocument()`，由后端校验 membership、删除 document record 并 best-effort 清理 OSS object，页面删除后刷新列表。
- `DocumentDetailPage`：读取 `getDocument()`、`getLatestDocumentJob()` 和 `listDocumentChunks()`，展示 job stage、错误和 chunks；点击重新处理时调用 `reprocessDocument()` 并刷新详情。
- `OverviewPage`：ECharts 图表必须限制 tooltip 在图表容器内，并在 Ant Design `Space` / `Card` 嵌套下设置 `min-width: 0` 与 `width: 100%`，避免图表画布或 tooltip 撑出下方 card 范围。
- `ChatLabPage`：通过 provider 调 `/chat`；回答 footer 展示 citation、trace link 和 feedback 按钮；feedback 调 `/messages/:id/feedback`。
- `ObservabilityPage`：读取 metrics、trace list 和 trace detail；trace table 点击调用 `selectTrace()`；`/observability?traceId=<id>` 会自动打开对应 trace。
- `EvalsPage`：读取 datasets/runs，并在至少两次 run 存在时调用 `/eval/runs/compare` 展示回归差异。

## 并发与状态

数据 hooks 使用 request id 和 mounted guard 防止 stale response 覆盖：

- `useKnowledgeChat` 分别保护 send 和 feedback。
- `useKnowledgeObservability` 拆分 list/metrics reload 与 trace detail 防覆盖逻辑，避免用户选择 trace 时 reload 卡住或覆盖选择。
- `useKnowledgeDocuments` 将 upload/reprocess 的 action error 合并到页面 error 展示。

新增工作流必须先补 provider 层方法，再由 hook 消费，最后页面接线；不要让页面绕过 provider。

## Core Operations Routes

当前已接线的知识库核心运营路由：

```text
/knowledge-bases
/knowledge-bases/:baseId
/documents
/documents/:documentId
```

新上传闭环以 `docs/contracts/api/knowledge.md` 的两步 Markdown/TXT upload contract 为准。前端只能展示后端返回的 OSS URL 或 object key，不允许在浏览器中持有 OSS credential，也不允许新增网页抓取入口。
