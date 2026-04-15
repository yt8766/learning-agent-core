# Runtime Governance And Sandbox

状态：current
适用范围：`packages/tools`、`apps/backend/agent-server/src/runtime`
最后核对：2026-04-14

## 1. 这篇文档说明什么

本文档说明 `@agent/tools` 当前在运行时治理里的职责边界，以及 sandbox / approval / registry / MCP 之间如何分工。

## 2. 当前职责

`packages/tools` 当前主要承载：

- tool registry
- tool definition
- sandbox executor
- approval preflight
- filesystem / scheduling / watchdog 基础能力
- MCP transport
- runtime governance 相关基础设施

当前目录大致对应：

- `src/registry`
  - tool registry 与统一导出
- `src/sandbox`
  - sandbox executor
- `src/approval`
  - 审批前置检查
- `src/mcp`
  - MCP transport
- `src/runtime-governance`
  - 运行时治理基础能力
- `src/filesystem`、`src/scheduling`、`src/watchdog`
  - 垂直执行基础能力

## 3. 不属于这里的内容

以下内容不应继续塞回 `packages/tools`：

- agent orchestration
- graph / ministry 主逻辑
- chat / review / research prompt
- 长链路 workflow 编排

这些应继续留在 `packages/agent-core`。

## 4. 与审批和中断的关系

- 高风险动作应优先走 approval preflight
- 真正的中断语义由 runtime / interrupt 协议统一解释
- `packages/tools` 提供的是“是否需要审批、如何执行、如何约束”的基础设施，不是最终恢复编排层

## 5. 与 report-kit 的边界

- `packages/report-kit`
  - 承载 data-report 的 blueprint、scaffold、assembly、write
- `packages/tools`
  - 负责把相关能力作为工具平台的一部分聚合暴露

后端 app 层不应绕过这些边界直接拼底层实现。

## 6. 继续阅读

- [tools 文档目录](/Users/dev/Desktop/learning-agent-core/docs/tools/README.md)
- [Runtime Interrupts](/Users/dev/Desktop/learning-agent-core/docs/runtime-interrupts.md)
- [Packages 分层与依赖约定](/Users/dev/Desktop/learning-agent-core/docs/package-architecture-guidelines.md)
