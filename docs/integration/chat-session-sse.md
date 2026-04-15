# Chat Session And SSE

状态：current
适用范围：`apps/backend/agent-server`、`apps/frontend/agent-chat`
最后核对：2026-04-14

## 1. 总体链路

当前聊天主链路采用：

1. 前端发送用户消息
2. 前端先创建或续接 chat session
3. `SessionCoordinator` 调用 `AgentOrchestrator`
4. `Supervisor / Workflow / Ministry workers` 按规划执行
5. 后端通过 SSE 持续返回事件
6. 前端按事件增量更新消息区、事件流、运行态和审批状态

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

## 2. 会话接口

- `GET /api/chat/sessions`
  - 获取会话列表
- `POST /api/chat/sessions`
  - 创建新会话
- `GET /api/chat/sessions/:id`
  - 获取会话详情
- `POST /api/chat/messages`
  - 在已有会话中继续发消息

补充：

- 首条消息现在也统一通过 `POST /api/chat/messages` 提交
- `POST /api/chat/sessions` 只负责创建空会话并返回 `sessionId`

## 3. SSE 接口

- `GET /api/chat/stream?sessionId=...`
  - `Content-Type: text/event-stream`
  - 返回标准 SSE 数据帧
  - 连接建立后会先发送注释包 `: stream-open`
  - 运行期间会周期性发送 `: keep-alive`

## 4. 流式可靠性约定

- `agent-chat` 优先消费 `/api/chat/stream` 的 SSE 事件
- 当前前端采用“stream 主通道 + snapshot 兜底”
  - SSE 正常时：
    - 不轮询 `messages`
    - 不轮询 `events`
    - 仅在必要时轻量补拉 `checkpoint`
  - SSE 断流、idle close 或终态事件缺失时：
    - 优先使用 `checkpoint` 收口运行态
    - 再按需补拉 `messages / events / checkpoint`

约定：

- SSE 是首选实时通道
- `checkpoint` 是运行态兜底
- `messages / events` 是历史恢复与终态校准

## 5. 前端接入入口

当前前端接入重点在：

- `apps/frontend/agent-chat/src/api/chat-api.ts`
- `apps/frontend/agent-chat/src/hooks/use-chat-session.ts`

## 6. 继续阅读

- [前后端对接文档](/Users/dev/Desktop/learning-agent-core/docs/integration/frontend-backend-integration.md)
- [Approval Recovery](/Users/dev/Desktop/learning-agent-core/docs/integration/approval-recovery.md)
