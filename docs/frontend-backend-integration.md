# 前后端对接文档

## 1. 总体链路

当前聊天主链路采用：

1. 前端发送用户消息
2. 后端创建或续接 chat session
3. `SessionCoordinator` 调用 `AgentOrchestrator`
4. `Manager / Research / Executor / Reviewer` 依次执行
5. 后端通过 SSE 持续返回事件
6. 前端按事件增量更新消息区、事件流、运行态和审批状态

当前不是“`POST /messages` 直接流式返回正文”，而是：

- `POST /api/chat/sessions/:id/messages`
  - 负责提交消息
- `GET /api/chat/sessions/:id/stream`
  - 负责流式返回事件与 token

这是网页聊天场景更稳定的实现方式。

---

## 2. 后端接口

后端控制器：

- `apps/backend/agent-server/src/chat/chat.controller.ts`

基础列表与详情：

- `GET /api/chat/sessions`
  - 获取会话列表
- `POST /api/chat/sessions`
  - 创建新会话并提交首条消息
- `GET /api/chat/sessions/:id`
  - 获取会话详情
- `GET /api/chat/sessions/:id/messages`
  - 获取消息列表
- `GET /api/chat/sessions/:id/events`
  - 获取事件列表
- `GET /api/chat/sessions/:id/checkpoint`
  - 获取当前运行态快照

会话动作：

- `POST /api/chat/sessions/:id/messages`
  - 在已有会话中继续发消息
- `POST /api/chat/sessions/:id/approve`
  - 审批通过
- `POST /api/chat/sessions/:id/reject`
  - 审批拒绝
- `POST /api/chat/sessions/:id/learning/confirm`
  - 确认学习候选
- `POST /api/chat/sessions/:id/recover`
  - 从 checkpoint 恢复

流式接口：

- `GET /api/chat/sessions/:id/stream`
  - `Content-Type: text/event-stream`
  - 返回标准 SSE `MessageEvent`

---

## 3. 主要返回类型

共享类型定义：

- `packages/shared/src/types.ts`

### 3.1 ChatSessionRecord

```ts
interface ChatSessionRecord {
  id: string;
  title: string;
  status: 'idle' | 'running' | 'waiting_approval' | 'waiting_learning_confirmation' | 'completed' | 'failed';
  currentTaskId?: string;
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
  createdAt: string;
}
```

### 3.3 ChatEventRecord

```ts
interface ChatEventRecord {
  id: string;
  sessionId: string;
  type:
    | 'session_started'
    | 'user_message'
    | 'manager_planned'
    | 'subtask_dispatched'
    | 'research_progress'
    | 'tool_selected'
    | 'tool_called'
    | 'approval_required'
    | 'approval_resolved'
    | 'review_completed'
    | 'learning_pending_confirmation'
    | 'learning_confirmed'
    | 'assistant_token'
    | 'assistant_message'
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

---

## 5. 前端接入方式

前端 API 文件：

- `apps/frontend/agent-chat/src/api/chat-api.ts`

前端会话 Hook：

- `apps/frontend/agent-chat/src/hooks/use-chat-session.ts`

### 5.1 创建会话

前端调用：

```ts
createSession(message, title?)
```

对应后端：

```http
POST /api/chat/sessions
```

返回：

- `ChatSessionRecord`

### 5.2 续聊

前端调用：

```ts
appendMessage(sessionId, message);
```

对应后端：

```http
POST /api/chat/sessions/:id/messages
```

返回：

- 新增的 `ChatMessageRecord`

注意：

- 这个接口本身不是流式返回
- 真正的流式更新来自 `/stream`

### 5.3 建立 SSE

前端调用：

```ts
createSessionStream(sessionId);
```

底层是：

```ts
new EventSource(`${API_BASE}/chat/sessions/${sessionId}/stream`);
```

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

参考目录：

- `D:\渡一资料\前端架构课\coding-agent\完整代码\duyi-figma-make\server\agents`

建议 `packages/agent-core/src` 后续按这套结构继续整理：

```text
src/
├─ adapters/
├─ flows/
├─ graphs/
├─ shared/
├─ runtime/
├─ utils/
├─ session/
├─ tests/
└─ types/
```

推荐解释：

- `adapters/`
  - 对接 LLM、tools、memory、session 等外部能力
- `flows/`
  - 按聊天流、审批流、学习流组织 `nodes/prompts/schemas/utils`
- `graphs/`
  - 只放图定义与编排入口
- `shared/`
  - 多 flow 共用的 prompt、schema、事件映射
- `runtime/`
  - Agent 运行时上下文
- `utils/`
  - 纯工具函数
- `session/`
  - 会话、checkpoint、事件持久化

这样比单纯的：

- `models/`
- `agents/`
- `graph/`
- `session/`

更接近成熟 Agent 工程结构。

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
   - 规划
   - 子任务
   - 工具调用
   - 审批
   - token
   - 完整回答
6. 前端更新：
   - 会话列表
   - 消息区
   - 事件流
   - checkpoint
   - 审批区
   - 学习确认区

---

## 9. 常见问题

### 为什么 `/messages` 不是流式？

因为当前设计是：

- `POST /messages` 负责提交输入
- `GET /stream` 负责持续输出

这是浏览器端最稳的模式。

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

## 10. 建议的后续工作

1. 继续把 `agent-core` 从当前结构迁到 `adapters / flows / graphs / shared / utils / session`
2. 给前端消息区补真正的“最后一条 assistant 流式打字效果”
3. 给后端补一个专门的流式调试接口，便于只测 token 输出
4. 在 `agent-admin` 中增加 chat session 观测页，方便从运维视角排查多 Agent 流程
