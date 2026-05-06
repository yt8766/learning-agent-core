# X SDK Chat And Knowledge Refactor Design

状态：snapshot
文档类型：plan
适用范围：`apps/frontend/agent-chat`、`apps/frontend/knowledge`
最后核对：2026-05-04

## 背景

当前 `apps/frontend/knowledge` 与 `apps/frontend/agent-chat` 都已经引入了 `@ant-design/x`、`@ant-design/x-markdown` 与 `@ant-design/x-sdk`，但聊天主线仍然分裂：

- `knowledge` 主要通过 `useKnowledgeChat`、页面局部状态和 `@ant-design/x/es/*` 直连入口维护消息、会话和流式状态。
- `agent-chat` 主要通过 `useChatSession`、`messages + events + checkpoint` 三套并行状态，以及自定义消息适配器维护前线作战面。
- 两个前端都在使用 `Bubble.List`、`Sender`、`XMarkdown` 等 UI 能力，但尚未收敛到统一的 `XRequest + Provider + useXChat/useXConversations` 主线。

这导致几个持续问题：

1. 消息真相分散，页面和 hook 同时在管业务状态。
2. 复杂能力没有稳定边界，审批、Think、ThoughtChain、citation、技能安装、计划中断、恢复等语义分散在多个页面和 helper 中。
3. `knowledge` 与 `agent-chat` 虽然都叫 chat，但无法共享稳定的聊天抽象，只能共享零散渲染组件。
4. 测试与渲染实现对 `@ant-design/x/es/*` 的路径直连过深，后续升级和替换成本高。

本轮目标不是“在原结构上再包一层 `x-sdk`”，而是让 `@ant-design/x-sdk` 成为两个前端的唯一聊天状态主线，同时保持 `agent-chat` 现有审批、Think、ThoughtChain、恢复、技能建议、工作台等能力不回退。

## 目标

1. `knowledge` 与 `agent-chat` 的聊天状态统一切换到 `XRequest + Chat Provider + useXChat + useXConversations`。
2. `knowledge` 彻底删除 `use-knowledge-chat` 作为主状态源的职责。
3. `agent-chat` 彻底删除 `use-chat-session` 作为消息真相的职责，不再并行维护 `messages + events + checkpoint` 三套页面主状态。
4. `x-components` 成为两个前端聊天 UI 的统一基础组件入口，不再新增 `@ant-design/x/es/*` 直连实现。
5. `x-markdown` 成为 assistant / system 富文本正文的统一渲染入口，流式状态通过稳定 `streaming` 配置驱动。
6. `x-card` 成为审批卡、技能安装卡、计划中断卡、恢复卡等结构化 Agent UI 的统一渲染入口。
7. `knowledge` 维持现有会话、流式回答、citation、trace、feedback、欢迎区和建议区能力。
8. `agent-chat` 维持现有会话创建、历史切换、审批、Think、ThoughtChain、response steps、技能建议、计划中断、恢复与工作台能力。
9. 页面层只负责编排与展示，不再直接承担聊天主状态机。

## 非目标

- 不在本轮新建大而全的共享前端聊天平台包。
- 不为了共用而统一 `knowledge` 与 `agent-chat` 的全部 Provider 实现。
- 不重写后端 chat API 为全新协议。
- 不在本轮重做 `agent-chat` 或 `knowledge` 的整体视觉风格。
- 不把所有前端聊天辅助能力都抬到 `packages/core`。

## 设计原则

### 单一消息状态源

每个聊天页面在任意时刻只能有一个消息状态真相，统一由 `useXChat` 承担。页面、旧 hook、局部 helper 不得再并行维护第二套消息主状态。

### 领域语义下沉

`x-sdk` 负责聊天状态；复杂领域语义下沉到应用内 `provider / adapter / parser / card-command` 边界，不直接污染 `useXChat` 调用层。

### 可见消息与运行态投影分层

正文文本、结构化卡片、Think、ThoughtChain、citation、response steps、审批动作、恢复动作必须分层表示，禁止继续混在一段 `content` 文本里。

### 结构化卡片协议化

审批、技能安装、计划中断、恢复等高交互内容统一通过 `@ant-design/x-card` 的 A2UI v0.9 command 流渲染，不再长期散落在大量条件 JSX 中。

