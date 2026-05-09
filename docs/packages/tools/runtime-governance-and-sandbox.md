# Runtime Governance And Sandbox

状态：current
文档类型：reference
适用范围：`packages/tools`、`apps/backend/agent-server/src/runtime`
最后核对：2026-05-09

## 1. 这篇文档说明什么

本文档说明 `@agent/tools` 当前在运行时治理里的职责边界，以及 approval preflight / registry / MCP / executor repository 之间如何分工。

## 2. 当前职责

`packages/tools` 当前主要承载：

- tool registry
- tool definition
- approval preflight
- filesystem / scheduling 基础能力
- MCP transport
- runtime governance 相关基础设施

当前目录大致对应：

- `src/registry`
  - tool registry 与统一导出
- `src/sandbox`
  - 仅保留 tools 侧 workspace path helper 导出；sandbox executor/provider 的真实宿主是 `@agent/runtime`
- `src/approval`
  - 审批前置检查
- `src/mcp`
  - MCP transport
- `src/runtime-governance`
  - 运行时治理 repository / facade 基础能力
- `src/filesystem`、`src/scheduling`
  - 垂直执行基础能力

对外导出约束：

- `@agent/tools` 根入口继续作为唯一稳定消费入口
- 根入口应显式列出稳定命名导出，避免用整包 `export *` 把内部目录递归暴露
- `src/approval`、`src/mcp`、`src/registry` 等目录保留为包内组织层，不作为新增消费方的默认导入入口
- `ExecutionWatchdog`、sandbox executor/provider、tools center projection 与 connector governance snapshot mutation 的真实宿主都是 `@agent/runtime`；`@agent/tools` 根入口不再转发这些 runtime-owned 能力
- `@agent/tools` 禁止依赖或导入 `@agent/runtime`；共享 tool contract 必须来自 `@agent/core`

## 3. Runtime Root Storage 边界

`connectors`、`scheduling` 与 `runtime-governance` executor 不再直接写入 workspace 根目录下的
`data/runtime/*`：

- `schedule_task`、`list_scheduled_tasks`、`cancel_scheduled_task` 通过 `ScheduleRepository` 读写 schedule record；调用方需要持久化时必须显式注入 repository。
- `archive_thread`、`schedule_cancel`、`recover_run` 与 `list_runtime_artifacts` 通过 `RuntimeGovernanceRepository` 读写 archives、recoveries、cancellations 与 schedules 汇总；浏览器 replay 从 `artifacts/runtime/browser-replays` 读取。
- connector draft executor 通过显式 `ConnectorDraftStorage` 读写草稿；调用方需要文件、数据库或远端配置存储时必须在边界层注入 storage。
- executor 未收到注入时只使用包内内存默认实现，不能创建 `data/runtime/schedules`、`data/runtime/archives`、`data/runtime/recoveries`、`data/runtime/cancellations` 或 `data/runtime/connectors`。

## 4. 不属于这里的内容

以下内容不应继续塞回 `packages/tools`：

- agent orchestration
- graph / ministry 主逻辑
- chat / review / research prompt
- 长链路 workflow 编排

这些应继续留在 `packages/runtime` 与对应 `agents/*` 宿主。

## 5. 与审批和中断的关系

- 高风险动作应优先走 approval preflight
- 真正的中断语义由 runtime / interrupt 协议统一解释
- `packages/tools` 提供的是“是否需要审批、如何执行、如何约束”的基础设施，不是最终恢复编排层

## 6. 与 report-kit 的边界

- `packages/report-kit`
  - 承载 data-report 的 blueprint、scaffold、assembly、write
- `packages/tools`
  - 负责把相关能力作为工具平台的一部分聚合暴露

后端 app 层不应绕过这些边界直接拼底层实现。

## 7. 继续阅读

- [tools 文档目录](/docs/packages/tools/README.md)
- [Runtime Interrupts](/docs/packages/runtime/runtime-interrupts.md)
- [Packages 分层与依赖约定](/docs/conventions/package-architecture-guidelines.md)
