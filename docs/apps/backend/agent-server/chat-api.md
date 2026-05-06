# Agent-Server Chat API 文档

状态：current
文档类型：reference
适用范围：`apps/backend/agent-server` + `apps/frontend/agent-chat`
最后核对：2026-05-05

> **版本**: v1.0  
> **适用范围**: `apps/backend/agent-server` + `apps/frontend/agent-chat`  
> **最后更新**: 2026-05-04

---

## 1. 接口概览

Chat API 是 `agent-chat` 前线的核心通信协议，承载：

- **会话生命周期**：创建、列表、详情、更新、删除
- **消息对话**：发送消息、获取历史、流式响应
- **Agent 控制**：审批、拒绝、取消、恢复、学习确认
- **实时事件**：SSE 事件流订阅

Chat Runtime v2 的 ChatRun、view-stream、auto review 与自然语言 pending interaction 已拆到 [agent-chat-runtime-v2.md](/docs/contracts/api/agent-chat-runtime-v2.md)。本文件继续记录现有 session/direct 兼容 API；新增或修改 v2 字段时，必须先更新 v2 contract。

### 1.1 基础信息

| 项目     | 值                                             |
| -------- | ---------------------------------------------- |
| 基础路径 | `/api`（由 `API_PREFIX` 控制，默认 `api`）     |
| 服务端口 | `3000`（由 `PORT` 控制，默认 `3000`）          |
| 传输协议 | HTTP/1.1（SSE 流式）+ WebSocket（辅助，可选）  |
| 内容格式 | `application/json` / `text/event-stream`       |
| 认证方式 | Session Cookie (`agent_session_id`) + 可选 JWT |

### 1.2 端口冲突注意事项

> ⚠️ **已知陷阱**：PostgREST（Supabase 网关）默认也占用 `3000` 端口。
>
> **解决方案**：
>
> - `docker-compose.yml` 中将 PostgREST 映射到 `3001:3000`
> - `.env` 中 `SUPABASE_URL=http://localhost:3001`
> - 确保 NestJS `agent-server` 独占 `localhost:3000`

---

## 2. 会话管理（Sessions）

### 2.1 获取会话列表

```http
GET /api/chat/sessions
```

**响应**: `200 OK`

```json
[
  {
    "id": "session_1777823310553",
    "title": "海外直播产品需要什么",
    "status": "completed",
    "titleSource": "generated",
    "createdAt": "2026-05-03T15:48:30.553Z",
    "updatedAt": "2026-05-03T15:59:26.758Z"
  }
]
```

**字段说明**:

| 字段          | 类型      | 说明                                                             |
| ------------- | --------- | ---------------------------------------------------------------- |
| `id`          | `string`  | 会话唯一标识                                                     |
| `title`       | `string`  | 会话标题（AI 自动生成或用户指定）                                |
| `status`      | `string`  | `idle` / `running` / `completed` / `error` / `awaiting_approval` |
| `titleSource` | `string`  | `generated`（AI 生成）/ `user`（用户指定）                       |
| `createdAt`   | `ISO8601` | 创建时间                                                         |
| `updatedAt`   | `ISO8601` | 最后更新时间                                                     |

---

### 2.2 创建会话

```http
POST /api/chat/sessions
Content-Type: application/json

{
  "title": "可选标题",
  "message": "可选的初始消息"
}
```

**响应**: `201 Created`

```json
{
  "id": "session_xxx",
  "title": "新会话",
  "status": "idle",
  "createdAt": "2026-05-04T06:00:00.000Z",
  "updatedAt": "2026-05-04T06:00:00.000Z"
}
```

**Cookie**: 自动设置 `agent_session_id=session_xxx; Path=/; SameSite=Lax`

---

### 2.3 获取会话详情

```http
GET /api/chat/sessions/:id
```

**响应**: `200 OK`

```json
{
  "id": "session_xxx",
  "title": "会话标题",
  "status": "completed",
  "messages": [...],
  "modelId": "kimi-k2.6",
  "createdAt": "2026-05-04T06:00:00.000Z",
  "updatedAt": "2026-05-04T06:05:00.000Z"
}
```

---

### 2.4 更新会话

```http
PATCH /api/chat/sessions/:id
Content-Type: application/json

{
  "title": "新的标题"
}
```

**响应**: `200 OK`

---

### 2.5 删除会话

```http
DELETE /api/chat/sessions/:id
```

**响应**: `204 No Content`

---

## 3. 消息与对话（Messages）

### 3.0 Runtime v2 消息补充

