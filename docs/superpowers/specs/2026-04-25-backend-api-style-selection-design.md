# Backend API Style Selection Design

状态：snapshot
文档类型：note
适用范围：`apps/backend/agent-server`、`apps/llm-gateway`、`docs/api`、`docs/integration`
最后核对：2026-04-25

## 1. 背景

当前仓库同时存在两个后端性质不同的项目：

- `apps/backend/agent-server`：开发自治平台主 API 服务，负责 chat、runtime、approvals、learning、evidence、connectors、message gateway 等治理和执行链路。
- `apps/llm-gateway`：私有 LLM Gateway，提供 OpenAI-compatible API、provider adapter、虚拟 API Key、用量、限流、fallback 与后台管理。

两者都在同一个 monorepo 中，但它们的 API 目标不同。`agent-server` 面向平台前端和运行时治理；`llm-gateway` 面向外部 LLM 客户端、OpenAI-compatible 调用方和私有后台。

本设计用于回答：在 RESTful、GraphQL、RPC / tRPC、Webhook / SSE / WebSocket 之间，当前项目应如何选择，并形成后续新增接口的判断标准。

## 2. 总体结论

当前项目采用：

```text
RESTful JSON API + schema-first contract + SSE streaming
```

作为默认接口风格。

明确取舍：

- RESTful 是默认 API 形态，用于查询、命令、CRUD、后台管理、中心 projection 与 OpenAI-compatible HTTP 入口。
- SSE 是默认实时输出通道，用于大模型流式响应、Agent 执行过程、运行态事件和前端可观察状态。
- Stable contract 必须 schema-first，优先由 `packages/core` 或真实宿主的 `contracts/`、`schemas/` 定义，再被前后端复用。
- GraphQL 暂不引入。
- tRPC 不作为跨端主协议。
- WebSocket 暂不引入；只有出现真实双向实时协同需求时再重新评估。
- Webhook 只用于外部系统主动回调，例如飞书、Telegram 或后续第三方事件接入，不作为内部前后端主通道。

## 3. 为什么默认选择 RESTful

RESTful 适合当前仓库的主原因：

- `agent-server` 已经是 NestJS Controller 风格，现有模块天然按资源和命令组织，例如 chat session、approval action、runtime center、platform console、memory、rules、skills。
- `llm-gateway` 对外需要兼容 OpenAI-style HTTP API。对模型网关来说，`GET /api/v1/models`、`GET /api/v1/key`、`POST /api/v1/chat/completions` 这种 REST-like 入口比 GraphQL 或 tRPC 更通用。
- REST 能被浏览器、curl、Postman、外部 SDK、AI 代理和非 TypeScript 调用方稳定理解。
- 项目规范已经要求 `docs/api` 文档先行，REST path、method、query、body、response、error semantics 更适合沉淀成长期稳定 contract。

RESTful 在本项目不等于“所有接口都必须是纯 CRUD”。平台命令也可以通过 REST 表达，例如：

- `POST /chat/messages`
- `POST /chat/approve`
- `POST /chat/reject`
- `POST /platform/console/refresh-metrics`
- `POST /api/admin/keys/:id/revoke`

这些命令仍要有稳定 DTO、错误语义和兼容策略。

## 4. 为什么实时链路选择 SSE

当前实时需求主要是服务端持续向前端输出状态：

- LLM token 或 chunk 流。
- Agent run 的 thought / evidence / approval / done / error 事件。
- Chat 直连模式的 Sandpack、report-schema、普通 assistant 输出。
- 断线后由 checkpoint、messages、events 补拉恢复。

这些需求是“服务端推，客户端观察”为主，不需要客户端和服务端在同一个持久连接里频繁双向互发消息。因此 SSE 比 WebSocket 更合适：

- 浏览器原生支持 `EventSource`。
- HTTP 语义清晰，容易经过代理和日志系统。
- 服务端可以按事件类型写入 `event:` 和 `data:`。
- 与现有 checkpoint / history 兜底模型契合。
- 对 `llm-gateway` 来说，OpenAI-compatible streaming 本来就是 SSE 风格。

当前 `agent-server` 的推荐链路继续保持：

```text
REST command -> SSE observe -> checkpoint/history recover
```

当前 `llm-gateway` 的推荐链路继续保持：

```text
POST /api/v1/chat/completions
stream=false -> JSON
stream=true  -> text/event-stream
```

## 5. 为什么暂不引入 GraphQL

GraphQL 的优势是按需取数和复杂关联查询，但当前项目不应把它作为默认方案。

原因：

