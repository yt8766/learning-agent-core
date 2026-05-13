# Agent-Chat 前端 Chat API 集成指南

状态：current
文档类型：guide
适用范围：`apps/frontend/agent-chat`
最后核对：2026-05-05

> **版本**: v1.0  
> **适用范围**: `apps/frontend/agent-chat`  
> **后端文档**: [agent-server/chat-api.md](../../backend/agent-server/chat-api.md)

---

## 1. 架构概述

`agent-chat` 是面向用户的**前线作战面**（OpenClaw 模态），通过 HTTP/SSE 与 `agent-server` 通信。

```
┌─────────────────┐     HTTP/SSE      ┌──────────────────┐
│  agent-chat     │  ←────────────→  │  agent-server    │
│  (Frontend)     │   /api/chat/*    │  (NestJS)        │
└─────────────────┘                  └──────────────────┘
       │                                    │
       │ React Hooks                        │ ChatService
       │ useChatSession                     │ RuntimeModule
       │                                    │ LangGraph
       ▼                                    ▼
┌─────────────────┐                  ┌──────────────────┐
│  EventSource    │                  │  Supervisor      │
│  Axios Client   │                  │  Coder/Reviewer  │
└─────────────────┘                  └──────────────────┘
```

---

## 2. 环境配置

### 2.1 开发环境变量

创建 `apps/frontend/agent-chat/.env.local`：

```bash
# API 基础路径（Vite 代理用）
VITE_API_BASE_URL=/api

# 开发代理目标（指向 agent-server）
VITE_API_PROXY_TARGET=http://localhost:3000
```

### 2.2 生产环境变量

生产构建时，前端静态资源托管在 CDN/Nginx，API 请求直接指向网关：

```bash
VITE_API_BASE_URL=https://api.your-domain.com/api
```

---

## 3. API 客户端

### 3.1 核心客户端

文件: `src/api/chat-api.ts`

```typescript
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

const http = axios.create({
  baseURL: API_BASE,
  withCredentials: true, // 关键：携带 session cookie
  timeout: 12000,
  headers: { 'Content-Type': 'application/json' }
});
```

**关键配置**:

- `withCredentials: true` → 必须，否则 Cookie 不会随跨域请求发送
- `baseURL: '/api'` → 开发时由 Vite 代理到 `localhost:3000`

### 3.2 请求去重与缓存

```typescript
const inFlightRequests = new Map<string, Promise<unknown>>();
const resolvedRequestCache = new Map<string, { expiresAt: number; data: unknown }>();

async function request<T>(
  path: string,
  config?: {
    method?: 'GET' | 'POST' | 'DELETE' | 'PATCH';
    data?: unknown;
    dedupeKey?: string;      // 去重键
    cacheWindowMs?: number;  // 缓存窗口（ms）
    timeoutMs?: number;
  }
): Promise<T> { ... }
```

| 场景     | dedupeKey                         | cacheWindowMs |
| -------- | --------------------------------- | ------------- |
| 会话列表 | `GET:/chat/sessions`              | `1000`        |
| 消息历史 | `GET:/chat/messages:${sessionId}` | `400`         |
| 事件列表 | `GET:/chat/events:${sessionId}`   | `400`         |

---

## 4. 核心 Hook: useChatSession

文件: `src/hooks/use-chat-session.ts`

### 4.0 当前主线说明

`useChatSession` 现在是一个 **x-sdk compat facade**，不是旧式的独立聊天状态机：

- `sessions / activeSession / messages`
  - 真相来自 `useXConversations` 与 `useXChat`
- `checkpoint / events / reconnect / streamingCompleted`
  - 仍在 facade 中负责运行态投影、SSE 收口与恢复语义
- 页面层
  - 继续消费 `useChatSession()` 返回的兼容视图模型
  - 不应再额外维护第二套本地消息或会话真相

这意味着后续如果要接新的聊天能力，优先修改：

