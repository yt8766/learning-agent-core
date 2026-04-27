# agent-chat 概览

状态：current
文档类型：reference
适用范围：`apps/frontend/agent-chat`
最后核对：2026-04-26

`agent-chat` 是前线作战面，不是普通聊天壳子。

当前主要承载：

- 自有 Agent Chat 品牌的轻量聊天壳，视觉参考轻量多会话聊天产品，但不复用第三方品牌、logo 或图标资产
- Collapsible multi-session sidebar with time grouping and status indicators
- 当前隐藏 Quick / expert chat entry mode；执行意图由发送框内项目已支持的开关表达
- Current-conversation anchor rail for long-thread navigation
- 聊天流内 Codex 风格执行与审批卡，用于承载命令、工具调用、审批、拒绝反馈、取消与恢复
- Chat thread 与多轮会话切换
- Approval cards、Cancel、Recover 等消息流内操作
- Think / ThoughtChain / Event Timeline 运行态可视化
- Evidence / Sources / Learning suggestions 展示
- Workspace Vault 轻量摘要、Skill reuse readiness 与 Skill Flywheel 候选摘要
- Session list、长线程锚点轨与执行状态等轻量辅助视图

当前约束：

- 前线发送框不再暴露模型切换下拉框；聊天模型选择统一交给 Runtime 路由与治理策略决定
- Workspace / learning / reuse / skill draft 详情不作为默认右侧工作台外壳展示；主聊天消息流只展示轻量折叠摘要或 Codex 风格审批/执行卡
- Workspace Center projection 只允许在 chat 侧作为只读 readiness 摘要消费；不要在 `agent-chat` 中新增 Skill Draft 审批、安装或治理动作
- 运行时代码导入 `@agent/*` workspace 包时，必须在 `apps/frontend/agent-chat/package.json` 显式声明对应 `workspace:*` 依赖；`tsconfig.app.json` 的 `paths` 只服务 TypeScript，不足以保证 Vite dev server 的 import-analysis 解析
- 本地 dev 默认通过同源 `/api` 调用后端，并由 Vite proxy 转发到 `http://localhost:3000`；如需指向其他后端，优先设置 `VITE_API_PROXY_TARGET`，只有明确跨源联调时才设置 `VITE_API_BASE_URL`
- 空会话启动时只允许自动创建一次默认 session；如果后端不可达或 CORS/preflight 失败，前端应展示连接错误而不是在每次 render 后重复 `POST /api/chat/sessions`

## 当前目录职责

- `src/app`
  - 应用入口、路由装配、全局 provider
- `src/api`
  - 面向 `agent-server` 的接口封装与 SSE/HTTP 调用
  - `workspace-center-api.ts` 请求 `/api/platform/workspace-center` projection，并归一化为 chat 本地白名单 readiness 摘要；只暴露 workspace id/name/status、draft/reuse 计数、安装状态计数和有限 draft title，不透出 draft body、description 或治理动作入口
- `src/features/chat`、`src/features/chat-thread`
  - 聊天发送、消息流、会话主链路
- `src/features/approvals`
  - 审批卡片、审批动作与恢复入口
- `src/features/event-timeline`
  - ThoughtChain / 事件时间线展示
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
  - `pages/chat-home/chat-home-page.tsx`
    - 当前默认页面壳：`chatx-agent-codex`，承载自有 Agent Chat 品牌、多会话侧栏、空会话入口、聊天流、停止当前会话动作与审批反馈 modal
  - `pages/chat-home/chat-home-sidebar.tsx`
    - 左侧多会话侧栏；按时间分组，展示运行中、等待审批、完成等状态，并提供新对话、重命名、删除和退出登录入口
  - `pages/chat-home/chat-home-workbench-sections.tsx`
    - 保留高级摘要 section state 装配与导出 helper，默认聊天页面不再以完整 workbench 外壳承载这些内容
  - `pages/chat-home/chat-home-workbench-section-renders.tsx`
    - 承载 approval / current progress / evidence / learning / reuse / event stream 等高级摘要 section 渲染
- `src/styles`、`src/assets`、`src/types`、`src/lib`
  - 样式、静态资源、类型和轻量工具

## 启动

```bash
pnpm --dir apps/frontend/agent-chat dev
```

## 轻量聊天壳与 Codex 风格执行体验

`pages/chat-home` 默认呈现轻量聊天壳，使用自有 `Agent Chat` 品牌标识与项目内 CSS 图标，不复用第三方品牌名称、logo 或图表资产。左侧是多会话导航，按时间分组并用状态点表达运行中、失败与完成状态；等待审批 / 等待确认的会话使用胶囊与处理中图标突出阻塞态，审批完成后回落为普通会话项。中间主区域当前隐藏快速/专家模式切换，避免与发送框内的执行意图开关重复。发送框内的“深度思考”和“智能搜索”不新增后端字段，而是折叠到当前项目已支持的文本 workflow payload：深度思考对应 `/plan <message>`，智能搜索对应 `/browse <message>`，再通过既有 `POST /api/chat/messages` 的 `message` 字段进入 Runtime 路由；前端展示层会过滤这些 workflow 前缀，避免用户气泡、会话标题、左侧会话列表与锚点浮层暴露 `/plan`、`/browse` 等内部路由命令。`@ant-design/x` Sender 的 loading cancel action 直接接入 `cancelActiveSession`，用于停止当前运行会话。

右侧默认不占用完整工作台空间。长线程通过右侧锚点浮条定位用户问题、助手回答、审批点、Evidence 段落与关键执行节点；不再额外展示“回到当前会话”按钮。AI 回复统一展示自有 Agent Chat 头像，每条可见 AI 回复都有独立的“已思考”摘要；当前运行中的最新回复会把 Think / ThoughtChain 绑定为可展开面板，历史回复则保留各自的完成态思考入口，避免只有最后一条回复出现思考状态。Think、ThoughtChain、Evidence、Approval、Learning 与 Skill reuse 保留为消息内折叠摘要；当聊天记录出现审批或高风险命令时，应在消息流内展示 Codex 风格审批卡，明确命令/动作、风险说明、批准、拒绝、带反馈拒绝和取消入口。

API 仍以 [`agent-chat.md`](/docs/contracts/api/agent-chat.md) 为准：会话列表、消息、SSE、checkpoint、approve/reject 与 interrupt 恢复语义不因视觉重设计而改变。前端组件只消费项目稳定 DTO / SSE / checkpoint projection，不直接渲染第三方 executor、MCP、终端或浏览器原始 payload。

## Workspace Vault 摘要

Workspace Vault 摘要由 `buildWorkspaceVaultSignals` 从当前 checkpoint 与 Workspace Center readiness 聚合，不写入主聊天 Bubble，也不复用 `learning_summary` 这类线程消息标记。新版默认聊天壳不把它作为常驻右侧工作台展示；需要高级摘要时，由消息内折叠摘要或显式高级入口承载。

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
