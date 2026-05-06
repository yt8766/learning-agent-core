# agent-chat 文档目录

状态：current
文档类型：index
适用范围：`docs/apps/frontend/agent-chat/`
最后核对：2026-05-05

本目录用于沉淀 `apps/frontend/agent-chat` 相关文档。

当前对应实现目录：

- `src/app`
  - 应用入口与路由装配
- `src/api`
  - 聊天、会话、SSE 与后台接口封装
- `src/pages/chat`、`src/pages/chat-thread`
  - 消息流与会话主界面
  - assistant `<think>` 解析、默认展开思考块、思考用时、消息底部复制 / 重新生成 / 点赞 / 点踩操作区
  - `chat-bubble-items-cache.ts` 负责增量复用未变化的 Bubble item，避免流式 token 更新重建历史气泡
- `src/pages/approvals`
  - 历史审批视图。Chat Runtime v2 的工具审批默认走聊天内自然语言确认，不再新增审批卡；仅保留兼容入口和非 v2 旧事件展示。
- `src/pages/event-timeline`
  - ThoughtChain / timeline 展示；主聊天 AI 回复不再内嵌 ThoughtChain
- `src/utils/agent-tool-execution-api.ts`、`src/utils/agent-tool-event-projections.ts`
  - Agent Tool Execution REST helper 与 SSE/tool event 投影 helper
- `src/utils/chat-response-step-projections.ts`
  - 回复步骤投影；折叠 `chat_response_step(s)` 稳定事件
- `src/hooks/chat-session/*`
  - 会话加载、SSE 绑定与消息同步
  - 旧 activation stream 的 assistant token / delta 需要短窗口批量 flush 到 `messages`，且不逐 token 推进 UI `events`、`sessions`、`checkpoint`，避免每个 token 触发完整 Markdown 与页面派生重渲染
  - x-sdk 请求流必须以 `syncAssistantMessages: false` 和 `syncUserMessages: false` 复用 stream binding，只同步运行态事件/状态，不再走旧 user / assistant 消息写入路径
- `src/chat-runtime/*`、`src/hooks/use-chat-session.ts`
  - `@ant-design/x-sdk` 聊天运行时与 `useChatSession` compat facade
  - `sessions / activeSession / messages` 已收敛到 `useXConversations / useXChat`
  - `/chat/messages` 返回 `handledAs: pending_interaction_reply` 时，`agent-chat-session-provider.ts` 必须短路当前请求并在聊天流内显示自然语言处理结果，不能再打开新的 `/chat/stream` 或 v2 view-stream
  - `setMessagesCompat` 只写 `useXChat` 消息源；`messagesShadow` 暂留但不再参与真实消息流
  - `sessionsShadow / activeSessionIdShadow` 只在 compat setter 内更新本地 shadow，外部 `conversationStore` 同步必须通过 effect 完成，避免 render 相关路径直接写外部 store
  - `checkpoint / events / reconnect / streamingCompleted` 仍由 compat facade 负责派生与收口，页面不应再维护第二套消息真相
- `src/styles/tailwind.css`、`src/styles/index.css`、`src/styles/chat-home-studio.scss`
  - Tailwind v4 theme tokens（`@tailwindcss/vite`，**不启用** Preflight）；`src/lib/cn.ts`（`tailwind-merge`）。额外 **Studio 壳**：`chat-home-studio.scss` 为深色星云侧栏 + `chatx-main-stage` 冷色弥散主区、玻璃 Composer；排版 **Syne + DM Sans**（`index.html`）。Ant-X / SCSS 细调仍可并存。
- `src/pages/chat-home/*`
  - **消费级会话壳（仅 IA/样式）**：侧栏 + 主列；协议仍以 `useChatSession` / SSE 为准。「中部滚动 / 底部 Composer」与固定 `ConversationAnchorRail`。
  - 锚点浮条输入必须先按 `message.id` 去重；主会话区的 Bubble 与 Anchor 应基于同一份去重后的消息视图，workbench 对外部传入的 `bubbleItems` 也要按 key 保留首个，避免重复 key、重复“助手回复”锚点和 rail / bubble 撕裂
  - 消费 `tool_*`、`execution_step_*`、`tool_execution` interrupt 与 workspace projection 摘要；Workspace Vault 作为高级摘要，不作为默认主聊天视图
