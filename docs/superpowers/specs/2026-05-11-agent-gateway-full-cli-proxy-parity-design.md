# Agent Gateway Full CLIProxyAPI Parity Design

状态：draft  
文档类型：spec  
适用范围：`apps/frontend/agent-gateway`、`apps/backend/agent-server/src/domains/agent-gateway`、`packages/core/src/contracts/agent-gateway`、`docs/contracts/api/agent-gateway.md`  
最后核对：2026-05-11  
创建日期：2026-05-11

## 背景

用户目标是让 `apps/frontend/agent-gateway` 直接吸收 `/Users/dev/Desktop/Cli-Proxy-API-Management-Center` 的页面与功能，并把 `https://github.com/router-for-me/CLIProxyAPI` 的 Go 后端能力迁入本仓库 TypeScript 后端。目标不是新增一个外部 CLIProxyAPI 连接壳，而是把 Agent Gateway 收敛为本仓库内建的 CLIProxyAPI-compatible gateway。

当前仓库已经具备一版 Agent Gateway 基础：

- 独立前端 `apps/frontend/agent-gateway`。
- Identity 登录、Gateway clients、client API keys、client quota、usage、logs。
- `@agent/core` 下 schema-first Agent Gateway contract。
- `agent-server` 内的 `agent-gateway` domain、management adapter、migration、OAuth、quota、runtime-engine 目录。
- OpenAI-compatible `/v1/models` 与 `/v1/chat/completions` 基础 runtime。
- CPAMC 管理页的一部分视觉与功能复刻。

因此本设计采用“分层完整复刻”：全量目标按 CLIProxyAPI parity 定义，但实施按 UI、Contract、Backend Management、Runtime、Ops 分层推进，避免把 Go 项目和参考前端一次性硬搬进本仓库后冲破既有边界。

参考来源：

- CLIProxyAPI repository: `https://github.com/router-for-me/CLIProxyAPI`
- CLIProxyAPI `config.example.yaml`: `https://raw.githubusercontent.com/router-for-me/CLIProxyAPI/main/config.example.yaml`
- CLIProxyAPI SDK usage: `https://raw.githubusercontent.com/router-for-me/CLIProxyAPI/main/docs/sdk-usage.md`
- CLIProxyAPI SDK advanced: `https://raw.githubusercontent.com/router-for-me/CLIProxyAPI/main/docs/sdk-advanced.md`
- CPAMC local source: `/Users/dev/Desktop/Cli-Proxy-API-Management-Center`
- Current contract: `docs/contracts/api/agent-gateway.md`
- Current frontend docs: `docs/apps/frontend/agent-gateway/README.md`

## 已确认决策

1. 采用分层完整复刻，而不是只做前端或只做 runtime。
2. 后端采用 TypeScript 主体加可替换 executor adapter。管理、鉴权、路由、quota、日志、accounting 和稳定 contract 由 TS 主链负责；provider 调用首期可通过 CLI、HTTP 或 process adapter 承接，后续逐个替换为纯 TS executor。
3. 前端完整吸收 CPAMC 功能，但不原样保留 CPAMC 产品语义。页面、路由、交互和视觉参考 CPAMC，信息架构、文案、登录、secret projection、调用方管理和迁移导入改为 Agent Gateway 语义。

## 目标

1. 将 `apps/frontend/agent-gateway` 建成 Agent Gateway Management Center，覆盖 CPAMC 的核心管理能力：Dashboard、Config、API keys、AI Providers、provider edit/model pages、Auth Files、OAuth、Quota、Logs、System。
2. 保留并强化本项目已有能力：Runtime Engine、Gateway Clients、Usage Stats、Migration Import、Identity 登录、client quota、runtime health。
3. 在 `agent-server` 内实现 CLIProxyAPI-compatible runtime，不以外部 CLIProxyAPI 作为默认运行时。
4. 通过 `@agent/core` schema-first contract 定义管理 API、runtime invocation、OAuth credential、quota/accounting/logs、migration preview/apply 和 runtime error。
5. 所有第三方 CLI、SDK、vendor response、OAuth token、stderr、headers、raw payload 都必须经过 adapter/facade 转换后再进入业务层或公共 contract。
6. 完成交付设计后，后续实现计划必须可按切片验证，不能只落页面或只落后端骨架。

## 非目标

- 不直接 vendor 或复制上游 Go 源码到本仓库。
- 不让前端直接消费 CLIProxyAPI raw management payload。
- 不恢复已删除的 `packages/shared`。
- 不把 runtime 主链写进 controller、service 巨型文件或 `workflows/*`。
- 不把 OAuth access token、refresh token、auth file 明文、raw vendor headers、raw provider error 暴露给前端或 `packages/core` 查询 projection。
- 不触碰用户浏览器 profile、Cookie、Local Storage、Session Storage、IndexedDB 或 Chrome 缓存目录。
- 不要求 CI 依赖真实 provider 凭据；真实 provider 验证作为可选集成验证。

