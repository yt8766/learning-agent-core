# agent-chat 概览

状态：current
文档类型：reference
适用范围：`apps/frontend/agent-chat`
最后核对：2026-05-03

`agent-chat` 是前线作战面，不是普通聊天壳子。

当前主要承载：

- DeepSeek-style lightweight frontline shell
- Collapsible multi-session sidebar with time grouping and status indicators
- Single chat entry with per-message ability chips
- Current-conversation anchor rail for long-thread navigation
- Inline Agent OS assistant replies for execution tasks
- Chat thread 与多轮会话切换
- Approval cards、Cancel、Recover 等消息流内操作
- 主聊天以内联认知条 + Codex 风格自定义认知块呈现（`CognitionInferenceSection` / `CognitionThoughtLog`），已不再使用 `@ant-design/x` 的 `Think`/`ThoughtChain`；处理进度时间线不包含模型流式正文类事件（`assistant_token`、`assistant_message`、`final_response_*` 等）
- Evidence / Sources / Learning suggestions 展示
- Workspace Vault 轻量摘要、Skill reuse readiness 与 Skill Flywheel 候选摘要
- Runtime panel、session list 等执行辅助视图

当前约束：

- 前线发送框不再暴露模型切换下拉框；聊天模型选择统一交给 Runtime 路由与治理策略决定
- 前线聊天不再暴露“快速模式 / 专家模式”入口；普通消息默认按直接发送处理，需要计划语义时由“深度思考”等能力 chip 显式触发
- Inline Agent OS / 响应步骤里来自工具完成的 `outputPreview`（如文件已读、目录已列）是**成功摘要**，不是报错；英文 “Read … / Listed …” 类日志已收敛为中文说明，避免被误认为异常堆栈
- 侧栏会话菜单提供手动重命名；手动重命名会把 `ChatSessionRecord.titleSource` 置为 `manual`，后续 runtime 不得再用大模型摘要标题覆盖。未手动命名的新会话标题由 runtime 基于首条用户消息调用大模型生成摘要标题，失败时才使用本地短标题兜底
- Workspace / learning / reuse / skill draft 详情应留在高级 workbench；主聊天消息流只展示 AI 正文、来源卡和 inline Agent OS response steps。Chat Runtime v2 的工具审批主路径为聊天内自然语言确认，不再新增审批卡。
- Workspace Center projection 只允许在 chat 侧作为只读 readiness 摘要消费；不要在 `agent-chat` 中新增 Skill Draft 审批、安装或治理动作
- 运行时代码导入 `@agent/*` workspace 包时，必须在 `apps/frontend/agent-chat/package.json` 显式声明对应 `workspace:*` 依赖；`tsconfig.app.json` 的 `paths` 只服务 TypeScript，不足以保证 Vite dev server 的 import-analysis 解析
- 本地 dev 默认通过同源 `/api` 调用后端，并由 Vite proxy 转发到 `http://localhost:3000`；如需指向其他后端，优先设置 `VITE_API_PROXY_TARGET`，只有明确跨源联调时才设置 `VITE_API_BASE_URL`
- 空会话启动时只允许自动创建一次默认 session；如果后端不可达或 CORS/preflight 失败，前端应展示连接错误而不是在每次 render 后重复 `POST /api/chat/sessions`
- `src/styles/chat-home-page.scss` 是聊天首页样式聚合入口；同一个 Sass module 在该入口中只能 `@use` 一次，同名 `_*.scss` partial 与非 partial 文件也不能并存，避免 Vite/Sass 因重复 namespace 或解析歧义中断 dev server、CLI 编译或 build

## 当前目录职责

- `src/app`
  - 应用入口、路由装配、全局 provider
- `src/api`
  - 面向 `agent-server` 的接口封装与 SSE/HTTP 调用
  - `workspace-center-api.ts` 请求 `/api/platform/workspace-center` projection，并归一化为 chat 本地白名单 readiness 摘要；只暴露 workspace id/name/status、draft/reuse 计数、安装状态计数和有限 draft title，不透出 draft body、description 或治理动作入口