- `src/chat-runtime/agent-chat-session-provider.ts`
- `src/chat-runtime/agent-chat-provider.ts`
- `src/chat-runtime/agent-chat-actions.ts`
- `src/chat-runtime/agent-chat-conversations.ts`

不要直接在页面里重建一条平行消息链。

### 4.1 状态结构

```typescript
interface ChatSessionState {
  sessions: ChatSessionRecord[]; // x-sdk conversations 真相
  activeSessionId: string | null; // x-sdk active conversation
  messages: ChatMessageRecord[]; // x-sdk messages 真相
  events: ChatEventRecord[]; // compat facade 运行态事件
  checkpoint: ChatCheckpointRecord | undefined; // compat facade 运行态快照
  draft: string; // 输入框草稿
  error: Error | null;
  loading: boolean;
  streamingCompleted: boolean; // 流结束信号，供消息渲染收口
}
```

### 4.2 主要 Actions

| Action               | 调用 API                                 | 说明                                  |
| -------------------- | ---------------------------------------- | ------------------------------------- |
| `sendMessage`        | `useXChat` provider + `GET /chat/stream` | 发送消息并通过会话 SSE 接收运行态事件 |
| `createNewSession`   | `POST /chat/sessions`                    | 创建新会话                            |
| `selectSession`      | `GET /chat/sessions/:id`                 | 切换会话                              |
| `deleteSession`      | `DELETE /chat/sessions/:id`              | 删除会话                              |
| `updateSessionTitle` | `PATCH /chat/sessions/:id`               | 修改标题                              |
| `submitApproval`     | `POST /chat/approve`                     | 审批通过                              |
| `submitRejection`    | `POST /chat/reject`                      | 审批拒绝                              |
| `cancelRun`          | `POST /chat/cancel`                      | 取消当前任务                          |
| `recoverSession`     | `POST /chat/recover`                     | 恢复会话                              |
| `confirmLearning`    | `POST /chat/learning/confirm`            | 确认学习建议                          |

---

## 5. 流式对话实现

### 5.0 Runtime v2 view-stream 与自然语言审批

Chat Runtime v2 的接口契约以 [agent-chat-runtime-v2.md](/docs/contracts/api/agent-chat-runtime-v2.md) 为准。前端当前已具备两段独立接入能力：

- `src/api/chat-runtime-v2-api.ts`
  - 构造 `/chat/view-stream?sessionId=...&runId=...&afterSeq=...`
  - 使用 `@agent/core` 的 `ChatViewStreamEventSchema` 解析 `event:` SSE payload
- `src/hooks/chat-session/use-chat-view-stream.ts`
  - 把 `ready / fragment_delta / fragment_completed / interaction_waiting / error / close` 投影成前端状态
  - 忽略 `seq <= lastSeq` 的补发或重复事件，避免断线恢复时重复拼接正文
  - `interaction_waiting` 只保存 `pendingInteraction`，不生成审批卡
- 后端 `view-stream` 会把 `tool_stream_dispatched` / `tool_stream_completed` 投影成白名单工具执行事件，并把 `interrupt_pending(kind=tool_execution)` 投影成 `interaction_waiting`
  - 高风险工具请求会带 `requiredConfirmationPhrase: "确认执行"`
  - 前端 composer 会在 pending tool approval 时把 placeholder 调整为“回复「确认执行」继续，或输入取消 / 修改要求”
  - 这只是输入引导，不恢复审批卡主路径

当用户回复高风险审批提示时，`POST /chat/messages` 可能返回：

```json
{
  "handledAs": "pending_interaction_reply",
  "message": {
    "id": "interaction_reply_...",
    "role": "user",
    "content": "确认推送"
  },
  "interactionResolution": {
    "interactionId": "pending_interaction_...",
    "intent": {
      "action": "approve",
      "confidence": 0.98
    }
  }
}
```

`agent-chat-session-provider.ts` 必须把这类回复视为“恢复原 run 的交互回复”，而不是新任务：