- `src/pages/runtime-panel`
  - 运行态面板
- `src/pages/learning`
  - 学习建议与复用提示
- `src/pages/session-list`
  - 会话列表
- `src/components`、`src/hooks`、`src/store`
  - 通用组件、hooks、状态管理

约定：

- `agent-chat` 的专项文档统一放在 `docs/apps/frontend/agent-chat/`
- 聊天壳、侧栏、锚点浮条、审批卡、ThoughtChain、AI 回复样式、运行态消费或交互协议变化后，需同步更新本目录文档
- 涉及 ChatRun、view-stream、auto review、pending interaction 或自然语言审批时，必须先阅读并更新 [agent-chat-runtime-v2.md](/docs/contracts/api/agent-chat-runtime-v2.md)，再改前后端实现
- `useChatSession` 不再是独立消息状态机；后续改动如果触达主消息链，应优先修改 `src/chat-runtime/*` 与 x-sdk provider / conversation adapter，而不是重新把 `messages` / `sessions` 真相塞回本地 `useState`
- v2 自然语言审批回复只是一条普通用户消息：用户回复“确认推送 / 取消 / 但请改成...”后，provider 根据后端 `pending_interaction_reply` 回包输出 assistant 状态文案并等待原 run 恢复；不要重新生成审批卡，也不要把回复当新任务发送给 supervisor
- x-sdk 请求期间，user 本地气泡与 assistant 正文只允许由 x-sdk runtime 写入；旧 stream binding 不能再同步 `user_message` / assistant token 到消息列表，否则会重新引入发送中用户气泡重复、loading placeholder 残留、transient direct reply 重复和第二轮回复不可见的问题
- `useChatSession` 里的 runtime activation effect 只能由稳定激活键驱动，例如 `activeSessionId / streamReconnectNonce / isRequesting`；不要把每次 render 都会重建的 `chatActions`、`streamManager` 一类对象直接放进 effect 依赖，否则会重复激活 session 并引发 `session / checkpoint / messages / events` 死循环请求
- 工具执行展示只消费项目稳定事件投影，不直接渲染第三方 executor、MCP、终端或浏览器原始 payload
- assistant 消息正文不得原样泄漏 `<think>`；前端适配层负责把思考内容展示到默认展开的 thinking panel，后端 direct-reply 仍要在持久化前做清洗兜底
- assistant 正文流式展示由 `XMarkdown.streaming` 承担；不要再叠加 `Bubble.typing` / `Bubble.streaming` 的正文动画
- `XMarkdown.streaming` 固定使用 Ant Design X 原生淡入动画，不默认传 `tail`，并加载 `x-markdown-light` / `x-markdown-dark` 主题样式；不要恢复自定义 incomplete Markdown skeleton 占位
- 思考摘要在运行中和完成后都必须可展开；运行中缺少 `thinkingDurationMs` 时，用 checkpoint 更新时间计算当前用时兜底
- 主聊天线程采用 inline Agent OS：普通问答走 `已思考`，执行任务走 `处理中 / 已处理`，执行详情在同一条 assistant 回复内按 Agent OS 过程分组展开，不依赖右侧高级面板
- 回复步骤只消费 `chat_response_step(s)` 稳定投影；非投影 payload 必须在 schema parse 前跳过，主视觉展示用户可读动作，不展示裸英文事件名、`nodeId`、`fromNodeId` 或 `toNodeId`
- 消息操作区不提供分享按钮；assistant 可复制、重新生成、点赞、点踩，user 只提供复制

当前文档：

- [overview.md](/docs/apps/frontend/agent-chat/overview.md)
- [chat-api-integration.md](/docs/apps/frontend/agent-chat/chat-api-integration.md) ⬅️ **前端 Chat API 集成指南（新增）**
