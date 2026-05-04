状态：current
文档类型：architecture
适用范围：`apps/frontend/knowledge`
最后核对：2026-05-04

# Knowledge 前端架构

`apps/frontend/knowledge` 是独立的知识库前端项目，面向知识库、文档上传、RAG 对话、观测、评测和账号设置工作流。它不是 `agent-chat` 或 `agent-admin` 的副本。

## API 边界

UI 只能通过 `KnowledgeApiProvider` 获取 `KnowledgeFrontendApi`，页面和 hooks 不直接 new 真实 client，也不直接 import mock 数据。默认装配在 `src/main.tsx`：

- `VITE_KNOWLEDGE_API_MODE=mock`：使用 `MockKnowledgeApiClient`，仅用于本地 demo。
- 其他情况：使用 `KnowledgeApiClient`，默认 base URL 为 `http://127.0.0.1:3020/api`。

`KnowledgeApiClient` 统一走 fetch 路径。请求前通过 `AuthClient.ensureValidAccessToken()` 取 access token；业务接口返回 `401 + code=auth_token_expired` 时，调用 `AuthClient.refreshTokensOnce()` 并重试原请求一次。

前端 DTO 以 `docs/contracts/api/knowledge.md` 为准；稳定共享模型优先从 `@agent/knowledge` 消费，例如 `KnowledgeBaseHealth`、RAG answer route/diagnostics 和 trace projection。新增字段时先更新 API contract / SDK schema，再更新前端类型和实现。

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

## Trustworthy Workbench UI

Knowledge pages display backend health projections and warnings; they do not infer readiness locally. Document pages render ingestion stage, progress, error, and retry actions from `getLatestDocumentJob()`.

Chat Lab displays route reason, retrieval diagnostics, grounded citations, feedback, and trace links from `/chat`. Observability displays trace spans for route, retrieval, generation, and eval stages while keeping legacy raw trace fallback display-only.

## 登录与 Token

登录使用 JWT 双 token：

- `LoginPage` 调用 `AuthProvider.login()`。
- `AuthProvider.login()` 调 `AuthClient.login()`，后者请求 `/auth/login` 并保存 tokens。
- 登录页展示账号和密码，初始值必须为空，不再预填 `dev@example.com` / `secret`。
- 登录页采用 RAG 企业知识库品牌页：左侧展示知识接入、检索增强、安全控制等产品能力，右侧以账号密码作为主登录表单。
- 登录页额外展示但暂不接功能：记住我、忘记密码、首次使用联系管理员、其他登录方式分隔标题、钉钉登录、飞书登录、企业微信登录。
- 登录页仍不展示账号/短信登录方式切换、验证码、SSO 或中英文切换入口；当前界面全部为中文。
- 登录页顶部品牌栏固定在视口顶部，页面滚动时必须保持可见；主体内容需要为固定顶部栏预留空间，不能被遮盖。
- 当后端存在 `DATABASE_URL` 或显式 `KNOWLEDGE_REPOSITORY=postgres` 时，Knowledge 登录会校验数据库里的超管账号；当前请求字段仍沿用 `email`，但前端 UI 和后端语义按账号名处理。
- `AuthClient` 和 `KnowledgeApiClient` 默认使用绑定到 `globalThis` 的 fetch，避免浏览器原生 fetch 被类字段调用时出现 `Illegal invocation`。
- `AuthClient` 调用 `auth-server /api/auth/login` 和 `/api/auth/refresh`；`KnowledgeApiClient` 调用 `knowledge-server /api/knowledge/bases` 等业务接口。
- `/login` 是唯一规范登录入口。未登录访问任何受保护业务路径时，`ProtectedRoute` 必须 `Navigate` 到 `/login`，不能在原业务 URL 下直接渲染登录页。
- 已登录用户访问 `/login` 时必须重定向回工作台；如果登录页带有 `location.state.from`，登录成功后优先回到原受保护路径，否则回到 `/`。
- token 存在本地浏览器 storage；退出登录只删除本地 token。
- `AuthClient` 支持 `setAuthLostHandler()`，refresh token 过期或 refresh 失败时清理 token，并通知 `AuthProvider` 把 UI 切回未登录状态。

## 页面工作流