### 页面瘦身

页面只消费：

- `useXConversations`
- `useXChat`
- parser 产物
- action handler

页面本身不再承担核心聊天状态折叠与领域事件解释。

## 目标架构

### 总体分层

两个前端统一收敛到以下层次：

1. `XRequest`
   负责 HTTP / SSE / 流式传输配置，不持有业务状态。
2. `Chat Provider`
   负责把现有后端协议转换成 `useXChat` 可消费的请求和流式输出。
3. `useXConversations + useXChat`
   负责会话列表与消息列表的唯一状态主线。
4. `parser / adapter / card-command`
   负责把领域消息和领域事件投影成 UI 可直接消费的结构。
5. `x-components + x-markdown + x-card`
   负责最终渲染。

### 应用内目录边界

`knowledge` 新增宿主：

- `apps/frontend/knowledge/src/chat-runtime/knowledge-chat-provider.ts`
- `apps/frontend/knowledge/src/chat-runtime/knowledge-chat-types.ts`
- `apps/frontend/knowledge/src/chat-runtime/knowledge-chat-parser.tsx`
- `apps/frontend/knowledge/src/chat-runtime/knowledge-conversations.ts`
- `apps/frontend/knowledge/src/chat-runtime/knowledge-chat-actions.ts`

`agent-chat` 新增宿主：

- `apps/frontend/agent-chat/src/chat-runtime/agent-chat-provider.ts`
- `apps/frontend/agent-chat/src/chat-runtime/agent-chat-types.ts`
- `apps/frontend/agent-chat/src/chat-runtime/agent-chat-event-adapter.ts`
- `apps/frontend/agent-chat/src/chat-runtime/agent-chat-message-parser.tsx`
- `apps/frontend/agent-chat/src/chat-runtime/agent-chat-card-commands.ts`
- `apps/frontend/agent-chat/src/chat-runtime/agent-chat-conversations.ts`
- `apps/frontend/agent-chat/src/chat-runtime/agent-chat-actions.ts`

页面层只保留页面编排，不再承担聊天主状态机：

- `apps/frontend/knowledge/src/pages/chat-lab/*`
- `apps/frontend/agent-chat/src/pages/chat-home/*`

如果两个应用之间出现可复用的纯前端 contract 或纯 mapper，仅允许抽出非常薄的共享宿主；本轮不先为“未来可能复用”新建平台化大包。

## 统一消息模型

两个前端统一使用一套前端聊天消息模型，由应用各自的 `chat-runtime/*-types.ts` 定义本地正式类型。

```ts
type FrontendChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  kind: 'plain' | 'markdown' | 'card' | 'mixed';
  meta?: {
    conversationId?: string;
    messageId?: string;
    traceId?: string;
    citations?: CitationProjection[];
    think?: ThinkProjection;
    thoughtChain?: ThoughtProjectionItem[];
    actions?: MessageActionProjection[];
    cards?: AgentCardProjection[];
    statusLine?: StatusProjection;
    route?: RouteProjection;
    checkpoints?: CheckpointProjection[];
    responseSteps?: ResponseStepProjection[];
    stream?: {
      phase: 'idle' | 'loading' | 'updating' | 'done' | 'error' | 'abort';
      hasNextChunk?: boolean;
    };
  };
};
```

设计约束：

- `content` 只承载用户可读正文，不再拼装审批文案、事件日志或卡片语义。
- `kind` 用于指导 parser 选择 Markdown、卡片或混合渲染模式。
- `meta` 用于承载 citation、Think、ThoughtChain、actions、cards、statusLine 等领域投影。
- 所有高级能力都必须能投影到某一条 assistant 或 system 消息上，避免退回页面散状态。

## 事件模型

页面不再直接消费原始 SSE / EventSource / checkpoint 记录。Provider 内部负责：

1. 消费后端 chat / stream / session / checkpoint / event 源。
2. 转换为领域 event。
3. 折叠为消息增量与会话状态增量。
4. 通过 `useXChat` 持续更新同一条 assistant / system 消息。

`useXChat` 看到的生命周期固定为：

1. 用户消息入列。
2. assistant 占位消息创建。
3. assistant 正文逐块更新。
4. 同一消息的 `meta` 被持续 patch。
5. 流结束后消息定稿。

