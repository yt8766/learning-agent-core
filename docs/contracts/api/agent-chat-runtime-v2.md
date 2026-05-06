# Agent Chat Runtime V2 API

状态：current
文档类型：reference
适用范围：`apps/backend/agent-server`、`apps/frontend/agent-chat`、`packages/core`
最后核对：2026-05-05

本文是 `agent-chat` 会话化 Agent 执行协议的 v2 API 契约。前后端必须先按本文确认接口、事件与 schema 边界，再进入实现；实现过程中如需改字段，必须先更新本文与对应 schema/contract，再改后端和前端。

现有 v1/session/direct 接口见 [Agent Chat API](/docs/contracts/api/agent-chat.md) 与 [Chat API 数据模型](/docs/contracts/api/chat-data-model.md)。本文描述 v2 主链契约，其中核心 schema、run 查询/取消、view-stream、自然语言 pending interaction、agent-tools 审批 bridge 与前端 composer 引导已落地；未明确标注为已落地的迁移项仍按本文作为扩展目标。

## 0. 当前落地状态

已落地：

- `packages/core` schema-first contract：`ChatRunRecord`、`ChatMessageFragment`、`ChatViewStreamEvent`、`ExecutionAutoReviewRecord`、`ChatPendingInteraction`、`ApprovalReplyIntent`。
- 后端 `GET /api/chat/runs`、`GET /api/chat/runs/:runId`、`POST /api/chat/runs/:runId/cancel`。
- 后端 `GET /api/chat/view-stream?sessionId=...&runId=...&afterSeq=...`，使用显式 `event:` SSE。
- view-stream 已投影 `assistant_token`、`assistant_message` / `final_response_completed`、`session_failed`、`node_progress` 与 `interrupt_pending(kind=tool_execution)`。
- `POST /api/chat/messages` 已优先处理 `PendingInteractionService` 中的 pending interaction，并可把同 session 的 `agent-tools` `pending_approval` 自然语言回复转为 `AgentToolsService.resumeApproval()`。
- 前端 `chat-runtime-v2-api.ts` 与 `use-chat-view-stream.ts` 已按 `@agent/core` schema 解析 v2 view-stream。
- 前端 `agent-chat-session-provider.ts` 已短路 `handledAs = "pending_interaction_reply"`，不再把确认回复当作新任务或新 stream。
- 前端 composer 在 pending tool approval 时显示确认短语提示，例如 `回复「确认执行」继续，或输入取消 / 修改要求`。

仍为后续扩展：

- 普通 `POST /api/chat/messages` 统一返回 `{ message, run, handledAs: "new_run" }` 的完整 v2 new-run 响应。
- 将所有工具执行前的 v2 `ExecutionAutoReviewRecord` 作为 view-stream `auto_review_completed` 事件统一投影。
- 用持久化 `ChatRunRecord` 完整驱动 runtime task、checkpoint 与恢复，而不是当前内存 run MVP。
- 将通用 LLM direct、Sandpack、Report Schema 全部迁出 `/api/chat` 主链。

## 1. 目标与非目标

目标：

- 把聊天流式返回从 token 流升级为一次 Agent run 的可观察运行流。
- 建立 `ChatRunRecord`，显式表达“一条用户消息触发的一次执行生命周期”。
- 建立 `ChatViewStreamEvent`，为 `agent-chat` 提供面向 UI 的流式展示协议。
- 保留 `ChatEventRecord` 作为事实流，用于恢复、审计、Admin 与 Run Observatory。
- 用自然语言确认替代审批卡主路径：用户直接回复“确认执行”“取消”“改成只读”等。
- 引入自动审查门：`allow` 自动执行，`needs_confirmation` 等用户明确确认，`block` 直接阻断。

非目标：

- 不把通用 LLM 直连、Sandpack preview、Report Schema 生成继续扩进 `/api/chat/*` 主链。
- 不用展示流替代 checkpoint、历史事件或治理审计。
- 不把原始模型 hidden reasoning 作为 thinking 流式输出；`thinking` 只允许承载可公开的执行摘要。
- 不让前端自定义 card 类型反向定义后端稳定消息 contract。

## 2. 接口设计硬门禁

凡涉及 `agent-chat` 前后端联调、SSE、DTO、事件、checkpoint、审批/interrupt、tool result、run state、view projection 的新增或修改，执行顺序固定为：

1. 先更新本文或对应 `docs/contracts/api/*` 文档。
2. 再更新 `packages/core` 或真实宿主的 schema-first contract。
3. 再实现后端 controller/service/adapter。
4. 再实现前端 API helper、stream consumer 与 UI。
5. 最后补 contract parse、SSE payload、前后端联调和文档回写。

