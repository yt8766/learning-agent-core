# Codex Chat

状态：current  
文档类型：reference  
适用范围：`apps/frontend/codex-chat`  
最后核对：2026-05-05

`codex-chat` 是新的 AI 对话前端项目，位于 `apps/frontend/codex-chat`。它复用 `agent-chat` 的基础依赖版本。

## 产品边界

- 这是一个面向 AI 对话与 Agent 可观察性的独立聊天工作台。
- 与 `agent-chat` 的 OpenClaw 作战面不同，`codex-chat` 当前更偏向精致会话体验验证：多会话、流式 Markdown、思考过程和步骤展示。
- 当前视觉方向为 DeepSeek 风格的轻量浅色对话界面：中心聚焦输入、低噪声侧边栏、蓝绿冷调品牌动作、克制的信息密度。
- 后端入口遵守 [Agent Chat API](/docs/contracts/api/agent-chat.md)，多会话默认使用 `/api/chat/sessions`、`POST /api/chat/messages` 与 `GET /api/chat/stream?sessionId=...`。

## 关键实现

- `src/components/codex-chat-shell.tsx`
  - 只作为组合入口：调用 `useCodexChatSession()`，再把返回的 chat facade 传给 `CodexChatLayout`。
  - 不再承载会话请求、SSE 绑定或大块 JSX，避免 shell 重新膨胀成状态和视图混合文件。
- `src/hooks/use-codex-chat-session.ts`
  - 使用 `/api/chat/sessions` 加载和创建真实后端会话。
  - 使用 `POST /api/chat/messages` 提交用户输入。
  - 使用 `EventSource(buildCodexChatStreamUrl(sessionId))` 接收 `assistant_token`、`assistant_message`、`final_response_delta`、`final_response_completed` 等流式事件。
  - 负责会话重命名、删除、审批回复识别、自动标题生成和主动关闭流。
- `src/components/codex-chat-layout.tsx`
  - 使用 `Bubble.List`、`Sender`、`Welcome`、`Prompts`、`XProvider` 组合聊天页面。
  - 会话删除入口放在每个会话项的三点菜单中，对应 `DELETE /api/chat/sessions/:id`。
- `src/runtime/codex-chat-stream.ts`
  - 提供 `buildCodexChatStreamUrl(sessionId)` 和 `closeEventSource(source)`，统一 SSE URL 编码与关闭语义。
- `src/components/assistant-message.tsx`
  - 使用 `@ant-design/x-markdown` 渲染 Markdown。
  - 展示可折叠思考过程与步骤列表。

## 本地运行

```bash
pnpm --dir apps/frontend/codex-chat dev
```

默认 Vite 端口为 `5171`。`/api` 会代理到 `VITE_API_PROXY_TARGET`，未设置时使用 `http://127.0.0.1:3000`。

> 本地不要默认写 `localhost:3000`。当前开发机上 `localhost` 可能解析到错误目标并导致 `/api/chat/sessions` 返回 `502`；`127.0.0.1:3000` 已确认可达。

## 验证入口

```bash
pnpm --dir apps/frontend/codex-chat turbo:test:unit
pnpm --dir apps/frontend/codex-chat typecheck
pnpm --dir apps/frontend/codex-chat build
pnpm check:docs
```

如果后端 SSE payload 新增稳定字段，应先更新 `docs/contracts/api/agent-chat.md` 或对应 schema，再同步调整 `CodexDirectChatProvider` 的 chunk 适配逻辑。
