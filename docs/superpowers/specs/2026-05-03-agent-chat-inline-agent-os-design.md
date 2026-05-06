# Agent Chat Inline Agent OS Design

状态：snapshot
文档类型：plan
适用范围：`apps/frontend/agent-chat`、`apps/backend/agent-server`、`packages/core`
最后核对：2026-05-03

## 背景

`agent-chat` 当前同时存在三类主线程状态：

- `已思考`：模型回答前的思考状态，适合普通问答。
- `已处理步骤`：response steps 投影出来的执行过程摘要。
- ThoughtChain / node / graph 事件：更接近内部运行轨迹或治理详情。

这些语义现在还没有完全分层。普通技术问答容易出现不该出现的“已处理 1 个步骤”，执行任务又会把 `主 Agent / 礼部 / final_response_completed` 这类内部节点信息露在主视觉里，导致聊天线程不像成熟聊天产品，也不像 Codex 那样自然展示执行过程。

本设计把主线程收敛成两种模式：

- 普通问答显示 `思考中 / 已思考`。
- 执行任务显示 `处理中 / 已处理`，展开后在聊天消息内呈现完整 Agent OS 过程视图。

核心原则是：`agent-chat` 的聊天线程就是前线作战面，用户需要理解和复盘的 Agent OS 信息必须能直接在聊天内容里看到，不依赖右侧高级面板或 Runtime Drawer。

## 目标

1. 建立每轮 assistant 回复的展示模式：`answer_only` 与 `agent_execution`。
2. 普通问答只显示 DeepSeek / ChatGPT 风格的思考入口，不显示执行步骤。
3. 执行任务只显示一个 Codex 风格的 `处理中 / 已处理` 入口，不与独立 `已思考` 并列。
4. 执行入口展开后在聊天消息内部展示 Agent OS 六段：思考、探索、执行、协作、验证、交付。
5. 完成后默认折叠为 `已处理 6s` / `已处理 9m 35s`，展开后仍能复盘完整过程。
6. 内部节点名、graph id、原始 payload 不作为主文案，只能进入调试详情或隐藏元信息。
7. 让主线程同时具备成熟聊天产品的清爽回答、Codex 的执行可观察性，以及本项目多 Agent 治理的可信过程。

## 非目标

- 不做右侧高级面板或 Runtime Drawer 作为本轮核心体验。
- 不做完整审计后台。
- 不删除现有事件、ThoughtChain、Evidence、Approval、Learning 数据源。
- 不暴露模型原始 `<think>` 或敏感推理内容。
- 不像素级复刻 Codex、DeepSeek、ChatGPT、Gemini、Kimi 任一产品。

## 展示模式

### `answer_only`

适用场景：

- 普通知识问答。
- 技术概念解释。
- 翻译、总结、轻量创作。
- 没有文件读写、命令、工具、审批、子 Agent、验证等真实执行动作的回复。

主线程结构：

```text
已思考（用时 5 秒）  ^
  用户问的是 Docker 容器和镜像的区别，需要简洁解释两者关系。

镜像是模板，容器是镜像运行起来后的实例……
```

规则：

- 可以显示 `思考中 / 已思考`。
- 不显示 `已处理 1 个步骤`。
- 不显示 Agent OS 六段。
- 不显示节点 id、graph id 或内部事件名称。

### `agent_execution`

适用场景：

- 用户要求实现、修复、重构、测试、提交、部署、查文件、改代码。
- 本轮实际发生命令、文件读取、文件编辑、工具调用、浏览器动作、审批、子 Agent、验证。
- Supervisor 或后端明确标记本轮为执行型任务。

主线程结构：

```text
已处理 9m 35s  v

[思考]
我会先确认当前分支和影响范围，再把 UI 收束为聊天内单入口。

[探索]
已查看 3 个文件
- response-step-summary.tsx
- quick-response-steps.tsx
- chat-response-step-projections.ts

[执行]
Ran 2 commands
Edited 4 files

[协作]
生成 1 个子 Agent
- Lorentz：完成 schema 与导出审查。

[验证]
通过：agent-chat response steps tests
阻塞：backend typecheck 有既有红灯

[交付]
完成 UI 收束；剩余风险：需要真实 SSE 场景回归。

最终答案正文……
```

规则：

