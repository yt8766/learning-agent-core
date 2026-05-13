# Agent Gateway 内建 CLIProxyAPI Runtime 设计

状态：draft
文档类型：spec
适用范围：`apps/backend/agent-server`、`apps/frontend/agent-gateway`、`packages/core/src/contracts/agent-gateway`
最后核对：2026-05-10
创建日期：2026-05-10

## 背景

当前 `agent-gateway` 已有独立前端、管理 API、Gateway client、client API key、额度、部分 CLI Proxy management parity、`/v1/models` 与 `/v1/chat/completions` deterministic runtime。现有后端还保留 `CliProxyManagementClient`，可在 `AGENT_GATEWAY_MANAGEMENT_MODE=cli-proxy` 下连接真实 CLIProxyAPI management API。

新目标不是让 `agent-server` 连接外部 CLIProxyAPI，而是在 `agent-server` 内完整实现 CLIProxyAPI 能力。外部 `router-for-me/CLIProxyAPI` 与 `/Users/dev/Desktop/Cli-Proxy-API-Management-Center` 仅作为行为、协议和界面参考。

参考来源：

- `https://github.com/router-for-me/CLIProxyAPI`
- `https://help.router-for.me/management/api`
- `/Users/dev/Desktop/Cli-Proxy-API-Management-Center`
- `docs/contracts/api/agent-gateway.md`
- `docs/apps/backend/agent-server/agent-gateway.md`
- `docs/apps/frontend/agent-gateway/README.md`

## 目标

1. 在 `agent-server` 内建 CLIProxyAPI runtime engine，真实承载 CLI/OAuth/API 执行链路。
2. 兼容 CLIProxyAPI 的主要 runtime 协议面：OpenAI Chat Completions、OpenAI Responses、Claude Messages、Gemini generateContent、provider-specific routes、streaming 与 non-streaming。
3. 复刻 CLIProxyAPI management 能力，并通过本项目 schema-first contract 暴露给前端。
4. 复刻并增强参考管理中心前端，新增中转站配置、用户额度、调用方额度、API key 额度、日志审计与 runtime health。
5. 保持 `agent-server` 的治理边界：Identity、权限、审计、配置持久化、secret vault、quota 与 runtime lifecycle 都由 `agent-server` 管理。

## 非目标

- 不 vendor 上游 Go CLIProxyAPI 代码。
- 不要求外部 CLIProxyAPI 存在，后端默认必须自给自足。
- 不把真实执行链路散写到现有 controller 或超大 service 中。
- 不让前端消费 CLIProxyAPI raw hyphen-case / snake_case payload。
- 首轮不做多实例分布式 runtime 调度；先完成单 `agent-server` 内可运行、可观测、可替换的 runtime。

## 推荐架构

采用 `agent-server` 内嵌 runtime engine 模块。

新增主落点：

```text
apps/backend/agent-server/src/domains/agent-gateway/runtime-engine/
├─ admin/
├─ accounting/
├─ executors/
├─ oauth/
├─ processes/
├─ protocols/
├─ routing/
├─ streaming/
├─ types/
└─ runtime-engine.module.ts
```

职责边界：

- `runtime-engine/`：真实 CLIProxyAPI 执行内核，负责协议适配、执行器、子进程、OAuth/auth-file、路由、streaming、usage 与 health。
- `agent-gateway` 现有 services/controllers：负责 HTTP 管理面、前端 BFF、schema parse、权限、调用 runtime engine facade。
- `repositories/`：配置、provider、credential、auth file、quota、logs、usage、cooldown、OAuth state 的持久化边界。
- `secrets/`：明文 secret 写入与读取边界，查询 projection 只返回 mask 或 `secretRef`。
- `packages/core/src/contracts/agent-gateway/`：稳定 JSON contract 与 zod schema source of truth。

`CliProxyManagementClient` 降级为迁移兼容能力：

- 可用于从外部 CLIProxyAPI 导入配置、auth files、API keys 和 provider state。
- 不作为默认 management client。
- 不作为 runtime 执行依赖。
- 任何 raw upstream payload 必须在 adapter 层转换为项目 schema。

## Runtime Engine 模块

### protocols

负责把外部协议归一为内部 invocation，并把内部结果映射回对应协议。

首轮覆盖：

- OpenAI `GET /v1/models`
- OpenAI `POST /v1/chat/completions`
- OpenAI `POST /v1/responses`
- Claude `POST /v1/messages`
- Gemini `POST /v1beta/models/:model:generateContent`
- Provider-specific routes，例如 `/api/provider/:provider/v1/chat/completions`

内部统一结构建议：

```ts
GatewayRuntimeInvocationSchema;
GatewayRuntimeResponseSchema;
GatewayRuntimeStreamEventSchema;
GatewayRuntimeErrorSchema;
```

