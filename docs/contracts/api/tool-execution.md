# Agent Tool Execution API

状态：current
文档类型：reference
适用范围：`apps/backend/agent-server`、`apps/frontend/agent-chat`、`apps/frontend/agent-admin`、`packages/runtime`、`packages/tools`
最后核对：2026-04-26

本文记录 Agent Tool 执行请求、策略判定、审批恢复、SSE 事件与前后端职责。执行节点与通用执行投影背景见 [Execution Fabric API](/docs/contracts/api/execution-fabric.md)，sandbox 限制见 [Sandbox API](/docs/contracts/api/sandbox.md)，自动审查见 [Auto Review API](/docs/contracts/api/auto-review.md)。

> 边界说明：`/api/agent-tools/*` 是当前真实落地的工具执行入口。Execution Fabric 文档中的 `/api/execution/*` 是 planned governance / projection endpoint，用于后续统一执行节点治理和投影读取；它不替代本文入口，也不表示仓库内存在第二套当前工具执行实现。

开发入口速查：

- 后端主入口：`apps/backend/agent-server/src/agent-tools/*`
- Chat 前端消费：`apps/frontend/agent-chat` 的工具执行 API helper、SSE projection helper、OpenClaw workbench timeline fallback
- Admin 前端消费：`apps/frontend/agent-admin` 的 runtime summary、run workbench、run observatory governance projection
- Contract 回归：`test/integration/frontend-backend/sse-payload-contract.int-spec.ts`

## 目的

Agent Tool Execution 是从聊天、Runtime、专项 Agent 或后台治理面发起工具执行的稳定 API 边界。

本阶段目标：

- 让 `agent-chat` 能展示工具选择、策略判定、审批等待、执行进度和结果。
- 让 `agent-admin` 能按 execution request、node、capability 与 policy decision 做治理和排障。
- 让后端只暴露项目自定义 contract，不把第三方 executor、MCP、终端或浏览器事件结构直接穿透到前端。
- 让高风险工具执行统一进入 approval resume，而不是各工具自定义恢复 payload。

字段定义以 `@agent/core` execution contract 为准：

- `ExecutionNodeRecordSchema`
- `ExecutionCapabilityRecordSchema`
- `ExecutionPolicyDecisionRecordSchema`
- `ExecutionRequestRecordSchema`
- `ExecutionResultRecordSchema`

## 当前实现状态

已落地的最小闭环：