## 方案对比

### 方案 A：一次性硬复刻

直接复制 CPAMC 前端，再把 CLIProxyAPI Go 逻辑翻成 TS。

优点：

- 目标直观。
- 初期页面相似度最高。

缺点：

- 容易与现有 Identity、schema-first contract、Gateway client、secret vault、runtime-engine 边界冲突。
- Go 项目内的 provider 细节、进程、OAuth、配置、日志若直接平移，容易产生超大 service 和 raw payload 穿透。
- 难以按本仓库验证体系逐层证明。

### 方案 B：外部 CLIProxyAPI 兼容壳

前端像 CPAMC，后端主要连接外部 CLIProxyAPI management/runtime。

优点：

- 最快获得可见效果。
- 后端实现量小。

缺点：

- 不满足“Go 转 TS、完整复刻”的核心目标。
- 本仓库仍依赖外部 runtime，Agent Gateway 不是自给自足的中转站。
- 外部 raw payload 和兼容模式会长期污染主线 contract。

### 方案 C：分层完整复刻（采用）

全量目标按 CLIProxyAPI parity 定义，但实现按层推进。TS 后端拥有主链治理，provider 调用先走可替换 adapter，后续逐步纯 TS 化。

优点：

- 符合本仓库 schema-first、真实宿主、adapter/facade、安全 projection 的边界。
- 可以先达成完整产品闭环，再逐个深化 provider executor。
- 每层都有明确测试和文档收口。

代价：

- 首轮设计和计划必须更严谨。
- 短期内会同时存在 deterministic harness、CLI/HTTP adapter 和后续纯 TS executor 的分层状态，需要文档标明边界。

## 总体架构

```text
apps/frontend/agent-gateway
  -> AgentGatewayApiClient
  -> /api/agent-gateway/* management API
  -> @agent/core schema-first contracts
  -> agent-server agent-gateway domain
  -> runtime-engine facade
  -> provider runtime executors
  -> CLI / HTTP / process / future pure TS adapters
```

主要宿主：

- `apps/frontend/agent-gateway`：Agent Gateway 管理中心 UI。
- `packages/core/src/contracts/agent-gateway`：稳定 JSON contract 与 zod schema source of truth。
- `apps/backend/agent-server/src/api/agent-gateway`：HTTP controller，仅做鉴权、DTO parse、状态码和 facade 调用。
- `apps/backend/agent-server/src/domains/agent-gateway`：配置、provider、auth files、OAuth、quota、logs、usage、migration、clients、runtime 的真实业务宿主。
- `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine`：CLIProxyAPI-compatible runtime 主链。
- `apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/executors`：provider executor adapter。
- `apps/backend/agent-server/src/domains/agent-gateway/secrets`：secret vault。
- `apps/backend/agent-server/src/domains/agent-gateway/repositories` 和 `persistence`：memory 与 durable repository 边界。

`CliProxyManagementClient` 保留为迁移 adapter：

- 只用于从已有 CLIProxyAPI 导入或对比配置。
- 不作为默认 runtime。
- 不作为前端直接依赖。
- 所有 upstream payload 必须转换为项目 schema。

## 前端设计

### 信息架构

`agent-gateway` 保持独立 Vite app，使用当前白色管理中心 shell，但功能完整吸收 CPAMC。

主导航建议：

1. 仪表盘：连接、runtime、请求、quota、provider、auth file、routing 摘要。
2. Runtime：executor health、active streams、process/adapter 状态、usage queue、cooldown。
3. 调用方管理：Gateway clients、client API keys、client quota、client logs。
4. 使用统计：趋势、provider/model/client 维度统计、成本与 token。
5. 配置面板：raw YAML、visual config editor、diff、save、reload、payload rules。
6. AI 提供商：Gemini、Codex、Claude、Vertex、OpenAI-compatible、Ampcode。
7. Provider 编辑页：provider-specific credentials、headers、models、excluded models、alias、test model。
8. 认证文件：upload/download/delete/patch/list models、status、authIndex、recent requests。
9. OAuth 登录：Codex、Claude、Gemini CLI、Antigravity、Kimi、Vertex import。
10. 配额管理：provider/auth file/model quota snapshots、refresh、manual override。
11. 日志：tail/search/filter/download/clear/request error files。
12. 迁移导入：连接外部 CLIProxyAPI、preview、conflict confirm、apply report。
13. 中心信息：version、model discovery、request log setting、quick links、login storage clear。

