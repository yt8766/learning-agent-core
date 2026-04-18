# 前后端对接文档

状态：current
文档类型：integration
适用范围：`apps/backend/agent-server`、`apps/frontend/agent-chat`、`apps/frontend/agent-admin`
最后核对：2026-04-16

本主题主文档：

- 本文是前后端对接总入口；涉及聊天主链、SSE、runtime center、审批恢复时，默认先看本文

本文只覆盖：

- 前后端整体接口边界
- 聊天主链与 admin 侧关键对接点
- 与专题文档之间的总分关系

相关专题文档：

- `SSE / chat session` 细节： [chat-session-sse.md](/docs/integration/chat-session-sse.md)
- `approval / reject / recover` 细节： [approval-recovery.md](/docs/integration/approval-recovery.md)
- `runtime center / admin API` 细节： [runtime-centers-api.md](/docs/integration/runtime-centers-api.md)

当前专题拆分：

- [Chat Session And SSE](/docs/integration/chat-session-sse.md)
- [Runtime Centers API](/docs/integration/runtime-centers-api.md)
- [Approval Recovery](/docs/integration/approval-recovery.md)

## 1. 总体链路

当前聊天主链路采用：

1. 前端发送用户消息
2. 前端先创建或续接 chat session
3. `SessionCoordinator` 调用 `AgentOrchestrator`
4. `Supervisor / Workflow / Ministry workers` 按规划执行
5. 后端通过 SSE 持续返回事件
6. 前端按事件增量更新消息区、事件流、运行态和审批状态

说明：

- 当前实现仍兼容部分旧 `manager / research / executor / reviewer` 事件与类型
- 新增前后端实现应优先以 `supervisor / ministry / workflow / evidence / learning` 语义为准
- 文档中的旧命名如有出现，应理解为过渡兼容层，而不是目标架构

当前不是“`POST /messages` 直接流式返回正文”，而是：

- `POST /api/chat/messages`
  - 负责提交消息
- `GET /api/chat/stream?sessionId=...`
  - 负责流式返回事件与 token

同时后端也提供一条轻量直连大模型的 SSE 接口：

- `POST /api/chat`
  - 请求体可传 `message` 或 `messages`
  - 可选传 `systemPrompt`、`modelId`、`temperature`、`maxTokens`
  - 直接以 `text/event-stream` 返回 `token / done / error` 事件
  - 适合不需要会话编排、只需要流式模型回复的简单场景

这是网页聊天场景更稳定的实现方式。

补充说明：

- 首条消息现在也统一通过 `POST /api/chat/messages` 提交
- `POST /api/chat/sessions` 只负责创建空会话并返回 `sessionId`
- `agent-chat` 当前已支持在发送前一键切换模型：
  - 默认值为“自动选择”，保持治理路由自动选模
  - 用户手动选择模型后，仅覆盖当前消息触发的这一轮执行
  - 下拉项由 `GET /api/chat/models` 动态返回，适配运行时新增 provider 或模型

---

## 2. 后端接口

后端控制器：

- `apps/backend/agent-server/src/chat/chat.controller.ts`

基础列表与详情：

- `GET /api/chat/sessions`
  - 获取会话列表
- `POST /api/chat/sessions`
  - 创建新会话
- `GET /api/chat/models`
  - 获取当前运行时可选模型列表
  - 返回值来自后端实际挂载的 LLM provider，前端不再硬编码模型枚举
  - `agent-chat` 聊天输入框的“切换模型”下拉框默认消费这条接口
- `GET /api/chat/sessions/:id`
  - 获取会话详情
- `GET /api/chat/messages?sessionId=...`
  - 获取消息列表
- `GET /api/chat/events?sessionId=...`
  - 获取事件列表
- `GET /api/chat/checkpoint?sessionId=...`
  - 获取当前运行态快照

平台治理与导出接口补充：

- `GET /platform/console?days=30&status=&model=&pricingSource=&runtimeExecutionMode=&runtimeInteractionKind=&approvalsExecutionMode=&approvalsInteractionKind=`
  - 获取整包 Platform Console 数据
  - 当前只会对 `runtime` 与 `approvals` 两块做过滤裁剪
  - 其他 center 仍保持全量返回
  - 用于让 admin 的 `refreshAll` / `refreshTask` 与分中心 refresh 保持同一组筛选语义