- 运行中默认展开，让用户知道系统正在做什么。
- 完成后默认折叠，只保留 `已处理 ...` 与最终答案正文。
- `已思考` 合并进 `[思考]` 分组，不再作为并列入口出现。
- 展开内容必须是自然语言和用户可读动作。
- 如果只有 `final_response_completed` 这类低价值步骤，不单独渲染过程卡，最多归入 `[交付]`。
- 失败、阻塞、等待审批必须露出风险摘要，不能被折叠完全隐藏。

## Agent OS 六段

### 思考

展示计划、判断和执行策略摘要。

要求：

- 不展示模型原始 `<think>`。
- 不展示敏感推理、密钥、隐藏系统提示词。
- 以用户可理解的行动计划为主。

### 探索

展示读取和检索上下文的行为。

例子：

- 已查看 N 个文件。
- 已搜索 N 条记录。
- 已读取某份文档或规范。
- 已确认当前分支、diff、接口文档。

### 执行

展示实际改变世界或运行工具的行为。

例子：

- Ran 2 commands。
- Edited 4 files。
- Updated contract schema。
- Called browser action。

命令和文件名可以使用 monospace 或 pill，但主文案仍应是自然语言。

### 协作

展示子 Agent、六部角色或专项 agent 的协作结果。

例子：

- 生成 1 个子 Agent。
- 工部完成实现补丁。
- 刑部完成风险审查。
- 礼部完成文档整理。

子 Agent 返回时优先展示一句结果摘要，不只展示 agent id。

### 验证

展示测试、类型检查、构建、审查和阻断。

例子：

- 通过：`pnpm --dir apps/frontend/agent-chat exec vitest run ...`
- 通过：agent-chat typecheck。
- 阻塞：外部服务不可用。
- 失败：某条测试未通过。

验证状态比普通步骤优先级更高，失败或阻塞必须在折叠摘要中可见。

### 交付

展示最终收束。

例子：

- 最终回复完成。
- 文档已更新。
- 计划已完成。
- 残留风险与后续建议。

低价值的 `final_response_completed`、`summary_completed` 等内部步骤只能被转写成自然语言交付摘要。

## 数据契约

为了避免前端靠节点文案硬猜，后端和稳定 contract 应补齐两层字段。

建议在 `packages/core` 的 chat response step contract 中扩展：

```ts
type ChatTurnDisplayMode = 'answer_only' | 'agent_execution';

type ChatAgentOsGroupKind = 'thinking' | 'exploration' | 'execution' | 'collaboration' | 'verification' | 'delivery';

type ChatAgentOsGroup = {
  kind: ChatAgentOsGroupKind;
  title: string;
  summary?: string;
  steps: ChatResponseStepRecord[];
  status: 'queued' | 'running' | 'completed' | 'blocked' | 'failed' | 'cancelled';
};

type ChatResponseStepSnapshot = {
  displayMode?: ChatTurnDisplayMode;
  agentOsGroups?: ChatAgentOsGroup[];
};
```

兼容策略：

- 新字段先设为可选。
- 后端有能力时优先输出 `displayMode` 与 `agentOsGroups`。
- 前端没有收到新字段时用兜底规则派生。
- 旧 response steps 仍可渲染，但必须经过用户可读文案转换，不能直接露出节点 id。

## 前端渲染规则

新增或收敛组件边界：

- `MessageThinkingPanel`
  - 只负责 `answer_only` 的 `思考中 / 已思考`。
- `AgentOsRunPanel`
  - 负责 `agent_execution` 的 `处理中 / 已处理`。
  - 展开后渲染 Agent OS 六段。
- `AgentOsGroup`
  - 渲染单个分组。
- `AgentOsStepItem`
  - 渲染用户可读步骤。

主消息适配层只做模式选择：

```text
if displayMode === answer_only:
  render MessageThinkingPanel
else if displayMode === agent_execution:
  render AgentOsRunPanel
```

前端兜底判定：

- 有 command / file / edit / tool / approval / subagent / verification 事件：`agent_execution`。
- 只有 `<think>`、`thinkState` 或普通 assistant 文本：`answer_only`。
- session running 但尚未收到任何执行信号时，可临时显示 `思考中`，收到执行信号后切换为 `处理中`。
- completed 且只有最终回复完成步骤时，不展示 `已处理 1 个步骤`。

## 后端映射规则

后端 adapter 应把现有事件归到 Agent OS 分组：

- lifecycle / planning / supervisor plan -> `thinking`
- file read / search / context assembly -> `exploration`
- command / edit / tool call / browser action -> `execution`
- subagent / ministry / worker result -> `collaboration`
- test / typecheck / build / review -> `verification`
- final response / summary / docs / delivery -> `delivery`

