# LLM Gateway

状态：current
文档类型：guide
适用范围：`apps/llm-gateway`
最后核对：2026-04-25

## 1. 当前定位

`apps/llm-gateway` 是私用 LLM 中转站，提供 OpenAI-compatible `/v1/*` API、管理员后台、虚拟 API Key、模型别名、用量记录和基础限额。

它部署为当前 monorepo 下的独立 Vercel app。Vercel Project 的 Root Directory 应选择 `apps/llm-gateway`。

## 2. 重要边界

- 只代理官方 provider API Key。
- 不代理 Codex Plus / Pro、ChatGPT Plus / Pro、网页登录态或 Cookie。
- Codex 额度只通过后台链接跳转到 `https://chatgpt.com/codex/settings/usage` 查看。
- 当前 bootstrap runtime 需要配置 `LLM_GATEWAY_BOOTSTRAP_API_KEY`，否则 `/v1/*` 路由会 fail closed。

## 3. 前端 UI 栈

管理员后台采用 `shadcn + Radix + Tailwind CSS v4 + @tabler/icons-react/lucide-react`，不使用 Ant Design。登录页与控制台页都必须消费本地 shadcn 组件，不再保留旧的 `.panel` / `.admin-login-form` 手写表单样式。`shadcn` 与 `tailwindcss` 在该 app 中按正式运行依赖放在 `dependencies`，不要放回 `devDependencies`。

- Tailwind v4 入口：`apps/llm-gateway/app/globals.css`
- Tailwind 配置：`apps/llm-gateway/tailwind.config.ts`
- PostCSS 配置：`apps/llm-gateway/postcss.config.mjs`
- shadcn 配置：`apps/llm-gateway/components.json`
- 本地组件：`apps/llm-gateway/src/components/ui/*`
- 工具函数：`apps/llm-gateway/src/lib/utils.ts`

`postcss.config.mjs` 必须保留 `@tailwindcss/postcss`，否则 Next dev/build 只会输出全局变量和第三方 CSS，不会生成 shadcn dashboard 依赖的 Tailwind utilities，首页会退回浏览器默认列表/链接/按钮样式。shadcn 官方 CLI 在 monorepo 中必须用 `-c apps/llm-gateway` 指向当前 workspace，例如：

```bash
pnpm dlx shadcn@latest add alert -c apps/llm-gateway
```

新增 UI 时优先通过 shadcn CLI 写入官方组件源码到 `src/components/ui/`，页面只消费本地组件与项目样式 token。不要在 `llm-gateway` 混入 antd，避免后台控制台出现两套交互和主题系统。

### 首页

`/` 当前直接渲染基于 shadcn 官方 `dashboard-01` 改造的大模型网关观察页，不再重定向到 `/admin`。页面入口为 `app/page.tsx`，采用 `SidebarProvider + SidebarInset + SiteHeader + GatewayCenterPage` 组合：

视觉规范按黑白 dashboard-01 收敛：页面主色为黑白中性，不再以蓝灰主色、渐变卡片或重阴影作为首屏视觉。桌面端左侧栏必须为 inset/gap 布局，真实 sidebar 面板可以 fixed，但前置 spacer 必须用 Tailwind v4 可编译的 `w-[var(--sidebar-width)]` 保持主内容不被遮挡。首页外框、sidebar、header、metric cards、chart 和 table 的主要边界统一使用浅灰细边，禁止显式 `border-black`，阴影默认关闭或弱化。

- `src/components/app-sidebar.tsx`：保留 dashboard-01 的 sidebar/header/footer 结构，但品牌和导航统一接入 `dashboard-data.ts` 的治理菜单，展示 `运行中枢`、`模型中枢`、`服务商中枢`、`凭证中枢`、`日志与成本`、`连接器与策略`、`审批中枢`、`证据中心`。
- `src/components/site-header.tsx`：顶部栏，包含 sidebar trigger 与当前中心标题。
- `src/components/gateway-center-pages.tsx`：使用 shadcn `Card`、`Badge`、`Separator`、`Table` 等本地组件渲染各中心右侧页面。页面内容映射到大模型网关已有真实后台能力：模型、服务商、虚拟凭证、日志、策略、审批与证据。

侧边栏不是删除对象；首页允许展示大模型网关的观察与管理入口，但写操作仍应进入明确后台流程。当前首页不再保留“添加模型”这类演示入口，不在首屏直接提交 provider credential、虚拟 API key 或其他敏感配置。

