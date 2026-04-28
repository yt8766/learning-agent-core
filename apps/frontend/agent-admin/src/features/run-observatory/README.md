# Run Observatory

`run-observatory` 是 agent-admin 的运行观测展示模块，负责呈现单次 agent run 的执行链路、工具执行投影、checkpoint 诊断、interrupt、evidence 和轻量 baseline compare。

## 功能边界

- 展示单次 run 的状态、目标、耗时、当前阶段、当前治理部类和 worker。
- 展示 timeline、trace spans、checkpoints、interrupt ledger、evidence 和 diagnostics。
- 支持 graph filter 与 focus target，用于从运行图、checkpoint、span、evidence 等入口跳转到对应观测片段。
- 展示 agent tool execution projection，并支持 blocked、resumed、terminal、high risk 等筛选。
- 支持基于当前 detail 与 baseline detail 的前端轻量 compare。
- 仅消费后端已经投影好的 observability payload，不在前端重建诊断口径或 raw task dump。

## 数据契约

本 feature 主要消费 `RunBundleRecord`，定义位置为 `packages/core/src/tasking/types/run-observability.ts`，schema 来源为 `packages/core/src/tasking/schemas/run-observability.ts`。

关键字段：

- `run`：run summary，包括状态、目标、耗时、当前阶段、治理部类和 worker。
- `timeline`：canonical stage 维度的执行时间线。
- `traces`：span 级执行链路。
- `checkpoints`：checkpoint 摘要与可恢复性诊断。
- `interrupts`：审批、中断、恢复等 ledger。
- `diagnostics`：后端投影出的诊断信息。
- `evidence`：与 checkpoint/span 关联的证据。
- `artifacts`、`review`、`learning`：运行产物、审查摘要和学习摘要的可选展示数据。

本 feature 还可接收来自 runtime overview 的 `AgentToolExecutionProjectionInput`，用于构建工具执行观测列表；该投影只用于运行观测展示，不改变 `RunBundleRecord` 的稳定契约。

`run-observatory` 不负责 benchmark 指标、prompt regression suite、scenario 趋势或 eval recent runs；这些职责属于 `evals-center`。

## 当前文件

- `run-observatory-panel.tsx`：运行观测主面板，负责 detail 状态分支、focus 滚动、工具执行观测和各卡片接线。
- `run-observatory-panel-cards.tsx`：timeline、trace、checkpoint、interrupt、evidence、diagnostics 等展示卡片。
- `run-observatory-panel-support.ts`：focus target、DOM id 和 focus detail 构建。
- `run-observatory-agent-tools.ts`：agent tool execution projection 的筛选与摘要构建。
- `run-observatory-focus-card.tsx`：当前 focus target 的详情卡片。
- `run-observatory-compare-card.tsx`：baseline compare 展示卡片。
- `run-observatory-compare-support.ts`：summary/detail compare 与 graph filter 投影 helper。
