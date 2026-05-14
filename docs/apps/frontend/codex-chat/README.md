# Codex Chat

状态：current  
文档类型：reference  
适用范围：`apps/frontend/codex-chat`  
最后核对：2026-05-13

`codex-chat` 是新的 AI 对话前端项目，位于 `apps/frontend/codex-chat`。它复用 `agent-chat` 的基础依赖版本。

## 产品边界

- 这是一个面向 AI 对话与 Agent 可观察性的独立聊天工作台。
- 与 `agent-chat` 的 OpenClaw 作战面不同，`codex-chat` 当前更偏向轻量 Chatbot 体验验证：多会话、流式 Markdown、思考过程和步骤展示。
- 当前页面和样式层复刻 [vercel/chatbot](https://github.com/vercel/chatbot) 的 Chatbot 视觉范式：浅色侧边栏、极简历史列表、中心问候、建议动作、底部 composer 和低噪声消息流。
- 本轮复刻参考上游 `main` 的 `107a43a8039bb4f19d0ced4ff3445e2523d14305`（2026-04-17），上游许可证为 Apache-2.0；本项目只迁移前端页面/样式体验，不引入上游 Next.js App Router、Auth.js、Drizzle、Redis、Vercel Blob 或 AI Gateway 后端实现。
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
  - 使用自定义 message stack、`Prompts`、`XProvider` 组合 Chatbot 风格页面；不再使用 Ant Design X `Bubble.List`，避免 AntD 气泡结构偏离 vercel/chatbot 的消息布局。
  - 负责左侧历史列表、`New chat` / `Delete all` 入口、会话菜单、官方式顶部栏、空态 greeting、建议动作和底部 composer。
  - 左侧栏必须支持收起 / 展开；收起时保留图标入口，不隐藏主对话区域。
  - 左下角用户头像必须打开用户菜单；当前没有真实认证时，菜单使用访客模式提示承接“账户设置”和“退出登录”动作。
  - 底部 composer 使用 `CodexComposer` 自定义大输入框，结构对齐上游 `MultimodalInput`：`Ask anything...` 占位、附件按钮、模型标识和单个上箭头发送按钮。
  - composer 启动后读取 `/api/chat/models`，默认回退到 `Kimi K2.5`；发送消息时会把选中 `modelId` 传给 `POST /api/chat/messages`。
  - composer 已处理中文输入法组合态，避免 Enter 在拼音/中文候选过程中误提交。
  - 主对话区不渲染顶部空白栏；`Deploy with Vercel`、移动端打开侧栏按钮和可见性锁按钮不在当前产品展示层渲染。
  - 会话删除入口放在每个会话项的三点菜单中，对应 `DELETE /api/chat/sessions/:id`。
- `src/runtime/codex-chat-stream.ts`
  - 提供 `buildCodexChatStreamUrl(sessionId)` 和 `closeEventSource(source)`，统一 SSE URL 编码与关闭语义。
- `src/components/assistant-message.tsx`
  - 使用 `@ant-design/x-markdown` 渲染 Markdown。
  - 展示结构直接对齐 vercel/chatbot 的 `PreviewMessage`：assistant 左侧小图标、普通回复只渲染 Markdown，hover 时显示消息 actions。
  - assistant 头像、reasoning、复制和赞踩入口使用本地 `chatbot-icons` SVG，避免混入 Ant Design 图标导致官方视觉不一致。
  - `steps` 仍保留在 `CodexChatMessage` contract 中供后续 Agent 可观察面使用，但普通 assistant 回复不再默认渲染步骤卡，避免出现“流式生成中 token 卡片”堆叠。
  - 保持 `CodexChatMessage` contract 兼容，不新增前后端协议字段；`approvalPending` 只在前端映射为等待审批卡片。
- `src/components/message-reasoning.tsx`
  - 参考 vercel/chatbot 的低噪声 reasoning：默认折叠，流式中默认展开，内容限制在小型滚动区域。
- `src/components/message-actions.tsx`
  - 提供消息级操作入口，当前至少支持复制正文；浏览器缺少 `navigator.clipboard` 时只返回失败状态，不抛错。
- `src/styles/index.css`
  - 只保留全局 token、基础元素样式和样式分组导入。
- `src/styles/chatbot-layout.css`
  - 承载 vercel/chatbot 风格的 shell、sidebar、empty state 与 suggestions 样式。
  - 侧栏收起时按官方 icon rail 处理：隐藏历史、文字和主区域顶部栏，只保留聊天入口、新建入口、删除全部入口与底部用户头像；收起态不再把侧栏展开按钮挤到主区域边缘。
- `src/styles/chatbot-mobile.css`
  - 承载移动端侧栏抽屉、遮罩层和窄屏 suggestions 横向滚动样式，避免布局样式文件重新膨胀。
- `src/styles/chatbot-composer.css`
  - 承载底部 composer、附件入口、模型标识和发送按钮样式；用于避免双输入框或双发送按钮。
  - composer 视觉尺寸保持紧凑，接近上游 `MultimodalInput` / `PromptInput` 的低高度输入器：小附件按钮、短底栏、单个圆形发送 / 停止按钮和可截断模型名。
  - 模型选择器对齐上游 `ModelSelector`：点击当前模型后打开浮层，包含 `Search models...` 搜索框、`Available` 分组、模型列表和能力图标；浮层保持上游紧凑规格（约 `280px` 宽、`13px` 列表文字、`280px` 最大列表高度），模型数据优先来自 `/api/chat/models`，接口失败时使用本地 fallback 列表。
  - 模型 provider logo 来源与上游一致，按 `models.dev/logos/{provider}.svg` 下载后放在 `public/model-logos/`；已内置 `deepseek`、`mistral(ai)`、`moonshotai`、`openai`、`minimax`、`zai`、`x-ai/xai`、`google`、`anthropic`。`glm` 特例使用 `bigmodel.cn` 的智谱 AI `apple-touch-icon-152x152.png`，未知 provider 才回退到官方远程 URL。
  - composer 草稿通过 `localStorage` 的 `codex-chat:composer:draft` key 做 best-effort 恢复；提交成功后清空该 key，避免刷新丢失未发送内容，也避免跨产品污染其他聊天输入框。
  - Enter 会发送，Shift+Enter 会换行；中文输入法组合态会阻止 Enter 误提交。
  - 请求中发送按钮切换为停止按钮，并调用当前会话的 `onCancel`；空输入时只禁用发送，不禁用停止。
  - 附件入口当前仍是占位按钮，只弹出“附件上传尚未接入”提示；在后端消息附件协议落地前不要做本地假上传或假预览。
- `src/styles/chatbot-messages.css`
  - 承载消息列表、assistant reasoning、Markdown 和来源条样式。

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

## 后续改动注意

- `codex-chat` 不是上游 vercel/chatbot 的 Next.js 应用副本；不要把 `app/(chat)/api/*`、Auth.js、数据库迁移或 Vercel 专属服务直接搬进当前 Vite 前端。
- 页面视觉可以继续对齐上游 `components/chat/*` 和 `app/globals.css`，但跨运行时能力必须先落到本仓库的稳定 API contract。
- 页面显示文案默认使用中文；如果引入上游英文组件，必须在落地时同步本地化。
- 如果继续迁移上游组件，优先拆成小文件并保持单个手写源码文件不超过 400 行。
