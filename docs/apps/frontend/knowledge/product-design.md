# Knowledge App Product Design

状态：current
文档类型：reference
适用范围：`apps/frontend/knowledge`
最后核对：2026-05-04

## Positioning

`apps/frontend/knowledge` 是独立 Knowledge 前端项目，当前 UI 定位为 **RAG Ops 控制台**，面向知识库运营、RAG 体验验证、引用审查、观测排障与评测闭环。它不是 marketing landing page，不做营销式首页；也不是 `agent-chat` 或 `agent-admin` 的重复产品。

产品设计属性：product（因 docs checker 当前不支持 product 作为顶层文档类型，顶层使用 reference）

- 不重复 `agent-chat`：Knowledge App 的 Chat Lab 用于验证指定知识库的检索、回答、引用、反馈和 trace，不承载 OpenClaw 作战面、审批恢复、ThoughtChain 或多 Agent 执行体验。
- 不重复 `agent-admin`：Knowledge App 的观测和评测只围绕知识库问答质量、检索表现、文档处理和 RAG 链路，不承载全局 Runtime Center、Approvals Center、Skill Lab 或治理后台。
- 默认 API-first：前端消费 `auth-server` 与 `knowledge-server` 稳定接口和 mock client，不直接运行 RAG internals，不从应用层直连 `packages/knowledge/src`。
- MVP 优先打通横向闭环：登录、知识库、文档、对话、引用、反馈、trace、评测数据集、评测运行和结果指标先能连起来，再扩展高级治理。

## Routes

```text
/login
/app/overview
/app/knowledge-bases
/app/knowledge-bases/:id
/app/documents/:id
/app/chat-lab
/app/observability/traces
/app/observability/traces/:id
/app/evals/datasets
/app/evals/runs
/app/evals/runs/:id
/app/settings
```

所有 `/app/*` 路由必须经过登录态保护。未登录访问时跳转 `/login`；已登录访问 `/login` 时跳转 `/app/overview`。鉴权刷新失败或 refresh token 过期时清理本地 token 并回到 `/login`。

## Navigation

主导航面向 Knowledge App 的工作流，而不是营销信息架构：

- 总览：`/app/overview`
- 知识库：`/app/knowledge-bases`
- 对话实验室：`/app/chat-lab`
- 观测中心：`/app/observability/traces`
- 评测中心：`/app/evals/datasets`、`/app/evals/runs`
- 设置：`/app/settings`

文档详情、trace 详情和评测运行详情属于上下文详情页，不作为一级导航常驻入口。知识库详情页内可提供二级 tabs：概览、文档、对话、评测、观测、配置、权限；MVP 可以先渲染完整 tab 外壳，其中概览、文档、对话、评测和观测按权限展示真实数据面板，配置和权限先展示受限空态。

## MVP User Flow

面向 owner/admin/maintainer 的完整运营闭环：

```text
login
-> create knowledge base
-> upload markdown or txt
-> document processing reaches ready
-> ask a question in Chat Lab
-> answer shows citations
-> open trace detail
-> submit negative feedback
-> add message to eval dataset
-> create eval run
-> inspect eval results
```

MVP 的完成标准是这条路径能用 mock 数据和后端 stub API 证明端到端信息结构成立。evaluator 的 MVP 闭环从 Chat Lab 或 Eval Center 开始，不包含 dashboard/observability；viewer 的 MVP 闭环限于 allowed 知识库、文档、Chat Lab 和 feedback。纵向增强如批量权限、真实向量库适配、复杂过滤、告警订阅和高级评测分析，必须建立在这些路径已可运行的基础上。

## Auth Behavior

Knowledge App 使用 JWT 双 token：

- `accessToken`：用于普通 API 请求，短期有效。
- `refreshToken`：用于刷新 access token，长期有效但仍有过期时间。
- 本地存储：当前认证存储只保存 access token、refresh token 和各自过期时间；当前用户摘要通过 `/auth/me` 或后续 app shell 状态维护，不和 token 写进同一份本地记录。键名必须带 knowledge 前缀，避免与其他前端应用冲突。
- 自动刷新：请求前如果 access token 接近过期，先刷新再发业务请求。
- 401 恢复：业务请求返回 `401 auth_token_expired` 时触发一次刷新，并对原请求最多重试一次。
- 并发控制：多个请求同时触发刷新时共享同一个 refresh promise，避免并发刷新造成 token 版本抖动。
- 失败边界：refresh 失败、refresh token 缺失或过期时，底层 `AuthClient` 清理本地 token 并触发 `onAuthLost`；路由层后续负责跳转 `/login` 并保留用户原目标路径用于重新登录后恢复。