- 不再打开新的 `/chat/stream`
- 不再启动新的 ChatRun/view-stream
- 在聊天流内显示简短 assistant 状态，例如“已收到确认，正在继续原运行。”
- 对 `unknown` 意图提示用户直接回复确认语或取消

这条规则是 “审批卡直接不要了” 的前端落点；旧 `approval_request` 卡只服务历史兼容事件，不是 v2 主路径。

### 5.1 当前会话流式链路

`agent-chat` 当前主界面不直接消费 `POST /api/chat` 的 direct SSE。拿到 `runId` 的新主体验优先消费 v2 `view-stream`；没有 `runId` 的历史会话和旧 provider 继续保留 `/api/chat/stream` fallback。旧 fallback 链路是：

1. `sendMessage` 通过 `useXChat` 驱动的 session provider 发起请求；provider 负责在已有会话时先 `appendMessage`，新会话时先 `ensureSession`。
2. `GET /api/chat/stream?sessionId=...` 的 `EventSource` 订阅会话事件。
3. `assistant_token`、`final_response_delta`、`assistant_message` 只由 x-sdk session provider 合并为 assistant 正文。
4. `final_response_completed`、`session_finished`、`session_failed`、`run_cancelled` 负责收口 streaming 状态并触发最终快照 reconcile。

`useChatSession` 会阻止 “x-sdk 正在请求” 与 “旧 activateChatSession 流” 同时打开，避免双流重复消费。

当前发送链路中，`useXChat` 是唯一的 `messages` 真相，也是 user 本地气泡与 assistant 正文的唯一写入方。`chat-session-stream-binding.ts` 在 x-sdk 请求流里会以 `syncUserMessages: false`、`syncAssistantMessages: false` 运行：它仍负责 checkpoint、events、sessions、idle/error/reconcile 等运行态同步，但不会再把 `user_message` 或 assistant token 写入旧消息同步路径。这样可以避免发送中用户气泡重复、loading placeholder、direct reply transient message 与 x-sdk 更新消息同时出现在主线程，导致第一次发送卡在“正在生成回复”或第二次发送看不见 AI 回复。

`POST /api/chat` 仍是后端 direct chat/Sandpack/report-schema 入口；如需在 `agent-chat` 前端启用独立 direct chat，需要新增专门的 fetch/stream adapter，不能和 session stream 混用。

### 5.2 使用 EventSource（仅 GET）

```typescript
// 用于 /chat/stream 长连接订阅
const eventSource = new EventSource(`/api/chat/stream?sessionId=${sessionId}`, { withCredentials: true });

eventSource.onmessage = event => {
  const data = JSON.parse(event.data);
  // 处理事件...
};

eventSource.onerror = error => {
  console.error('SSE error:', error);
  // 可在这里实现自动重连
};

// 组件卸载时关闭
return () => eventSource.close();
```

### 5.3 SSE 事件处理与渲染节流

`assistant_token` 和 `final_response_delta` 可能以很高频率到达。前端必须避免每个 token 都立即触发 Markdown 重渲染：

- 旧 activation stream 仍可让 token 类正文事件进入 `chat-session-stream-binding.ts` 的短窗口队列，再按约一帧批量 flush 到 `setMessages`
- x-sdk 请求流必须关闭旧 user / assistant 消息同步，只把本地 user 气泡和正文事件交给 x-sdk runtime 与 `agent-chat-session-provider.ts` 的 `foldProviderEvent`
- `assistant_token` / `final_response_delta` 是高频正文片段，不进入 UI `events`、`sessions`、`checkpoint` 的逐 token 同步路径；它们只驱动正文草稿，避免触发 `ChatHomePage` 全量派生计算
- `assistant_message`、`final_response_completed`、`session_finished` 等结构性或终态事件仍进入事件流、会话状态和 checkpoint 同步，用于 timeline、状态收口和最终快照 reconcile
- 非正文事件仍立即更新，且在处理前先 flush 已积压正文，保证消息顺序和终态 reconcile 不丢 token
- stream error、idle close、terminal event 前都必须先 flush pending token，再关闭或切换兜底轮询
- `ChatHomePage` 通过 `chat-bubble-items-cache.ts` 增量复用未变化的 Bubble item；流式阶段只重建正在变化的 assistant 气泡，历史气泡的 content/footer JSX 不应被 token 更新反复重建
- 回复步骤面板只解析 payload `projection` 为 `chat_response_step` / `chat_response_steps` 的稳定投影；token payload 必须在 zod schema parse 前被轻量跳过