这样既保留 `useXChat` 的单消息主线，又能承载复杂治理和运行态投影。

## Knowledge 设计

### Provider 职责

`knowledge-chat-provider.ts` 负责把现有 API 接成 `useXChat` 语义：

- `chat`
- `streamChat`
- `createFeedback`
- `listConversations`
- `listConversationMessages`

`XRequest` 使用前端安全配置：

- 不直接在浏览器注入 `Authorization`
- 只通过现有同域 API 或现有前端 API client 访问后端
- `manual: true` 用于 Provider 场景

### Conversation 管理

`useXConversations` 成为 `knowledge` 会话列表唯一状态来源。

会话数据来自：

- 后端 `listConversations()`
- 本地创建新会话时的 optimistic conversation
- 切换会话时的 `defaultMessages` 异步加载

`queueRequest` 用于以下场景：

- 切换到新建会话后自动发送首条消息
- 后端消息历史尚未完成初始化时的延迟发送

### 消息渲染

`knowledge-chat-parser.tsx` 把消息投影到：

- `Bubble.List`
- `XMarkdown`
- `Sources` 或 citation footer
- `Actions.Copy`
- `Actions.Feedback`
- `Suggestion`
- `Welcome`

assistant 消息约束：

- `content` 渲染为 Markdown
- `meta.citations` 渲染为引用区
- `meta.route`、`meta.traceId`、`meta.statusLine` 渲染为 footer 辅助信息

### 页面收敛

以下文件将不再承担主状态职责：

- `apps/frontend/knowledge/src/hooks/use-knowledge-chat.ts`
- `apps/frontend/knowledge/src/pages/chat-lab/chat-lab-page.tsx`
- `apps/frontend/knowledge/src/pages/chat-lab/chat-lab-messages.tsx`
- `apps/frontend/knowledge/src/pages/chat-lab/chat-lab-sidebar.tsx`

收敛后：

- `chat-lab-page.tsx` 只负责编排 `useXConversations + useXChat + Bubble.List + Sender + Suggestion + Welcome`
- `chat-lab-messages.tsx` 转成纯 parser / render helper
- `chat-lab-sidebar.tsx` 直接消费 `useXConversations` 数据
- `use-knowledge-chat.ts` 最终删除或缩成兼容 facade，且不再是主状态源

复用而不重写的边界：

- `knowledge-api-provider.tsx`
- `knowledge-api-client.ts`
- `chat-lab-diagnostics.ts`
- `chat-lab-helpers.ts` 中真正属于领域格式化的部分

## Agent Chat 设计

### Provider 职责

`agent-chat-provider.ts` 负责把现有 `agent-chat` 后端会话协议转换成 `useXChat` 能力：

- 新建 / 激活会话
- 历史会话读取
- 主链流式消息
- checkpoint / event / response steps 折叠
- 审批 / 反馈 / 技能安装 / 计划中断 / 恢复动作

### 三套状态折叠为一条消息主线

当前 `agent-chat` 的复杂度来自：

- `messages`
- `events`
- `checkpoint`

本轮不允许这三者继续作为页面并行真相存在。`agent-chat-event-adapter.ts` 负责把这三类输入折叠成：

- assistant / system 消息正文 patch
- `meta.think`
- `meta.thoughtChain`
- `meta.responseSteps`
- `meta.cards`
- `meta.actions`
- 会话级状态投影

### 高级能力投影规则

#### Think

- `meta.think` 保存当前 thinking 状态、耗时、目标消息 id。
- 页面通过 `Think` 组件渲染单块推理摘要。

#### ThoughtChain

- `meta.thoughtChain` 保存步骤化推理项目。
- 页面通过 `ThoughtChain` 渲染多步过程，不再由页面直接读散落的 checkpoint 字段。

#### Response Steps

- `meta.responseSteps` 保存按消息挂载的 response step 投影。
- 与正文和 Think 共处于同一条 assistant 消息上下文中。

#### 审批 / 技能安装 / 计划中断 / 恢复

- 统一投影到 `meta.cards`
- 由 `agent-chat-card-commands.ts` 生成 A2UI v0.9 commands
- 页面通过 `XCard.Box + XCard.Card` 渲染结构化操作卡

#### 用户动作