`POST /api/chat/messages` 在普通发送时继续走 session 消息追加；当当前 session 存在 `pendingInteraction` 时，该接口会优先把用户文本解析为自然语言审批回复，并返回：

```json
{
  "handledAs": "pending_interaction_reply",
  "message": {
    "id": "interaction_reply_...",
    "sessionId": "session_...",
    "role": "user",
    "content": "确认推送",
    "createdAt": "2026-05-05T10:00:00.000Z"
  },
  "interactionResolution": {
    "interactionId": "pending_interaction_...",
    "intent": {
      "interactionId": "pending_interaction_...",
      "action": "approve",
      "confidence": 0.98,
      "normalizedText": "确认推送"
    }
  }
}
```

这类回复不会创建新的 run message，也不会要求前端渲染审批卡。前端应把它作为原 run 的恢复信号处理。

当同一 session 存在 `agent-tools` 的 `pending_approval` 请求时，`POST /api/chat/messages` 也会优先把自然语言回复转为 `AgentToolsService.resumeApproval()`：

- `确认执行` -> `interrupt.action = "approve"`
- `取消 / 拒绝 / stop` -> `interrupt.action = "reject"`
- 带条件回复，如“可以，但不要删除文件” -> `interrupt.action = "feedback"`

该 bridge 只负责自然语言入口；工具请求状态、审批 ID 校验、sandbox / auto-review 关联恢复仍由 `AgentToolsService` 负责。

### 3.1 获取消息历史

```http
GET /api/chat/messages?sessionId=sess_xxx
```

**说明**: `sessionId` 也可通过 Cookie `agent_session_id` 传递。

**响应**: `200 OK`

```json
[
  {
    "id": "msg_user_1",
    "role": "user",
    "content": "Kimi Code 的 Plan Mode 是什么？",
    "createdAt": "2026-05-04T06:00:00.000Z"
  },
  {
    "id": "msg_assistant_1",
    "role": "assistant",
    "content": "Plan Mode（计划模式）是 Kimi Code CLI 的一种功能模式...",
    "thinking": {
      "status": "completed",
      "elapsedMs": 7200,
      "steps": [
        {
          "type": "search",
          "query": "Kimi Code Plan Mode",
          "resultsCount": 33,
          "sources": [{ "title": "Kimi Code 官方文档", "url": "https://...", "snippet": "..." }]
        },
        {
          "type": "browse",
          "url": "https://...",
          "title": "Kimi Code: Next-Gen AI Code Agent",
          "summary": "..."
        },
        {
          "type": "reasoning",
          "content": "根据搜索结果，Plan Mode 允许 AI 在执行前展示详细计划..."
        }
      ]
    },
    "citations": [{ "index": 1, "source": { "title": "...", "url": "..." }, "quote": "..." }],
    "createdAt": "2026-05-04T06:00:07.200Z"
  }
]
```

**消息字段说明**:

| 字段        | 类型      | 说明                                     |
| ----------- | --------- | ---------------------------------------- |
| `id`        | `string`  | 消息唯一标识                             |
| `role`      | `string`  | `user` / `assistant` / `system` / `tool` |
| `content`   | `string`  | 消息内容（Markdown）                     |
| `thinking`  | `object?` | 思考过程（见 3.3）                       |
| `toolCalls` | `array?`  | 工具调用记录                             |
| `citations` | `array?`  | 来源引用                                 |
| `feedback`  | `string?` | `like` / `dislike`                       |
| `createdAt` | `ISO8601` | 创建时间                                 |

---

### 3.2 发送消息（主对话入口）

```http
POST /api/chat
Content-Type: application/json
Accept: text/event-stream

{
  "message": "Kimi Code 的 Plan Mode 是什么？",
  "sessionId": "session_xxx",
  "modelId": "kimi-k2.6",
  "stream": true,
  "mode": "stream"
}
```

**请求字段**:

| 字段        | 类型      | 必填 | 说明                                                |
| ----------- | --------- | ---- | --------------------------------------------------- |
| `message`   | `string`  | ✅   | 用户输入消息                                        |
| `sessionId` | `string`  | ✅   | 会话 ID（也可 Cookie 传递）                         |
| `modelId`   | `string`  |      | LLM 模型 ID，默认由后端路由决定                     |
| `stream`    | `boolean` |      | `true` = SSE 流式，`false` = JSON 一次性返回        |
| `mode`      | `string`  |      | `stream` / `preview` / `sandpack` / `report-schema` |

**响应模式 A：SSE 流式（`stream=true` 且 `Accept: text/event-stream`）**

