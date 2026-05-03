# Agent Chat DeepSeek-Style Frontline Design

状态：snapshot
文档类型：plan
适用范围：`apps/frontend/agent-chat`
最后核对：2026-04-26

> 过时说明（2026-05-02）：本文是历史设计快照。当前 `agent-chat` 已移除快速/专家模式，已恢复侧栏手动重命名入口，并且主聊天 AI 回复不再内嵌 `Think` / `ThoughtChain` 折叠行；真实实现以 `docs/apps/frontend/agent-chat/overview.md` 和 `docs/packages/runtime/session-title-generation.md` 为准。

## 目标

将 `agent-chat` 的默认体验从控制台式 OpenClaw 工作区，优化为更接近 DeepSeek 的轻量聊天界面，同时保留本项目的多 Agent 前线能力。

本次设计采用“轻量聊天 + 治理浮层”方向：

- 默认第一屏像聊天产品一样干净、聚焦。
- 左侧支持多个历史会话，并支持展开与收起。
- 中间主区域覆盖无消息空态和有消息线程态。
- 右侧新增当前会话内的消息锚点浮条，用于长对话快速定位。
- Think、ThoughtChain、Evidence、Approval、Learning、Skill reuse 不删除，只默认折叠或放入专家模式、高级面板与消息内状态。

## 非目标

- 不冒用 DeepSeek 品牌名。视觉可借鉴蓝色品牌感、留白、输入框和聊天布局，但文案使用项目自己的 `Agent Chat` / OpenClaw 语义。
- 不修改后端 SSE、DTO 或持久化 contract。
- 不删除现有审批、恢复、取消、Evidence、Learning、Skill reuse 等能力。
- 不把 `agent-chat` 改成普通聊天机器人；它仍是前线作战面。

## 总体结构

页面由四个主要区域组成：

1. 左侧多会话导航栏
2. 中间聊天主区域
3. 右侧当前会话锚点浮条
4. 可展开的高级治理面板

左侧展开态参考用户提供的图片 1：顶部品牌、开启新对话按钮、按时间分组的会话列表、底部用户区。左侧收起态参考图片 2：窄栏约 `96-112px`，左上保留品牌图标，顶部胶囊按钮组提供展开和新对话。

中间主区域参考图片 3 和图片 4：无消息时居中展示品牌引导、快速/专家模式切换与输入框；有消息后展示用户气泡、助手回答、折叠思考状态和底部输入框。

右侧新增当前会话内的定位浮条。默认只显示几个短横点，当前节点为蓝色；hover 后展开为当前会话内的锚点列表，点击滚动到对应消息、回答、审批点、证据段落或关键节点。

## 组件边界

### `ChatHomeShell`

页面级布局容器，负责以下状态：

- `sidebarCollapsed`
- `chatMode`
- `showAdvancedPanel`

它只做布局与状态装配，不直接渲染复杂消息卡或会话分组逻辑。

### `ChatSessionSidebar`

左侧多会话导航组件。输入来自 `useChatSession()` 的 sessions、active session、loading 状态和操作回调。

职责：

- 按“今天 / 7 天内 / 30 天内 / YYYY-MM”分组会话。
- 展示会话标题、截断状态与 status dot。
- 支持点击切换会话。
- 支持新建会话。
- 支持展开态和收起态。

状态表达：

- `running`：蓝色状态点或轻标签。
- `waiting_approval` / `waiting_interrupt`：绿色等待胶囊，分别显示 `等待批准` / `等待确认`，右侧带轻量处理中图标。
- `failed` / error：红色状态点。
- 完成或空闲：灰色或无强调状态点。

### `ChatEmptyState`

无消息时的首屏入口。

内容：

- 蓝色品牌标识与 `Agent Chat` 文案。
- 快速模式 / 专家模式分段控制。
- DeepSeek 风格的大圆角输入框。
- 快捷能力按钮，如“深度思考”“智能搜索”。这些按钮必须对应现有能力或明确作为专家模式入口，不做无行为装饰。

模式语义：

- 快速模式：普通直接回答路径。
- 专家模式：启用计划/调度语义，默认用轻量 `/plan` workflow command 提交。
- 快捷能力按钮仍优先保留自身 workflow payload；即使用户当前处于专家模式，选择快捷能力也会回到快速语义，避免 `/review` / `/qa` 等显式动作被误包装成 `/plan`。

### `ChatThreadSurface`

有消息时的主线程区域。

职责：

- 渲染用户消息、助手消息和消息卡片。
- 将 Think、ThoughtChain、Evidence、Approval、Learning 等能力转为轻量折叠状态。
- 为右侧锚点浮条提供稳定 DOM anchor。
- 保持输入框在底部附近，避免主聊天区域被高级面板挤压。

### `ChatComposer`

继续复用现有发送逻辑和 helper，但视觉改为大圆角输入框。

行为：

- 快速模式按普通文本提交。
- 专家模式通过 `resolveComposerSubmitForMode` 提交为 `/plan <内容>`；已有显式 workflow command 与快捷能力建议 payload 必须保持兼容。
- loading 时保留取消能力。
- 保留附件、搜索、深度思考等已有或可映射按钮，但按钮必须有真实状态或明确后续接线边界。

### `ConversationAnchorRail`

右侧当前会话内定位浮条。

默认态：

