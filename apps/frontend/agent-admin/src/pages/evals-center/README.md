# Evals Center

`evals-center` 是 agent-admin 的评测中心展示模块，负责把评测聚合结果呈现为治理视角的 benchmark 指标、趋势图和 prompt regression 明细。

## 功能边界

- 展示 benchmark 场景数量、命中运行数、总体通过率和每日趋势。
- 展示 scenario 级别的命中、通过、失败和通过率。
- 展示 recent runs，用于从评测结果回看命中的任务运行。
- 展示 prompt regression 的 suite 覆盖、latest run 状态、provider 覆盖和 prompt 结果。
- 提供 history day、scenario、outcome 等展示筛选入口，并把筛选状态交给上层容器维护。
- 提供导出动作入口，但不在本 feature 内定义导出协议或持久化策略。

## 数据契约

本 feature 消费 `EvalsCenterRecord`，定义位置为 `apps/frontend/agent-admin/src/types/admin/evals.ts`。

关键字段：

- `scenarioCount`、`runCount`、`overallPassRate`：评测中心顶部指标。
- `dailyTrend`、`persistedDailyHistory`、`historyDays`、`historyRange`：趋势图和历史范围。
- `scenarios`、`scenarioTrends`、`recentRuns`：benchmark 明细和最近命中运行。
- `promptRegression`：prompt regression 配置、latest run、suite 覆盖和 prompt 结果。

`evals-center` 不消费 `RunBundleRecord`，也不负责运行链路、checkpoint、trace、interrupt、evidence 或 tool execution 的运行观测展示；这些职责属于 `run-observatory`。

## 当前文件

- `evals-center-panel.tsx`：评测中心主面板，负责顶部指标、趋势图、suite 覆盖图、总体通过率图和筛选动作接线。
- `evals-center-sections.tsx`：prompt regression 与 benchmark 明细分区。