禁止前端和后端分别先写字段、再事后倒推协议。

## 3. API 边界

`/api/chat/*` v2 只负责会话化 Agent 执行：

| 能力          | 入口                    | 说明                                                         |
| ------------- | ----------------------- | ------------------------------------------------------------ |
| Session       | `/api/chat/sessions*`   | 长期会话管理。                                               |
| Message       | `/api/chat/messages*`   | 用户输入、历史消息、反馈；pending interaction 优先在此解析。 |
| Run           | `/api/chat/runs*`       | 一次用户输入触发的一次执行生命周期。                         |
| View Stream   | `/api/chat/view-stream` | 面向 `agent-chat` 的展示流。                                 |
| Domain Stream | `/api/chat/stream`      | 事实流，保留兼容与治理用途。                                 |
| Events        | `/api/chat/events`      | 历史事实事件补拉。                                           |
| Checkpoint    | `/api/chat/checkpoint`  | 恢复和终态校准。                                             |
| Recover       | `/api/chat/recover*`    | 恢复当前或指定 checkpoint。                                  |

后续应迁出或保持 legacy：

| 能力                                              | 目标边界                                     |
| ------------------------------------------------- | -------------------------------------------- |
| 通用 LLM 直连                                     | `/api/direct-chat/*`                         |
| Sandpack / Preview                                | `/api/artifacts/*`                           |
| Report Schema 生成与编辑                          | `/api/reports/*`                             |
| `POST /api/chat`                                  | legacy/direct 兼容入口，不再新增主链字段。   |
| `POST /api/chat/approve`、`POST /api/chat/reject` | legacy UI fallback；新主路径走自然语言回复。 |

## 4. 核心资源

### 4.1 `ChatRunRecord`

`ChatRunRecord` 是一次用户消息到一次 assistant 输出的执行生命周期。`ChatSession.currentTaskId` 可继续表达当前活跃 runtime task，但不能替代 run。

```ts
{
  id: string;
  sessionId: string;
  requestMessageId: string;
  responseMessageId?: string;
  taskId?: string;
  route: 'direct_reply' | 'supervisor' | 'workflow' | 'artifact';
  status:
    | 'queued'
    | 'running'
    | 'thinking'
    | 'streaming_response'
    | 'waiting_interaction'
    | 'completed'
    | 'failed'
    | 'cancelled';
  modelId?: string;
  tokenUsage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}
```

### 4.2 `ChatMessageFragment`

`ChatMessageRecord.content` 继续保存最终 assistant 文本。流式阶段使用 fragment 承载可展示的 thinking、response、tool、evidence 等片段。

```ts
{
  id: string;
  sessionId: string;
  runId: string;
  messageId: string;
  kind:
    | 'thinking'
    | 'response'
    | 'tool_call'
    | 'tool_result'
    | 'evidence'
    | 'system_note'
    | 'error';
  content: string;
  status: 'streaming' | 'completed' | 'failed';
  stageId?: string;
  elapsedMs?: number;
  references?: Array<{
    id: string;
    title?: string;
    url?: string;
    sourceType?: string;
  }>;
}
```

约束：

- `kind = "thinking"` 只能输出可公开执行摘要、检索计划、工具选择说明或进度说明。
- `kind = "response"` 的最终内容应收口到 `ChatMessageRecord.content`。
- `tool_call`、`tool_result`、`evidence` 只暴露白名单摘要，不透传 raw input/output、完整 metadata、第三方 response 或敏感字段。

### 4.3 `ExecutionAutoReviewRecord`

自动审查是执行门，不是用户确认卡片。

```ts
{
  id: string;
  sessionId: string;
  runId: string;
  requestId: string;
  subject:
    | 'tool_call'
    | 'shell_command'
    | 'file_edit'
    | 'network_request'
    | 'git_operation';
  verdict: 'allow' | 'needs_confirmation' | 'block';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  autoExecutable: boolean;
  reasons: string[];
  reasonCodes: string[];
  requiredConfirmationPhrase?: string;
  userFacingSummary: string;
  createdAt: string;
}
```

判定语义：

| verdict              | 行为                                                                 |
| -------------------- | -------------------------------------------------------------------- |
| `allow`              | 自动执行，不等待用户确认；`autoExecutable = true`。                  |
| `needs_confirmation` | assistant 用普通文本请求自然语言确认；`autoExecutable = false`。     |
| `block`              | 不执行，assistant 解释阻断原因和替代建议；`autoExecutable = false`。 |

默认规则：

