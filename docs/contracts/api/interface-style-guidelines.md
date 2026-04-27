# Interface Style Guidelines

状态：current
文档类型：guide
适用范围：`apps/backend/agent-server`、`apps/llm-gateway`、跨端 API 与 SSE 契约
最后核对：2026-04-25

本文是新增或修改后端接口时的接口风格判断入口；接口协议选择以本文的当前约束为准。

## 1. 默认选择

当前仓库默认采用：

```text
RESTful JSON API + schema-first contract + SSE streaming
```

规则：

- RESTful JSON API 是默认查询、命令、CRUD、后台管理和 OpenAI-compatible HTTP 入口。
- SSE 是默认实时输出通道，用于 LLM streaming、Agent 执行事件、审批等待、完成和错误事件。
- 稳定 payload 必须 schema-first，优先落在 `packages/core` 或真实宿主的 `contracts/`、`schemas/`。
- GraphQL 暂不引入。
- tRPC 不作为跨端主协议。
- WebSocket 暂不引入；只有真实双向实时协同需求出现时再评估。
- Webhook 只用于外部系统主动回调，不作为内部前后端主通道。

## 2. `agent-server` 规则

`apps/backend/agent-server` 继续采用：

```text
REST command/query -> SSE observe -> checkpoint/history recover
```

使用方式：

- REST query：session、messages、events、checkpoint、runtime center、approvals center、learning center、evidence center、connector center。
- REST command：create session、append message、approve、reject、cancel、recover、confirm learning、refresh metrics。
- SSE observe：chat stream、runtime events、LLM response、approval pending、done/error。
- checkpoint/history：断流、刷新、idle close 或终态事件缺失后的恢复与校准。

约束：

- Controller 只做 HTTP/SSE/鉴权/参数装配，不内联 prompt、模型输出解析、graph 节点或长流程。
- 新增跨端 DTO、SSE event、checkpoint payload 或审批事件前，先更新 `docs/contracts/api/*`。
- 前端不从 raw task dump 自行推导 runtime、approval 或 evidence 状态，应消费后端 projection。

## 3. `llm-gateway` 规则

`apps/llm-gateway` 继续采用 OpenAI-compatible REST + SSE streaming。

公开调用面保持：

- `GET /api/v1/models`
- `GET /api/v1/key`
- `POST /api/v1/chat/completions`

后台管理面继续使用 REST：

- `POST /api/admin/auth/login`
- `POST /api/admin/auth/refresh`
- `POST /api/admin/auth/logout`
- `GET /api/admin/dashboard`
- `GET /api/admin/logs`
- `GET/POST/PATCH /api/admin/providers`
- `GET/POST/PATCH /api/admin/models`
- `GET/POST/PATCH /api/admin/keys`

约束：

- 对外 chat completions request、response、stream chunk 保持 OpenAI-compatible。
- Provider-specific response、error、SSE chunk、usage 必须先在 adapter 层转换成 gateway contract。
- Admin contract 继续放在 `apps/llm-gateway/src/contracts/*`，并用 zod parse 保护 route 和测试。
- 外部客户端不依赖 GraphQL、tRPC 或 monorepo 类型，只依赖 HTTP contract。

## 4. 何时重新评估其他协议

只有满足明确条件才重新评估：

- GraphQL：多个端持续需要同一实体的不同字段组合，REST projection 已明显膨胀，并且 schema、权限、缓存、错误语义可以统一治理。
- tRPC：只限局部内部工具，不对外公开，不替代 `docs/contracts/api` 契约，不绕过 schema-first contract。
- WebSocket：出现多人协作、高频双向控制或无法用 REST command + SSE observe 表达的实时需求。
- Webhook：外部系统主动调用本服务时使用，入口必须做鉴权、签名校验、幂等和 payload 归一化。

## 5. 新接口决策表

| 需求                 | 默认选择                          | 说明                                                          |
| -------------------- | --------------------------------- | ------------------------------------------------------------- |
| 后台 CRUD 或列表查询 | REST                              | 路径、方法、状态码、错误语义清晰                              |
| 平台动作命令         | REST command                      | approve、reject、cancel、recover、refresh 这类离散动作走 HTTP |
| Agent 执行观察       | SSE                               | 服务端单向持续推送为主                                        |
| 断线恢复             | checkpoint + messages/events REST | 长流程必须可恢复                                              |
| LLM chat completions | OpenAI-compatible REST            | 保持外部客户端兼容                                            |
| LLM streaming        | SSE                               | 与 OpenAI-compatible stream 一致                              |
| 外部平台回调         | Webhook                           | 第三方主动调用本服务                                          |
| Monorepo 类型同步    | zod schema + inferred type        | 不用 tRPC 替代正式 HTTP contract                              |