### executors

每个 provider 一个 executor adapter：

- `codex`
- `claude-code`
- `gemini-cli`
- `antigravity`
- `openai-compatible`
- `ampcode`

executor 只暴露项目自定义接口：

```ts
interface GatewayRuntimeExecutor {
  readonly providerKind: GatewayProviderKind;
  listModels(context): Promise<GatewayRuntimeModel[]>;
  invoke(invocation, context): Promise<GatewayRuntimeResult>;
  stream(invocation, context): AsyncIterable<GatewayRuntimeStreamEvent>;
}
```

第三方 CLI、SDK、vendor response、stderr、exit code 不得穿透到 controller、公共 contract 或前端。

### processes

负责 Node child process 生命周期：

- 启动命令与参数生成。
- stdin/stdout/stderr 解析。
- 超时、取消、并发上限。
- exit code 与信号归一。
- stderr 脱敏与分级记录。
- 进程池或按请求启动策略。

首轮必须提供 mock CLI harness，保证不依赖真实 CLI 也能测试 streaming、取消、错误和 quota。

### oauth

负责 auth file 与 token lifecycle：

- OAuth start/status/callback。
- auth file upload/download/patch/delete。
- token refresh。
- provider-specific excluded models 和 model alias。
- auth file health、quota status、recent requests。

Controller 不直接读写 OAuth token 文件，也不直接处理 provider callback raw payload。

### routing

负责多账号和 provider 选择：

- `round-robin`
- `fill-first`
- `session-affinity`
- model alias。
- prefix routing。
- excluded models。
- cooldown。
- quota exceeded fallback。
- provider health。

路由结果必须记录为 `GatewayRouteDecision`，用于日志、审计和 debug。

### streaming

负责统一流式输出：

- OpenAI SSE chunks。
- Responses stream event。
- Claude event stream。
- Gemini stream。
- keepalive。
- 首包前 retry。
- client disconnect cancellation。

streaming 层只消费内部 `GatewayRuntimeStreamEvent`，不直接解析 provider raw object。

### accounting

负责运行时额度与用量：

- request 预检。
- token/request 额度检查。
- usage 记录。
- quota consume/refund。
- usage queue。
- request log。
- latency、status、route decision、authIndex、clientId、userId。

## 用户额度设计

新增三层额度：

1. Identity user quota：控制台或业务用户的总额度。
2. Gateway client quota：中转调用方额度，适合团队、项目、应用。
3. Gateway API key quota：具体 key 的额度与 scope。

额度维度：

- tokens。
- requests。
- daily/monthly/rolling window。
- provider/model allowlist 或 denylist。
- hard deny。
- soft warning。
- fallback provider。
- manual override。

额度消费顺序：

1. Runtime API key scope 校验。
2. API key quota。
3. Gateway client quota。
4. Identity user quota，如 client 绑定 user。
5. Provider/auth file quota 状态。
6. 执行器调用。
7. usage 结算与日志落地。

## 后端 API 边界

### 管理面

继续使用全局 `/api` 前缀：

- `/api/agent-gateway/snapshot`
- `/api/agent-gateway/config/*`
- `/api/agent-gateway/api-keys`
- `/api/agent-gateway/provider-configs`
- `/api/agent-gateway/auth-files`
- `/api/agent-gateway/oauth/*`
- `/api/agent-gateway/quotas/*`
- `/api/agent-gateway/clients/*`
- `/api/agent-gateway/logs/*`
- `/api/agent-gateway/system/*`
- `/api/agent-gateway/runtime/*`

新增 runtime admin projection：

- runtime health。
- executor status。
- model discovery。
- active streams。
- process pool status。
- cooldown state。
- usage queue status。
- config reload result。

### Runtime 协议面

不使用 `/api` 前缀：

- `GET /v1/models`
- `POST /v1/chat/completions`
- `POST /v1/responses`
- `POST /v1/messages`
- `POST /v1beta/models/:model:generateContent`
- `/api/provider/:provider/*`

Runtime 认证：

- 使用 Gateway client API key。
- 不接受 Identity access token 作为 runtime 调用凭据。
- API key scope 必须能区分 `models.read`、`chat.completions`、`responses`、`claude.messages`、`gemini.generate` 等能力。

## 前端设计

`apps/frontend/agent-gateway` 继续作为独立中转控制台，不并入 `agent-admin`。

参考 `/Users/dev/Desktop/Cli-Proxy-API-Management-Center` 补齐页面：