- `KnowledgeBasesPage`：通过 provider 读取知识库列表；支持新建知识库并进入 `/knowledge-bases/:baseId` 详情。列表可展示 `health.status` 与 `health.warnings`，用于把后端知识库健康投影直接暴露给运营人员。
- `KnowledgeBasesPage` 列表工具栏支持关键字搜索和健康状态筛选。关键字匹配知识库名称、描述和标签；健康状态只消费后端 `health.status`，不在前端自行推断 ready/degraded/error。
- `KnowledgeBaseDetailPage`：读取知识库、文档列表和上传状态；上传入口只接受 Markdown/TXT，并按两步协议调用 provider。
- `DocumentUploadPanel`：先调用 `uploadKnowledgeFile()`，由后端代理上传到 OSS 并返回 `KnowledgeUploadResult`；再调用 `createDocumentFromUpload()` 创建 document 和 ingestion job；非终态 job 通过 `getLatestDocumentJob()` 轮询。面板必须展示 `Progress`，优先使用后端 `job.progress.percent`，后端未返回时才使用 stage fallback。
- `DocumentsPage`：通过 provider 读取文档列表并进入 `/documents/:documentId` 详情；文档 Table 必须有行内处理进度列，直接展示每个文档的入库/向量化进展。上传入口是“上传文档”按钮触发的弹窗，不在页面顶部常驻选择器；弹窗内选择目标知识库、embedding model，并提供 Markdown/TXT 拖拽上传区域，同时保留文件选择按钮作为兼容入口。上传目标必须来自 `listKnowledgeBases()` 返回的当前用户可访问知识库，不能硬编码 `kb_frontend` 这类 mock / fixture id。单知识库可默认选中，但选择控件仍在弹窗内可见；`listEmbeddingModels()` 用于展示 embedding model 选择器，创建 document 时把 `embeddingModelId` 写入 `metadata.embeddingModelId`。保留旧 `uploadDocument()` 兼容方法只用于迁移期，内部必须转到 `uploadKnowledgeFile()` + `createDocumentFromUpload()` 两步协议，不能再请求旧单步 `/knowledge-bases/:id/documents/upload` 路径；删除操作必须先通过行内确认提示，再走 `deleteDocument()`，由后端校验 membership、删除 document record 并 best-effort 清理 OSS object，页面删除后刷新列表。
- `DocumentDetailPage`：读取 `getDocument()`、`getLatestDocumentJob()` 和 `listDocumentChunks()`，展示稳定 `job.stage`、`job.progress.percent`、可重试错误和 chunks；点击重新处理或失败 job 的重试按钮时调用 `reprocessDocument()` 并刷新详情。旧 `currentStage` / `stages` timeline 只作为详细进度保留，页面主状态以稳定 ingestion job projection 为准。
- `AgentFlowPage`：读取 `listAgentFlows()` 展示智能代理流程画布。画布使用 `@xyflow/react`，但持久化时只保存 `@agent/knowledge` 的 `KnowledgeAgentFlow` contract，不保存 React Flow vendor 对象。默认节点类型包括输入、意图识别、知识检索、重排、模型生成、审批门、连接器动作和输出。运行流程调用 `/knowledge/agent-flows/:flowId/run`，返回 run id 与 trace id 后只展示稳定状态，不展示 raw provider payload。
- `OverviewPage`：ECharts 图表必须限制 tooltip 在图表容器内，并在 Ant Design `Space` / `Card` 嵌套下设置 `min-width: 0` 与 `width: 100%`，避免图表画布或 tooltip 撑出下方 card 范围。
- `UsersPage`：一级路由 `/users`，面向 Knowledge App 成员治理，展示成员、角色、状态、部门、知识库权限数、查询量和邀请入口；当前使用前端 fixture 表达页面结构，后续接入后端时必须通过稳定 provider/contract 获取用户与权限数据。
- `SettingsModelsPage`、`SettingsKeysPage`、`SettingsStoragePage`、`SettingsSecurityPage`：系统设置拆成 `/settings/models`、`/settings/keys`、`/settings/storage`、`/settings/security` 四个子路由，分别覆盖模型配置、API 密钥、存储管理和安全策略。侧边栏通过 `系统设置` 分组暴露这些入口，`/settings` 只保留轻量兼容概览。
- `ChatLabPage`：通过 `useXConversations` 管理会话列表、通过 `useXChat` + 自定义 Knowledge provider 驱动 `/chat` 流式对话；进入页面后读取 `listKnowledgeBases()` 用于输入框 `@` 候选和解析文本中的 `@知识库名`，同时读取 `listRagModelProfiles()`、`listConversations()` 和当前会话的 `listConversationMessages()`。没有后端会话时保留本地新会话空态；有后端会话时默认激活第一条并使用其 `activeModelProfileId` 作为后续发送的 `model`。页面采用 Codex 风格双栏工作台：左侧是会话与知识库入口，右侧是顶部运行栏、居中空态标题、消息线程和底部 composer，不再使用嵌套 Card demo 布局。空态主标题已去掉 `Kimi` 品牌文案，改为中性 `Knowledge` 标识；顶部不再展示模型选择下拉。左侧会话列表使用 `Conversations`，并补充仅含“重命名 / 删除”的会话管理菜单；删除当前会话时如果列表被清空，前端会立即补一个本地 `新会话` 空态。输入框使用 Ant Design X `Suggestion` 包裹普通受控 `Sender`，避免 `slotConfig` contenteditable 影响普通文字和空格输入；用户输入 `@` 时展示当前可访问知识库候选，选择候选后将当前 `@` token 从文本框移除，并在 `Sender.header` 内展示蓝色知识库标签。发送时必须从 header 标签状态和文本 `@知识库名` 解析 `metadata.mentions`，不直接发送 knowledgeBaseIds。发送请求时必须采用 OpenAI Chat Completions 风格 payload：`model`、`messages: [{ role: 'user', content }]`、`metadata.conversationId`、`metadata.mentions`、`stream: true`；没有 `@mentions` 时发送空 mentions，让后端在检索前根据问题和 knowledge base 元信息自动路由。新 Chat Lab 不能继续发送旧的顶层 `message` / `knowledgeBaseIds` payload，也不能主动发送 `metadata.knowledgeBaseIds`。`KnowledgeApiClient.streamChat()` 使用 POST SSE 读取 `KnowledgeRagStreamEvent`，x-sdk provider 将 `answer.delta` / `answer.completed` / `rag.completed` 映射为 `useXChat` 消息更新，同时把 stream events 投影到页面状态行。SDK citation 必须先转换为前端 citation DTO，再进入 Bubble footer。AI 回复必须通过 Ant Design X `Bubble.List.role.ai` 统一配置 `contentRender`、`footer` 和 `loadingRender`：正文用 Markdown 渲染，footer 使用 `Actions.Copy` 与 `Actions.Feedback`，并继续展示 route reason、retrieval diagnostics、trace link 和 citation cards；底部状态行从 SSE events 派生 planner/retrieval 摘要，展示 planner、选择理由、search mode、confidence、executed query 和 hit count，不能只显示“没检索到”。citation card 至少展示 title、quote、score 或 uri，不能退回只展示标题列表。feedback 调 `/messages/:id/feedback`。
- `ChatLabPage` 左侧同时提供 `AI 助手`实验面板，参考独立样例项目的信息结构但使用本项目 Ant Design / Ant Design X 组件体系实现，当前保留快捷问题和思考过程预览；`深度思考 / 联网搜索` 这类底部模式按钮已从前端界面移除。接入真实策略时继续通过正式 contract 传递 `metadata.reasoningMode` / `metadata.webSearchMode`，不得把第三方样例状态对象穿透到后端协议。
- `ObservabilityPage`：读取 metrics、trace list 和 trace detail；trace table 点击调用 `selectTrace()`；`/observability?traceId=<id>` 会自动打开对应 trace。页面同时兼容稳定 trace projection 的 `id/question/spans` 和历史 raw trace 的 `traceId/operation/spans.status=ok`，Table 主列优先展示 question，缺失时回退 operation。
- `EvalsPage`：读取 datasets/runs，并在至少两次 run 存在时调用 `/eval/runs/compare` 展示回归差异。

## 并发与状态

数据 hooks 使用 request id 和 mounted guard 防止 stale response 覆盖：

- `ChatLabPage` 通过 x-sdk conversation store 隔离不同会话消息，feedback 仍单独走 `/messages/:id/feedback`。
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
