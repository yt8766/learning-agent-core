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
- 除 `POST /api/chat` 的 SSE 模式外，所有 JSON 接口默认 `Content-Type: application/json`。
- `sessionId` 缺失且 cookie 也不存在时，后端返回 `400`，错误信息为 `sessionId is required.`。

## 返回结构速查

| 类型                   | 关键字段                                                                                                                                                                                            | 说明                                                                                                                                                                    |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ChatSessionRecord`    | `id`、`title`、`status`、`currentTaskId?`、`channelIdentity?`、`compression?`、`approvalPolicies?`、`createdAt`、`updatedAt`                                                                        | 会话摘要和当前运行状态。`status` 可为 `idle`、`running`、`waiting_interrupt`、`waiting_approval`、`waiting_learning_confirmation`、`cancelled`、`completed`、`failed`。 |
| `ChatMessageRecord`    | `id`、`sessionId`、`role`、`content`、`taskId?`、`linkedAgent?`、`card?`、`createdAt`                                                                                                               | 聊天消息。`role` 使用 core 中的 `ChatRole`；`card` 可承载 approval、plan question、capability catalog 等结构化卡片。                                                    |
| `ChatEventRecord`      | `id`、`sessionId`、`type`、`at`、`payload`                                                                                                                                                          | SSE 与历史事件统一记录。`payload` 由事件类型决定。                                                                                                                      |
| `ChatCheckpointRecord` | `checkpointId`、`sessionId`、`taskId`、`graphState`、`pendingApprovals`、`agentStates`、`traceCursor`、`messageCursor`、`approvalCursor`、`learningCursor`、`activeInterrupt?`、`interruptHistory?` | 运行态快照，用于断流恢复、审批恢复、终态校准。                                                                                                                          |

## 会话接口

| 方法     | 地址                                 | 参数                                                                            | 返回值                              | 说明                                                                                                     |
| -------- | ------------------------------------ | ------------------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/chat/sessions`                 | 无                                                                              | `ChatSessionRecord[]`               | 获取会话列表。                                                                                           |
| `POST`   | `/api/chat/sessions`                 | body: `{ message?: string; title?: string; channelIdentity?: ChannelIdentity }` | `ChatSessionRecord`                 | 创建会话并写入 `agent_session_id` cookie。`message` 只作为创建上下文，不替代 `POST /api/chat/messages`。 |
| `GET`    | `/api/chat/sessions/:id`             | path: `id`                                                                      | `ChatSessionRecord`                 | 获取会话详情，并写入同名 cookie。                                                                        |
| `PATCH`  | `/api/chat/sessions/:id`             | path: `id`; body: `{ title: string }`                                           | `ChatSessionRecord`                 | 更新会话标题。                                                                                           |
| `DELETE` | `/api/chat/sessions/:id`             | path: `id`                                                                      | `void`                              | 删除会话。                                                                                               |
| `GET`    | `/api/chat/messages?sessionId=...`   | query: `sessionId`                                                              | `ChatMessageRecord[]`               | 获取消息历史；兼容层可从 cookie 读取 `sessionId`。                                                       |
| `GET`    | `/api/chat/events?sessionId=...`     | query: `sessionId`                                                              | `ChatEventRecord[]`                 | 获取事件历史；用于重连和终态补偿。                                                                       |
| `GET`    | `/api/chat/checkpoint?sessionId=...` | query: `sessionId`                                                              | `ChatCheckpointRecord \| undefined` | 获取最新运行态快照。                                                                                     |
| `POST`   | `/api/chat/messages`                 | body: `{ sessionId: string; message: string; modelId?: string }`                | `ChatMessageRecord`                 | 提交首条或后续用户消息。                                                                                 |

`POST /api/chat/messages` 只提交输入，不流式返回输出。流式输出只来自 `/api/chat/stream`。

如果写接口显式传 `modelId`，后端应写入 `requestedHints.preferredModelId`，由 Runtime 路由决定最终调用模型。

## 审批、恢复与学习动作

| 方法   | 地址                              | 参数                                                                                                                                                                                 | 返回值              | 说明                                                                               |
| ------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- | ---------------------------------------------------------------------------------- |
| `POST` | `/api/chat/approve`               | body: `{ sessionId: string; intent?: string; reason?: string; actor?: string; feedback?: string; approvalScope?: "once" \| "session" \| "always"; interrupt?: ApprovalResumeInput }` | `ChatSessionRecord` | 审批通过或恢复 interrupt。                                                         |
| `POST` | `/api/chat/reject`                | body: `{ sessionId: string; intent?: string; reason?: string; actor?: string; feedback?: string; interrupt?: ApprovalResumeInput }`                                                  | `ChatSessionRecord` | 拒绝审批、取消 interrupt 或带反馈打回。                                            |
| `POST` | `/api/chat/learning/confirm`      | body: `{ sessionId: string; candidateIds?: string[]; actor?: string }`                                                                                                               | `ChatSessionRecord` | 确认学习候选。                                                                     |
| `POST` | `/api/chat/recover`               | body: `{ sessionId: string }`                                                                                                                                                        | `ChatSessionRecord` | 从当前 checkpoint 恢复。                                                           |
| `POST` | `/api/chat/recover-to-checkpoint` | body: `{ sessionId: string; checkpointCursor?: number; checkpointId?: string; reason?: string }`                                                                                     | `ChatSessionRecord` | 恢复到指定 checkpoint；`checkpointCursor` 与 `checkpointId` 至少提供一个更可追踪。 |
| `POST` | `/api/chat/cancel`                | body: `{ sessionId: string; actor?: string; reason?: string }`                                                                                                                       | `ChatSessionRecord` | 取消当前会话运行。                                                                 |

