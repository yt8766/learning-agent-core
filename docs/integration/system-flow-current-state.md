# System Flow Current State

状态：current
适用范围：`apps/backend/agent-server`、`packages/agent-core`、`apps/frontend/*`
最后核对：2026-04-14

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

- [前后端对接文档](/Users/dev/Desktop/learning-agent-core/docs/integration/frontend-backend-integration.md)
- [Chat Session And SSE](/Users/dev/Desktop/learning-agent-core/docs/integration/chat-session-sse.md)
- [Runtime Interrupts](/Users/dev/Desktop/learning-agent-core/docs/runtime-interrupts.md)
- [Runtime State Machine](/Users/dev/Desktop/learning-agent-core/docs/runtime-state-machine.md)