```
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache, no-transform
Connection: keep-alive
X-Accel-Buffering: no

: keep-alive

event: thinking
data: {"type":"search","query":"Kimi Code Plan Mode","status":"started"}

event: thinking
data: {"type":"search","query":"Kimi Code Plan Mode","status":"completed","resultsCount":33}

event: thinking
data: {"type":"browse","urls":["https://..."],"status":"started"}

event: thinking
data: {"type":"reasoning","content":"根据搜索结果..."}

event: token
data: {"content":"Plan Mode 是"}

event: token
data: {"content":" Kimi Code CLI 的一种功能模式"}

...

event: done
data: {"messageId":"msg_xxx","usage":{"prompt":1200,"completion":800}}
```

**SSE 事件类型**:

| 事件名                | 说明                       | 数据格式                                |
| --------------------- | -------------------------- | --------------------------------------- |
| `thinking`            | 思考步骤（搜索/浏览/推理） | `{ type, status, ... }`                 |
| `token`               | 生成的文本片段             | `{ content: string }`                   |
| `tool_call`           | 工具调用开始/结束          | `{ toolCallId, name, status, result? }` |
| `approval_required`   | 需要用户审批               | `{ interruptId, intent, description }`  |
| `learning_suggestion` | 学习建议                   | `{ candidates: [...] }`                 |
| `error`               | 错误                       | `{ message: string }`                   |
| `done`                | 完成                       | `{ messageId?, usage?, ... }`           |

**响应模式 B：JSON 一次性（`stream=false` 或 `Accept: application/json`）**

```json
{
  "content": "Plan Mode 是 Kimi Code CLI 的一种功能模式...",
  "messageId": "msg_xxx",
  "usage": { "prompt": 1200, "completion": 800 },
  "events": [...]
}
```

---

### 3.3 思考过程（ThinkingProcess）

当 AI 需要多步推理时，通过 SSE `thinking` 事件推送思考步骤。

**ThinkingStep 类型**:

```typescript
type ThinkingStep = SearchStep | BrowseStep | ReasoningStep | CalculationStep;

interface SearchStep {
  type: 'search';
  query: string;
  status: 'started' | 'completed' | 'error';
  resultsCount?: number;
  sources?: Source[];
  error?: string;
}

interface BrowseStep {
  type: 'browse';
  url: string;
  title?: string;
  status: 'started' | 'completed' | 'error';
  summary?: string;
  error?: string;
}

interface ReasoningStep {
  type: 'reasoning';
  content: string;
}

interface CalculationStep {
  type: 'calculation';
  expression: string;
  result: string;
}

interface Source {
  title: string;
  url: string;
  favicon?: string;
  snippet: string;
}
```

**前端展示建议**:

- 使用可折叠面板（`ThinkingPanel`）
- 搜索步骤显示 "🔍 搜索到 N 个网页" + 来源列表
- 浏览步骤显示 "📄 浏览页面：标题"
- 推理步骤显示 "💡 推理内容"
- 耗时统计放在面板标题

---

### 3.4 追加消息（无需 AI 回复）

```http
POST /api/chat/messages
Content-Type: application/json

{
  "sessionId": "session_xxx",
  "message": "补充说明...",
  "modelId": "kimi-k2.6"
}
```

**响应**: `201 Created` → `ChatMessageRecord`

---

### 3.5 消息反馈

```http
POST /api/chat/messages/:messageId/feedback
Content-Type: application/json

{
  "type": "like",
  "comment": "很有帮助"
}
```

**字段**:

| 字段      | 类型      | 说明               |
| --------- | --------- | ------------------ |
| `type`    | `string`  | `like` / `dislike` |
| `comment` | `string?` | 可选文字反馈       |

---

## 4. 实时事件流（SSE）

### 4.1 订阅会话事件

```http
GET /api/chat/stream?sessionId=session_xxx
Accept: text/event-stream
```

**说明**: 长连接 SSE，用于接收会话的实时事件（token、tool_call、approval 等）。

**事件流示例**:

```
: stream-open

data: {"type":"assistant_token","content":"你好"}

data: {"type":"tool_call","toolCallId":"tc_1","name":"search_web","status":"started"}

data: {"type":"tool_call","toolCallId":"tc_1","name":"search_web","status":"success","result":{...}}

data: {"type":"assistant_token","content":"根据搜索结果..."}

: keep-alive

data: {"type":"done"}
```

**连接管理**:

- 每 15 秒发送 `: keep-alive` 注释防止超时
- 客户端断开时自动清理订阅
- 支持重连：客户端断开后可重新建立连接，服务端会推送历史事件