`ApprovalResumeInput` 的关键字段为 `{ interruptId?: string; action: "approve" | "reject" | "feedback" | "input" | "bypass" | "abort"; feedback?: string; value?: string; payload?: Record<string, unknown> }`。

## SSE 接口

`GET /api/chat/stream?sessionId=...`

- `Content-Type: text/event-stream`
- 建连后发送注释包 `: stream-open`
- 运行期间发送 `: keep-alive`
- 首次连接会回放当前会话已有事件，但不得回放 `assistant_token`
- 数据帧格式为 `data: <ChatEventRecord JSON>\n\n`，没有自定义 `event:` 字段。

事件类型以 `packages/core/src/tasking/schemas/chat.ts` 的 `ChatEventRecordSchema` 为准。当前稳定枚举：

- `decree_received`
- `session_started`
- `user_message`
- `supervisor_planned`
- `libu_routed`
- `ministry_started`
- `ministry_reported`
- `skill_resolved`
- `skill_stage_started`
- `skill_stage_completed`
- `manager_planned`
- `subtask_dispatched`
- `research_progress`
- `tool_selected`
- `tool_called`
- `tool_stream_detected`
- `tool_stream_dispatched`
- `tool_stream_completed`
- `interrupt_pending`
- `interrupt_resumed`
- `interrupt_rejected_with_feedback`
- `execution_step_started`
- `execution_step_completed`
- `execution_step_blocked`
- `execution_step_resumed`
- `approval_required`
- `approval_resolved`
- `approval_rejected_with_feedback`
- `review_completed`
- `learning_pending_confirmation`
- `learning_confirmed`
- `conversation_compacted`
- `context_compaction_applied`
- `context_compaction_retried`
- `node_status`
- `node_progress`
- `assistant_token`
- `assistant_message`
- `run_resumed`
- `run_cancelled`
- `budget_exhausted`
- `preflight_governance_blocked`
- `background_learning_queued`
- `dream_task_completed`
- `final_response_delta`
- `final_response_completed`
- `session_finished`
- `session_failed`

其中以下事件主要用于历史兼容或旧链路投影，新前端应优先消费 interrupt / execution / assistant / session 语义：

- `manager_planned`
- `research_progress`
- `approval_required`
- `approval_resolved`
- `approval_rejected_with_feedback`

`assistant_token.payload.messageId` 与 `assistant_token.payload.content` 用于追加同一条 assistant 消息；`assistant_message` 是最终完整消息和兜底展示来源。

## Direct Reply

`POST /api/chat`

请求体：

| 字段                  | 类型                                                   | 必填 | 说明                                                  |
| --------------------- | ------------------------------------------------------ | ---- | ----------------------------------------------------- |
| `message`             | `string`                                               | 否   | 单轮输入。`message` 与 `messages` 至少提供一个。      |
| `messages`            | `DirectChatMessages`                                   | 否   | 传给 LLM provider 的多轮消息。                        |
| `systemPrompt`        | `string`                                               | 否   | 系统提示词。                                          |
| `modelId`             | `string`                                               | 否   | 期望模型。最终模型仍由 provider 或 runtime 路由决定。 |
| `preferLlm`           | `boolean`                                              | 否   | 优先直连 LLM。                                        |
| `disableCache`        | `boolean`                                              | 否   | 禁用缓存。                                            |
| `temperature`         | `number`                                               | 否   | 采样温度。                                            |
| `maxTokens`           | `number`                                               | 否   | 最大输出 token。                                      |
| `stream`              | `boolean`                                              | 否   | 客户端期望流式响应。                                  |
| `projectId`           | `string`                                               | 否   | 预览、沙盒或项目上下文。                              |
| `mockConfig`          | `Record<string, unknown>`                              | 否   | 测试或 demo 配置。                                    |
| `responseFormat`      | `"text" \| "sandpack" \| "preview" \| "report-schema"` | 否   | 响应模式。                                            |
| `reportSchemaInput`   | `DataReportJsonStructuredInput`                        | 否   | `report-schema` 结构化输入。                          |
| `currentBundle`       | `ReportBundle`                                         | 否   | 报表编辑时的当前 bundle。                             |
| `requestedOperations` | `ReportPatchOperation[]`                               | 否   | 报表编辑操作意图。                                    |

响应为 SSE，事件类型为：

- `token`
- `stage`
- `files`
- `schema`
- `schema_progress`
- `schema_partial`
- `schema_ready`
- `schema_failed`
- `done`
- `error`

如果请求 `Accept: application/json` 且 `responseFormat=report-schema`，响应为 JSON：

```ts
{
  content: string;
  status: DirectStageStatus;
  bundle?: ReportBundle;
  elapsedMs?: number;
  reportSummaries?: unknown;
  runtime?: unknown;
  events: DirectChatSseEvent[];
}
```

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