当前前端实现入口：

- `apps/frontend/knowledge/src/api/token-storage.ts`：负责 `localStorage` 中的 knowledge 前缀 token key、绝对过期时间读写、退出登录清理、access token 提前刷新判断和 refresh token 过期判断。
- `apps/frontend/knowledge/src/api/auth-client.ts`：负责 `/auth/login`、`/auth/refresh`、`/auth/me` 请求封装；登录成功后写入 token；登出只删除本地 token；主动刷新使用单个共享 refresh promise。
- `apps/frontend/knowledge/src/api/knowledge-api-client.ts`：负责 `knowledge-server` 业务 API 请求的 Bearer token 注入；业务接口返回 `401 auth_token_expired` 或 `401 access_token_expired` 时调用共享 refresh，并对原请求最多重试一次。
- `apps/frontend/knowledge/src/api/mock-data.ts` 与 `mock-knowledge-api-client.ts`：当前横向 MVP 页面使用的本地 fixture / mock client；真实后端联调时应替换为 `KnowledgeApiClient`，不要让页面直接读取后端或 SDK runtime。
- `apps/frontend/knowledge/src/pages/auth/*`：当前登录门通过 `AuthProvider -> AuthClient.login() -> /auth/login` 走真实双 token 登录链路；退出登录只删除本地 token 并切回未登录状态。
- `apps/frontend/knowledge/src/pages/*`：当前已落地 RAG 总览、知识空间、摄取管线、Agent Flow、检索实验室、Trace 观测、评测回归、访问治理和系统策略页面，第一屏是可操作工作台，不是 landing page。
- `apps/frontend/knowledge/src/pages/shared/ui.tsx`：提供 `RagOpsPage`、`MetricStrip`、`LifecycleRail`、`StatusPill` 和 `InsightList`，作为 RAG Ops 页面统一外壳。
- `apps/frontend/knowledge/src/styles/knowledge-rag-ops.css`：承载 RAG Ops 重设计样式；旧的 `knowledge-pro.css` 保留壳层、异常页和历史组件样式，不再继续堆新增页面视觉。
- `apps/frontend/knowledge/test/token-storage.test.ts` 与 `apps/frontend/knowledge/test/auth-client.test.ts`：固定双 token 存储、并发刷新复用和 logout 本地清理语义。
- `apps/frontend/knowledge/test/knowledge-api-client.test.ts`：固定业务请求 access token 过期后的 refresh/retry、不相关 401 不刷新、以及最多重试一次的边界。
- `apps/frontend/knowledge/test/app-render.test.tsx`：固定未登录时显示登录门、已登录时显示工作台导航。

权限边界在 MVP 中先以用户 `roles` 与 `permissions` 驱动 UI 可用态，后端 API contract 始终是权限事实来源：

- owner/admin：可执行 MVP 全部动作。
- maintainer：创建知识库、上传文档、重处理文档、聊天、反馈、查看 dashboard/trace、启动评测。
- evaluator：查看知识库、使用 Chat Lab、提交反馈、管理评测数据集和运行；不能访问 dashboard overview、observability metrics/traces/detail。
- viewer：查看 allowed 知识库和文档、使用 Chat Lab、提交反馈；不能上传、编辑、查看 dashboard overview、查看 observability 或启动评测。

## MVP Pages

### Login

核心数据：

- 用户邮箱、密码、登录中状态、登录错误、登录后目标路径。

主要操作：

- 登录。
- 在已登录时自动进入 `/app/overview`。

状态要求：

- 加载态：登录按钮显示处理中并禁用重复提交。
- 错误态：展示无效凭据、网络失败或服务不可用的简短错误。
- 空态：表单默认空值；页面展示 RAG 企业知识库品牌介绍和能力说明，但不得预填账号或密码。
- 登录方式：当前账号密码是唯一已接功能的主登录方式；页面额外展示但暂不接功能的入口包括记住我、忘记密码、首次使用联系管理员、其他登录方式分隔标题、钉钉登录、飞书登录和企业微信登录。
- 不展示项：不展示账号/短信登录方式切换、短信验证码、图形验证码、SSO 或中英文切换入口。
- 登录边界：登录成功后写入双 token 和用户摘要；失败不得写入半截 token。