- `src/features/chat`、`src/features/chat-thread`
  - 聊天发送、消息流、会话主链路
- `src/features/approvals`
  - 历史审批卡片兼容、自然语言审批动作与恢复入口
- `src/features/event-timeline`
  - 认知块 / 事件时间线展示（自定义 `CognitionThoughtLog`）
- `src/features/runtime-panel`
  - 运行态侧栏与任务执行信息
- `src/features/learning`
  - 学习建议、复用提示等学习闭环 UI
- `src/features/session-list`
  - 会话列表与切换
- `src/components`
  - 跨 feature 复用组件
- `src/hooks`
  - 视图层 hooks；`src/hooks/chat-session` 聚焦会话驱动
- `src/store`
  - 前端状态管理
- `src/pages`
  - 页面级路由；当前以 `chat-home`、`session-detail` 为主
  - `pages/chat-home/chat-home-workbench-sections.tsx`
    - 只保留 workbench section state 装配与导出 helper
  - `pages/chat-home/chat-home-workbench-section-renders.tsx`
    - 承载 approval / current progress / evidence / learning / reuse / event stream 等 section 渲染
- `src/styles`、`src/assets`、`src/types`、`src/lib`
  - 样式、静态资源、类型和轻量工具

## 启动

```bash
pnpm --dir apps/frontend/agent-chat dev
```

## 轻量聊天壳与治理能力

`pages/chat-home` 默认呈现轻量聊天壳。左侧是多会话导航，按时间分组并用状态点表达运行中、失败与完成状态；等待审批 / 等待确认的会话使用绿色胶囊和处理中图标突出阻塞态，审批完成后回落为普通会话项并保留右侧蓝点。中间主区域在无消息时只展示单一输入入口；普通消息直接发送，计划语义由发送框里的“深度思考”等能力 chip 显式触发。

右侧默认不占用完整工作台空间。长线程通过当前会话锚点浮条定位用户问题、助手回答、审批点、Evidence 段落与关键治理节点。认知推理与过程流以自定义 `CognitionInferenceSection` / `CognitionThoughtLog` 折叠渲染；Learning 与 Skill reuse 的详情保留在高级面板或对应结构化卡片。

`agent-chat` 会把每轮 assistant 回复分成 `answer_only` 与 `agent_execution` 两种主线程展示模式。普通问答只显示 `思考中 / 已思考`，不会把 `final_response_completed` 这类低价值步骤渲染成“已处理 1 个步骤”。执行任务显示聊天内 `处理中 / 已处理` 入口；运行中默认展开，完成后默认折叠，展开后按“探索、执行、协作、验证、交付”等 Agent OS 过程分组展示。普通模型 thinking 不混入执行面板；用户理解和复盘本轮执行不依赖右侧 Runtime Drawer。投影折叠 helper 是 `src/lib/chat-response-step-projections.ts`；它从 `chat.events` 派生 `responseStepsByMessageId`，不写入 `ChatMessageRecord.card`。

主聊天线程不再把 `node_status`、`node_progress`、`execution_step_*`、`trajectory_step` 或 `task_trajectory` 直接写成系统消息卡片。过程事件仍保留在 `chat.events`，由 response-step projection、timeline 或 workbench 消费，避免聊天面回退到事件时间线卡片效果。

`direct_reply_*` 是当前轮 assistant 流式文本的本地中间态。该消息在主线程中必须保留正文：运行中用于展示正在生成的 AI 回复，取消后如果后端还没有持久化最终 assistant message，也要保留取消前已经流出的非空文本。只有 `progress_stream_*` 与 `summary_stream_*` 这类能力状态中间态会在主线程中清空正文并折叠为治理摘要。

## `node_*` 事件与直连回复 checkpoint