修改首页视觉或 sidebar 基础组件时，至少同步执行 `apps/llm-gateway/test/home-page.test.tsx`、`apps/llm-gateway/test/admin-page-auth-gate.test.tsx` 与 `apps/llm-gateway/test/app-sidebar-hydration.test.ts`。这些测试同时保护业务文案、浅灰细边、sidebar client boundary 和 Tailwind v4 CSS 变量写法。

首页仪表盘会通过现有后台接口读取真实数据，但不在首屏发起写操作。当前 `/admin` 同样挂载受 `AdminAuthGate` 保护的仪表盘外壳；真实虚拟凭证、服务商、模型与日志的 route/service 已存在，旧客户端表单实现仍保留在 `src/admin/admin-console.tsx`，但没有作为 `/admin` 首屏路由挂载。

管理员登录表单提交 `username + password`。当前管理员模型仍是单 owner 兼容实现，用户名按 owner `displayName` 匹配，bootstrap 默认用户名为 `admin`，本地 `.env.example` 只提供密码占位符，启动前必须替换为本地私有值。该管理员在应用首次登录时写入 PostgreSQL；仅启动 PostgreSQL 容器不会直接创建管理员行。账号与密码输入框初始值必须为空，并显式关闭保存凭据自动填充；密码输入框提供图标按钮切换显示和隐藏，按钮必须保持 `type="button"`，避免触发表单提交。

登录页可以参考 shadcn 示例的卡片、字段分组和输入控件结构，但不能出现 Google 登录、公开注册、找回密码或其他未接线能力。该后台只面向部署初始化后的私有管理员账号。

后台 token 使用 `accessToken + refreshToken` 长短 token。前端将 token pair 存入 `localStorage`，所有后台 API 必须通过 `adminFetch` 发起。`adminFetch` 会在 access token 距离过期不足 60 秒时主动 refresh；如果后端返回 `admin_access_token_expired`，会被动 refresh 并把原请求最多重放一次。并发 refresh 共享同一个 promise，避免多个页面同时打爆 refresh route。

### 管理员后台

`/admin` 当前复用首页仪表盘外壳，但仍由 `AdminAuthGate` 保护。页面入口为 `app/admin/page.tsx`，只负责套 `AdminAuthGate` 并渲染 `src/components/gateway-dashboard.tsx`。旧的 `src/admin/admin-console.tsx` 保留为后台管理能力的客户端实现入口，后续如需恢复真实虚拟凭证 / 服务商 / 模型表单，应挂到仪表盘内的明确管理子页或页签，不能再把 `/admin` 首屏退回旧控制台。当前挂载的管理员仪表盘不渲染 secret、API key plaintext、credential fingerprint、ciphertext 或 hash。

管理员仪表盘的信息架构继续对齐 `agent-admin` 的中文治理语义，同时保持大模型网关的真实领域能力：左侧栏优先收敛为 `运行中枢`、`模型中枢`、`服务商中枢`、`凭证中枢`、`日志与成本`、`连接器与策略`、`审批中枢`、`证据中心`，而不是保留 dashboard-01 的英文演示菜单。侧栏页脚账号区必须提供退出登录入口；退出登录只清理本地 token pair 并调用后台 auth logout route，不展示或回传任何 secret。右侧主工作区按当前选中的中心渲染 shadcn 页面组合，优先复用本地 `src/components/ui/*` 与 dashboard-01 shell，避免回退到旧 `.panel` 控制台或混入第二套 UI 框架。

`src/components/gateway-dashboard.tsx` 只在 `/admin` 受 `AdminAuthGate` 保护的后台内启用远程数据。它不会一次性预加载全部后台接口，而是随左侧栏当前中心调用 `loadAdminConsoleDataForCenter(center)`：`运行中枢` 读取 `/api/admin/dashboard`，`模型中枢` 读取 `/api/admin/models`，`服务商中枢` 读取 `/api/admin/providers`，`凭证中枢` 读取 `/api/admin/keys`，`日志与成本` 读取 `/api/admin/dashboard` 与 `/api/admin/logs`。`/` 首页不触发受保护的 admin API 请求，避免未登录或未配置 admin secret 时把公共首页打成 503 噪声。