- `GET /platform/runtime-center?days=30&status=&model=&pricingSource=&executionMode=&interactionKind=`
  - 获取 Runtime Center 数据
  - `executionMode` 的 canonical 写出始终对应 `executionPlan.mode`：
    - `plan`
    - `execute`
    - `imperial_direct`
  - 兼容读取旧别名：
    - `standard -> execute`
    - `planning-readonly -> plan`
  - 新任务、新导出、新分享链接只应写出 canonical 值，不再回写旧别名
  - `interactionKind` 当前支持：
    - `approval`
    - `plan-question`
    - `supplemental-input`
- `GET /platform/runtime-center/export?...`
  - 导出 Runtime Center
  - 会沿用同一组 runtime 过滤参数
  - 前端可直接把这条 URL 作为“当前运行视角分享链接”复制给其他操作者
  - CSV 当前额外包含：
    - `filterExecutionMode`
    - `filterInteractionKind`
    - 每条 run 的 `executionMode`
    - 每条 run 的 `interactionKind`
- `GET /platform/approvals-center?executionMode=&interactionKind=`
  - 获取 Approvals Center 数据
  - 与 `agent-admin` 的审批中心筛选一致
- `GET /platform/approvals-center/export?...`
  - 导出 Approvals Center
  - 当前支持：
    - `executionMode`
    - `interactionKind`
  - 前端可直接把这条 URL 作为“当前审批视角分享链接”复制给其他操作者
  - CSV 当前额外包含：
    - `filterExecutionMode`
    - `filterInteractionKind`
    - 每条审批项的 `executionMode`
    - 每条审批项的 `interactionKind`

会话动作：

- `POST /api/chat/messages`
  - 在已有会话中继续发消息
  - 当前请求体除 `sessionId`、`message` 外，还可选传 `modelId`
  - 当传入 `modelId` 时，本轮消息会把该模型写入 `requestedHints.preferredModelId`
  - Runtime 会优先按该显式模型路由，并同步覆盖当前 worker 的实际调用模型
- `POST /api/chat/approve`
  - 审批通过或恢复中断
- `POST /api/chat/reject`
  - 审批拒绝、取消中断或打回恢复
- `POST /api/chat/learning/confirm`
  - 确认学习候选
- `POST /api/chat/recover`
  - 从 checkpoint 恢复

流式接口：

- `GET /api/chat/stream?sessionId=...`
  - `Content-Type: text/event-stream`
  - 返回标准 SSE 数据帧
  - 连接建立后会先发送注释包 `: stream-open`
  - 运行期间会周期性发送 `: keep-alive` 防止代理或浏览器误断流

流式可靠性约定：

- `agent-chat` 优先消费 `/api/chat/stream` 的 SSE 事件。
- 当前前端采用“stream 主通道 + snapshot 兜底”：
  - 当 SSE 正常连接时
    - 不轮询 `messages`
    - 不轮询 `events`
    - 仅在必要时轻量补拉 `checkpoint`
  - 当 SSE 断流、idle close 或终态事件缺失时
    - 优先使用 `checkpoint` 收口运行态
    - 再按需补拉 `messages / events / checkpoint` 做一次终态校准
- 当前前端还要求：
  - 如果 `checkpoint` 已经进入 `completed / failed / cancelled`
  - 即使终态 SSE 事件漏到前端
  - 也必须立刻把 `session.status` 收口到终态
  - 并补拉一次 `messages / events / checkpoint`，避免同一会话第二轮一直 loading
- 目的：
  - 避免浏览器 `EventSource` 丢包
  - 避免跨域凭证或网络抖动导致“界面看起来没有返回”
- 约定：
  - SSE 是首选实时通道
  - `checkpoint` 是运行态兜底
  - `messages / events` 是历史恢复与终态校准
  - 如果普通聊天命中 `direct-reply` 但模型调用失败，后端必须把失败摘要写入：
    - `agentStates[].observations`
    - `trace.direct_reply_fallback`
  - 前端必须把这类失败显示为可见的 Runtime Issue，不能只展示兜底回复。

---

## 3. 主要返回类型

共享类型定义：

- 当前以 `packages/core` 与各宿主本地 facade/compat 类型层为准；`packages/shared` 已退场

### 3.1 ChatSessionRecord