| verdict              | 典型动作                                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `allow`              | 只读搜索、读取文件、`git diff/status/log`、类型检查、测试、lint check。                                           |
| `needs_confirmation` | 写文件、安装依赖、格式化写入、启动服务、commit、push、外部 API、可能长期运行命令。                                |
| `block`              | 删除未授权路径、`git reset --hard`、绕过 hook、读写敏感数据、清理浏览器 profile、工作区外写入、明显偏离用户目标。 |

### 4.4 `ChatPendingInteraction`

审批卡退出主路径。需要用户参与时，assistant 以普通回复提出确认、拒绝或修改要求，后端记录 pending interaction。

```ts
{
  id: string;
  sessionId: string;
  runId: string;
  kind:
    | 'tool_approval'
    | 'auto_review_block'
    | 'plan_confirmation'
    | 'supplemental_input';
  status: 'pending' | 'resolved' | 'cancelled' | 'expired';
  promptMessageId: string;
  interruptId?: string;
  reviewId?: string;
  expectedActions: Array<'approve' | 'reject' | 'feedback' | 'input' | 'abort'>;
  requiredConfirmationPhrase?: string;
  createdAt: string;
  resolvedAt?: string;
}
```

### 4.5 `ApprovalReplyIntent`

当 session 存在 pending interaction 时，`POST /api/chat/messages` 必须优先解释用户消息是否为 interaction 回复。

```ts
{
  interactionId: string;
  action: 'approve' | 'reject' | 'feedback' | 'input' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  originalText: string;
  normalizedText: string;
  matchedConfirmationPhrase?: string;
  feedback?: string;
}
```

高风险动作必须匹配明确短语，例如：

- `确认推送`
- `确认删除`
- `确认安装`
- `确认提交`

“嗯”“好吧”“可以吧”“看着办”不能放行高风险动作。带条件确认，例如“可以，但不要删除文件”，必须解释为 `feedback`，不能直接 `approve`。

## 5. HTTP 接口

### 5.1 创建会话

`POST /api/chat/sessions`

请求：

```ts
{
  title?: string;
  channelIdentity?: ChannelIdentity;
}
```

响应：`ChatSessionRecord`

约束：

- v2 创建会话不触发 run。
- 首条用户输入必须通过 `POST /api/chat/messages` 提交。
- 旧 `CreateChatSessionDto.message` 只作为 legacy 兼容，不作为 v2 新接入默认路径。

### 5.2 提交消息或回复 pending interaction

`POST /api/chat/messages`

请求：

```ts
{
  sessionId: string;
  message: string;
  modelId?: string;
  channelIdentity?: ChannelIdentity;
}
```

响应：

```ts
{
  message: ChatMessageRecord;
  run?: ChatRunRecord;
  handledAs: 'new_run' | 'pending_interaction_reply';
  interactionResolution?: {
    interactionId: string;
    intent: ApprovalReplyIntent;
    resolvedInteraction?: ChatPendingInteraction;
  };
}
```

处理规则：

- 无 pending interaction：创建 user message、创建 `ChatRunRecord`、创建 assistant response 占位消息，返回 `handledAs = "new_run"`。
- 有 pending interaction：先解析 `ApprovalReplyIntent`；命中 `approve` / `reject` / `feedback` / `input` 时不创建新 run，返回 `handledAs = "pending_interaction_reply"`。
- 解析为 `unknown` 时，后端应让 assistant 追问或说明需要的确认短语；不得把模糊确认误当作高风险放行。

### 5.3 查询消息

`GET /api/chat/messages?sessionId=...`

响应：`ChatMessageRecord[]`

说明：

- 返回长期消息，不要求返回所有 fragment。
- 前端实时渲染优先消费 `view-stream`；历史恢复可结合 messages、runs、events、checkpoint。

### 5.4 查询 run

`GET /api/chat/runs?sessionId=...`

响应：`ChatRunRecord[]`

`GET /api/chat/runs/:runId`

响应：`ChatRunRecord`

### 5.5 取消 run

`POST /api/chat/runs/:runId/cancel`

请求：

```ts
{
  sessionId: string;
  actor?: string;
  reason?: string;
}
```

响应：`ChatRunRecord`

说明：

- 取消 run 应同步取消或标记对应 runtime task / interrupt / pending interaction。
- view-stream 必须输出 `run_status` 与 `close`。

## 6. View Stream

`GET /api/chat/view-stream?sessionId=...&runId=...&afterSeq=...`

SSE framing：

```text
event: <ChatViewStreamEventType>
data: <ChatViewStreamEvent JSON>
```

通用 envelope：

```ts
{
  id: string;
  seq: number;
  sessionId: string;
  runId: string;
  at: string;
  data: Record<string, unknown>;
}
```