- Session fast-path（`direct-reply`）通过 runtime `emitNodeStatusEvent` 投递标准 `node_status` / `node_progress`，payload 包含 `nodeId`、`nodeLabel`、`phase`（`start` | `progress` | `end`）、`detail`、`progressPercent`（可选）；旧的 `{ node, status, route }` 写法已由前端投影兜底为生命周期摘要。
- 直连回合结束时 runtime 写入本轮 `checkpoint.thinkState.thinkingDurationMs`（流式起止毫秒差），并将模型 reasoning 片段（与 runtime `sanitizeDirectReplyVisibleContent` / agent-chat `parseAssistantThinkingContent` 对齐的可剥离标签）聚合进 `thinkState.content`；用户可见正文仍经消毒去掉推理标签。
- **联网检索**：`AgentRuntime` 将 MCP 能力 `webSearchPrime`（次之 `minimax:web_search`）适配为 direct-reply 的 `webSearchFn`；无能力时跳过检索，thoughtChain 仍保留意图与组织回答等叙述步骤。
- **历史认知**：直连成功或失败后均会对本轮助手消息调用 `mergeAssistantCognitionSnapshot`，写入与 checkpoint 一致的 `cognitionSnapshot`（含 `thoughtChain`），以便非当前 cognition 目标的气泡仍可展开（参见 `buildBubbleItems` 对 `cognitionSnapshot` 的优先读取）。
- **时长展示**：`buildCognitionDurationLabel` 在 `chatRoute.flow === 'direct-reply'` 时**只**采用 `thinkState.thinkingDurationMs`，不再用 `thoughtChain` 前几项上的 `thinkingDurationMs`，也不再用 `checkpoint.createdAt`/`updatedAt` 区间兜底，避免长会话 checkpoint 污染「本轮已思考」文案。
- **避免双轨**：当助手消息已带叙述型 `cognitionSnapshot`，或当前投影的 `thoughtItems` 已包含联网检索/浏览变体时，主线程会隐藏正文**前**的 Agent OS 响应步骤摘要，仅保留内联认知折叠条。
- Workbench 认知时间线的脚注时间使用 `formatSessionTime` 本地化展示；`buildCognitionDurationLabel` 对超长耗时做上限与「较长」兜底（非 direct-reply 路径仍可能使用 thoughtChain 或 checkpoint 时间区间）。

## Workspace Vault 摘要

`pages/chat-home/chat-home-workbench.tsx` 在右侧 OpenClaw workbench 的 `Current Workspace` 区块内渲染 `Workspace Vault` 摘要。该摘要由 `buildWorkspaceVaultSignals` 从当前 checkpoint 与 Workspace Center readiness 聚合，不写入主聊天 Bubble，也不复用 `learning_summary` 这类线程消息标记。

当前 Vault 只展示轻量 readiness 信号：

- Workspace signals：来源、复用记忆、规则、技能、角色与连接器的总览。
- Evidence readiness：当前 `externalSources` 数量与 learning evaluation 中的 internal source 数量。
- Reuse readiness：memory / rule / reused skill / installed skill / company worker 的复用总数，以及技能、角色、连接器分布。
- Skill draft readiness：learning evaluation 中的 recommended / auto-confirm candidate 计数与 confidence。
- Workspace Center：通过 agent-chat 本地 `api/workspace-center-api.ts` 请求 `/api/platform/workspace-center`，把平台 projection 归一化成只读 readiness，展示 draft ready/total、approved、reuse 与最多 3 个 draft title。
- Install receipts：当前 checkpoint 中 `skillSearch.suggestions[].installState` 的安装收据状态与 receipt id 摘要。
- Capability gap：`skillSearch.capabilityGapDetected` 与 `mcpRecommendation` / suggestion 的摘要。

这些 cards 是前线作战面的上下文视图，不是 Skill Lab 的替代入口。chat 侧仍只展示 readiness / intake / receipt 摘要；真实草案治理、安装和审批状态以 Workspace Center、Skill Lab 或后端稳定接口为准。`Workspace Center` readiness 请求失败时静默回退到 checkpoint signals，不污染主聊天流。

## 最低验证

```bash
pnpm exec tsc -p apps/frontend/agent-chat/tsconfig.app.json --noEmit
```