- 后端入口：`apps/backend/agent-server/src/agent-tools/*`，Nest controller 使用 `@Controller('agent-tools')`，经全局 `api` prefix 后暴露为 `/api/agent-tools/*`。
- 后端当前使用 in-memory repository，能力目录由 `@agent/tools` 默认 registry 投影为 `@agent/core` execution contracts。
- 后端已支持 Agent Tool Surface alias request：调用方可传 `alias = read | list | search | write | edit | delete | command` 与 `approvalMode = suggest | auto_edit | full_auto`，服务端会先解析为稳定 `toolName` / `capabilityId` / `riskClass`，再进入现有 policy、sandbox、auto-review、queue 与 projection 链路。
- `low` 风险 request 当前通过同步 executor queue 边界完成：先写入 `queued`，再 drain 到 `running` / `succeeded`；HTTP response 仍返回最终 `succeeded` 结果，便于现阶段前后端联调。
- `medium`、`high`、`critical` 或 capability 要求审批时进入 `pending_approval`；`approve` / `bypass` 会复用同一 queue drain helper，`reject` 进入 `denied`，`abort` / `cancel` 进入 `cancelled`，`feedback` / `input` 回到 `pending_policy`。
- `AgentToolsService` 已在创建 request 后、进入队列或审批前调用 `SandboxService.preflight`：低风险只读工具默认使用 `workspace-readonly`，高风险工具默认使用 `release-ops`；sandbox `require_approval` 会把 request 置为 `pending_approval`，`reasonCode = sandbox_approval_required`，并在 request metadata 写入 `sandboxRunId`、`sandboxDecision`、`sandboxProfile`。
- sandbox 允许且 request 仍为低风险可执行路径时，后端会调用 `AutoReviewService.createReview(kind = "tool_execution")`；`allow` / `warn` 继续进入同步 executor queue，`block` 会把 request 置为 `pending_approval`，`reasonCode = auto_review_blocked`，并在 metadata 写入规范关联字段 `reviewId`、兼容字段 `autoReviewId` 与 `autoReviewVerdict`。
- agent-tools 事件投影会把 `sandboxRunId`、`sandboxDecision`、`sandboxProfile`、`reviewId`、`autoReviewId`、`autoReviewVerdict`、`alias`、`approvalMode`、`approvalReasonCode`、`aliasReasonCode` 作为白名单治理字段写入 `tool_called`、`execution_step_started`、`execution_step_completed`、`execution_step_blocked`、`execution_step_resumed` 与 `interrupt_*` payload；事件不得展开 request metadata 中的 raw input、`rawInput`、`rawOutput`、完整 `metadata`、vendor/provider payload 或第三方 response。
- `/api/agent-tools/requests/:requestId/approval` 在 `approve` / `bypass` 恢复时会根据 request metadata 同步调用关联的 sandbox run / auto review approval resume；auto review 关联优先读取 `reviewId`，缺失时 fallback 到 `autoReviewId`，然后再进入 executor queue drain；未注入对应 facade 时保持旧的 agent-tools 最小闭环行为。
- 后端已在 agent-tools repository 内维护 in-memory execution event log，并通过 service/controller 暴露 `listEvents(query?)` / `GET /api/agent-tools/events`；该入口支持 `requestId`、`taskId`、`sessionId` 查询过滤，空白 query 按未传处理，非字符串 query 返回稳定 400；出口会重新 parse `ChatEventRecord` 并净化 payload，用于后续 SSE 广播接线。
- 后端 repository 已提供 `exportSnapshot()` / `restoreSnapshot()` 可替换持久化边界；snapshot 只暴露 `ExecutionRequestRecord`、`ExecutionResultRecord`、`ChatEventRecord` 与 approval projection，不暴露内部 `Map` 或索引结构。
- 后端已暴露 `GET /api/agent-tools/projection` 治理读取入口，返回当前 in-memory `requests`、`results`、`capabilities`、`nodes`、`events` 与从 request 收集的 `policyDecisions`，用于 Run Observatory/Admin projection 补拉；该入口支持 `requestId`、`taskId`、`sessionId` 查询过滤，过滤只收窄 execution records 与 event log，capability/node 目录仍保持全量治理视角。
- `agent-chat` 已提供纯请求 helper 与 SSE payload projection helper：`agent-tool-execution-api.ts`、`agent-tool-event-projections.ts`；REST facade 会用 `@agent/core` schema 解析 request、result、capability、node、policy、event 与 governance projection，并可按 `requestId`、`taskId`、`sessionId` 拉取过滤投影。
- `agent-chat` 的 governance projection timeline helper 会先消费事件流；当断流补拉缺少事件时，会用 request/result 生成稳定 fallback timeline，避免工具执行状态在重连后消失。
- `agent-chat` 的 `useChatSession` 会按当前 `activeSessionId` 与 `activeSession.currentTaskId` 补拉 `/api/agent-tools/projection`，当 active session 尚未带 `currentTaskId` 时用 checkpoint task id 兜底，避免只按 session 全局串会话；解析后的 `agentToolGovernanceProjection` 会暴露给 OpenClaw workbench 与 ThoughtChain，补拉失败不会打断聊天主流程。
- `agent-admin` 已通过 `/api/agent-tools/projection` 补拉治理投影，并在 API 层用 `@agent/core` schema 校验 `requests`、`results`、`capabilities`、`nodes`、`policyDecisions` 与 `events`；API helper 同样支持 `requestId`、`taskId`、`sessionId` 过滤。
- `agent-admin` 已提供 sandbox 与 auto review API helper，覆盖 profiles / preflight / run detail / cancel / approval resume，以及 review create / list / get / rerun / approval resume；这些 helper 只做前端最小结构校验，展示层仍应以本文和对应 API 文档为准处理字段演进。
- `agent-admin` Runtime Summary、Run Workbench 与 Run Observatory 已消费 `/api/agent-tools/projection`；详情侧会按当前 `taskId` 过滤 request/result/event/policy decision，只展示安全摘要，不渲染 raw input、raw output、完整 metadata 或 vendor/provider payload。
- `agent-admin` Runtime Summary 的 event log 已识别 `tool_stream_detected`、`tool_stream_dispatched`、`tool_stream_completed`、`execution_step_completed`、`execution_step_blocked`、`execution_step_resumed` 与工具审批恢复事件；blocked/resumed 计数只统计真实阻断/恢复，latest events 可展示 running/succeeded/failed/cancelled 生命周期。
- `agent-chat` OpenClaw workbench 已接入工具执行 section，优先从 `agentToolGovernanceProjection` 生成 timeline fallback；若没有补拉投影，则从 `chat.events` 投影 `tool_*`、`execution_step_*` 与 `tool_execution` interrupt 事件；policy decision 会进入工具执行 timeline，但只保留 `decisionId`、`decision`、`reasonCode`、`reason`、`requiresApproval`、`riskClass` 展示白名单，未知事件与冗余 raw/vendor/provider 字段保持忽略，不影响既有聊天、审批和 ThoughtChain 展示。
- `agent-admin` Runtime 工具区已新增 Requests 分栏，展示 request queue、状态、风险、节点标签与治理 badge；Risk / Nodes / Policy / Event Log 继续消费同一份 projection，不从 raw task dump 重算状态。
- 后端 facade 已补齐 API 合同测试，覆盖 controller path metadata、request/result 404/null 语义、400/409 错误 code、capability/node query、approval resume、cancel 与 health-check。