事件类型：

```ts
type ChatViewStreamEventType =
  | 'ready'
  | 'session_updated'
  | 'run_status'
  | 'fragment_started'
  | 'fragment_delta'
  | 'fragment_completed'
  | 'step_updated'
  | 'auto_review_completed'
  | 'interaction_waiting'
  | 'user_reply_interpreted'
  | 'interaction_resolved'
  | 'tool_execution_started'
  | 'tool_execution_completed'
  | 'error'
  | 'close';
```

约束：

- 所有事件必须带递增 `seq`，为后续 `afterSeq` 重连做准备。
- 当前实现支持历史补发与实时订阅的最小 `afterSeq` 过滤；后续持久化和跨进程恢复仍必须保留 `seq` 与 `afterSeq`。
- `error` 表示发生了什么错误；`close` 表示本条流为什么结束，二者不能混用。
- `event:` 字段必须显式写出，不沿用旧 `/api/chat/stream` 的无 event 名数据帧。

### 6.1 `ready`

```text
event: ready
data: {
  "id": "view_evt_1",
  "seq": 1,
  "sessionId": "s1",
  "runId": "r1",
  "at": "2026-05-05T10:00:00.000Z",
  "data": {
    "requestMessageId": "m_user",
    "responseMessageId": "m_assistant",
    "modelId": "default",
    "thinkingEnabled": true
  }
}
```

### 6.2 `fragment_delta`

```text
event: fragment_delta
data: {
  "id": "view_evt_2",
  "seq": 2,
  "sessionId": "s1",
  "runId": "r1",
  "at": "2026-05-05T10:00:01.000Z",
  "data": {
    "messageId": "m_assistant",
    "fragmentId": "frag_response",
    "delta": "推荐采用双流模型..."
  }
}
```

### 6.3 `auto_review_completed`

```text
event: auto_review_completed
data: {
  "id": "view_evt_3",
  "seq": 3,
  "sessionId": "s1",
  "runId": "r1",
  "at": "2026-05-05T10:00:02.000Z",
  "data": {
    "review": {
      "id": "review_1",
      "sessionId": "s1",
      "runId": "r1",
      "requestId": "tool_1",
      "subject": "shell_command",
      "verdict": "allow",
      "riskLevel": "low",
      "autoExecutable": true,
      "reasons": ["只读验证命令"],
      "reasonCodes": ["READ_ONLY_CHECK"],
      "userFacingSummary": "自动审查通过：低风险，只读验证。",
      "createdAt": "2026-05-05T10:00:02.000Z"
    }
  }
}
```

### 6.4 `interaction_waiting`

```text
event: interaction_waiting
data: {
  "id": "view_evt_4",
  "seq": 4,
  "sessionId": "s1",
  "runId": "r1",
  "at": "2026-05-05T10:00:03.000Z",
  "data": {
    "interaction": {
      "id": "pi_1",
      "sessionId": "s1",
      "runId": "r1",
      "kind": "tool_approval",
      "status": "pending",
      "promptMessageId": "m_assistant",
      "reviewId": "review_2",
      "expectedActions": ["approve", "reject", "feedback"],
      "requiredConfirmationPhrase": "确认推送",
      "createdAt": "2026-05-05T10:00:03.000Z"
    },
    "naturalLanguageOnly": true
  }
}
```

### 6.5 `error` 与 `close`

```text
event: error
data: {
  "id": "view_evt_5",
  "seq": 5,
  "sessionId": "s1",
  "runId": "r1",
  "at": "2026-05-05T10:00:04.000Z",
  "data": {
    "code": "MODEL_STREAM_FAILED",
    "message": "模型流式响应失败",
    "recoverable": true
  }
}

event: close
data: {
  "id": "view_evt_6",
  "seq": 6,
  "sessionId": "s1",
  "runId": "r1",
  "at": "2026-05-05T10:00:04.100Z",
  "data": {
    "reason": "error",
    "retryable": true,
    "autoResume": false
  }
}
```

## 7. Domain Stream 与历史事件

`GET /api/chat/stream?sessionId=...&afterEventId=...`

- 继续返回 `ChatEventRecord`，用于事实流、恢复、审计、Admin 与 Run Observatory。
- 保留旧 framing：`data: <ChatEventRecord JSON>\n\n`。
- 新增实现应支持 `afterEventId`，用于断线后补拉。
- 不得把 view patch 作为唯一事实来源写入 domain stream。

`GET /api/chat/events?sessionId=...&afterEventId=...&limit=...`

- 返回历史 `ChatEventRecord[]`。
- 前端展示不得依赖 raw metadata、vendor/provider 原始对象或第三方 response。