```ts
interface ChatSessionRecord {
  id: string;
  title: string;
  status:
    | 'idle'
    | 'running'
    | 'waiting_approval'
    | 'waiting_learning_confirmation'
    | 'cancelled'
    | 'completed'
    | 'failed';
  currentTaskId?: string;
  compression?: {
    summary: string;
    condensedMessageCount: number;
    condensedCharacterCount: number;
    totalCharacterCount: number;
    trigger: 'message_count' | 'character_count';
    source: 'heuristic' | 'llm';
    updatedAt: string;
  };
  createdAt: string;
  updatedAt: string;
}
```

### 3.2 ChatMessageRecord

```ts
interface ChatMessageRecord {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  linkedAgent?: 'manager' | 'research' | 'executor' | 'reviewer';
  card?:
    | {
        type: 'approval_request';
        intent: string;
        toolName?: string;
        reason?: string;
        riskLevel?: RiskLevel;
        requestedBy?: string;
      }
    | {
        type: 'run_cancelled';
        reason?: string;
      };
  createdAt: string;
}
```

补充说明：

- `linkedAgent` 当前仍使用旧枚举做兼容
- 面向新能力设计时，应更关注 `currentMinistry`、`currentWorker`、`resolvedWorkflow`、`thoughtChain`、`thinkState` 等运行态字段

### 3.3 ChatEventRecord

```ts
interface ChatEventRecord {
  id: string;
  sessionId: string;
  type:
    | 'decree_received'
    | 'session_started'
    | 'user_message'
    | 'supervisor_planned'
    | 'libu_routed'
    | 'ministry_started'
    | 'ministry_reported'
    | 'skill_resolved'
    | 'skill_stage_started'
    | 'skill_stage_completed'
    | 'manager_planned'
    | 'subtask_dispatched'
    | 'research_progress'
    | 'tool_selected'
    | 'tool_called'
    | 'interrupt_pending'
    | 'interrupt_resumed'
    | 'interrupt_rejected_with_feedback'
    | 'approval_required' // legacy fallback
    | 'approval_resolved' // legacy fallback
    | 'approval_rejected_with_feedback' // legacy fallback
    | 'review_completed'
    | 'learning_pending_confirmation'
    | 'learning_confirmed'
    | 'conversation_compacted'
    | 'assistant_token'
    | 'assistant_message'
    | 'run_resumed'
    | 'run_cancelled'
    | 'budget_exhausted'
    | 'final_response_delta'
    | 'final_response_completed'
    | 'session_finished'
    | 'session_failed';
  at: string;
  payload: Record<string, unknown>;
}
```

补充说明：

- 新实现默认优先发 `interrupt_*`
- `approval_*` 仅用于兼容历史会话和旧链路
- `interrupt_pending` 可同时承载：
  - 操作确认：`interactionKind = 'approval'`
  - 计划提问：`interactionKind = 'plan-question'`
  - 补充输入：`interactionKind = 'supplemental-input'`

`plan-question` 示例 payload：

```ts
{
  taskId: "task_123",
  intent: "plan_question",
  interruptId: "interrupt_task_123_plan_question",
  interactionKind: "plan-question",
  questionSet: {
    title: "方案确认",
    summary: "存在几个会改变执行路径的关键未知项。"
  },
  questions: [
    {
      id: "delivery_mode",
      question: "这一轮更希望我输出哪种方案结果？",
      questionType: "direction",
      options: [
        { id: "plan_only", label: "只出方案", description: "收敛计划，不进入实现。" },
        { id: "implement_now", label: "直接实现", description: "跳过计划，直接进入执行。" }
      ],
      recommendedOptionId: "plan_only",
      allowFreeform: true,
      defaultAssumption: "默认只出方案。"
    }
  ]
}
```

### 3.4 ChatCheckpointRecord

```ts
interface ChatCheckpointRecord {
  sessionId: string;
  taskId: string;
  runId?: string;
  skillId?: string;
  executionMode?: 'standard' | 'planning-readonly' | 'plan' | 'execute' | 'imperial_direct';
  skillStage?: string;
  resolvedWorkflow?: WorkflowPresetDefinition;
  currentNode?: string;
  currentMinistry?: WorkerDomain;
  currentWorker?: string;
  pendingAction?: PendingActionRecord;
  pendingApproval?: PendingApprovalRecord;
  activeInterrupt?: ApprovalInterruptRecord; // 兼容字段，运行归属为 司礼监 / InterruptController
  approvalFeedback?: string;
  modelRoute?: ModelRouteDecision[];
  externalSources?: EvidenceRecord[];
  reusedMemories?: string[];
  reusedRules?: string[];
  reusedSkills?: string[];
  learningEvaluation?: LearningEvaluationRecord;
  budgetState?: BudgetState;
  llmUsage?: LlmUsageRecord;
  traceCursor: number;
  messageCursor: number;
  approvalCursor: number;
  learningCursor: number;
  graphState: {
    status: TaskStatus;
    currentStep?: string;
    retryCount?: number;
    maxRetries?: number;
  };
  pendingApprovals: ApprovalRecord[];
  agentStates: AgentExecutionState[];
  thoughtChain?: ChatThoughtChainItem[];
  thinkState?: ChatThinkState;
  createdAt: string;
  updatedAt: string;
}
```