### RAG Overview

核心数据：

- 知识空间数量、ready 文档数、failed 文档数、检索质量、引用覆盖、负反馈率、P95/P99、最新评测分、活跃告警数。
- 最近失败任务、近期低分 trace、近期评测运行、Top missing knowledge questions。

主要操作：

- 创建知识库。
- 进入失败文档、低分 trace、评测运行详情。
- 从 missing knowledge 问题跳转 Chat Lab 或加入评测数据集。

状态要求：

- 加载态：指标卡和列表使用骨架屏。
- 空态：没有知识库时引导创建知识库；没有 trace 或 eval 时展示轻量空态。
- 错误态：指标区可局部失败，保留其他可用数据并允许重试。
- 权限边界：`GET /dashboard/overview` 仅 owner/admin/maintainer 可访问。viewer 和 evaluator 访问 `/app/overview` 时显示受限态或引导跳转到 `/app/chat-lab`、`/app/evals/datasets` 等其有权限的页面，不请求 dashboard endpoint，也不展示 overview 操作入口。

### Knowledge Spaces

核心数据：

- 知识库列表、状态、文档数、chunk 数、最新评测分、最新 trace 时间、标签、更新时间、分页信息。

主要操作：

- 搜索、按状态或标签过滤、分页。
- 创建知识库。
- 进入知识库详情。

状态要求：

- 加载态：表格行骨架。
- 空态：无知识库时展示创建入口；搜索无结果时展示清除筛选。
- 错误态：列表加载失败时提供重试。
- 权限边界：viewer/evaluator 只能查看；owner/admin/maintainer 可创建和编辑基础信息。
- 查询边界：当前 `/knowledge-bases` 只接受 `PageQuery`。MVP 的搜索、状态过滤和标签过滤只在当前页或 mock data 上做 client-side filter；如需后端 status/tags/search query，必须作为 future contract extension 先更新 API contract。

### Knowledge Base Detail

核心数据：

- 知识库摘要、处理状态、文档列表、最近问题、最近 trace、最近评测运行、配置摘要、权限摘要。

主要操作：

- 上传 markdown 或 txt 文档。
- 打开文档详情。
- 跳转 Chat Lab 并预选当前知识库。
- 查看相关 trace 和评测运行。

状态要求：

- 加载态：摘要和 tab 内容分别加载。
- 空态：无文档时引导上传；无 trace 或 eval 时保留 tab 但展示空态。
- 错误态：详情不存在时展示 not found；局部面板失败可单独重试。
- 权限边界：上传、重处理和配置入口只对 owner/admin/maintainer 开放。viewer/evaluator 可看 allowed 知识库摘要和文档列表，但不能看到需要写权限的操作按钮。

### Document Detail

核心数据：

- 文档元数据、处理 job timeline、最新错误、chunk 表、引用命中摘要、上传者和更新时间。

主要操作：

- 重新处理、重新 embedding、禁用文档。
- 查看 chunk 内容和来源位置。
- 从失败 job 跳转错误详情或重试。

状态要求：

- 加载态：timeline 和 chunk 表独立骨架。
- 空态：处理未完成时 chunk 表展示等待状态。
- 错误态：处理失败展示可读错误、失败阶段和可重试动作。
- 权限边界：viewer/evaluator 可以查看 allowed 文档基础信息和 chunk；`GET /documents/:id/jobs` 仅 owner/admin/maintainer 可访问，所以 viewer/evaluator 的 job timeline 显示受限态或隐藏，不发起 jobs 请求。reprocess、reembed 和 disable 也只对 owner/admin/maintainer 开放。

### Retrieval Lab

核心数据：

- 知识空间选择器、聊天线程、问题、回答、引用、反馈、trace id、token、延迟摘要和 assistant config 中的检索步骤标签。

主要操作：

