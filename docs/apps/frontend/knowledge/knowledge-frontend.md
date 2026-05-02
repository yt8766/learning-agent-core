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
- `DocumentUploadPanel`：先调用 `uploadKnowledgeFile()`，由后端代理上传到 OSS 并返回 `KnowledgeUploadResult`；再调用 `createDocumentFromUpload()` 创建 document 和 ingestion job；非终态 job 通过 `getLatestDocumentJob()` 轮询。面板必须展示 `Progress`，优先使用后端 `job.progress.percent`，后端未返回时才使用 stage fallback。
- `DocumentsPage`：通过 provider 读取文档列表并进入 `/documents/:documentId` 详情；文档 Table 必须有行内处理进度列，直接展示每个文档的入库/向量化进展。上传入口是“上传文档”按钮触发的弹窗，不在页面顶部常驻选择器；弹窗内选择目标知识库、embedding model，并选择 Markdown/TXT 文件。上传目标必须来自 `listKnowledgeBases()` 返回的当前用户可访问知识库，不能硬编码 `kb_frontend` 这类 mock / fixture id。单知识库可默认选中，但选择控件仍在弹窗内可见；`listEmbeddingModels()` 用于展示 embedding model 选择器，创建 document 时把 `embeddingModelId` 写入 `metadata.embeddingModelId`。保留旧 `uploadDocument()` 兼容方法只用于迁移期，内部必须转到 `uploadKnowledgeFile()` + `createDocumentFromUpload()` 两步协议，不能再请求旧单步 `/knowledge-bases/:id/documents/upload` 路径；删除操作必须先通过行内确认提示，再走 `deleteDocument()`，由后端校验 membership、删除 document record 并 best-effort 清理 OSS object，页面删除后刷新列表。
- `DocumentDetailPage`：读取 `getDocument()`、`getLatestDocumentJob()` 和 `listDocumentChunks()`，展示 job stage、错误和 chunks；点击重新处理时调用 `reprocessDocument()` 并刷新详情。
- `OverviewPage`：ECharts 图表必须限制 tooltip 在图表容器内，并在 Ant Design `Space` / `Card` 嵌套下设置 `min-width: 0` 与 `width: 100%`，避免图表画布或 tooltip 撑出下方 card 范围。
- `ChatLabPage`：通过 provider 调 `/chat`；进入页面后读取 `listKnowledgeBases()` 用于输入框 `@` 候选和解析文本中的 `@知识库名`，不得再渲染常驻知识库 Select，也不得把会话 key 映射成 `kb_frontend` / `kb_runtime` 这类 fixture ID。页面采用 Codex 风格双栏工作台：左侧是会话与知识库入口，右侧是顶部运行栏、居中空态标题、消息线程和底部 composer，不再使用嵌套 Card demo 布局。输入框使用 Ant Design X `Suggestion` 包裹普通受控 `Sender`，避免 `slotConfig` contenteditable 影响普通文字和空格输入；用户输入 `@` 时展示当前可访问知识库候选，选择候选后将当前 `@` token 从文本框移除，并在 `Sender.header` 内展示蓝色知识库标签。发送时必须从 header 标签状态和文本 `@知识库名` 解析 `metadata.mentions`，不直接发送 knowledgeBaseIds。左侧会话栏支持“新建会话”，会话内容来自当前本地会话消息列表。发送请求时必须采用 OpenAI Chat Completions 风格 payload：`model`、`messages: [{ role: 'user', content }]`、`metadata.conversationId`、`metadata.mentions`、`stream: false`；没有 `@mentions` 时发送空 mentions，让后端在检索前根据问题和 knowledge base 元信息自动路由。新 Chat Lab 不能继续发送旧的顶层 `message` / `knowledgeBaseIds` payload，也不能主动发送 `metadata.knowledgeBaseIds`。AI 回复必须通过 Ant Design X `Bubble.List.role.ai` 统一配置 `contentRender`、`footer` 和 `loadingRender`：正文用 Markdown 渲染，footer 使用 `Actions.Copy` 与 `Actions.Feedback`，并继续展示 trace link 和 citation cards；citation card 至少展示 title、quote、score 或 uri，不能退回只展示标题列表。feedback 调 `/messages/:id/feedback`。
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