仍未落地的部分：

- request/result/event 真实落盘、异步真实 executor worker、真实 sandbox runner、真实 reviewer runner 与 SSE 广播仍需后续推进。
- 当前 facade 是稳定协议入口的最小实现，不代表工具执行主链已经替换现有 chat/runtime 内部工具链。

与 sandbox / auto-review 的职责边界：

- agent-tools 是跨端工具执行主入口，负责创建 execution request、统一审批恢复和输出治理 projection。
- sandbox 只负责执行前安全边界、profile、permission scope、run 状态与 sandbox 审批；它不替代 agent-tools request。
- auto-review 只负责结构化审查、finding、verdict 与审查阻断；它不替代 agent-tools 的 request/result 生命周期。
- agent-tools 写入 SSE / projection 时只可提取 `sandboxRunId`、`sandboxDecision`、`sandboxProfile`、`reviewId`、`autoReviewId`、`autoReviewVerdict`、`alias`、`approvalMode`、`approvalReasonCode`、`aliasReasonCode` 等白名单治理字段，不得展开 raw input、raw output、完整 metadata、vendor/provider payload 或第三方 response。

## REST Endpoints

| 方法   | 地址                                            | 参数                                                                                                                       | 返回值                          | 说明                                             |
| ------ | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------ |
| `GET`  | `/api/agent-tools/requests/:requestId`          | path: `requestId`                                                                                                          | `ExecutionRequestRecord`        | 获取单次工具执行请求投影。                       |
| `GET`  | `/api/agent-tools/requests/:requestId/result`   | path: `requestId`                                                                                                          | `ExecutionResultRecord \| null` | 获取工具执行结果；未完成时返回 `null`。          |
| `GET`  | `/api/agent-tools/events`                       | query: `requestId?: string`、`taskId?: string`、`sessionId?: string`                                                       | `ChatEventRecord[]`             | 获取当前 in-memory 工具执行事件投影。            |
| `GET`  | `/api/agent-tools/projection`                   | query: `requestId?: string`、`taskId?: string`、`sessionId?: string`                                                       | `AgentToolGovernanceProjection` | 获取后台治理面补拉用的工具执行聚合投影。         |
| `POST` | `/api/agent-tools/requests`                     | body: `CreateAgentToolExecutionRequest`                                                                                    | `AgentToolExecutionResponse`    | 创建工具执行请求，后端完成策略判定或排队。       |
| `POST` | `/api/agent-tools/requests/:requestId/cancel`   | path: `requestId`; body: `{ sessionId?: string; taskId?: string; actor?: string; reason?: string }`                        | `ExecutionRequestRecord`        | 取消尚未终态的工具执行请求。                     |
| `POST` | `/api/agent-tools/requests/:requestId/approval` | path: `requestId`; body: `{ sessionId: string; interrupt: AgentToolApprovalResumeInput; actor?: string; reason?: string }` | `AgentToolExecutionResponse`    | 从审批卡恢复工具执行。                           |
| `GET`  | `/api/agent-tools/capabilities`                 | query: `nodeId?: string`、`category?: string`、`riskClass?: string`、`requiresApproval?: boolean`                          | `ExecutionCapabilityRecord[]`   | 获取当前可见工具能力投影。                       |
| `GET`  | `/api/agent-tools/nodes`                        | query: `status?: string`、`kind?: string`、`sandboxMode?: string`、`riskClass?: string`                                    | `ExecutionNodeRecord[]`         | 获取可见执行节点列表。                           |
| `GET`  | `/api/agent-tools/nodes/:nodeId`                | path: `nodeId`                                                                                                             | `ExecutionNodeRecord`           | 获取单个执行节点详情。                           |
| `POST` | `/api/agent-tools/nodes/:nodeId/health-check`   | path: `nodeId`; body: `{ reason?: string; actor?: string }`                                                                | `ExecutionResultRecord`         | 触发受控健康检查，结果按执行结果 contract 写出。 |