消息展示层由 `XMarkdown` 负责流式 Markdown 表现，`Bubble` 的 `typing/streaming` 不再叠加正文打字机，避免双重动画导致卡顿。`XMarkdown.streaming` 当前配置包含：

- `hasNextChunk: true`，仅在会话仍处于当前 assistant 流式阶段时传入
- `enableAnimation: true`
- `animationConfig: { fadeDuration: 400 }`

前端入口必须加载 `@ant-design/x-markdown/themes/light.css` 与 `@ant-design/x-markdown/themes/dark.css`，assistant Markdown class 由 antd theme id 映射到 `x-markdown-light` / `x-markdown-dark`。默认不传 `tail`，避免正文末尾出现块状光标；不要恢复自定义 `incompleteMarkdownComponentMap` skeleton，占位组件会在高频 token 下造成额外替换与视觉抖动。

当 session 已进入 `completed` / `failed` / `cancelled`，即使 checkpoint 的 thinking 状态短暂滞后，只要 assistant 正文已经存在，也不能继续把该 Markdown 当作 streaming 渲染。

### 5.4 SSE 事件处理示例

```typescript
function handleSseEvent(event: SseEvent) {
  switch (event.type) {
    case 'thinking':
      // 更新思考面板
      updateThinkingPanel(event.data);
      break;
    case 'token':
      // 追加文本到消息
      appendTokenToMessage(event.data.content);
      break;
    case 'tool_call':
      // 显示工具调用卡片
      showToolCallCard(event.data);
      break;
    case 'approval_required':
      // 弹出审批对话框
      showApprovalDialog(event.data);
      break;
    case 'learning_suggestion':
      // 显示学习建议
      showLearningSuggestions(event.data.candidates);
      break;
    case 'done':
      // 完成，清理状态
      finalizeMessage(event.data);
      break;
    case 'error':
      // 显示错误
      showErrorToast(event.data.message);
      break;
  }
}
```

---

## 6. 思考面板（Thinking Panel）

参考 Kimi Code 的思考展示，实现可折叠的思考过程面板。

### 6.1 组件设计

```typescript
// src/components/thinking-panel.tsx
interface ThinkingPanelProps {
  thinking: ThinkingProcess;
  defaultExpanded?: boolean;
}

export function ThinkingPanel({ thinking, defaultExpanded = true }: ThinkingPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="thinking-panel">
      <button
        className="thinking-header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="thinking-icon">
          {thinking.status === 'thinking' ? '⏳' : '✅'}
        </span>
        <span className="thinking-title">
          {thinking.status === 'thinking' ? '思考中' : '已思考'}
        </span>
        <span className="thinking-time">
          （用时 {thinking.elapsedMs / 1000} 秒）
        </span>
        <span className="thinking-toggle">
          {expanded ? '▼' : '▶'}
        </span>
      </button>

      {expanded && (
        <div className="thinking-steps">
          {thinking.steps.map((step, index) => (
            <ThinkingStepItem key={index} step={step} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}
```

### 6.2 步骤渲染