复制、审批、反馈、重试、技能安装、计划操作不再散落在 JSX 分支里，而是统一描述为 `meta.actions`，交由 `agent-chat-actions.ts` 解释并回调现有后端能力。

### Conversation 管理

`useXConversations` 成为 `agent-chat` 会话列表唯一状态来源，负责：

- 新会话创建
- 历史会话切换
- 恢复已有会话
- 激活状态切换

恢复与重连的关键约束：

- 切换会话不重复灌入历史消息
- reconnect / recover 不重复创建 assistant 占位消息
- 流结束后正确停止 stream 与补充轮询

### 页面收敛

以下旧主链将被实质替换：

- `apps/frontend/agent-chat/src/hooks/use-chat-session.ts`
- `apps/frontend/agent-chat/src/hooks/chat-session/*`
- `apps/frontend/agent-chat/src/pages/chat-home/chat-home-page.tsx`
- `apps/frontend/agent-chat/src/pages/chat-home/chat-home-conversation.tsx`
- `apps/frontend/agent-chat/src/pages/chat-home/chat-home-workbench.tsx`
- `apps/frontend/agent-chat/src/pages/chat/chat-message-adapter.tsx`
- `apps/frontend/agent-chat/src/pages/chat/chat-bubble-items-cache.ts`
- `apps/frontend/agent-chat/src/components/chat-message-cards.tsx`

收敛后的职责变化：

- `use-chat-session.ts` 不再持有消息真相、事件真相、checkpoint 真相三套并行状态。
- `chat-home-page.tsx` 不再自己构造 bubbleItems 主链，而是消费 `agent-chat-message-parser.tsx` 的产物。
- `chat-message-adapter.tsx` 的领域逻辑拆到 `event-adapter + parser + card-commands`。
- `chat-message-cards.tsx` 仅保留 Markdown / 富内容渲染能力，不再承担整个消息语义拼装。

## X Card 设计

所有新增结构化卡片命令必须遵守：

- 协议固定使用 `v0.9`
- 每条命令显式包含 `version: "v0.9"`
- 每个 surface 只有一个 `root`
- 组件树使用扁平邻接表
- 结构与数据分离：布局走 `updateComponents`，运行态数据走 `updateDataModel`

本轮 `x-card` 主要覆盖：

- 审批请求卡
- 技能安装卡
- 计划中断卡
- 恢复 / recover 卡
- 其他需要结构化动作回传的 Agent UI 区块

`agent-chat-actions.ts` 负责把 `ActionPayload` 映射回现有前端动作：

- `updateApproval`
- `updatePlanInterrupt`
- `installSuggestedSkill`
- `cancel`
- `recover`

## 迁移路径

按以下顺序执行：

1. 先定义统一前端聊天 contract
2. 先完整打通 `knowledge`
3. 再迁移 `agent-chat`
4. 最后删除旧主线实现与兼容残留

### 阶段一：统一 contract

先在两个应用内分别落地正式类型，固定：

- `FrontendChatMessage`
- conversation model
- action model
- card model
- thought model
- parser 输入输出约定

在此之前不直接改页面主链。

### 阶段二：Knowledge 先落地

先完成 `knowledge` 的完整迁移，用于验证：

- `XRequest`
- Provider
- `useXConversations`
- `useXChat`
- parser
- Markdown streaming

`knowledge` 的复杂度相对更低，适合作为 `x-sdk` 主骨架验证场。

### 阶段三：Agent Chat 迁移

在 `knowledge` 骨架验证后，再迁 `agent-chat`，重点处理：

- event / checkpoint / response steps 折叠
- 审批卡
- Think / ThoughtChain
- 恢复与重连
- 工作台相关投影

### 阶段四：清理旧实现

新主线稳定后，必须清理：

- 旧 hook
- 旧 adapter
- 旧页面散状态
- 旧 `@ant-design/x/es/*` 直连入口
- 已无调用的样式、helper 和测试 mock

旧实现一旦被新主线替代，就进入删除清单，不允许长期并存。

## 主要风险

### 风险一：Agent Chat 的复杂状态不是纯消息流

问题：

- 现有大量能力来自 `messages + events + checkpoint` 三套数据协作。

应对：