现有 `GatewayWorkspacePages.tsx` 已超过 300 行，后续实现若继续膨胀，应拆为 `routes/` 或 `pages/<domain>/wiring.tsx`，避免页面 wiring 堆回单文件。

### 页面迁移规则

- 可以复制 CPAMC 的组件结构、交互和视觉细节，但必须改为本仓库 import、API client、contract 和命名。
- 不保留 CPAMC 的 raw `services/api/*` 作为前端主客户端。
- 所有 mutation 通过 `AgentGatewayApiClient`，成功后统一 invalidates `['agent-gateway']` 查询前缀。
- 页面缺少 callback 时必须显示错误，不能静默成功。
- 所有 secret 查询只显示 masked value、prefix、状态或 `secretRef`。
- OAuth 页面不得展示 access token 或 refresh token。
- 文件上传、OAuth 新窗口、callback URL、diff、reload、delete、clear logs 等高风险或异步动作必须有 loading/success/error 状态。

## Contract 设计

所有新增或修改稳定字段先落 `packages/core/src/contracts/agent-gateway`。

需要补齐或核对的 schema 分组：

- Management projections：snapshot、dashboard、system、provider configs、auth files、quota details、logs、API keys。
- Runtime invocation：provider kind、input protocol、model、messages/content、stream flag、tool calls、metadata、client context。
- Runtime response：non-stream result、stream events、OpenAI-compatible error、provider normalized error。
- Executor config：provider kind、enabled、adapter kind、command profile、base URL、headers secret refs、timeout、concurrency、model aliases。
- OAuth credential：credential id、provider kind、auth file id、account email、project id、status、secret ref、scopes、expiresAt、refreshedAt。
- Quota snapshot：provider/auth file/model/client/key 维度、remaining、used、resetAt、source、refreshedAt。
- Accounting：usage record、request log、route decision、latency、token usage、estimated cost。
- Migration：source server、resources、safe plan、conflicts、apply results、failed reasons。
- Config rules：model aliases、excluded models、payload default/override/filter rules、cooldown, session affinity。

兼容策略：

- 查询 projection 可以追加字段，不直接删除或破坏式改名。
- 明文 secret 只允许出现在 create/update command payload 或一次性 create response。
- Runtime 错误统一投影为项目定义错误语义，再映射到 OpenAI/Gemini/Claude/Codex 外壳。
- Provider-specific request/response 只在 protocol adapter 内存在，不进入公共 contract。

## 后端 Management 设计

`agent-server` 管理面继续使用全局 `/api` 前缀，并受 Identity access token 保护。

核心能力：

- Config：raw YAML、visual config、diff、save、reload、payload rules。
- API keys：管理面 proxy API keys 与 Gateway client API keys 分离。
- Providers：provider configs、models、test model、headers、proxy URL、model alias、excluded models。
- Auth files：上传、下载、删除、字段修补、模型列举、状态。
- OAuth：start、status、callback、device flow、credential projection、secret vault 写入。
- Quota：provider quota refresh、manual update、client/key quota、usage aggregation。
- Logs：tail、search、request error files、download、clear。
- System：version、latest version、request log setting、model discovery。
- Migration：preview、conflict classification、apply、report。

Controller 规则：

- Controller 不拼接业务流程。
- Controller 不解析 provider raw payload。
- Controller 不读写 secret 明文。
- Controller 只负责 auth、schema parse、status code、调用 facade/service。

## Runtime 设计

Runtime API 不使用 `/api` 前缀，保持 CLIProxyAPI/OpenAI-compatible 使用习惯。

首批 runtime surface：

- `GET /v1/models`
- `POST /v1/chat/completions`
- `POST /v1/responses`
- `POST /v1/messages`
- `POST /v1beta/models/:model:generateContent`
- `/api/provider/:provider/*`

认证：

- Runtime 使用 Gateway client API key：`Authorization: Bearer <gateway_proxy_api_key>`。
- Identity access token 只用于管理面。

主链顺序：

1. Parse runtime request 到 `GatewayRuntimeInvocation`。
2. 校验 API key、scope、client 状态。
3. 校验 API key quota、client quota、可选 Identity user quota。
4. 根据 provider/model/alias/prefix/session affinity/cooldown/quota 选择 route。
5. 调用 `ProviderRuntimeExecutor`。
6. 对 non-stream 或 stream event 做协议外壳映射。
7. 记录 route decision、usage、request log、quota consume/refund、cooldown。

Executor interface：