`src/components/gateway-center-pages.tsx` 只消费这些真实接口返回的数据：`运行中枢` 使用 dashboard summary 与排行，`模型中枢` 使用模型列表，`服务商中枢` 使用服务商与凭据摘要，`凭证中枢` 使用虚拟凭证列表，`日志与成本` 使用日志与成本聚合。`模型中枢`、`服务商中枢` 与 `凭证中枢` 的创建入口必须是按钮触发的弹窗，不在页面常驻展开表单；每一行都提供编辑弹窗和删除确认弹窗。创建或编辑提交成功后弹窗必须自动关闭，并通过全局 toast 给出成功反馈；提交失败时弹窗保持打开，错误同时进入全局 toast 与页面错误条，便于继续修正表单。删除动作是软失效：调用凭证删除会置为 `revoked`，服务商删除会置为 `disabled`，模型删除会置为 `enabled=false`，数据库记录仍保留用于审计与历史日志关联。当前没有专用后台接口的 `审批中枢`、`证据中心` 与 `连接器与策略` 不展示静态伪数据，只显示“待接入 API”状态。

后台数据只通过 `adminFetch` 访问：

- `GET /api/admin/keys`、`POST /api/admin/keys`、`POST /api/admin/keys/:id/revoke`
- `GET /api/admin/providers`、`POST /api/admin/providers`、`PATCH /api/admin/providers/:id`、`DELETE /api/admin/providers/:id`
- `GET /api/admin/models`、`POST /api/admin/models`
- `GET /api/admin/dashboard`、`GET /api/admin/logs`

未挂载的 `AdminConsole` 客户端表单覆盖虚拟凭证、服务商、模型与日志管理能力；如果重新挂载，必须保持当前 secret 边界：虚拟凭证创建响应里的 `plaintext` 只进入一次性 reveal 区域，用户点击隐藏后不再渲染；列表只展示脱敏摘要。服务商管理接口不返回 `credentials[]` 嵌套数组，而是在 provider 行上扁平返回当前展示用凭据摘要字段，例如 `credentialId`、`credentialKeyPrefix`、`credentialKeyVersion`、`credentialStatus`、`credentialCreatedAt` 与 `credentialRotatedAt`；UI 只展示 `credentialStatus` 与 `credentialKeyPrefix`，不得展示 secret 明文、密文或 fingerprint。模型表单覆盖 `alias`、`providerId`、`providerModel`、`contextWindow`、`capabilities`、输入/输出价格、`fallbackAliases`、`adminOnly` 与 `enabled`。

日志页签使用 `src/admin/admin-logs-section.tsx` 渲染真实后台数据。`loadAdminConsoleData()` 会并行读取 dashboard rollup 与 request logs：dashboard 展示请求数、token、估算成本、失败率，以及模型 / 凭证 / 服务商排行；日志表格展示最近请求的 key、model、provider、status、token、cost、latency 与脱敏错误信息。前端只消费 `src/contracts/admin-logs.ts` 定义的稳定 schema，不展示 provider secret、虚拟 key hash、ciphertext、fingerprint 或包含 secret-like 片段的错误明文。

## 4. Vercel 部署

在 Vercel 中导入当前仓库，Root Directory 选择 `apps/llm-gateway`。配置数据库、Redis、provider key、session secret 和 key hashing secret 后，再逐步替换当前内存 bootstrap runtime。

阶段 7 Preview 验收清单统一维护在 [llm-gateway-vercel-preview.md](/docs/integration/llm-gateway-vercel-preview.md)。涉及 `DATABASE_URL`、Upstash、Admin auth、provider 后台录入/注入或 `/api/v1` smoke 时，先按该清单核对，再更新本文档中的前端入口说明。

Preview 半自动 smoke 入口：

```bash
PREVIEW_BASE_URL=https://<preview-domain> \
LLM_GATEWAY_PREVIEW_API_KEY=<virtual-api-key> \
LLM_GATEWAY_PREVIEW_ADMIN_PASSWORD=<preview-admin-password> \
pnpm --dir apps/llm-gateway preview:smoke
```

该入口覆盖 `/api/v1/models`、`/api/v1/key`、`/api/v1/chat/completions` 和 admin auth smoke；设置 `LLM_GATEWAY_PREVIEW_STREAM=1` 可追加 stream smoke。运行前仍需在后台人工完成 provider credential 录入、model alias 启用和虚拟 API key 创建，脚本不会打印 API key、admin token 或 admin password。

生产环境必须配置 Upstash Redis：