- 先定义 `event-adapter` 折叠规则，再切换页面。
- 不允许页面直接拿 `useXChat` 去消费未折叠的原始 SSE / checkpoint。

### 风险二：X Card 协议化后调试成本上升

问题：

- 卡片 JSX 被命令流替代后，命令结构错误会更隐蔽。

应对：

- `card-commands` 单独收口。
- 所有 command 生成逻辑做最小测试覆盖。
- 协议固定 `v0.9`，不在本轮混用 `v0.8`。

### 风险三：两个应用复杂度不同，容易过度抽象

问题：

- `knowledge` 与 `agent-chat` 的聊天复杂度差异显著。

应对：

- 只共享最薄的前端 contract 和通用 mapper 约束。
- Provider、event folding、card 生成保持应用内实现，不做大而全抽象。

### 风险四：测试 mock 与正式入口不一致

问题：

- 当前不少测试依赖 `@ant-design/x/es/*`、`@ant-design/x-markdown/es` mock。

应对：

- 统一迁到正式包入口：
  - `@ant-design/x`
  - `@ant-design/x-markdown`
  - `@ant-design/x-sdk`

## 验证策略

### Knowledge 验证

至少覆盖：

1. 会话列表加载、切换、新建。
2. 发送消息后用户消息立即出现。
3. assistant 占位消息流式更新。
4. 最终回答、citation、trace、feedback 正常挂载。
5. `XMarkdown` 流式收口时 `hasNextChunk` 正确结束。
6. `Suggestion`、`Welcome`、`Sender` 的基础交互不回退。

### Agent Chat 验证

至少覆盖：

1. 新会话创建、历史会话切换、恢复已有会话。
2. 发送后立即出现用户消息与 assistant 占位。
3. SSE / 轮询折叠后，正文、Think、ThoughtChain、response steps 能同步更新到同一条消息。
4. 审批卡、技能安装卡、计划中断卡、恢复卡能通过 `XCard` 渲染并触发动作。
5. 审批、反馈、重试、复制、技能安装、计划操作仍能打回现有后端能力。
6. 会话完成后流和轮询能正确停止。
7. reconnect / recover 不重复灌消息、不丢失 `meta` 投影。

### 测试形态

本轮以前端重构行为验证为主，优先补和改现有测试，而不是盲目扩张新测试宿主。重点包括：

- parser / adapter 单测
- chat page render test
- stream event folding test
- conversation switching test
- approval / card action test

### 最低命令

至少覆盖：

- `pnpm exec tsc -p apps/frontend/knowledge/tsconfig.app.json --noEmit`
- `pnpm exec tsc -p apps/frontend/agent-chat/tsconfig.app.json --noEmit`
- `pnpm --dir ../../.. exec vitest run --config vitest.config.js apps/frontend/knowledge/test`
- `pnpm --dir ../../.. exec vitest run --config vitest.config.js apps/frontend/agent-chat/test`

如果迁移过程中触达与 chat API 契约耦合的前端 client / contract，再补受影响范围对应的 schema / contract 校验。

## 文档更新

实现时需要同步更新：

- `docs/apps/frontend/knowledge/knowledge-chat-lab.md`
- `docs/apps/frontend/knowledge/knowledge-frontend.md`
- `docs/apps/frontend/agent-chat/README.md`
- `docs/apps/frontend/agent-chat/chat-api-integration.md`
- 如前后端 chat contract 有变化，对应 `docs/contracts/api/*`

如果旧文档仍描述旧 hook 或旧页面散状态为主线，必须直接改写为新主线，不新增分叉说明文档。

## 实施完成定义

只有同时满足以下条件，本轮重构才算完成：

1. `knowledge` 与 `agent-chat` 都以 `useXChat/useXConversations` 作为唯一聊天状态主线。
2. `knowledge` 删除 `use-knowledge-chat` 的主状态职责。
3. `agent-chat` 删除 `use-chat-session` 的消息主状态职责。
4. `agent-chat` 现有审批、Think、ThoughtChain、恢复、技能建议、工作台能力全部保持可用。
5. 页面层不再并行维护第二套消息真相。
6. 旧 `@ant-design/x/es/*` 直连和已失效适配层已清理。
7. 受影响范围类型检查和关键前端测试通过。
8. 文档已同步收口到真实实现。