```typescript
function ThinkingStepItem({ step, index }: { step: ThinkingStep; index: number }) {
  switch (step.type) {
    case 'search':
      return (
        <div className="thinking-step search-step">
          <div className="step-header">
            🔍 搜索: {step.query}
            {step.status === 'completed' && (
              <span className="badge">{step.resultsCount} 个结果</span>
            )}
          </div>
          {step.sources && (
            <div className="search-sources">
              {step.sources.map((source, i) => (
                <a key={i} href={source.url} target="_blank" rel="noopener">
                  {source.title}
                </a>
              ))}
            </div>
          )}
        </div>
      );

    case 'browse':
      return (
        <div className="thinking-step browse-step">
          <div className="step-header">
            📄 浏览页面: {step.title}
          </div>
          <div className="browse-summary">{step.summary}</div>
        </div>
      );

    case 'reasoning':
      return (
        <div className="thinking-step reasoning-step">
          <div className="step-header">💡 推理</div>
          <div className="reasoning-content">{step.content}</div>
        </div>
      );

    case 'calculation':
      return (
        <div className="thinking-step calc-step">
          <div className="step-header">🔢 计算</div>
          <code>{step.expression} = {step.result}</code>
        </div>
      );
  }
}
```

---

## 7. 消息卡片组件

### 7.1 消息类型映射

| 消息内容 | 组件                      |
| -------- | ------------------------- |
| 普通文本 | `MarkdownContent`         |
| 代码块   | `CodeBlock` (带复制/运行) |
| 工具调用 | `ToolCallCard`            |
| 来源引用 | `CitationCard`            |
| 审批请求 | `ApprovalCard`            |
| 学习建议 | `LearningSuggestionCard`  |
| 技能复用 | `SkillBadge`              |

### 7.2 ApprovalCard（审批卡片）

```typescript
interface ApprovalCardProps {
  interruptId: string;
  intent: string;
  description: string;
  onApprove: (scope: 'once' | 'session' | 'always') => void;
  onReject: (feedback?: string) => void;
}

export function ApprovalCard({ interruptId, intent, description, onApprove, onReject }: ApprovalCardProps) {
  const [feedback, setFeedback] = useState('');

  return (
    <div className="approval-card">
      <div className="approval-icon">⚠️</div>
      <div className="approval-content">
        <h4>需要您的确认</h4>
        <p>{description}</p>
        <div className="approval-actions">
          <button onClick={() => onApprove('once')}>✅ 允许本次</button>
          <button onClick={() => onApprove('session')}>✅ 允许本会话</button>
          <button onClick={() => onApprove('always')}>✅ 总是允许</button>
          <button onClick={() => onReject(feedback)}>❌ 拒绝</button>
        </div>
        <input
          placeholder="拒绝原因（可选）"
          value={feedback}
          onChange={e => setFeedback(e.target.value)}
        />
      </div>
    </div>
  );
}
```

---

## 8. 状态管理策略

### 8.1 为什么选择 useState 而非全局 Store

当前 `agent-chat` 采用**本地 Hook 状态**（`use-chat-session.ts`），原因：

- 聊天状态是**会话级**的，不是全局共享的
- 避免了 Zustand/Redux 的样板代码
- 与 React 生命周期天然绑定（SSE 连接在组件卸载时自动关闭）

### 8.2 TanStack Query 的使用

```typescript
// src/api/chat-query.ts
import { useQuery, useMutation } from '@tanstack/react-query';

export function useSessionsQuery() {
  return useQuery({
    queryKey: ['chat', 'sessions'],
    queryFn: listSessions,
    staleTime: 1000
  });
}

export function useSessionQuery(sessionId: string | null) {
  return useQuery({
    queryKey: ['chat', 'session', sessionId],
    queryFn: () => selectSession(sessionId!),
    enabled: !!sessionId
  });
}
```

**适用场景**:

| 数据         | 管理方式                 | 原因                 |
| ------------ | ------------------------ | -------------------- |
| 会话列表     | `useQuery`               | 需要缓存和自动刷新   |
| 消息历史     | `useQuery`               | 需要缓存和去重       |
| SSE 实时事件 | `useState` + `useEffect` | 流式数据不适合 Query |
| 输入草稿     | `useState`               | 纯本地状态           |

---

## 9. 错误处理与重试

### 9.1 API 错误边界

```typescript
// 在 chat-api.ts 中统一处理
http.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // 未登录，跳转到登录页
      window.location.href = '/login';
    }
    if (error.response?.status === 503) {
      // 服务暂时不可用
      toast.error('服务暂时不可用，请稍后重试');
    }
    return Promise.reject(error);
  }
);
```