```text
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

当前 runtime 在 production 缺少 Upstash 配置时会 fail closed，不会静默使用 memory limiter。OpenAI adapter 已支持真实 Chat Completions 调用，但 provider key 仍应在后续 Provider 管理后台中加密入库；`.env` 中的 provider key 只作为 bootstrap seed。

API Key 管理的稳定 contract 已收敛到 `src/contracts/admin-api-key.ts`，并由 `src/keys/api-key-admin-service.ts` 负责一次性 plaintext 响应、权限归一化和状态机校验。`revoked` 是终态，不能重新启用；后台列表和详情不能返回 `keyHash` 或 plaintext。

Admin API Key 路由当前提供最小管理闭环：

- `GET /api/admin/keys`：需要 `Authorization: Bearer <admin access token>`，返回 `ApiKeyAdminListResponseSchema`，只包含 redacted summary。
- `POST /api/admin/keys`：需要 admin access token，按 `CreateApiKeyRequestSchema` 创建虚拟 API Key，响应 `CreateApiKeyResponseSchema`；`plaintext` 只在这次创建响应中出现。
- `PATCH /api/admin/keys/:id`：需要 admin access token，按 `UpdateApiKeyRequestSchema` 更新 `name`、limits、`expiresAt`、`models` 与 `allowAllModels`；`revoked` key 视为终态并返回错误。
- `DELETE /api/admin/keys/:id`：需要 admin access token，等价于软删除，会将 key 置为 `revoked` 并保留记录。
- `POST /api/admin/keys/:id/revoke`：需要 admin access token，将 `active` 或 `disabled` key 置为 `revoked` 并写入 `revokedAt`；响应不得包含 `keyHash` 或 plaintext。

路由服务入口在 `src/admin/admin-api-key-routes.ts`。该文件只暴露窄 `AdminApiKeyStore` 注入点；`DATABASE_URL` 存在时默认使用 Postgres store，不会静默回落到内存实现。`GET /api/admin/keys`、`PATCH /api/admin/keys/:id` 与 `POST /api/admin/keys/:id/revoke` 只需要 admin token 与数据库连接，不需要 `LLM_GATEWAY_KEY_HASH_SECRET`；只有创建新虚拟凭证时才必须配置 `LLM_GATEWAY_KEY_HASH_SECRET`（兼容读取历史 `LLM_GATEWAY_API_KEY_SECRET`），否则返回 `api_key_secret_not_configured`。route handler 不直接包含存储细节。

Admin Provider/Model 路由当前提供最小管理闭环：

- `GET /api/admin/providers`：需要 `Authorization: Bearer <admin access token>`，返回 provider 列表与扁平的 redacted credential 状态摘要；响应不能包含 provider secret 的 plaintext、ciphertext 或可解密 payload，也不能把凭据作为 `credentials[]` 嵌套数组返回。
- `POST /api/admin/providers`：需要 admin access token，按 `UpsertProviderWithCredentialRequestSchema` 创建 provider，当前 route service 使用 `provider_<name slug>` 作为内存实现 ID。请求可以携带可选 `plaintextApiKey`；携带时同一次请求会创建 credential，并在响应 provider 行上扁平返回当前凭据摘要字段，前端创建弹窗不再额外调用 `/credentials`。
- `PATCH /api/admin/providers/:id`：需要 admin access token，按 `UpsertProviderWithCredentialRequestSchema` 更新 provider 基础信息。请求可以携带可选 `plaintextApiKey`；留空则保留已有凭据，填写则在同一个 provider 资源接口内轮换为新 active credential，并在响应 provider 行上扁平返回当前凭据摘要字段。
- `DELETE /api/admin/providers/:id`：需要 admin access token，软删除 provider，将其置为 `disabled` 并保留记录；响应会返回扁平 provider 行与当前凭据摘要字段，便于前端在表格中继续保留审计摘要。
- `POST /api/admin/providers/:id/credentials`：兼容旧客户端和独立补录场景；需要 admin access token，按 `CreateProviderCredentialRequestSchema` 接收 `plaintextApiKey`，通过 `ProviderSecretVault` 加密后保存；响应只返回 `CreateProviderCredentialResponseSchema` 的 redacted credential。当前后台创建/编辑表单不再调用该入口。
- `POST /api/admin/providers/:id/credentials/rotate`：兼容旧客户端和显式轮换场景；需要 admin access token，按 `RotateProviderCredentialRequestSchema` 创建新 active credential，并将旧 active credential 标记为 `rotated`。当前后台编辑表单优先通过 `PATCH /api/admin/providers/:id` 携带 `plaintextApiKey` 完成轮换。
- `GET /api/admin/models`：需要 admin access token，返回 `GatewayModelAdminRecord[]`。
- `POST /api/admin/models`：需要 admin access token，按 `normalizeGatewayModelAdminUpsert` + `UpsertGatewayModelRequestSchema` 创建模型。`providerId` 优先按真实 provider id 查找，例如 `provider_minimax`；如果传入 `minimax` 这类 slug，route 会尝试解析为 `provider_minimax`。两者都不存在时返回 `admin_model_provider_not_found`，不再让 Postgres 外键错误退化成泛化 `admin_provider_model_request_failed`。
- `PATCH /api/admin/models/:id`：需要 admin access token，按同一模型 contract 更新模型并保留原 `createdAt`；`providerId` 解析规则与创建模型一致。
- `DELETE /api/admin/models/:id`：需要 admin access token，软删除模型，将其置为 `enabled=false` 并保留记录。

Provider/Model route service 入口在 `src/admin/admin-provider-model-routes.ts`，只暴露窄 `AdminProviderModelStore` 注入点；`DATABASE_URL` 存在时默认使用 `src/repositories/postgres-admin-provider-model-store.ts` 写入 `providers`、`provider_credentials` 与 `gateway_models`，否则回落内存实现。只读接口和 provider/model 基础写入不要求 `LLM_GATEWAY_PROVIDER_SECRET_KEY`；只有请求携带 `plaintextApiKey` 创建或轮换 provider credential 时才会创建 `ProviderSecretVault` 并要求该 secret。credential 明文只进入 `ProviderSecretVault.encrypt()`，数据库保存加密 payload；provider 资源响应只返回扁平 redacted credential 摘要字段。没有配置 `LLM_GATEWAY_PROVIDER_SECRET_KEY` 时，不填写 provider 密钥仍可创建/编辑 provider；一旦填写密钥会返回 `admin_provider_secret_not_configured`，并且 route 会在保存 provider 前失败，避免创建出没有凭据的半成品记录。

Admin Logs/Dashboard 路由当前提供最小运营闭环：

- `GET /api/admin/logs`：需要 admin access token，按 `AdminRequestLogQuerySchema` 支持 `keyId`、`model`、`provider`、`status` 与 `limit` 查询，返回 `AdminRequestLogListResponseSchema`。
- `GET /api/admin/dashboard`：需要 admin access token，复用同一组过滤参数，返回 `AdminDashboardResponseSchema`，包含 summary 与 top models / keys / providers rollup。

route service 入口在 `src/admin/admin-logs-routes.ts`，只暴露窄 `AdminLogsStore` 注入点；`DATABASE_URL` 存在时默认使用 `src/repositories/postgres-admin-logs-store.ts` 查询 `request_logs`，否则回落内存实现。Postgres logs store 会在查询前执行 `create table if not exists request_logs`，避免新环境只打开后台日志页时因为日志表尚未由 gateway runtime 创建而返回泛化 500。所有 route/UI 响应必须经过 redaction：provider secret、API key、token 等 secret-like 错误文本一律显示为 `[redacted]`，避免把上游错误中的敏感字段带到后台页面。streaming 已经输出 chunk 后再失败时，`src/gateway/streaming-accounting.ts` 在写入 request log 前也必须先脱敏 `errorMessage`，不能只依赖后台查询时二次 redaction。

`/v1/*` 由 `vercel.json` rewrite 到 `/api/v1/*`，因此 OpenAI-compatible 客户端只需要配置：

```text
base_url=https://<your-domain>/v1
api_key=<LLM_GATEWAY_BOOTSTRAP_API_KEY 或后续后台创建的虚拟 Key>
```

## 5. 本地验证

`.next` 是 Next build/dev 生成目录，里面会出现 Turbopack 生成的 chunk、manifest 与 route type 文件；这些文件不属于源码、文档或 fixture。巡检行数、格式化和 lint 时必须继续排除 `.next`，当前根级 `.gitignore` 忽略 `.next`，`apps/llm-gateway` 的 `lint` 脚本也显式带 `--ignore-pattern .next`。

本地启动使用固定端口 `3100`：

```bash
pnpm --dir apps/llm-gateway dev
```

启动后访问 `http://localhost:3100`，后台入口为 `http://localhost:3100/admin`。

运行：

```bash
pnpm --dir apps/llm-gateway typecheck
pnpm exec vitest run --config vitest.config.js apps/llm-gateway/test
pnpm --dir apps/llm-gateway build
```