- `agent-admin` 的六大中心是治理 projection，不是普通数据自由查询页面。前端应消费后端整理好的 Runtime、Approvals、Learning、Evidence、Connector & Policy 等视图，而不是自行拼装 runtime 原始状态。
- `agent-chat` 是执行工作台，核心是 message、approval、thought chain、evidence、learning suggestion 与 skill reuse 的协同展示，实时事件和 checkpoint 比字段按需查询更重要。
- `llm-gateway` 必须优先保持 OpenAI-compatible REST 边界，GraphQL 对外部模型客户端没有收益。
- 引入 GraphQL 会新增 schema server、resolver、cache、权限、N+1、订阅或 streaming 边界等复杂度，并可能和现有 `docs/api + zod schema` 契约体系分叉。

只有同时满足以下条件时，才重新评估 GraphQL：

- 多个前端或外部消费方持续需要同一批实体的不同字段组合。
- REST projection 已经产生大量重复 endpoint 或字段膨胀。
- 权限、缓存、错误语义和 schema 演进能被清晰设计。
- GraphQL schema 能与 `packages/core` 或宿主 `schemas/` 保持单一真实来源，不形成第二套 contract。

## 6. 为什么 tRPC 不作为主协议

tRPC 的优势是 TypeScript monorepo 内端到端类型同步。但它不适合作为当前项目的跨端主协议。

原因：

- 本项目不是普通单前端全栈应用，而是多 Agent 平台和模型网关。接口需要被文档、外部客户端、AI 代理、curl、SDK 和未来其他端理解。
- 项目规范要求稳定 contract 先落 schema，再推导类型。`tRPC` 容易让后端函数形状成为隐式协议，弱化 `docs/api` 的长期契约地位。
- `llm-gateway` 的核心对外价值是 OpenAI-compatible HTTP API，tRPC 会破坏通用客户端兼容性。
- `agent-server` 的运行时、审批、恢复、观察链路需要明确事件语义、错误语义、兼容策略和断线恢复，而不仅是类型同步。

本项目需要类型安全时，优先采用：

```text
zod schema -> inferred TypeScript type -> typed request helper / client facade
```

而不是把跨端协议切换到 tRPC。

tRPC 仅可在未来满足以下条件时作为局部内部工具评估：

- 调用方和服务端都固定在同一个 TypeScript runtime 边界内。
- 不对外公开，不替代 `docs/api` 中的正式 REST / SSE 契约。
- 不让 tRPC router 成为绕过 schema-first contract 的通道。
- 有明确测试证明错误语义、鉴权和兼容策略没有变弱。

## 7. WebSocket 与 Webhook 的边界

WebSocket 暂不作为默认实时协议。

只有出现以下需求时才考虑：

- 多人同时协作编辑同一个 run、任务或白板。
- 客户端需要高频向服务端发送控制消息，且这些控制消息不能用 REST command 表达。
- 需要服务端主动向同一连接做低延迟双向协调，而不是单向事件推送。

如果只是 approve、reject、cancel、recover、refresh 这类离散动作，继续使用 REST command；如果只是观察运行进度，继续使用 SSE。

Webhook 只用于外部系统回调：

- 飞书、Telegram、GitHub、支付系统、第三方 connector event。
- Webhook controller 负责鉴权、签名校验、幂等、归一化，然后转入内部 command / queue / runtime。
- Webhook payload 不直接穿透到公共 contract 或业务层，必须先转换成项目自定义 schema。

## 8. `agent-server` 具体规范

`agent-server` 继续采用 REST + SSE + checkpoint/history。

推荐 API 分层：

- REST query：读取 session、message、event、checkpoint、runtime center、approvals center、evidence center、learning center、connector center。
- REST command：创建 session、追加 message、approve、reject、cancel、recover、confirm learning、refresh metrics。
- SSE observe：chat 直连、run stream、runtime events、LLM response、approval pending、done/error。
- checkpoint/history：断线、idle close、终态事件缺失或页面刷新后的恢复与校准。

边界规则：

- Controller 只做 HTTP/SSE/鉴权/参数装配，不内联长 prompt、模型输出解析、graph 节点或复杂流程。
- 跨端 DTO 先进入 `docs/api`，再进入 `packages/core` 或真实宿主 schema。
- 前端不从 raw task dump 推导 runtime、approval 或 evidence 状态，应消费后端 projection。
- 新增实时事件必须定义事件类型、payload schema、终态语义、断线恢复方式和兼容策略。
- 高风险动作必须进入审批门，审批动作使用 REST command，审批状态通过 SSE 和 checkpoint 被观察。

## 9. `llm-gateway` 具体规范

`llm-gateway` 继续采用 OpenAI-compatible REST + SSE streaming。

公开调用面：

- `GET /api/v1/models`
- `GET /api/v1/key`
- `POST /api/v1/chat/completions`

后台管理面：