---

## 4. SSE 返回规则

SSE 实现位置：

- `apps/backend/agent-server/src/chat/chat.controller.ts`
- `packages/runtime/src/session/session-coordinator.ts`

### 4.1 首次连接

`GET /stream` 建立后：

- 会先回放当前会话已有事件
- 但不会回放 `assistant_token`

原因：

- `assistant_token` 是增量 token
- 如果历史重放它，前端会把旧 token 再拼一遍，导致重复文本

### 4.2 执行中增量推送

后端会持续推送这些事件：

- `decree_received`
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
- `tool_called`
- `review_completed`
- `interrupt_pending`
- `interrupt_resumed`
- `interrupt_rejected_with_feedback`
- `learning_pending_confirmation`
- `assistant_token`
- `assistant_message`

其中：

- `assistant_token`
  - 用于前端逐 token 拼接回答
- `assistant_message`
  - 用于最终完整回答落盘和兜底展示
- `supervisor_planned / ministry_*`
  - 是当前主线推荐消费事件，适合驱动 Think、ThoughtChain、Evidence、运行态面板
- `manager_planned / research_progress`
  - 仍可能出现，但主要用于兼容旧流程

---

## 5. 前端接入方式

前端 API 文件：

- `apps/frontend/agent-chat/src/api/chat-api.ts`

前端会话 Hook：

- `apps/frontend/agent-chat/src/hooks/use-chat-session.ts`

### 5.1 创建会话

前端调用：

```ts
createSession(undefined, title?)
```

对应后端：

```http
POST /api/chat/sessions
```

返回：

- `ChatSessionRecord`

注意：

- 该接口现在只负责创建空会话
- 首条消息与后续消息统一都通过 `POST /api/chat/messages` 提交

### 5.2 续聊

前端调用：

```ts
appendMessage(sessionId, message);
```

对应后端：

```http
POST /api/chat/messages
```

返回：

- 新增的 `ChatMessageRecord`

注意：

- 这个接口本身不是流式返回
- 真正的流式更新来自 `/stream`
- `sessionId` 通过 body 显式传递，不再建议只依赖 cookie
- 首条消息和后续消息都走这个接口

### 5.3 建立 SSE

前端调用：

```ts
createSessionStream(sessionId);
```

底层是：

```ts
new EventSource(`${API_BASE}/chat/stream?sessionId=${sessionId}`);
```

推荐所有客户端都显式传 `sessionId`：

- 查询接口通过 query 传递
- 写接口通过 body 传递
- SSE 通过 query 传递

当前后端仍兼容从 `agent_session_id` cookie 中推断 `sessionId`，但这只是兼容层，不建议作为新接入默认方案。

### 5.4 前端收到 SSE 后怎么做

当前实现：

1. `setEvents(current => mergeEvent(current, nextEvent))`
2. 调用 `syncMessageFromEvent(nextEvent)`
3. 再刷新轻量运行态：
   - `checkpoint`
   - `sessions`

当前不会在每个事件上都重新拉：

- `messages`
- `events`
- `checkpoint`
- `sessions`

这样做是为了减少重复请求。

---

## 6. assistant_token 如何接成“流式消息”

前端实现文件：

- `apps/frontend/agent-chat/src/hooks/use-chat-session.ts`

当前规则：

- 如果 SSE 事件类型是 `assistant_token`
- 就从 `payload.messageId` 和 `payload.content` 取增量 token
- 用 `mergeOrAppendMessage(..., appendContent = true)` 把 token 追加到同一条 assistant 消息上

伪代码：

```ts
if (event.type === 'assistant_token') {
  mergeOrAppendMessage(
    current,
    {
      id: messageId,
      role: 'assistant',
      content: token
    },
    true
  );
}
```