```ts
interface ProviderRuntimeExecutor {
  readonly providerKind: GatewayProviderKind;
  listModels(context: GatewayExecutorContext): Promise<GatewayRuntimeModel[]>;
  invoke(invocation: GatewayRuntimeInvocation, context: GatewayExecutorContext): Promise<GatewayRuntimeResult>;
  stream(
    invocation: GatewayRuntimeInvocation,
    context: GatewayExecutorContext
  ): AsyncIterable<GatewayRuntimeStreamEvent>;
}
```

Adapter 类型：

- `deterministic`：CI/local harness。
- `http`：OpenAI-compatible 或 provider API HTTP executor。
- `process`：本机 CLI/process executor。
- `native-ts`：后续纯 TS provider executor。

Adapter 输出必须转换为项目内部 `GatewayRuntimeResult` 或 `GatewayRuntimeStreamEvent`。

## Ops 与可观测性

完整复刻需要覆盖 CLIProxyAPI 的日常运维能力：

- runtime health。
- executor health。
- active request/stream count。
- request logs。
- error files / normalized error projection。
- usage queue。
- quota refresh。
- cooldown state。
- config reload。
- provider model discovery。
- migration report。
- request log enable/disable。

这些能力在前端展示时必须是 projection，不展示 raw process stderr、raw vendor response 或 token。

## 数据与安全

- Secret vault 是明文 secret 唯一入口。
- Repository 查询 projection 只返回 masked value、prefix、`secretRef` 或 metadata。
- OAuth callback raw payload 只在 OAuth adapter 内处理。
- Auth file content 只能作为 secret 或受控文件对象存储，不能被前端列表接口原样返回。
- 日志必须脱敏 Authorization、API key、OAuth token、cookie、set-cookie、proxy password、custom secret headers。
- Clear login storage 只能清理本应用自己的 localStorage key，后端不得触碰浏览器 profile。

## 文档影响

后续实现必须同步更新：

- `docs/contracts/api/agent-gateway.md`
- `docs/apps/frontend/agent-gateway/README.md`
- `docs/apps/frontend/agent-gateway/cli-proxy-parity.md`
- `docs/apps/backend/agent-server/agent-gateway.md`（如不存在或过期，应创建/更新到该模块目录）
- `docs/integration/` 下涉及前后端联调的文档
- 本 spec 对应的 implementation plan

若实现让旧 parity、runtime 或 production migration 文档过期，必须直接更新原文档或标注正确入口，不能新增补丁文档后留下旧入口误导。

## 验证策略

最低验证分层：

- Contract：`packages/core/test/agent-gateway` schema parse 与 secret/raw payload 拒绝回归。
- Backend Unit/Spec：provider normalizer、runtime invocation parser、route decision、quota/accounting、OAuth adapter、migration mapper。
- Backend HTTP smoke：management API、runtime `/v1/models`、non-stream chat、stream chat、provider-specific route。
- Frontend Unit/Smoke：页面 callback 只调用 `AgentGatewayApiClient`，mutation 后触发 gateway data changed，缺少 callback 显示错误。
- Type：`pnpm exec tsc -p packages/core/tsconfig.json --noEmit`、`pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit`、`pnpm --dir apps/frontend/agent-gateway typecheck`。
- Docs：`pnpm check:docs`。

真实 provider 集成验证作为可选命令或手工步骤，不作为 CI 必需条件。CI 使用 deterministic harness 覆盖协议、streaming、取消、错误、quota 和日志链路。

## 成功标准

1. `agent-gateway` 前端页面能力覆盖 CPAMC 主要管理面，并以 Agent Gateway 语义展示。
2. 前端不再保留未接线装饰按钮；所有可见操作有真实 callback、错误或明确未接线状态。
3. 管理 API 与 runtime API 都有 schema-first contract。
4. `/v1/*` runtime 不依赖外部 CLIProxyAPI server。
5. Provider 调用经过可替换 executor adapter。
6. Gateway client/API key/quota/log/usage/accounting 闭环可在 deterministic harness 下跑通。
7. Migration 可以从已有 CLIProxyAPI 做 preview/apply，并输出 conflict/report。
8. 文档、测试、验证命令与实现状态一致。

## 实施切片建议

1. Contract parity：能力矩阵、schema、API 文档、core tests。
2. Frontend parity：页面迁移、路由拆分、API client 接线、UI smoke。
3. Backend management parity：config/provider/auth/OAuth/quota/log/system/migration service。
4. Runtime parity：protocol adapter、executor adapter、streaming、routing、accounting。
5. Ops parity：health、cooldown、usage queue、reload、logs、quota inspector、production smoke。

每个切片都必须包含测试、文档和 cleanup，不能把“稍后补文档”或“后面删旧入口”留到下一轮。