---

## 5. Agent 控制（审批与恢复）

### 5.1 审批操作

```http
POST /api/chat/approve
Content-Type: application/json

{
  "sessionId": "session_xxx",
  "intent": "execute_command",
  "actor": "agent-chat-user",
  "approvalScope": "once",
  "feedback": "确认执行"
}
```

**字段**:

| 字段            | 类型      | 说明                                                    |
| --------------- | --------- | ------------------------------------------------------- |
| `sessionId`     | `string`  | 会话 ID                                                 |
| `intent`        | `string`  | 审批意图标识                                            |
| `actor`         | `string`  | 执行者身份                                              |
| `approvalScope` | `string`  | `once`（仅本次）/ `session`（本会话）/ `always`（永久） |
| `feedback`      | `string?` | 审批附言                                                |

---

### 5.2 拒绝操作

```http
POST /api/chat/reject
Content-Type: application/json

{
  "sessionId": "session_xxx",
  "intent": "execute_command",
  "actor": "agent-chat-user",
  "feedback": "不要删除这个文件"
}
```

---

### 5.3 中断响应（通用）

```http
POST /api/chat/:endpoint
Content-Type: application/json

{
  "sessionId": "session_xxx",
  "intent": "execute_command",
  "actor": "agent-chat-user",
  "interrupt": {
    "interruptId": "int_xxx",
    "action": "approve",
    "payload": {}
  }
}
```

**`endpoint`**: `approve` | `reject`

**`interrupt.action`**: `approve` | `reject` | `feedback` | `input` | `bypass` | `abort`

---

### 5.4 取消当前任务

```http
POST /api/chat/cancel
Content-Type: application/json

{
  "sessionId": "session_xxx",
  "actor": "agent-chat-user",
  "reason": "用户主动取消"
}
```

---

### 5.5 恢复会话

```http
POST /api/chat/recover
Content-Type: application/json

{
  "sessionId": "session_xxx"
}
```

---

### 5.6 恢复到检查点

```http
POST /api/chat/recover-to-checkpoint
Content-Type: application/json

{
  "sessionId": "session_xxx",
  "checkpointId": "cp_xxx",
  "checkpointCursor": "cursor_value",
  "reason": "回退到之前的状态"
}
```

---

### 5.7 确认学习建议

```http
POST /api/chat/learning/confirm
Content-Type: application/json

{
  "sessionId": "session_xxx",
  "actor": "agent-chat-user",
  "candidateIds": ["candidate_1", "candidate_2"]
}
```

---

## 6. 事件与检查点（Events & Checkpoints）

### 6.1 获取会话事件

```http
GET /api/chat/events?sessionId=session_xxx
```

**响应**: `ChatEventRecord[]`

```json
[
  {
    "id": "evt_1",
    "type": "user_message",
    "payload": { "messageId": "msg_1" },
    "createdAt": "2026-05-04T06:00:00.000Z"
  },
  {
    "id": "evt_2",
    "type": "assistant_start",
    "payload": { "taskId": "task_1" },
    "createdAt": "2026-05-04T06:00:01.000Z"
  }
]
```

---

### 6.2 获取检查点

```http
GET /api/chat/checkpoint?sessionId=session_xxx
```

**响应**: `ChatCheckpointRecord | undefined`

```json
{
  "id": "cp_1",
  "sessionId": "session_xxx",
  "cursor": "cursor_value",
  "state": { ... },
  "createdAt": "2026-05-04T06:00:00.000Z"
}
```

---

## 7. 模型管理

### 7.1 获取可用模型列表

```http
GET /api/chat/models
```

**响应**: `200 OK`

```json
[
  { "id": "kimi-k2.6", "name": "Kimi K2.6", "provider": "kimi" },
  { "id": "kimi-k2.5", "name": "Kimi K2.5", "provider": "kimi" }
]
```

---

## 8. 错误处理

### 8.1 错误响应格式

```json
{
  "statusCode": 400,
  "message": "sessionId is required.",
  "error": "Bad Request"
}
```

### 8.2 常见错误码

| HTTP 状态 | 错误码           | 说明             | 处理建议                   |
| --------- | ---------------- | ---------------- | -------------------------- |
| `400`     | `Bad Request`    | 缺少 `sessionId` | 检查 Cookie 或显式传递参数 |
| `404`     | `Not Found`      | 会话不存在       | 检查 `sessionId` 是否正确  |
| `409`     | `Conflict`       | 会话状态冲突     | 例如正在运行中无法再次启动 |
| `500`     | `Internal Error` | 服务端错误       | 查看服务端日志             |

