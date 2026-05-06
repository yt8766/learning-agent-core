# Chat API 数据模型

状态：current
文档类型：reference
适用范围：`apps/backend/agent-server`、`apps/frontend/agent-chat`
最后核对：2026-05-05

本文档是 `agent-chat` 前后端交互的**数据模型契约**。接口路径与时序见 [Agent Chat API](/docs/contracts/api/agent-chat.md)。

> 当前状态说明：本文档基于 2026-05-05 的真实代码提取。前端 `apps/frontend/agent-chat/src/types/` 中存在大量手写 interface，与后端 `packages/core` 的 zod schema 存在不一致；本文档同时列出两者，并标注差异。

---

## 目录

1. [核心实体](#核心实体)
2. [请求 DTO](#请求-dto)
3. [响应与事件](#响应与事件)
4. [消息卡片类型](#消息卡片类型)
5. [Checkpoint 状态](#checkpoint-状态)
6. [Direct Chat 专用类型](#direct-chat-专用类型)
7. [前后端不一致清单](#前后端不一致清单)

---

## 核心实体

### ChatSessionRecord

会话摘要与当前运行状态。

| 字段                | 类型                                       | 来源 |
| ------------------- | ------------------------------------------ | ---- |
| `id`                | `string`                                   | core |
| `title`             | `string`                                   | core |
| `status`            | `ChatSessionStatus`                        | core |
| `currentTaskId?`    | `string`                                   | core |
| `titleSource?`      | `"placeholder" \| "generated" \| "manual"` | core |
| `channelIdentity?`  | `ChannelIdentity`                          | core |
| `compression?`      | `ChatSessionCompressionRecord`             | core |
| `approvalPolicies?` | `ChatSessionApprovalPolicies`              | core |
| `createdAt`         | `string` (ISO)                             | core |
| `updatedAt`         | `string` (ISO)                             | core |

**`ChatSessionStatus`** 枚举（前后端一致）：

```
'idle' | 'running' | 'waiting_interrupt' | 'waiting_approval'
| 'waiting_learning_confirmation' | 'cancelled' | 'completed' | 'failed'
```

**`ChannelIdentity`**：

```ts
{
  channel: 'web' | 'telegram' | 'feishu' | 'wechat';
  channelUserId?: string;
  channelChatId?: string;
  messageId?: string;
  displayName?: string;
}
```

**`ChatSessionCompressionRecord`**：

```ts
{
  summary: string;
  periodOrTopic?: string;
  focuses?: string[];
  keyDeliverables?: string[];
  risks?: string[];
  nextActions?: string[];
  supportingFacts?: string[];
  decisionSummary?: string;
  confirmedPreferences?: string[];
  openLoops?: string[];
  condensedMessageCount: number;
  condensedCharacterCount: number;
  totalCharacterCount: number;
  previewMessages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  trigger: 'message_count' | 'character_count';
  source: 'heuristic' | 'llm';
  summaryLength?: number;
  heuristicFallback?: boolean;
  effectiveThreshold?: number;
  compressionProfile?: 'default' | 'long-flow' | 'light-chat';
  updatedAt: string;
}
```

---

### ChatMessageRecord

聊天消息。

| 字段                 | 类型                        | 来源 | 说明                                |
| -------------------- | --------------------------- | ---- | ----------------------------------- |
| `id`                 | `string`                    | core | 消息唯一标识                        |
| `sessionId`          | `string`                    | core | 所属会话                            |
| `role`               | `ChatRole`                  | core | `'user' \| 'assistant' \| 'system'` |
| `content`            | `string`                    | core | 消息内容                            |
| `taskId?`            | `string`                    | core | 关联任务                            |
| `linkedAgent?`       | `string`                    | core | 关联 Agent 角色                     |
| `card?`              | `ChatMessageCard`           | core | 结构化卡片                          |
| `feedback?`          | `ChatMessageFeedbackRecord` | core | 反馈记录                            |
| `cognitionSnapshot?` | `ChatCognitionSnapshot`     | core | 认知快照                            |
| `createdAt`          | `string` (ISO)              | core | 创建时间                            |

**`ChatMessageFeedbackRecord`**：

```ts
{
  messageId: string;
  sessionId: string;
  rating: 'helpful' | 'unhelpful' | 'none';
  reasonCode?: 'too_shallow' | 'incorrect' | 'missed_point' | 'bad_format' | 'other';
  comment?: string;
  updatedAt: string;
}
```

约束：`unhelpful` 必须带 `reasonCode`；`helpful` / `none` 不允许带 `reasonCode`。

**`ChatCognitionSnapshot`**：

```ts
{
  thoughtChain: ChatThoughtChainItem[];
  thinkingDurationMs?: number;
  capturedAt?: string;
  thinkState?: ChatThinkState;
}
```

**`ChatThoughtChainItem`**：

```ts
{
  key: string;
  messageId?: string;
  thinkingDurationMs?: number;
  kind?: 'reasoning' | 'web_search' | 'browser';
  title: string;
  description?: string;
  content?: string;
  footer?: string;
  status?: 'loading' | 'success' | 'error' | 'abort';
  collapsible?: boolean;
  blink?: boolean;
  webSearch?: { query: string; resultCount?: number; topHosts?: string[]; hitIds?: string[]; hits?: Array<{ url: string; title?: string; host?: string }> };
  browser?: { pageCount?: number; pages: Array<{ url: string; title?: string; host?: string }> };
}
```

**`ChatThinkState`**：

```ts
{
  messageId?: string;
  thinkingDurationMs?: number;
  title: string;
  content: string;
  loading?: boolean;
  blink?: boolean;
}
```

---

### ChatEventRecord

SSE 与历史事件统一记录。

| 字段        | 类型                      | 来源 | 说明           |
| ----------- | ------------------------- | ---- | -------------- |
| `id`        | `string`                  | core | 事件唯一标识   |
| `sessionId` | `string`                  | core | 所属会话       |
| `type`      | `ChatEventType`           | core | 见下表         |
| `at`        | `string` (ISO)            | core | 事件发生时间   |
| `payload`   | `Record<string, unknown>` | core | 由事件类型决定 |

**`ChatEventType`** 枚举（前后端一致）：

```
decree_received, session_started, user_message,
supervisor_planned, libu_routed, ministry_started, ministry_reported,
skill_resolved, skill_stage_started, skill_stage_completed,
manager_planned, subtask_dispatched, research_progress,
tool_selected, tool_called, tool_stream_detected, tool_stream_dispatched, tool_stream_completed,
interrupt_pending, interrupt_resumed, interrupt_rejected_with_feedback,
execution_step_started, execution_step_completed, execution_step_blocked, execution_step_resumed,
approval_required, approval_resolved, approval_rejected_with_feedback,
review_completed,
learning_pending_confirmation, learning_confirmed, message_feedback_learning_candidate,
conversation_compacted, context_compaction_applied, context_compaction_retried,
node_status, node_progress,
assistant_token, assistant_message,
run_resumed, run_cancelled, budget_exhausted, preflight_governance_blocked, background_learning_queued,
dream_task_completed, final_response_delta, final_response_completed,
session_finished, session_failed
```

---

### ChatCheckpointRecord

运行态快照，用于断流恢复、审批恢复、终态校准。

> **注意**：该类型字段极多，前后端定义存在细微差异。以下以前端 `apps/frontend/agent-chat/src/types/chat-checkpoint.ts` 为准，标注与后端 schema 的差异。

**核心标识**：

| 字段           | 类型     | 说明                                                     |
| -------------- | -------- | -------------------------------------------------------- |
| `sessionId`    | `string` | 所属会话                                                 |
| `taskId`       | `string` | 关联任务                                                 |
| `runId?`       | `string` | 运行实例                                                 |
| `traceId?`     | `string` | 追踪 ID                                                  |
| `skillId?`     | `string` | 当前技能                                                 |
| `skillStage?`  | `string` | 当前技能阶段                                             |
| `checkpointId` | `string` | 后端为 `ChatCheckpointMetadataSchema.shape.checkpointId` |
| `createdAt`    | `string` | 后端还有 `updatedAt`                                     |

**路由与规划**：

| 字段                    | 类型                    | 说明                             |
| ----------------------- | ----------------------- | -------------------------------- |
| `currentNode?`          | `string`                | 当前节点                         |
| `currentMinistry?`      | `string`                | 当前部委                         |
| `currentWorker?`        | `string`                | 当前 Worker                      |
| `routeConfidence?`      | `number`                | 路由置信度                       |
| `chatRoute?`            | `ChatRoute`             | 聊天路由决策                     |
| `executionSteps?`       | `ExecutionStepRecord[]` | 执行步骤                         |
| `currentExecutionStep?` | `ExecutionStepRecord`   | 当前执行步骤                     |
| `executionMode?`        | `string`                | 后端 schema 中有，前端未显式声明 |
| `planMode?`             | `string`                | 后端 schema 中有，前端未显式声明 |

**审批与中断**：

| 字段                | 类型                                                                                                                 | 说明         |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------ |
| `pendingApprovals`  | `ApprovalRecord[]`                                                                                                   | 待审批列表   |
| `pendingAction?`    | `{ toolName, intent, riskLevel?, requestedBy }`                                                                      | 待处理动作   |
| `pendingApproval?`  | `{ toolName, intent, riskLevel?, requestedBy, reason?, reasonCode?, feedback?, serverId?, capabilityId?, preview? }` | 待审批详情   |
| `activeInterrupt?`  | `PlatformApprovalInterruptRecord`                                                                                    | 当前活跃中断 |
| `interruptHistory?` | `PlatformApprovalInterruptRecord[]`                                                                                  | 中断历史     |
| `approvalFeedback?` | `string`                                                                                                             | 审批反馈     |

**Agent 状态**：

| 字段                     | 类型                                          | 说明           |
| ------------------------ | --------------------------------------------- | -------------- |
| `agentStates`            | `AgentStateRecord[]`                          | Agent 执行状态 |
| `specialistLead?`        | `{ id, displayName, domain, reason? }`        | 专家主导       |
| `supportingSpecialists?` | `Array<{ id, displayName, domain, reason? }>` | 支持专家       |
| `specialistFindings?`    | `SpecialistFindingRecord[]`                   | 专家发现       |

**图谱状态**：

| 字段             | 类型                                                                                                                                                  | 说明       |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `graphState?`    | `{ status, currentStep?, retryCount?, maxRetries?, revisionCount?, maxRevisions?, microLoopCount?, maxMicroLoops?, microLoopState?, revisionState? }` | 图执行状态 |
| `traceCursor`    | `number`                                                                                                                                              | 追踪游标   |
| `messageCursor`  | `number`                                                                                                                                              | 消息游标   |
| `approvalCursor` | `number`                                                                                                                                              | 审批游标   |
| `learningCursor` | `number`                                                                                                                                              | 学习游标   |

**其他运行时状态**：

| 字段                   | 类型                                                                                         | 说明           |
| ---------------------- | -------------------------------------------------------------------------------------------- | -------------- |
| `thoughtChain?`        | `ChatThoughtChainItem[]`                                                                     | 思考链         |
| `thinkState?`          | `ChatThinkState`                                                                             | Think 面板状态 |
| `externalSources?`     | `EvidenceRecord[]`                                                                           | 外部证据来源   |
| `modelRoute?`          | `ModelRouteDecision[]`                                                                       | 模型路由决策   |
| `budgetState?`         | `{ stepBudget, stepsConsumed, retryBudget, retriesConsumed, sourceBudget, sourcesConsumed }` | 预算状态       |
| `reusedMemories?`      | `string[]`                                                                                   | 复用记忆       |
| `reusedRules?`         | `string[]`                                                                                   | 复用规则       |
| `reusedSkills?`        | `string[]`                                                                                   | 复用技能       |
| `usedInstalledSkills?` | `string[]`                                                                                   | 已安装技能     |
| `usedCompanyWorkers?`  | `string[]`                                                                                   | 已使用 Worker  |
| `connectorRefs?`       | `string[]`                                                                                   | 连接器引用     |
| `requestedHints?`      | `RequestedExecutionHints`                                                                    | 执行提示请求   |

---

## 请求 DTO

所有 DTO 均以 `packages/core/src/channels/schemas/channels.schema.ts` 的 zod schema 为**唯一权威来源**。前端如需本地类型，应通过 `@agent/core` 导入，不得手写重复定义。

### CreateChatSessionDto

```ts
{
  message?: string;      // 创建上下文，不替代 POST /chat/messages
  title?: string;
  channelIdentity?: ChannelIdentity;
}
```

### UpdateChatSessionDto

```ts
{
  title: string;
  titleSource?: 'placeholder' | 'generated' | 'manual';
}
```

### AppendChatMessageDto

```ts
{
  message: string;
  modelId?: string;      // 期望模型，最终由 runtime 路由决定
  channelIdentity?: ChannelIdentity;
}
```

### SessionApprovalDto

```ts
{
  sessionId: string;
  intent?: string;
  reason?: string;
  actor?: string;
  feedback?: string;
  approvalScope?: 'once' | 'session' | 'always';
  interrupt?: ApprovalResumeInput;
}
```

**`ApprovalResumeInput`**：

```ts
{
  interruptId?: string;
  action: 'approve' | 'reject' | 'feedback' | 'input' | 'bypass' | 'abort';
  feedback?: string;
  value?: string;
  payload?: Record<string, unknown>;
}
```

### SessionCancelDto

```ts
{
  sessionId: string;
  actor?: string;
  reason?: string;
}
```

### LearningConfirmationDto

```ts
{
  sessionId: string;
  candidateIds?: string[];
  actor?: string;
}
```

### RecoverToCheckpointDto

```ts
{
  sessionId: string;
  checkpointCursor?: number;
  checkpointId?: string;   // checkpointCursor 与 checkpointId 至少提供一个
  reason?: string;
}
```

### ChatMessageFeedbackRequest

```ts
{
  sessionId: string;
  rating: 'helpful' | 'unhelpful' | 'none';
  reasonCode?: 'too_shallow' | 'incorrect' | 'missed_point' | 'bad_format' | 'other';
  comment?: string;        // max 1000 chars
}
```

---

## 响应与事件

### SSE 事件帧格式

```
data: {"id":"...","sessionId":"...","type":"...","at":"...","payload":{...}}

```

- 无自定义 `event:` 字段
- 首次连接回放历史事件，但不回放 `assistant_token`
- `assistant_token` 的 `payload.messageId` 与 `payload.content` 用于追加同一条 assistant 消息
- `assistant_message` 是最终完整消息和兜底展示来源

### ChatResponseStep 投影事件

`node_progress` 事件可携带两种投影 payload：

1. **`ChatResponseStepEvent`** —— 增量步骤更新
2. **`ChatResponseStepSnapshot`** —— 完整步骤快照

两者均通过 `payload.projection` 字段区分。旧消费者可忽略这些 `node_progress` payload。

---

## 消息卡片类型

### 后端 schema 定义的卡片（`ChatMessageCardSchema`）

后端 `packages/core/src/tasking/schemas/chat.ts` 使用 discriminated union，当前仅定义 5 种：

| `type`                | 说明         |
| --------------------- | ------------ |
| `approval_request`    | 审批请求卡片 |
| `plan_question`       | 计划问题卡片 |
| `run_cancelled`       | 运行取消卡片 |
| `capability_catalog`  | 能力目录卡片 |
| `skill_draft_created` | 技能草稿卡片 |

### 前端实际使用的卡片（`apps/frontend/agent-chat/src/types/chat-message.ts`）

前端 `ChatMessageRecord.card` 是手写 union，包含 **14 种**卡片，远超后端 schema 定义：

| `type`                | 存在位置   | 说明                    |
| --------------------- | ---------- | ----------------------- |
| `approval_request`    | 前后端     | 审批请求                |
| `plan_question`       | 前后端     | 计划问题                |
| `run_cancelled`       | 前后端     | 运行取消                |
| `capability_catalog`  | 前后端     | 能力目录                |
| `skill_draft_created` | 前后端     | 技能草稿                |
| `control_notice`      | **仅前端** | 控制通知（tone/label）  |
| `compression_summary` | **仅前端** | 上下文压缩摘要          |
| `evidence_digest`     | **仅前端** | 证据来源摘要            |
| `learning_summary`    | **仅前端** | 学习结果摘要            |
| `skill_reuse`         | **仅前端** | 技能复用标记            |
| `worker_dispatch`     | **仅前端** | Worker 调度信息         |
| `skill_suggestions`   | **仅前端** | 技能建议卡片            |
| `runtime_issue`       | **仅前端** | 运行时问题              |
| `report_schema`       | **仅前端** | 报表 schema（疑似遗留） |

> **风险**：后端 `ChatMessageCardSchema` 无法 parse 前端实际发送/接收的 9 种卡片类型。当前运行时可能通过 `z.discriminatedUnion` 抛 parse error，或这些卡片以非 schema 方式写入消息记录。

---

## Checkpoint 状态

### 前后端字段覆盖差异

| 字段                      | 后端 schema                         | 前端 interface          | 状态                 |
| ------------------------- | ----------------------------------- | ----------------------- | -------------------- |
| `checkpointId`            | ✅ `ChatCheckpointMetadataSchema`   | ✅ 显式声明             | 一致                 |
| `sessionId`               | ✅                                  | ✅                      | 一致                 |
| `taskId`                  | ✅                                  | ✅                      | 一致                 |
| `runId`                   | ✅ `.optional()`                    | ✅ `?`                  | 一致                 |
| `traceId`                 | ✅ `.optional()`                    | ✅ `?`                  | 一致                 |
| `skillId`                 | ✅ `.optional()`                    | ✅ `?`                  | 一致                 |
| `skillStage`              | ✅ `.optional()`                    | ✅ `?`                  | 一致                 |
| `channelIdentity`         | ✅ `.optional()`                    | ❌ 未声明               | **缺失**             |
| `recoverability`          | ✅ `.optional()`                    | ❌ 未声明               | **缺失**             |
| `createdAt`               | ✅                                  | ✅                      | 一致                 |
| `updatedAt`               | ✅                                  | ✅                      | 一致                 |
| `graphState`              | ✅ `TaskCheckpointGraphStateSchema` | ✅ 简化声明             | 前端简化             |
| `traceCursor`             | ✅ `number`                         | ✅ `number`             | 一致                 |
| `messageCursor`           | ✅ `number`                         | ✅ `number`             | 一致                 |
| `approvalCursor`          | ✅ `number`                         | ✅ `number`             | 一致                 |
| `learningCursor`          | ✅ `number`                         | ✅ `number`             | 一致                 |
| `pendingApprovals`        | ✅ `ApprovalRecordSchema[]`         | ✅ `ApprovalRecord[]`   | 一致                 |
| `agentStates`             | ✅ `AgentExecutionStateSchema[]`    | ✅ `AgentStateRecord[]` | 字段名不同，结构兼容 |
| `thoughtChain`            | ✅ `.optional()`                    | ✅ `?`                  | 一致                 |
| `thinkState`              | ✅ `.optional()`                    | ✅ `?`                  | 一致                 |
| `thoughtGraph`            | ✅ `.optional()`                    | ❌ 未声明               | **缺失**             |
| `resolvedWorkflow`        | ✅ `.optional()`                    | ✅ 简化声明             | 前端简化             |
| `specialistLead` 等       | ✅ `.optional()`                    | ✅ 显式声明             | 一致                 |
| `executionPlan`           | ✅ `.optional()`                    | ❌ 未声明               | **缺失**             |
| `budgetGateState`         | ✅ `.optional()`                    | ❌ 未声明               | **缺失**             |
| `blackboardState`         | ✅ `.optional()`                    | ❌ 未声明               | **缺失**             |
| `criticState`             | ✅ `.optional()`                    | ❌ 未声明               | **缺失**             |
| `sandboxState`            | ✅ `.optional()`                    | ❌ 未声明               | **缺失**             |
| `knowledgeIngestionState` | ✅ `.optional()`                    | ❌ 未声明               | **缺失**             |
| `knowledgeIndexState`     | ✅ `.optional()`                    | ❌ 未声明               | **缺失**             |
| `llmUsage`                | ✅ `.optional()`                    | ❌ 未声明               | **缺失**             |
| `governanceScore`         | ✅ `.optional()`                    | ❌ 未声明               | **缺失**             |
| `governanceReport`        | ✅ `.optional()`                    | ❌ 未声明               | **缺失**             |
| `learningEvaluation`      | ✅ `.optional()`                    | ❌ 未声明               | **缺失**             |
| `skillSearch`             | ✅ `.optional()`                    | ❌ 未声明               | **缺失**             |
| `budgetState`             | ✅ `.optional()`                    | ✅ 简化声明             | 前端简化             |

---

## Direct Chat 专用类型

> 以下类型仅用于 `POST /api/chat`（direct reply 直连入口），**不属于**会话编排主链的数据模型。

### DirectChatRequestDto

```ts
{
  message?: string;                    // 单轮输入，与 messages 至少提供一个
  messages?: DirectChatMessages;       // 多轮消息，直接透传给 LLM provider
  systemPrompt?: string;
  modelId?: string;
  preferLlm?: boolean;
  disableCache?: boolean;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;                    // false 时 report-schema 返回 JSON 而非 SSE
  projectId?: string;
  mockConfig?: Record<string, unknown>;
  reportSchemaInput?: DataReportJsonStructuredInput;   // report-schema 专属
  currentBundle?: ReportBundle;                         // report-schema 专属
  requestedOperations?: ReportPatchOperation[];         // report-schema 专属
  responseFormat?: 'text' | 'sandpack' | 'preview' | 'report-schema';
}
```

> **设计问题**：`DirectChatRequestDto` 把普通聊天、Sandpack 生成、Preview 生成、Report Schema 生成的参数全部混在一个 DTO 中。`responseFormat` 决定路由，但各模式之间的字段互不相干，导致 DTO 成为 God Object。

### DirectChatSseEvent

```ts
{
  type: 'token' | 'stage' | 'files' | 'schema' | 'schema_progress'
      | 'schema_partial' | 'schema_ready' | 'schema_failed' | 'done' | 'error';
  data?: Record<string, unknown>;
  message?: string;
}
```

> **注意**：`DirectChatSseEvent` 与 `ChatEventRecord` 是**两套不同的事件体系**。前者用于 `POST /api/chat` 的直连回复，后者用于会话编排主链的 `GET /api/chat/stream`。

### Report Schema JSON 响应（非 SSE 模式）

当 `stream=false` 且 `Accept: application/json` 时：

```ts
{
  content: string;
  status: 'idle' | 'pending' | 'success' | 'error';
  bundle?: ReportBundle;
  elapsedMs?: number;
  reportSummaries?: unknown;
  runtime?: unknown;
  events: DirectChatSseEvent[];
}
```

---

## 前后端不一致清单

| #   | 问题                                                                                                                         | 位置                                                                                              | 严重程度 | 建议                                      |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- | ----------------------------------------- |
| 1   | `ChatMessageCardSchema` 仅定义 5 种卡片，前端实际使用 14 种                                                                  | `core/src/tasking/schemas/chat.ts` vs `frontend/agent-chat/src/types/chat-message.ts`             | **高**   | 补全后端 schema 或废弃前端多余卡片        |
| 2   | 前端 `ChatEventRecord.type` 为 `string`，后端为严格 enum                                                                     | `frontend/agent-chat/src/types/chat-events.ts` vs `core/src/tasking/schemas/chat.ts`              | **中**   | 前端应复用 core 的 `ChatEventRecord` 类型 |
| 3   | `ChatCheckpointRecord` 前端缺失约 15 个字段                                                                                  | `frontend/agent-chat/src/types/chat-checkpoint.ts` vs `core/src/tasking/schemas/checkpoint.ts`    | **中**   | 前端通过 `@agent/core` 导入，不要手写     |
| 4   | 前端 `ChatMessageFeedbackInput` 与后端 `ChatMessageFeedbackRequest` 重复定义                                                 | `frontend/agent-chat/src/types/chat-message.ts` vs `core/src/channels/schemas/channels.schema.ts` | **低**   | 统一使用 core 类型                        |
| 5   | `DirectChatRequestDto` 未在 `packages/core` 中定义                                                                           | `apps/backend/agent-server/src/chat/chat.direct.dto.ts`                                           | **中**   | 应迁入 `packages/core` schema             |
| 6   | `DirectChatSseEvent` 与 `ChatEventRecord` 并存两套事件体系                                                                   | `chat.direct.dto.ts` vs `core/src/tasking/schemas/chat.ts`                                        | **中**   | 考虑统一或显式命名空间隔离                |
| 7   | 后端 `ChatCheckpointRecordSchema` 中的 `channelIdentity`、`recoverability`、`thoughtGraph`、`executionPlan` 等字段前端未声明 | 见上表                                                                                            | **低**   | 前端应完整导入 core 类型                  |
| 8   | 前端 `AgentStateRecord` 与后端 `AgentExecutionStateSchema` 字段名不同                                                        | `frontend/agent-chat/src/types/chat-session.ts` vs `core/src/tasking/schemas/orchestration.ts`    | **低**   | 统一命名                                  |

---

## 附录：类型来源速查

| 类型                         | 权威来源                                                | 前端当前写法                                            |
| ---------------------------- | ------------------------------------------------------- | ------------------------------------------------------- |
| `ChatSessionRecord`          | `packages/core/src/tasking/schemas/session.ts`          | `apps/frontend/agent-chat/src/types/chat-session.ts`    |
| `ChatMessageRecord`          | `packages/core/src/tasking/schemas/chat.ts`             | `apps/frontend/agent-chat/src/types/chat-message.ts`    |
| `ChatEventRecord`            | `packages/core/src/tasking/schemas/chat.ts`             | `apps/frontend/agent-chat/src/types/chat-events.ts`     |
| `ChatCheckpointRecord`       | `packages/core/src/tasking/schemas/checkpoint.ts`       | `apps/frontend/agent-chat/src/types/chat-checkpoint.ts` |
| `CreateChatSessionDto`       | `packages/core/src/channels/schemas/channels.schema.ts` | 未单独定义                                              |
| `AppendChatMessageDto`       | `packages/core/src/channels/schemas/channels.schema.ts` | 未单独定义                                              |
| `SessionApprovalDto`         | `packages/core/src/channels/schemas/channels.schema.ts` | 未单独定义                                              |
| `ChatMessageFeedbackRequest` | `packages/core/src/channels/schemas/channels.schema.ts` | `ChatMessageFeedbackInput`（前端自定义）                |
| `DirectChatRequestDto`       | `apps/backend/agent-server/src/chat/chat.direct.dto.ts` | 未定义                                                  |
| `DirectChatSseEvent`         | `apps/backend/agent-server/src/chat/chat.direct.dto.ts` | 未定义                                                  |
