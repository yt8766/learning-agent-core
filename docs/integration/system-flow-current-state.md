# System Flow Current State

状态：current
文档类型：integration
适用范围：`apps/backend/agent-server`、`packages/runtime`、`agents/*`、`apps/frontend/*`
最后核对：2026-04-15

本主题主文档：

- 总体对接关系仍以 [frontend-backend-integration.md](/docs/integration/frontend-backend-integration.md) 为准

本文只覆盖：

- 当前系统的真实运行闭环
- 任务接入、执行、审批、学习的阶段划分
- runtime / agents / frontend 在主链上的协同语义

## 1. 这篇文档说明什么

本文档描述当前系统在“任务接入、执行、审查、审批、学习沉淀”上的真实主链，重点面向前后端联调和运行态理解。

## 2. 当前运行闭环

当前和后续都应优先维持这个闭环：

1. 接收任务
2. 规划与路由
3. 检索与补充上下文
4. 执行
5. 审查
6. 审批或恢复
7. 汇总答复
8. 学习沉淀
9. 后续复用

对于高风险动作，流程必须经过审批门，不能默认跳过。

## 3. 当前聊天入口路由

`agent-chat` 不再把所有文本消息一律送进完整多 Agent 工作流。

当前默认采用“first-match”入口分流：

1. 显式 workflow 命令或非通用 preset：进入多 Agent 工作流
2. 修改类请求：进入多 Agent 工作流
3. Figma / 设计稿类请求：进入多 Agent 工作流
4. 普通文本 prompt：优先走 direct-reply 流式聊天

当前显式 workflow 命令包含固定入口，例如：

- `/review`
- `/data-report`
- `/scaffold`

其中 `/scaffold` 当前规则固定为：

- 只在显式命令下命中，不做自由文本自动推断
- `list-templates` / `preview` 直接走只读 scaffold 能力
- `write` 先做目标目录预检，再决定是否进入审批与落盘
- 不接入当前“缺能力补 skill / 远程 skill 安装”的自动干预链路

## 4. Learning / Context / Cache

学习系统默认策略：

- 受控来源优先
- 高置信自动沉淀

当前上下文切片至少包含：

- conversation summary
- recent turns
- top-K reused memory / rule / skill
- top-K evidence
- 上一轮 learning evaluation 摘要

当前检索层默认继续围绕：

- `MemorySearchService`
- `VectorIndexRepository`
- `LocalVectorIndexRepository`

运行时默认继续收敛到：

- `BudgetGuard`
- `Semantic Cache`

## 5. Think / ThoughtChain / Evidence

这三者是 `agent-chat` 的核心能力，不是装饰层。

- `Think`
  - 表达当前谁在思考、为什么这样做、下一步是什么
- `ThoughtChain`
  - 表达已走过哪些节点、各节点的角色化解释、当前停在什么地方
- `Evidence`
  - 表达本轮引用了哪些外部来源或系统证据，它们是否可信

关键阶段至少要以 `trace / event / checkpoint summary` 之一落盘并可回放，默认覆盖：

- `plan`
- `route`
- `research`
- `execution`
- `review`
- `delivery`
- `interrupt`
- `recover`
- `learning`

## 6. 审批与中断

高风险动作必须经过 HITL。

支持的决策语义：

- Approve
- Reject
- Reject with feedback

支持的运行语义：

- cancel
- recover
- observe

后续所有“等待人类确认后才能继续”的新流程，默认应优先采用可恢复 interrupt，而不是仅依赖 `pendingApproval` 状态模拟。

## 7. MCP / 工具 / 子图

长期方向：

- 真实 MCP transport 成为主路径
- 不再继续扩展本地硬编码工具分叉
- capability 必须带完整治理信息

当前主图虽然仍未完全拆开，但已建立正式 subgraph descriptor registry，至少包含：

- `research`
- `execution`
- `review`
- `skill-install`
- `background-runner`

当前运行时还应把实际命中的子图持久化到：

- `TaskRecord.subgraphTrail`
- `ChatCheckpointRecord.subgraphTrail`

## 8. 继续阅读

- [API 文档目录](/docs/api/README.md)
- [前后端集成链路](/docs/integration/frontend-backend-integration.md)
- [Agent Chat API](/docs/api/agent-chat.md)
- [Runtime Interrupts](/docs/runtime/runtime-interrupts.md)
- [Runtime State Machine](/docs/runtime/runtime-state-machine.md)