---

## 9. 前端集成指南

### 9.1 环境变量

```bash
# .env.local (frontend/agent-chat)
VITE_API_BASE_URL=/api
VITE_API_PROXY_TARGET=http://localhost:3000
```

### 9.2 Vite 代理配置

```ts
// vite.config.ts
server: {
  proxy: {
    '/api': {
      target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000',
      changeOrigin: true
    }
  }
}
```

### 9.3 Axios 客户端配置

```ts
const http = axios.create({
  baseURL: '/api',
  withCredentials: true, // 必须：携带 session cookie
  timeout: 12000,
  headers: { 'Content-Type': 'application/json' }
});
```

### 9.4 SSE 连接管理

```ts
const eventSource = new EventSource(`/api/chat/stream?sessionId=${sessionId}`, { withCredentials: true });

eventSource.onmessage = event => {
  const data = JSON.parse(event.data);
  switch (data.type) {
    case 'assistant_token':
      appendToken(data.content);
      break;
    case 'thinking':
      updateThinkingPanel(data);
      break;
    case 'approval_required':
      showApprovalDialog(data);
      break;
    case 'done':
      eventSource.close();
      break;
    case 'error':
      showError(data.message);
      eventSource.close();
      break;
  }
};
```

### 9.5 Cookie 与 Session 管理

- 创建会话后，后端自动设置 `agent_session_id` Cookie
- 后续请求自动携带 Cookie（`withCredentials: true`）
- 也可显式在 URL Query 或 Body 中传递 `sessionId`
- 优先级：显式参数 > Cookie

---

## 10. 数据模型

### 10.1 ChatSessionRecord

```typescript
interface ChatSessionRecord {
  id: string;
  title: string;
  status: 'idle' | 'running' | 'completed' | 'error' | 'awaiting_approval';
  titleSource: 'generated' | 'user';
  currentTaskId?: string;
  modelId?: string;
  compression?: SessionCompression;
  createdAt: string;
  updatedAt: string;
}
```

### 10.2 ChatMessageRecord

```typescript
interface ChatMessageRecord {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  thinking?: ThinkingProcess;
  toolCalls?: ToolCall[];
  citations?: Citation[];
  feedback?: 'like' | 'dislike';
  createdAt: string;
}
```

### 10.3 ChatEventRecord

```typescript
interface ChatEventRecord {
  id: string;
  sessionId: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}
```

---

## 11. 附录

### 11.1 完整路由表

| 方法     | 路径                              | 说明                |
| -------- | --------------------------------- | ------------------- |
| `GET`    | `/api/chat/sessions`              | 会话列表            |
| `POST`   | `/api/chat/sessions`              | 创建会话            |
| `GET`    | `/api/chat/sessions/:id`          | 会话详情            |
| `PATCH`  | `/api/chat/sessions/:id`          | 更新会话            |
| `DELETE` | `/api/chat/sessions/:id`          | 删除会话            |
| `GET`    | `/api/chat/messages`              | 消息列表            |
| `POST`   | `/api/chat/messages`              | 追加消息            |
| `POST`   | `/api/chat/messages/:id/feedback` | 消息反馈            |
| `GET`    | `/api/chat/events`                | 事件列表            |
| `GET`    | `/api/chat/checkpoint`            | 检查点              |
| `POST`   | `/api/chat`                       | 主对话（流式/JSON） |
| `GET`    | `/api/chat/stream`                | SSE 事件流          |
| `GET`    | `/api/chat/models`                | 模型列表            |
| `POST`   | `/api/chat/approve`               | 审批                |
| `POST`   | `/api/chat/reject`                | 拒绝                |
| `POST`   | `/api/chat/cancel`                | 取消                |
| `POST`   | `/api/chat/recover`               | 恢复                |
| `POST`   | `/api/chat/recover-to-checkpoint` | 恢复到检查点        |
| `POST`   | `/api/chat/learning/confirm`      | 确认学习            |

### 11.2 相关文件

| 文件                                                    | 职责              |
| ------------------------------------------------------- | ----------------- |
| `apps/backend/agent-server/src/chat/chat.controller.ts` | HTTP/SSE 路由定义 |
| `apps/backend/agent-server/src/chat/chat.service.ts`    | 业务逻辑编排      |
| `apps/backend/agent-server/src/chat/chat.module.ts`     | NestJS 模块装配   |
| `apps/frontend/agent-chat/src/api/chat-api.ts`          | 前端 API 客户端   |
| `packages/core/src/chat/chat.schemas.ts`                | DTO Schema 定义   |
