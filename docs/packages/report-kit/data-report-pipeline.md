# Data Report Pipeline

状态：current
文档类型：reference
适用范围：`packages/report-kit`、`agents/data-report`、`packages/runtime`
最后核对：2026-04-27

## 1. 这篇文档说明什么

本文档说明 data-report 相关能力在 `report-kit`、`agents/data-report` 与 `packages/runtime` 之间的边界，避免后续再次把报表生成逻辑写回 app service。

## 2. `report-kit` 当前职责

`packages/report-kit` 当前只承载确定性报表资产与生成能力：

- blueprint
- scaffold
- routes
- assembly
- write
- report file materialization

这是 data-report 生成链路里的“确定性层”。

## 3. `agents/data-report` / `packages/runtime` 当前职责

`agents/data-report` 与 `packages/runtime` 在 data-report 相关链路中负责：

- preview flow
- graph / runtime facade
- LLM 节点编排
- preview/runtime 协调

这是 data-report 生成链路里的“编排层”。

## 4. app 层禁止做什么

`apps/backend/*/service` 不应直接：

- 拼 `report-kit` 内部流程
- 直接 `compile().invoke()` graph
- 在 service 内重建 preview / sandpack / report-schema 子流程

正确边界是：

- `report-kit`
  - 确定性生成资产
- `agents/data-report` / `packages/runtime`
  - graph 编排与 facade
- `apps/backend/*`
  - HTTP / SSE / 鉴权 / 运行时装配

## 5. 继续阅读

- [report-kit 文档目录](/docs/packages/report-kit/README.md)
- [data-report JSON bundle 规范](/docs/packages/report-kit/data-report-json-bundle.md)