- Dashboard：runtime health、provider health、quota summary、requests、latency、usage。
- Config：结构化配置与 raw YAML 双模式，支持 diff、保存、reload。
- API Keys：区分 proxy service keys、Gateway clients、client API keys。
- AI Providers：Gemini、Codex、Claude、Vertex、OpenAI-compatible、Ampcode 完整编辑页。
- Auth Files：批量上传、下载、删除、状态修补、OAuth excluded、model alias、recent requests。
- OAuth：Codex、Claude、Gemini、Antigravity、Kimi flow。
- Quota：provider quota、用户额度、调用方额度、API key 额度。
- Logs：request logs、error files、usage queue、stream trace。
- System：version、latest、runtime reload、model discovery、local login cleanup。

前端约束：

- 只消费 `@agent/core` contract 与 `src/api/agent-gateway-api.ts`。
- 不直接依赖后端内部路径。
- 不直接消费 raw CLIProxyAPI payload。
- 所有写操作必须有 loading、error、success、确认或未保存变更提示。

## 持久化与配置

首轮需要把现有 memory repository 升级为可持久化边界。实现可以先复用 `agent-server` 既有数据库基础设施，也可以先落文件型 repository，但 contract 必须稳定。

持久化对象：

- Gateway config。
- Runtime provider configs。
- API keys metadata 与 secret refs。
- Gateway clients。
- Client API keys。
- User/client/API key quota。
- Auth files metadata。
- OAuth state。
- Cooldown state。
- Request logs。
- Usage records。
- Usage queue。

Raw YAML 支持：

- 可导入 CLIProxyAPI `config.yaml`。
- 保存时转换为项目内部 schema。
- 导出时可生成 CLIProxyAPI-compatible YAML。
- 系统真实运行以项目 schema 为准，不依赖 raw YAML 字段名。

## 错误与安全

- 查询 projection 不返回明文 API key、OAuth token、refresh token、headers secret。
- Runtime 错误按目标协议映射，不泄漏 Nest 默认异常外壳。
- stderr、vendor raw response 和 request body 默认只进入脱敏日志。
- OAuth/auth-file 与 API key 批量写操作必须审计。
- 删除 auth file、替换 API keys、清空 logs、reload runtime 属于高风险操作，前端必须确认。
- 子进程执行必须有 timeout、并发上限和取消。

## Cleanup 影响

需要清理或降级这些旧语义：

- 文档中“默认 memory management client 代表 CLI Proxy parity runtime”的表述。
- `AGENT_GATEWAY_MANAGEMENT_MODE=cli-proxy` 作为主要运行方式的描述。
- 将 `CliProxyManagementClient` 作为后端连接真实 CLIProxyAPI 的主线说明。
- mock provider / deterministic relay 被误认为真实 runtime 的文档。

保留：

- 旧 Gateway auth 兼容入口，标注为 compat。
- 外部 CLIProxyAPI import adapter，标注为 migration-only。
- memory client/test fixture，标注为 test-only。

## 验证要求

最小验证矩阵：

- Type：`pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit`
- Type：`pnpm exec tsc -p apps/frontend/agent-gateway/tsconfig.app.json --noEmit`
- Spec：`packages/core/test/agent-gateway`
- Unit：runtime-engine protocol adapter、routing、quota、process harness、executor mock。
- Integration：`/v1/chat/completions` streaming/non-streaming、quota deny/consume/refund、OAuth callback、auth file lifecycle。
- Frontend：`apps/frontend/agent-gateway/test`
- Docs：`pnpm check:docs`

如果实现触达 `packages/*`，还需要按仓库规范执行：

```bash
pnpm build:lib
pnpm --dir apps/backend/agent-server build
```

## 成功标准

1. `agent-server` 不依赖外部 CLIProxyAPI 即可提供管理中心与 runtime API。
2. 至少一个真实 CLI/OAuth executor 能完成 non-stream 与 stream 请求闭环。
3. Runtime API key、client quota、user quota 能阻断超额请求并记录审计。
4. 前端能管理 provider、auth files、OAuth、quota、logs、runtime health 和 config reload。
5. 所有公共 payload 通过 `@agent/core` schema parse。
6. 旧文档中“连接外部 CLIProxyAPI”的主线描述被更新为迁移兼容。

## 实施拆分建议

建议后续 implementation plan 分为八个阶段：

1. Contract first：补齐 core schema 与 API 文档。
2. Runtime engine skeleton：模块、facade、mock process harness、health。
3. Protocol adapters：OpenAI/Responses/Claude/Gemini 归一与输出映射。
4. Quota/accounting：用户、client、API key 额度和 usage queue。
5. Executors：先接一个真实 executor，再扩展 Codex/Claude/Gemini/Antigravity。
6. Management parity：config、auth-files、OAuth、provider configs、logs、system。
7. Frontend parity/enhancement：参考管理中心页面补齐与新增额度页。
8. Cleanup/docs/verification：清理外部 CLIProxyAPI 主线表述，补验证闭环。