### 9.2 SSE 断线重连

```typescript
function createEventSourceWithReconnect(sessionId: string) {
  let eventSource: EventSource | null = null;
  let reconnectTimer: NodeJS.Timeout;
  let retryCount = 0;
  const MAX_RETRY = 5;

  const connect = () => {
    if (retryCount >= MAX_RETRY) {
      console.error('SSE 重连次数超限');
      return;
    }

    eventSource = new EventSource(`/api/chat/stream?sessionId=${sessionId}`, {
      withCredentials: true
    });

    eventSource.onopen = () => {
      retryCount = 0; // 重置重试计数
    };

    eventSource.onerror = () => {
      eventSource?.close();
      retryCount++;
      const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
      reconnectTimer = setTimeout(connect, delay);
    };
  };

  connect();

  return {
    get es() {
      return eventSource;
    },
    close: () => {
      clearTimeout(reconnectTimer);
      eventSource?.close();
    }
  };
}
```

---

## 10. 性能优化

### 10.1 消息列表虚拟化

当消息数量 > 100 时，使用 `react-window` 或 `@tanstack/react-virtual` 虚拟滚动。

### 10.2 思考面板懒加载

```typescript
// 思考步骤默认折叠，点击后才渲染详细内容
const ThinkingStepItem = lazy(() => import('./thinking-step-item'));

<Suspense fallback={<Skeleton />}>
  <ThinkingStepItem step={step} />
</Suspense>
```

### 10.3 代码分割

```typescript
// vite.config.ts
build: {
  rollupOptions: {
    output: {
      manualChunks(id) {
        if (id.includes('node_modules')) {
          if (id.includes('/react/')) return 'vendor-react';
          if (id.includes('/antd/')) return 'vendor-antd';
          if (id.includes('/@ant-design/x/')) return 'vendor-antx';
        }
      }
    }
  }
}
```

---

## 11. 调试技巧

### 11.1 查看实际请求 URL

浏览器 DevTools → Network → 找到请求 → Headers → Request URL

### 11.2 验证代理是否生效

```bash
# 在终端直接请求后端（绕过 Vite 代理）
curl http://localhost:3000/api/chat/sessions

# 通过 Vite 代理请求
curl http://localhost:5173/api/chat/sessions
```

### 11.3 查看后端路由映射

启动 `agent-server` 时，控制台会打印：

```
[RoutesResolver] ChatController {/api/chat}:
[RouterExplorer] Mapped {/api/chat/sessions, GET} route
[RouterExplorer] Mapped {/api/chat/sessions, POST} route
...
```

如果没有这些日志，说明 `ChatModule` 未加载。

---

## 12. 常见问题

### Q1: `/api/chat/sessions` 返回 404

**原因**: PostgREST 和 agent-server 端口冲突（都占用了 3000）。

**解决**:

1. 修改 `docker-compose.yml`：`3001:3000`
2. 更新 `.env`：`SUPABASE_URL=http://localhost:3001`
3. 重启 Docker：`docker compose up -d postgrest`

### Q2: Cookie 没有随请求发送

**原因**: `withCredentials: true` 未设置，或前端/后端域名不匹配。

**解决**:

- 前端 Axios：`withCredentials: true`
- 后端 CORS：`credentials: true`，且 `origin` 不能是 `*`

### Q3: SSE 连接立即断开

**原因**:

- 服务端发送了错误格式的 SSE 数据
- Nginx/代理缓存了响应（缺少 `X-Accel-Buffering: no`）

**解决**:

- 确保响应头包含 `X-Accel-Buffering: no`
- 检查服务端 `Content-Type: text/event-stream`

### Q4: 消息发送后没有流式响应

**原因**: `Accept` 头未设置为 `text/event-stream`。

**解决**:

```typescript
fetch('/api/chat', {
  headers: {
    Accept: 'text/event-stream' // 必须
  }
});
```