- 选择一个或多个知识库。
- 提问。
- 查看引用和来源文档。
- 提交正向或负向反馈。
- 将问答加入评测数据集。
- owner/admin/maintainer 可打开 Trace side panel 或进入 trace 详情页；viewer/evaluator 只能查看当前回答返回的 citation、answer 和有限延迟摘要，不能请求 trace detail。

状态要求：

- 加载态：发送中显示回答生成状态，引用区可在回答后补齐。
- 空态：未选择知识库时禁止发送并提示先选择；无线程时展示输入框和最近问题建议。
- 错误态：回答失败保留用户问题，展示 retry；引用解析失败不隐藏回答。
- 权限边界：feedback 按 API contract 开放给 owner/admin/maintainer/evaluator/viewer，只要用户具备对应 API 权限即可提交正向或负向反馈。加入评测数据集只对 owner/admin/maintainer/evaluator 开放。若未来产品要限制 viewer 反馈，必须先作为非 MVP 产品限制写入 contract 或新增前端策略说明，不能在 MVP 中覆盖当前 API 权限。

### Observability Trace List

观测中心必须是 Knowledge App 的一等模块。MVP 至少覆盖 trace 列表、trace 详情，以及性能、业务、调试三个维度。

核心数据：

- Trace 列表：问题、知识库、状态、延迟、命中数、引用数、反馈、错误码、创建时间、用户或会话摘要。
- 性能维度：平均延迟、P95/P99、检索耗时、生成耗时、token usage。
- 业务维度：负反馈率、missing knowledge、低引用回答、知识库覆盖、问题主题。
- 调试维度：span 状态、retrieval snapshot、rerank 结果、sanitized errors、request id。

主要操作：

- 按状态、知识库和时间范围过滤；feedback 和错误码过滤仅作为当前页/mock data 的 client-side 辅助视图。
- 打开 trace 详情。
- 从 trace 加入评测数据集；该入口只对同时具备 trace 读取和 eval 写入权限的 owner/admin/maintainer 展示，evaluator 可从 Chat Lab 添加评测样本。

状态要求：

- 加载态：过滤栏先可见，列表骨架加载。
- 空态：无 trace 时说明需要先在 Chat Lab 提问；筛选无结果时允许清除筛选。
- 错误态：列表失败展示重试，过滤条件保留。
- 权限边界：`GET /observability/metrics`、`GET /observability/traces` 和 `GET /observability/traces/:id` 仅 owner/admin/maintainer 可访问。viewer/evaluator 进入观测页时显示受限态或 403 copy，不能发起 trace detail 请求；最多只能在 Chat Lab 当前回答上下文中查看 chat response 已返回的有限 citation/answer 信息。
- 查询边界：当前 `/observability/traces` query 只支持 `PageQuery`、`knowledgeBaseId`、`status`、`from`、`to`。MVP 不要求后端支持 feedback/errorCode filters；这两类过滤只允许在当前页/mock data client-side filter，后端能力必须作为 future contract extension 先更新 API contract。

### Observability Trace Detail

核心数据：

- 问题、回答、引用、feedback、span timeline、retrieval snapshot、chunk 命中、token usage、latency breakdown、sanitized errors、request metadata。

主要操作：

- 复制 trace id。
- 打开来源文档或 chunk。
- 加入评测数据集。
- 从失败 span 跳转相关错误说明。

状态要求：

- 加载态：基础摘要优先，span 和 retrieval 面板可延迟加载。
- 空态：缺少引用或反馈时展示明确的空标签。
- 错误态：trace 不存在展示 not found；敏感字段不可展示 raw vendor payload。
- 权限边界：trace detail 仅 owner/admin/maintainer 可访问。viewer/evaluator 不应请求 `/observability/traces/:id`，也不展示 trace 摘要或调试信息；他们只能看到 Chat Lab 响应中已经返回的有限 answer/citation 信息。

### Eval Datasets

评测中心必须是 Knowledge App 的一等模块。MVP 至少包括数据集、运行和结果指标。

核心数据：

- 数据集列表、描述、样本数量、关联知识库、更新时间、创建者、最近运行摘要。

主要操作：

- 创建数据集。
- 从 Chat Lab 或 trace 添加样本。
- 查看数据集样本摘要。
- 从数据集启动评测运行。

状态要求：