文案生成原则：

- 主文案面向用户，不面向 graph 调试。
- `nodeId`、`fromNodeId`、`toNodeId` 只能作为 debug metadata。
- `ownerLabel` 可辅助展示，但不能压过动作本身。
- 六部语义可以出现，但要表达职责结果，例如“礼部整理交付文档”，不要只显示“礼部”标签。

## 错误与阻塞

- `blocked`：等待审批、等待用户输入、权限不足或外部服务阻断。
- `failed`：本轮执行失败或验证失败。
- `cancelled`：用户取消或 runtime cancel。

折叠摘要规则：

- 正常完成：`已处理 6s`。
- 运行中：`处理中 2 个步骤` 或更具体摘要。
- 阻塞：`已阻塞：等待审批`。
- 失败：`验证失败 1 项` 或 `处理失败`。
- 取消：`已取消`。

失败、阻塞、等待审批不能只藏在展开详情里。

## 和竞品的差距与超越方向

当前差距：

- DeepSeek / ChatGPT / Kimi 的普通问答更克制，主线程不暴露内部执行事件。
- Codex 的执行过程在聊天里更自然，用户能直接复盘做过什么。
- Gemini / ChatGPT 的回答结构更稳定，普通概念解释不会被工程状态打断。
- 本项目虽已有多 Agent、审批、Evidence、Learning、Recover 能力，但主线程还没有统一成一个产品语言。

超越方向：

- 普通问答保持成熟聊天产品的干净体验。
- 执行任务直接在聊天内展示 Codex 式可观察过程。
- 展开后不是普通日志，而是 Agent OS 六段：答案、执行、协作、验证、交付都在同一条可审计链路里。
- 不把关键过程藏进右侧面板；聊天线程本身就是一线作战面。

## 测试策略

### 前端

- 普通问答：包含 `<think>` 或 `thinkState` 时显示 `已思考`，不显示 `已处理 1 个步骤`。
- 执行任务：收到 command / file / tool / verification step 后显示 `处理中 / 已处理`。
- 执行任务完成：默认折叠，展开后显示六段 Agent OS。
- 执行任务里的思考：进入 `[思考]` 分组，不再单独显示 `已思考`。
- 低价值步骤：只有 `final_response_completed` 时不渲染裸步骤卡。
- 内部字段：主视觉不包含 `final_response_completed`、`node id`、`fromNodeId`、`toNodeId`。

### Backend / Contract

- schema parse 覆盖 `displayMode` 与 `agentOsGroups`。
- adapter 映射覆盖 lifecycle、file/search、command/edit、subagent、verification、final response。
- SSE snapshot 保持向后兼容。
- failed / blocked / cancelled 摘要可被前端识别。

### 验证命令

实现阶段按受影响范围选择：

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/chat-response-step-contracts.test.ts
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/chat/chat-response-step-projections.spec.ts
pnpm --dir apps/frontend/agent-chat exec vitest run test/components/chat-response-steps.test.tsx
pnpm --dir apps/frontend/agent-chat exec vitest run test/pages/chat/chat-message-adapter.test.tsx
pnpm exec tsc -p apps/frontend/agent-chat/tsconfig.app.json --noEmit
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

## 文档更新范围

实现阶段需要同步更新：

- `docs/apps/frontend/agent-chat/overview.md`
- `docs/apps/frontend/agent-chat/README.md`
- `docs/contracts/api/agent-chat.md`
- `docs/superpowers/specs/2026-05-02-agent-chat-codex-response-steps-design.md` 的状态说明或后续替代说明

如果旧文档仍描述“完成后 response steps 默认展开”或“Think / ThoughtChain 只在高级面板可见”，需要同步改为聊天内 Agent OS 的最新规则，避免知识分叉。

## 完成标准

1. “Docker 容器和镜像区别”这类普通问答只显示 `已思考`，不显示 `已处理 1 个步骤`。
2. “修复 chat 项目步骤展示”这类执行任务显示 `处理中 / 已处理`。
3. 执行任务展开后在聊天内容中看到 Agent OS 六段。
4. 执行任务完成后默认折叠，最终答案仍直接可读。
5. `主 Agent / 礼部 / final_response_completed / node id` 不作为主视觉文案出现。
6. 不依赖右侧高级面板或 Runtime Drawer 才能理解本轮执行过程。
