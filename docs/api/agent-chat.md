# Agent Chat API

状态：current
文档类型：reference
适用范围：`apps/backend/agent-server`、`apps/frontend/agent-chat`
最后核对：2026-04-25

本文是 `agent-chat` 的稳定接口契约。链路时序和断流补偿背景见 [前后端集成链路](/docs/integration/frontend-backend-integration.md)。

## 通用约定

- HTTP 数据接口使用 `/api/chat/*`。
- SSE 实时通道使用 `GET /api/chat/stream?sessionId=...`。
- 新接入必须显式传 `sessionId`：查询走 query，写接口走 body，SSE 走 query。
- `agent_session_id` cookie 仅为兼容层，不作为新接入默认方式。
- 共享结构以 `packages/core` 或后端真实宿主 schema 为准；本文只保留跨端必须知道的字段语义。

## 会话接口

| 方法   | 路径                                 | 用途               | 关键契约                                                           |
| ------ | ------------------------------------ | ------------------ | ------------------------------------------------------------------ |
| `GET`  | `/api/chat/sessions`                 | 获取会话列表       | 返回 `ChatSessionRecord[]`                                         |
| `POST` | `/api/chat/sessions`                 | 创建空会话         | 返回 `ChatSessionRecord`；首条消息不走该接口                       |
| `GET`  | `/api/chat/sessions/:id`             | 获取会话详情       | 返回 `ChatSessionRecord`                                           |
| `GET`  | `/api/chat/messages?sessionId=...`   | 获取消息列表       | 返回 `ChatMessageRecord[]`                                         |
| `GET`  | `/api/chat/events?sessionId=...`     | 获取事件列表       | 返回 `ChatEventRecord[]`                                           |
| `GET`  | `/api/chat/checkpoint?sessionId=...` | 获取运行态快照     | 返回 `ChatCheckpointRecord`                                        |
| `POST` | `/api/chat/messages`                 | 提交首条或后续消息 | body 至少包含 `sessionId`、`message`；返回新增 `ChatMessageRecord` |

`POST /api/chat/messages` 只提交输入，不流式返回输出。流式输出只来自 `/api/chat/stream`。

如果写接口显式传 `modelId`，后端应写入 `requestedHints.preferredModelId`，由 Runtime 路由决定最终调用模型。

## SSE 接口

`GET /api/chat/stream?sessionId=...`

- `Content-Type: text/event-stream`
- 建连后发送注释包 `: stream-open`
- 运行期间发送 `: keep-alive`
- 首次连接会回放当前会话已有事件，但不得回放 `assistant_token`

主线事件：

- `decree_received`
- `supervisor_planned`
- `libu_routed`
- `ministry_started`
- `ministry_reported`
- `skill_resolved`
- `skill_stage_started`
- `skill_stage_completed`
- `interrupt_pending`
- `interrupt_resumed`
- `interrupt_rejected_with_feedback`
- `learning_pending_confirmation`
- `assistant_token`
- `assistant_message`
- `session_finished`
- `session_failed`

兼容事件：

- `manager_planned`
- `research_progress`
- `approval_required`
- `approval_resolved`
- `approval_rejected_with_feedback`

`assistant_token.payload.messageId` 与 `assistant_token.payload.content` 用于追加同一条 assistant 消息；`assistant_message` 是最终完整消息和兜底展示来源。

## Direct Reply

`POST /api/chat`

请求体支持：

- `message` 或 `messages`
- 可选：`systemPrompt`、`modelId`、`temperature`、`maxTokens`

响应为 SSE，事件类型为：

- `token`
- `done`
- `error`

该接口只适合轻量直连模型回复；需要会话编排、审批、checkpoint 或恢复时，使用会话接口与 `/api/chat/stream`。

## Report Schema

`POST /api/chat` 在 `responseFormat=report-schema` 时是当前稳定外部入口。

关键约束：

- brand-new 生成走 bundle-first flow。
- 编辑请求必须显式传 `currentBundle`，修改意图通过 `requestedOperations` 或 `messages` 表达。
- `schema_ready` 与最终 `done` 事件都必须携带 canonical `bundle`。
- `schema` 字段仅作为 `bundle.primaryDocument` 的兼容投影。

## 可靠性

- SSE 是首选实时通道。
- `checkpoint` 是运行态兜底。
- `messages / events` 用于历史恢复与终态校准。
- 如果 checkpoint 已进入 `completed / failed / cancelled`，前端必须把 session 收口到对应终态。
- 如果 `direct-reply` 模型调用失败，后端必须把失败摘要写入 `agentStates[].observations` 与 `trace.direct_reply_fallback`；前端必须展示为 Runtime Issue。