- 只显示 2-4 个短横点。
- 当前锚点为蓝色。
- 位置固定在聊天主区域最右侧。

Hover 态：

- 展开浮层卡片。
- 展示当前会话内锚点标题。
- 每项右侧保留短横状态。
- 点击后滚动到对应 DOM id。

锚点来源：

- 用户问题。
- 助手回答。
- 审批卡。
- Evidence / Sources 段落。
- 关键 ThoughtChain / Think 状态。
- 实现时只保留当前 `Bubble.List` 实际渲染的可见消息锚点；被折叠、内联或过滤的原始消息不得单独出现在浮条里，避免点击后没有 DOM 目标。

如果当前会话没有足够锚点，不渲染浮条。

### `GovernanceStatusInline`

消息内的治理状态摘要组件。

职责：

- 将 Think / ThoughtChain 显示为“已思考（用时 N 秒）”一类折叠行。
- 将 Evidence 显示为来源数量或可展开摘要。
- 将 Approval 显示为待审批 / 已处理的轻量状态。
- 将 Learning / Skill reuse 显示为可展开提示。
- 消息表层轻量化样式落在 `styles/_chat-home-message-surface.scss`，作为 `chat-home-messages` 之后的覆盖入口，避免继续扩大旧的大型消息样式文件。

主聊天默认只显示摘要，详情进入折叠内容或高级面板。

## 数据流

本设计不新增后端协议，主要复用现有 `useChatSession()` 与页面 helpers。

派生数据：

- 左侧分组：由 `chat.sessions` 按更新时间派生。
- 会话状态点：由 `ChatSessionRecord.status` 派生。
- 消息锚点：由 `chat.messages`、message card 类型、checkpoint 中的 thought/evidence/approval 摘要派生。
- 治理状态：由现有 `bubbleItems`、`thoughtItems`、`checkpoint` 派生。
- 专家模式提交：复用现有 composer helper，避免在 UI 层复制 workflow 分支。

状态建议：

```ts
type ChatMode = 'quick' | 'expert';

interface ChatHomeShellState {
  sidebarCollapsed: boolean;
  chatMode: ChatMode;
  showAdvancedPanel: boolean;
  activeAnchorId?: string;
}
```

`anchorRailHovered` 可以作为 `ConversationAnchorRail` 局部状态，不需要进入页面级 state。

## 错误处理

- 会话列表加载失败、发送失败、SSE 中断继续使用现有 `chat.error`，但视觉上改为聊天页顶部轻提示。
- 点击锚点时如果目标 DOM 不存在，不抛错，只忽略本次跳转。
- 专家模式下如果没有可用 workflow，仍允许发送，并在治理状态中提示“已按普通对话处理”。
- 侧栏展开/收起不影响 active session、运行中任务、等待审批状态或当前滚动位置。
- 等待审批时，左侧会话绿色胶囊和消息内折叠状态必须同步表达；审批完成后侧栏会话项恢复普通标题与右侧蓝点。

## 测试策略

测试优先覆盖行为。

必须覆盖：

- 多会话按时间分组：今天、7 天内、30 天内、月份。
- 会话状态：运行中、失败与完成使用状态点；等待审批 / 等待确认使用绿色等待胶囊。
- 左侧展开/收起：展开态显示历史列表；收起态只显示品牌图标、展开按钮和新对话按钮。
- 新对话与会话切换：点击后调用现有回调。
- 空会话页：显示品牌、模式切换和输入框。
- 快速/专家模式：提交路径或 payload 有可验证差异。
- 有消息页：显示用户消息、助手消息与折叠治理状态。
- 右侧锚点浮条：有足够锚点时出现，hover 展开，点击触发定位。
- 回归：approval card、plan question、skill suggestion、evidence card、learning summary 不因视觉改造消失。

建议验证命令：

```bash
pnpm --dir apps/frontend/agent-chat exec vitest run test/pages/chat-home
pnpm exec tsc -p apps/frontend/agent-chat/tsconfig.app.json --noEmit
```

如果实现触达共享包或后端 contract，再按仓库验证规范补充更高层级检查。

## 文档更新范围

实现阶段需要同步更新：

- `docs/apps/frontend/agent-chat/overview.md`
- 相关测试说明或页面注释

需要清理或改写的旧描述：

- “单会话入口”相关描述。
- “Workspace 默认占据右侧主区域”的描述。
- 与左侧 `ChatHomeSidebar` 当前会话卡片不再一致的说明。

## 实施顺序建议

1. 先补测试：侧栏多会话分组、收起态、空态模式、锚点浮条。
2. 拆分 shell 与 sidebar 组件。
3. 改造空态和 composer 视觉。
4. 改造消息态治理状态摘要。
5. 增加右侧锚点浮条。
6. 收敛样式与响应式。
7. 更新 agent-chat 文档并清理旧描述。

## 开放决策

本设计已确认：

- 采用“轻量聊天 + 治理浮层”方向。
- 品牌视觉贴近 DeepSeek，但文案使用项目名。
- 左侧收起态采用窄栏胶囊按钮。
- 快速模式对应普通直接回答，专家模式对应计划/调度。
- 有消息页的多 Agent 能力默认折叠显示。
- 右侧浮条定位当前会话内消息锚点。
- 左侧栏支持多个会话，按时间分组并显示状态点。

实现前仍可微调具体视觉尺寸，但不应改变以上交互语义。