## 8. 自动审查与自然语言确认链路

工具或高风险动作执行前：

```text
tool_intent_created
  -> policy / sandbox preflight
  -> auto_review_running
  -> auto_review_completed
```

审查结果：

```text
allow
  -> execution_queued
  -> execution_running
  -> execution_completed / execution_failed

needs_confirmation
  -> assistant 普通文本请求确认
  -> create ChatPendingInteraction
  -> interaction_waiting
  -> user_reply_interpreted
  -> interaction_resolved
  -> approved 后 execution_queued

block
  -> execution_blocked
  -> assistant 解释阻断原因和替代方案
  -> waiting_user_input / run_failed
```

低风险自动执行时，assistant 可以简短说明：

```text
我会先运行类型检查确认影响范围。自动审查结果是低风险，只读验证，我直接执行。
```

高风险需要确认时，assistant 必须写清确认短语：

```text
我准备执行 `git push origin feature/x`。
自动审查结果：高风险，因为它会发布当前分支到远端。
请明确回复“确认推送”继续；也可以回复“取消”或说明要改的地方。
```

阻断时：

```text
这个操作我不会执行。
自动审查结果：阻断，因为它会删除工作区外路径，且当前任务没有要求清理这些文件。
我可以先列出候选文件，等你确认后再处理。
```

## 9. 前后端职责

后端：

- 以 `packages/core` 或真实宿主 schema-first contract 生成和校验所有稳定 DTO、event、payload。
- 在 `POST /api/chat/messages` 中优先处理 pending interaction 回复。
- 在工具执行前产出 `ExecutionAutoReviewRecord` 并执行 `allow / needs_confirmation / block` 决策。
- 维护 `ChatRunRecord` 生命周期，并把现有 runtime event 投影为 `ChatViewStreamEvent`。
- 保留 `ChatEventRecord` 事实流与 checkpoint 恢复语义。

前端：

- 新主体验在拿到 `runId` 时优先消费 `/api/chat/view-stream`；没有 `runId` 的旧会话继续保留 v1 stream fallback。
- 用 messages、runs、checkpoint 做历史恢复和终态校准。
- 不再把审批卡作为主交互；收到 `interaction_waiting` 后，可调整输入框 placeholder，引导用户自然语言确认、取消或反馈。
- 不从 raw task dump、raw metadata、vendor response 推导工具或审批状态。
- 不手写重复稳定 contract；应从 `@agent/core` 或本接口对应 schema 推导类型。

## 10. 兼容策略

- `POST /api/chat` 保留 legacy/direct 兼容入口，但不再承载新的会话化 Agent 主链字段。
- `POST /api/chat/approve` 与 `POST /api/chat/reject` 保留 legacy fallback；新主路径通过 `POST /api/chat/messages` 解析自然语言回复。
- `ChatMessage.card.approval_request` 保留历史 parse 和显示兼容，但不再作为新审批体验主路径。
- `assistant_token`、`assistant_message` 继续作为旧 stream 兼容；新前端优先消费 `fragment_started`、`fragment_delta`、`fragment_completed`。
- `node_progress` 中已有 `chat_response_step` / `chat_response_steps` projection 可继续投影为 `step_updated`。

## 11. 验证与回归风险

实现本文任一接口或字段前，至少补齐：

- Type：相关 `packages/core` schema infer 类型与前后端 import 检查。
- Spec：`ChatRunRecord`、`ChatMessageFragment`、`ChatViewStreamEvent`、`ExecutionAutoReviewRecord`、`ChatPendingInteraction`、`ApprovalReplyIntent` 的 parse 回归。
- Unit：自动审查规则、自然语言确认解析、高风险确认短语匹配。
- Demo：一轮低风险自动执行、一轮高风险自然语言确认、一轮 block 阻断。
- Integration：`POST /messages -> view-stream -> checkpoint/events` 的最小闭环；当前已覆盖 schema、view-stream 投影、agent-tools 自然语言审批 bridge 和前端 composer 引导，完整 live runtime demo 仍需在后续联调中补齐。

纯文档修改至少执行 `pnpm check:docs`。

## 12. 继续阅读

- [API 文档目录](/docs/contracts/api/README.md)
- [Agent Chat API](/docs/contracts/api/agent-chat.md)
- [Chat API 数据模型](/docs/contracts/api/chat-data-model.md)
- [Agent Tool Execution API](/docs/contracts/api/tool-execution.md)
- [Auto Review API](/docs/contracts/api/auto-review.md)
- [Sandbox API](/docs/contracts/api/sandbox.md)
- [前后端集成链路](/docs/integration/frontend-backend-integration.md)