- `POST /api/admin/auth/login`
- `POST /api/admin/auth/refresh`
- `POST /api/admin/auth/logout`
- `GET /api/admin/dashboard`
- `GET /api/admin/logs`
- `GET/POST/PATCH /api/admin/providers`
- `GET/POST/PATCH /api/admin/models`
- `GET/POST/PATCH /api/admin/keys`

边界规则：

- 对外 chat completions request / response / stream chunk 保持 OpenAI-compatible。
- Provider-specific response、error、SSE chunk、usage 先在 adapter 层转换成 gateway contract，不穿透到 route、UI 或公共 contract。
- Admin contract 继续放在 `apps/llm-gateway/src/contracts/*`，并用 zod parse 保护 route 和测试。
- 外部客户端不依赖 tRPC、GraphQL 或 monorepo 类型，只依赖 HTTP contract。
- 后台 UI 可以使用 typed helper，但 helper 必须以 route contract 为来源。

## 10. 文档与实现顺序

后续新增或修改接口时固定顺序：

1. 先更新 `docs/api/*` 中的接口契约，或在 `docs/integration/*` 中补链路说明。
2. 再新增或修改 `packages/core` 或真实宿主 `contracts/`、`schemas/`。
3. 再实现后端 route / controller / service facade。
4. 再接入前端 typed request helper 或 UI。
5. 最后补 Spec、Unit、Demo、Integration 验证。

如果只是 `llm-gateway` 宿主内部 admin contract，contract 可继续放在 `apps/llm-gateway/src/contracts/*`。如果 contract 将被 `agent-server`、前端应用或多个 workspace 包共同消费，应优先评估是否收敛到 `packages/core`。

## 11. 错误语义

REST JSON 错误响应必须稳定：

- 有机器可读 `code`。
- 有人类可读 `message`。
- 有错误分类 `type` 或等价字段。
- 不泄漏 provider key、token、cookie、数据库连接串、上游完整响应或内部 stack。

SSE 错误事件必须稳定：

- 使用明确 `type: "error"` 或协议定义的错误 event。
- payload 包含稳定 code / message。
- 已输出 chunk 后的 streaming 错误不得伪装成成功终态。
- 可以恢复的链路必须说明前端应读 checkpoint、events 还是 messages 进行收口。

## 12. 测试策略

接口风格选择本身是设计约束，后续实现变更按影响范围补测试：

- Type：受影响 app / package 的 TypeScript 检查。
- Spec：zod schema parse 回归，尤其是 DTO、SSE event、OpenAI-compatible response、admin contract。
- Unit：adapter、provider mapping、projection helper、command handler、error mapping。
- Demo：最小可运行闭环，例如 route handler mock service、chat stream smoke、admin logs route。
- Integration：前后端链路、SSE + checkpoint、llm-gateway E2E 或 backend center projection。

纯文档变更至少执行 `pnpm check:docs`。

## 13. 决策表

| 需求                                | 默认选择                                 | 不选什么         | 理由                              |
| ----------------------------------- | ---------------------------------------- | ---------------- | --------------------------------- |
| 后台管理 CRUD                       | REST                                     | GraphQL / tRPC   | 路径、方法、状态码和错误语义清晰  |
| Agent 执行观察                      | SSE                                      | WebSocket        | 当前是服务端单向推送为主          |
| Approve / Reject / Cancel / Recover | REST command                             | WebSocket        | 离散命令更适合 HTTP               |
| 断线恢复                            | checkpoint + messages/events REST        | 只依赖长连接     | 长流程必须可恢复                  |
| LLM chat completions                | OpenAI-compatible REST                   | GraphQL / tRPC   | 外部客户端兼容性优先              |
| LLM streaming                       | SSE                                      | WebSocket        | 与 OpenAI-compatible stream 一致  |
| 外部平台回调                        | Webhook                                  | SSE / tRPC       | 外部系统主动调用本服务            |
| 多端复杂按需字段                    | 暂用 REST projection，必要时评估 GraphQL | 立刻引入 GraphQL | 当前治理中心更需要稳定 projection |
| Monorepo 类型同步                   | zod schema + inferred type               | tRPC 主协议      | 保持正式 HTTP contract            |

## 14. 验收标准

本设计被采纳后，后续接口设计应满足：

- 新增跨端接口能明确归类为 REST query、REST command、SSE event、Webhook 或少数例外。
- `agent-server` 的运行态链路继续保持 REST command + SSE observe + checkpoint/history recover。
- `llm-gateway` 的外部调用面继续保持 OpenAI-compatible REST + SSE。
- 新增接口先写 `docs/api` 或宿主 contract 文档，再写实现。
- 稳定 payload 有 zod schema 或等价结构校验。
- 不因追求类型同步而绕过正式 API 文档和 schema-first contract。