所以前端看到的是：

- 同一条 assistant 消息逐步变长
- 而不是不断新增很多 assistant 消息

---

## 7. 当前 runtime / agents 推荐结构

建议按 `packages/runtime/src` 与对应 `agents/*/src` 的宿主边界继续整理：

```text
packages/runtime/src/
├─ flows/
├─ governance/
├─ graphs/
├─ runtime/
├─ session/
├─ capabilities/
└─ types/

agents/<domain>/src/
├─ flows/
├─ graphs/
├─ runtime/
├─ shared/
└─ types/
```

推荐解释：

- `flows/`
  - 按聊天流、审批流、学习流组织 `nodes/prompts/schemas/utils`
- `governance/`
  - 管理 worker registry、model routing policy、预算与治理策略
- `graphs/`
  - 只放图定义与编排入口
- `runtime/`
  - Agent 运行时上下文
- `shared/`
  - 放在对应 agent 宿主下，承载多 flow 共用的 prompt、schema、事件映射
- `session/`
  - 会话、checkpoint、事件持久化
- `workflows/`
  - 负责工作流预设、领域动作组合与策略化编排

这样可以和当前 `workflow + governance + graph + session` 的拆分保持一致。

---

## 8. 前后端联调顺序

### 8.1 启动后端

```bash
pnpm --dir apps/backend/agent-server start:dev
```

### 8.2 启动前端

```bash
pnpm --dir apps/frontend/agent-chat dev
```

### 8.3 联调步骤

1. 前端创建会话
2. 后端返回 `ChatSessionRecord`
3. 前端立刻建立 `/stream`
4. 前端发送消息或后端自动启动首轮任务
5. 后端通过 SSE 推送：
   - supervisor 规划
   - ministry 路由与执行
   - 工具调用
   - 审批
   - learning 建议
   - token
   - 完整回答
6. 前端更新：
   - 会话列表
   - 消息区
   - 事件流
   - checkpoint
   - 审批区
   - 学习确认区
   - Think / ThoughtChain / Evidence 区

---

## 9. 常见问题

### 为什么 `/messages` 不是流式？

因为当前设计是：

- `POST /messages` 负责提交输入
- `GET /stream` 负责持续输出

这是浏览器端最稳的模式，也是当前项目中 Agent 会话、审批、学习确认统一走一条事件流的基础。

### 为什么以前会重复请求 `/messages`？

因为之前：

- 发送成功后手动全量刷新一次
- SSE 到一条事件后又全量刷新一次
- React 开发模式下还可能双触发 effect

现在已经改成：

- 发送后本地合并用户消息
- SSE 到来后增量合并消息和事件
- 只轻量刷新运行态

### 为什么会只看到 `Read package.json`？

那代表当时后端没正确拿到 LLM 配置，走了本地工具兜底。
现在已经把配置读取改成从仓库根目录 `.env` 自动加载，重启后端后应优先走大模型。

---

## 10. 当前对接约束

1. `agent-chat` 必须保留审批、恢复、Think、ThoughtChain、Evidence、Learning suggestions 这些主链能力，但默认呈现应优先顺滑对话：
   - 主聊天区默认只展示用户消息、Agent 最终回复、必要审批/终止卡
   - Think、ThoughtChain、Evidence、Learning、Skill、Route 等运行态信息优先收纳到 workbench / runtime panel
2. `agent-admin` 负责 Runtime、Approvals、Learning、Skill Lab、Evidence、Connector & Policy 六大中心，不与 `agent-chat` 重叠造轮子
3. 前后端共享领域字段时，优先扩展 `TaskRecord`、`ChatCheckpointRecord`、`SkillCard`、`EvidenceRecord`、`McpCapability`
4. 新增 SSE 事件优先按 `supervisor / ministry / workflow / learning / evidence` 语义命名
5. 保留旧事件名时，应同时写明兼容计划，避免接口层长期停留在旧模型

---

## 11. 建议的后续工作

1. 继续把 `agent-core` 内剩余旧命名迁到 `supervisor / ministry / workflow`
2. 给前端消息区补真正的“最后一条 assistant 流式打字效果”
3. 给后端补一个专门的流式调试接口，便于只测 token 输出
4. 在 `agent-admin` 中增加 chat session 观测页，方便从运维视角排查多 Agent 流程