- 加载态：列表骨架。
- 空态：无数据集时引导从负反馈或 trace 创建第一批样本。
- 错误态：创建失败保留输入并提示原因。
- 权限边界：`/eval/datasets` 只对 owner/admin/maintainer/evaluator 开放。viewer 进入评测页显示受限态或 403 copy，不请求 eval endpoints；evaluator 和 maintainer 可创建和编辑数据集。

### Eval Runs

核心数据：

- 评测运行列表、状态、关联数据集、关联知识库、开始时间、结束时间、进度、总分、指标摘要、失败原因。

主要操作：

- 启动运行。
- 按状态、数据集、知识库和时间范围过滤。
- 打开运行详情。

状态要求：

- 加载态：列表和运行按钮分别呈现状态。
- 空态：无运行时引导选择数据集启动。
- 错误态：启动失败显示可读错误；运行失败在列表显示失败原因摘要。
- 权限边界：`/eval/runs` 只对 owner/admin/maintainer/evaluator 开放。viewer 进入评测运行页显示受限态或 403 copy，不请求 eval endpoints；evaluator 和 maintainer 可启动运行。

### Eval Run Detail

核心数据：

- 运行进度、`EvalReportSummary`（`totalScore`、`retrievalScore`、`generationScore`、`citationScore`、`regressionDelta`）、case results、case-level `retrievalMetrics`、`generationMetrics`、`judgeResult`、失败样本和低分原因。

主要操作：

- 查看 case 明细。
- 按指标筛选低分样本。
- owner/admin/maintainer 可打开对应 trace；evaluator 只能查看 eval case 中已经返回的受控摘要，trace link 必须隐藏或禁用并展示权限说明。
- 将失败问题回流到 missing knowledge 或数据集维护队列。

状态要求：

- 加载态：进度先展示，case results 可分页加载。
- 空态：运行排队或刚开始时展示等待状态。
- 错误态：运行失败展示失败阶段、错误码和可重试建议。
- 权限边界：结果可读范围按数据集和知识库权限裁剪，且只对 owner/admin/maintainer/evaluator 开放。viewer 不能请求 eval run detail 或 results endpoints。groundedness、answer correctness、latency、cost/token 等命名指标不属于当前 contract 稳定字段，只能作为 future metric extension 先扩展 contract 后再进入 UI。

### Settings

核心数据：

- 当前用户、`roles`、权限、API base URL、mock API 状态、token 过期时间、默认知识库选择偏好。

主要操作：

- 退出登录。
- 切换 mock/real API 的可见说明。
- 查看当前权限。

状态要求：

- 加载态：用户摘要骨架。
- 空态：权限为空时展示受限说明。
- 错误态：用户信息加载失败时允许重新登录。
- 登录边界：退出登录必须清理 Knowledge App 的 localStorage token，不触碰其他应用存储。

## Mock-first Development

前端支持 `VITE_USE_MOCK_API=true`。Mock-first 不是临时演示代码，而是 MVP 横向闭环的开发方式：

- mock client 必须实现与真实 API client 同形的方法，不让页面知道当前是 mock 还是真实后端。
- mock data 必须覆盖 auth、dashboard、knowledge bases、documents、chunks、chat、traces、eval datasets、eval runs 和 settings。
- mock 场景必须包含 ready、processing、failed、empty、unauthorized、permission denied、not found 和 network failure 等基础状态。
- 页面先基于 mock 完成数据结构、状态和交互，再接入后端 stub API。
- 后续真实 API 接入时，页面应只替换 client provider，不重写页面状态结构。

## Development Boundaries

- 页面组件只消费 Knowledge API client 和本地视图模型，不直接消费 RAG runtime、vector store、LLM SDK 或 `packages/knowledge/src`。
- 类型优先来自稳定 API contract 或 `apps/frontend/knowledge/src/types/api.ts`，不要在页面内重复发明 DTO。
- 观测中心不展示 raw vendor payload；错误、request metadata 和 span detail 必须先经过后端或 SDK 边界脱敏。
- 评测结果必须保留当前 contract 中的 `EvalReportSummary`、case id、可访问的 trace id、`retrievalMetrics`、`generationMetrics` 和 `judgeResult.score` 映射；generic metric name/threshold 结构属于 future contract extension。
- 所有列表页默认支持分页语义；即使 MVP mock 数据较少，也不要把列表实现成只能渲染固定数组的死结构。