`/api/agent-tools/*` 是 PR 1 文档约定的新稳定前缀。已有 chat/runtime 内部工具调用可以先保持内部入口，但跨端展示和新接入应迁移到本文前缀。

## Request Schema

`CreateAgentToolExecutionRequest`：

```ts
{
  sessionId?: string;
  taskId: string;
  nodeId?: string;
  capabilityId?: string;
  toolName?: string;
  alias?: "read" | "list" | "search" | "write" | "edit" | "delete" | "command";
  approvalMode?: "suggest" | "auto_edit" | "full_auto";
  requestedBy: {
    actor: "human" | "supervisor" | "ministry" | "specialist_agent" | "runtime";
    actorId?: string;
  };
  input: Record<string, unknown>;
  inputPreview?: string;
  riskClass?: "low" | "medium" | "high" | "critical";
  approvalIntent?: string;
  metadata?: Record<string, unknown>;
}
```

语义：

| 字段             | 说明                                                                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sessionId`      | 来自聊天会话时必填；后台治理或离线健康检查可缺省。                                                                                                |
| `taskId`         | 工具执行所属任务，必须可追踪到 runtime task 或治理任务。                                                                                          |
| `nodeId`         | 指定执行节点；缺省时由后端按 capability 和 policy 路由。                                                                                          |
| `capabilityId`   | 指定能力；与 `toolName` 或 alias 解析结果同时存在时，后端必须校验两者属于同一能力。                                                               |
| `toolName`       | 项目内稳定工具名，不是第三方 SDK 方法名；与 `alias` 至少提供一个。                                                                                |
| `alias`          | Agent-facing action alias；后端会在 policy 和执行前解析为稳定 `toolName`、`capabilityId`、`riskClass` 和标准化 input。                            |
| `approvalMode`   | Codex-style approval mode；可让低风险或 sandbox-safe 动作自动通过，但不能绕过 policy deny、sandbox、auto-review、approval projection 或事件审计。 |
| `requestedBy`    | 发起主体；用于审计、策略判定和 admin 过滤。                                                                                                       |
| `input`          | 工具输入原文；前端只展示受控摘要，不直接渲染敏感字段。                                                                                            |
| `inputPreview`   | 可展示摘要；缺省时由后端生成。                                                                                                                    |
| `riskClass`      | 调用方可提供初判；最终以后端 policy decision 写出的风险等级为准。                                                                                 |
| `approvalIntent` | 进入审批时展示的人类意图说明。                                                                                                                    |
| `metadata`       | 调试和扩展字段；不得承载替代稳定字段的核心语义。                                                                                                  |

## Response Schema

`AgentToolExecutionResponse`：

```ts
{
  request: ExecutionRequestRecord;
  policyDecision?: ExecutionPolicyDecisionRecord;
  result?: ExecutionResultRecord;
  approval?: {
    approvalId: string;
    interruptId: string;
    resumeEndpoint: "/api/agent-tools/requests/:requestId/approval";
    resumePayload: AgentToolApprovalResumeInput;
  };
}
```

`AgentToolGovernanceProjection`：

```ts
{
  requests: ExecutionRequestRecord[];
  results: ExecutionResultRecord[];
  capabilities: ExecutionCapabilityRecord[];
  nodes: ExecutionNodeRecord[];
  policyDecisions: ExecutionPolicyDecisionRecord[];
  events: ChatEventRecord[];
}
```

语义：

| 字段              | 说明                                                                                                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `requests`        | 当前可见工具执行请求投影，按 in-memory repository 写入顺序返回。                                                                                                     |
| `results`         | 已写入的终态执行结果；未完成 request 不会在此数组中出现。                                                                                                            |
| `capabilities`    | 当前可见工具能力目录，来自 `@agent/tools` 默认 registry 投影。                                                                                                       |
| `nodes`           | 当前可见执行节点目录。                                                                                                                                               |
| `policyDecisions` | 从 request 收集的策略判定记录，用于治理视图展示允许、拒绝和审批门。                                                                                                  |
| `events`          | 当前 in-memory `ChatEventRecord` 事件日志，按 append 顺序返回；payload 只保留治理白名单与安全摘要，`reviewId` 是 auto-review 关联字段，`autoReviewId` 仅作兼容字段。 |

`/api/agent-tools/events` 与 `/api/agent-tools/projection` 共用过滤语义：

- 不带 query 时返回当前可见全量 execution projection。
- `requestId`、`taskId`、`sessionId` 可以单独或组合使用；后端按 `ExecutionRequestRecord` 先过滤 request，再只返回对应 result、policy decision 与 event log。
- event log 会优先通过 `payload.requestId` 关联已匹配 request；若事件 payload 自带 `taskId` 或 `sessionId`，也可用于直接匹配。
- `capabilities` 与 `nodes` 不受 projection query 收窄，保持治理目录完整，避免前端因局部 request 过滤误判当前 runtime 能力边界。
- `/api/agent-tools/events` 只返回 event log；`requestId` 不存在时返回 `agent_tool_request_not_found`，`taskId` / `sessionId` 没有匹配 request 时返回空数组。

状态语义使用 `ExecutionRequestStatusSchema`：

```text
pending_policy -> pending_approval / queued / denied -> running -> succeeded / failed / cancelled
```

约束：

- `policyDecision.decision = "allow"` 时，可进入 `queued` 或直接返回已完成 `result`。
- `policyDecision.decision = "require_approval"` 时，`request.status` 必须为 `pending_approval`，并返回 `approval`。
- `policyDecision.decision = "deny"` 时，`request.status` 必须为 `denied`，不得进入执行队列。
- `result.status` 只允许 `succeeded`、`failed`、`cancelled`。

## SSE Events

Agent Tool 执行事件优先通过 `GET /api/chat/stream?sessionId=...` 暴露给 `agent-chat`，后台治理页可通过 Runtime / Run Observatory projection 补拉。数据帧仍为 `ChatEventRecord`。

相关事件：

| 事件类型                           | payload 关键字段                                                                                                                                                                                                                           | 说明                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| `tool_selected`                    | `{ requestId?: string; toolName: string; capabilityId?: string; nodeId?: string; riskClass?: string }`                                                                                                                                     | Runtime 已选择工具或能力。                          |
| `tool_called`                      | `{ requestId: string; toolName: string; inputPreview?: string; policyDecision?: unknown; sandboxRunId?: string; sandboxDecision?: string; sandboxProfile?: string; reviewId?: string; autoReviewId?: string; autoReviewVerdict?: string }` | 工具调用请求已创建；治理字段只来自白名单 metadata。 |
| `tool_stream_detected`             | `{ requestId: string; streamKind?: string }`                                                                                                                                                                                               | 后端检测到工具有流式输出。                          |
| `tool_stream_dispatched`           | `{ requestId: string; chunk?: string; outputPreview?: string }`                                                                                                                                                                            | 工具流式片段已派发。                                |
| `tool_stream_completed`            | `{ requestId: string; resultId?: string; status: "succeeded" \| "failed" \| "cancelled" }`                                                                                                                                                 | 工具流式输出结束。                                  |
| `execution_step_started`           | `{ requestId: string; nodeId?: string; toolName?: string; stage?: string; sandboxRunId?: string; reviewId?: string; autoReviewId?: string }`                                                                                               | 工具执行进入运行态。                                |
| `execution_step_completed`         | `{ requestId: string; resultId?: string; status: string; outputPreview?: string; sandboxRunId?: string; reviewId?: string; autoReviewId?: string }`                                                                                        | 工具执行完成。                                      |
| `execution_step_blocked`           | `{ requestId: string; reasonCode: string; approvalId?: string; interruptId?: string; sandboxRunId?: string; sandboxProfile?: string; reviewId?: string; autoReviewId?: string; autoReviewVerdict?: string }`                               | 策略、审批、sandbox 或 auto review 阻断。           |
| `execution_step_resumed`           | `{ requestId: string; approvalId?: string; interruptId?: string; action: string; reviewId?: string; autoReviewId?: string }`                                                                                                               | 审批恢复后继续或终止执行。                          |
| `interrupt_pending`                | `{ interruptId: string; kind: "tool_execution"; requestId: string; approvalId?: string; reviewId?: string; autoReviewId?: string; autoReviewVerdict?: string }`                                                                            | 新链路审批等待事件。                                |
| `interrupt_resumed`                | `{ interruptId: string; kind: "tool_execution"; requestId: string; action: string; reviewId?: string; autoReviewId?: string }`                                                                                                             | 审批已恢复。                                        |
| `interrupt_rejected_with_feedback` | `{ interruptId: string; kind: "tool_execution"; requestId: string; feedback?: string; reviewId?: string; autoReviewId?: string }`                                                                                                          | 带反馈打回。                                        |

旧 `approval_required`、`approval_resolved`、`approval_rejected_with_feedback` 只作为 legacy fallback；新前端应优先消费 `interrupt_*` 和 `execution_step_*`。

## Approval Resume Payload

`AgentToolApprovalResumeInput` 复用 chat 审批恢复语义，并增加工具执行上下文：

```ts
{
  interruptId?: string;
  action: "approve" | "reject" | "feedback" | "input" | "bypass" | "abort";
  requestId: string;
  approvalId?: string;
  feedback?: string;
  value?: string;
  payload?: {
    toolInputPatch?: Record<string, unknown>;
    approvalScope?: "once" | "session" | "always";
    reasonCode?: string;
    [key: string]: unknown;
  };
}
```

恢复规则：

- `approve`：允许当前 request 继续执行；若 `approvalScope` 非 `once`，后端必须写入可审计 policy record。
- `reject`：拒绝当前 request，状态进入 `denied` 或 `cancelled`，不得继续执行工具。
- `feedback`：打回给 Runtime / Supervisor，必须保留 `feedback` 到 interrupt history。
- `input`：补充缺失输入，`value` 或 `payload.toolInputPatch` 至少存在一个。
- `bypass`：仅允许有治理权限的 actor 使用，用于管理员明确越过非强制门。
- `abort`：终止当前 interrupt 和 request，状态进入 `cancelled`。

## Error Semantics

| 错误码                            | 建议 HTTP 状态 | 语义                                                          |
| --------------------------------- | -------------- | ------------------------------------------------------------- |
| `agent_tool_request_invalid`      | `400`          | 请求体不符合 schema，或 `toolName` 与 `capabilityId` 不一致。 |
| `agent_tool_request_not_found`    | `404`          | 指定 execution request 不存在或当前调用方不可见。             |
| `agent_tool_node_not_found`       | `404`          | 指定执行节点不存在或不可见。                                  |
| `agent_tool_capability_not_found` | `404`          | 指定能力不存在、禁用或不属于该节点。                          |
| `agent_tool_forbidden`            | `403`          | 调用方无权查看、创建、取消或恢复该工具执行。                  |
| `agent_tool_policy_denied`        | `403`          | 策略明确拒绝执行。                                            |
| `agent_tool_approval_required`    | `409`          | 当前 request 必须先审批，不能直接执行或取消外的动作。         |
| `agent_tool_conflict`             | `409`          | request 已终态、重复恢复、重复取消或状态游标过期。            |
| `agent_tool_execution_failed`     | `500`          | 工具执行失败；响应不得泄漏第三方原始错误对象。                |
| `agent_tool_executor_unavailable` | `503`          | 执行节点、sandbox、MCP transport 或 worker 不可用。           |

错误响应使用项目统一 error envelope。可附带 `requestId`、`nodeId`、`capabilityId`、`decisionId`、`approvalId` 和 `interruptId` 作为诊断上下文。

## 前后端职责

后端负责：

- 解析 request，匹配 node / capability，生成 `ExecutionRequestRecord`。
- 执行 policy decision，写出 `ExecutionPolicyDecisionRecord`。
- 按策略进入 queue、approval、deny 或 terminal result。
- 隐藏第三方 executor、MCP、终端和浏览器原始错误结构。
- 将关键状态写入 SSE、checkpoint、run observability 和 admin projection。

`agent-chat` 负责：

- 从 SSE 展示工具执行进度、审批卡和终态。
- 通过 `approval.resumeEndpoint` 或 chat 审批动作提交恢复 payload。
- 断流后通过 checkpoint / events / request detail / governance projection 校准状态；`useChatSession` 的治理投影补拉必须按当前 session/task 过滤，payload 必须先经过 `@agent/core` schema parse。
- OpenClaw workbench 的工具执行 section 可以直接消费治理投影生成 timeline fallback；governance projection 转 timeline 时优先使用 `events`，若某个 request 没有事件，使用 request 生成 `tool_called` fallback，若 result 存在且没有终态事件，追加 result fallback，避免重连补拉只拿到 record 却没有可见过程项。

`agent-admin` 负责：

- 展示 execution request、node、capability、policy decision 与 result。
- 对健康检查、取消、审批恢复等治理动作显示审计上下文。
- 不从 raw task dump 推导工具状态，优先消费本文和 Runtime / Run Observatory projection；从 `/api/agent-tools/projection` 补拉的数据必须先经过 `@agent/core` schema parse。
- Runtime Summary 的 event log 展示工具流与执行终态，但 blocked/resumed 指标必须只从阻断/恢复事件计算，不能从 request 当前状态反推。
- Selected Run / Run Observatory 必须按当前 `taskId` 调用 `/api/agent-tools/projection?taskId=...`，避免多个 run 的工具事件在详情页串流；projection 数据继续只展示 input/output 摘要，不渲染 raw input 或第三方 vendor/provider payload。
- Runtime Summary 与 Run Observatory 可以展示 request metadata 中的 sandbox / auto-review 白名单治理 badge；auto-review 展示关联优先使用 `reviewId`，`autoReviewId` 只作历史兼容字段，但不得展示 `metadata.input`、`rawInput`、vendor/provider payload 或未脱敏 output。
- `agent-chat` 与 `agent-admin` 的展示投影必须只消费白名单字段；即使后端、历史事件或测试 fixture 携带 `input`、`rawInput`、`rawOutput`、`metadata`、`vendorObject`、`vendorPayload`、`vendorResponse`、`rawVendorResponse`、`providerResponse`、`rawProviderResponse`，也不得进入 summary、badge、policy decision 展示对象。

## Compatibility Rules

- 新字段必须向后兼容；旧前端忽略未知字段时不得影响核心状态展示。
- `toolName` 是项目稳定工具名，不能替换成第三方 SDK 方法名或 MCP vendor 名。
- 高风险工具必须走 policy decision；不能由前端自行判断是否需要审批。
- `approval_*` 事件只作历史兼容，新实现必须写出 `interrupt_*`。
- 任何状态、错误码、resume payload 破坏式调整前，必须先更新本文、core schema 或真实宿主 schema，以及对应 parse / integration 测试。
