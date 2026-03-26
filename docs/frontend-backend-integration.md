# 前后端对接文档

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

这是网页聊天场景更稳定的实现方式。

补充说明：

- 首条消息现在也统一通过 `POST /api/chat/messages` 提交
- `POST /api/chat/sessions` 只负责创建空会话并返回 `sessionId`

---

## 2. 后端接口

后端控制器：

- `apps/backend/agent-server/src/chat/chat.controller.ts`

基础列表与详情：

- `GET /api/chat/sessions`
  - 获取会话列表
- `POST /api/chat/sessions`
  - 创建新会话
- `GET /api/chat/sessions/:id`
  - 获取会话详情
- `GET /api/chat/messages?sessionId=...`
  - 获取消息列表
- `GET /api/chat/events?sessionId=...`
  - 获取事件列表
- `GET /api/chat/checkpoint?sessionId=...`
  - 获取当前运行态快照

会话动作：

- `POST /api/chat/messages`
  - 在已有会话中继续发消息
- `POST /api/chat/approve`
  - 审批通过
- `POST /api/chat/reject`
  - 审批拒绝
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
- 当前前端同时具备轮询兜底：
  - 当 SSE 正常连接时
    - 仅轻量补拉 `checkpoint`
  - 当 SSE 断流或异常时
    - 自动切换为 `messages / events / checkpoint` 全量轮询
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
  - detail/checkpoint 轮询是可靠性兜底
  - 如果普通聊天命中 `direct-reply` 但模型调用失败，后端必须把失败摘要写入：
    - `agentStates[].observations`
    - `trace.direct_reply_fallback`
  - 前端必须把这类失败显示为可见的 Runtime Issue，不能只展示兜底回复。

---

## 3. 主要返回类型

共享类型定义：

- `packages/shared/src/types.ts`

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
    | 'approval_required'
    | 'approval_resolved'
    | 'approval_rejected_with_feedback'
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

### 3.4 ChatCheckpointRecord

```ts
interface ChatCheckpointRecord {
  sessionId: string;
  taskId: string;
  runId?: string;
  skillId?: string;
  skillStage?: string;
  resolvedWorkflow?: WorkflowPresetDefinition;
  currentNode?: string;
  currentMinistry?: WorkerDomain;
  currentWorker?: string;
  pendingAction?: PendingActionRecord;
  pendingApproval?: PendingApprovalRecord;
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
- `packages/agent-core/src/session/session-coordinator.ts`

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
- `approval_required`
- `approval_resolved`
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

## 7. 当前 agent-core 推荐结构

建议 `packages/agent-core/src` 后续按这套结构继续整理：

```text
src/
├─ adapters/
├─ flows/
├─ governance/
├─ graphs/
├─ runtime/
├─ session/
├─ shared/
├─ workflows/
└─ types/
```

推荐解释：

- `adapters/`
  - 对接 LLM、tools、memory、session 等外部能力
- `flows/`
  - 按聊天流、审批流、学习流组织 `nodes/prompts/schemas/utils`
- `governance/`
  - 管理 worker registry、model routing policy、预算与治理策略
- `graphs/`
  - 只放图定义与编排入口
- `shared/`
  - 多 flow 共用的 prompt、schema、事件映射
- `runtime/`
  - Agent 运行时上下文
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
