# Run Observatory API

状态：current
文档类型：reference
适用范围：`apps/backend/agent-server`、`apps/frontend/agent-admin`
最后核对：2026-04-25

本文记录 Runtime Observatory 的 workflow catalog、run list 和 run detail 契约。

## 接口

| 方法  | 路径                                | 用途                  | 关键契约                                   |
| ----- | ----------------------------------- | --------------------- | ------------------------------------------ |
| `GET` | `/platform/workflow-presets`        | 获取 workflow catalog | 返回 `WorkflowPresetDefinition[]`          |
| `GET` | `/platform/run-observatory`         | 获取 run summary 列表 | 返回 `RunSummaryRecord[]`                  |
| `GET` | `/platform/run-observatory/:taskId` | 获取单次 run 详情     | 返回 `RunBundleRecord`，不是 raw task dump |

## Workflow Preset

`WorkflowPresetDefinition` 的跨端关键字段：

- `id`
- `displayName`
- `command`
- `approvalPolicy`
- `requiredMinistries`
- `outputContract`

workflow launch 复用既有任务创建链路：前端读取 preset 后组装 `goal`，再调用任务创建接口。

## Run List

支持过滤：

- `status`
- `model`
- `pricingSource`
- `executionMode`
- `interactionKind`
- `q`
- `hasInterrupt`
- `hasFallback`
- `hasRecoverableCheckpoint`

`agent-admin` Runtime Queue 默认依赖服务端筛选；只有 list 请求失败时才允许使用本地 runtime task 兜底。

## Run Detail

`RunBundleRecord` 重点字段：

- `run`
- `timeline`
- `traces`
- `checkpoints`
- `interrupts`
- `diagnostics`
- `evidence`

轻量关联字段：

- `interrupts[].relatedCheckpointId`
- `interrupts[].relatedSpanId`
- `diagnostics[].linkedCheckpointId`
- `diagnostics[].linkedSpanId`
- `evidence[].linkedCheckpointId`
- `evidence[].linkedSpanId`

## Canonical Stage

observability detail 使用这组 canonical stage：

- `plan`
- `route`
- `research`
- `execution`
- `review`
- `delivery`
- `interrupt`
- `recover`
- `learning`

前端展示层应消费 canonical stage，不直接依赖内部 node 名称。

## 约束

- diagnostics 以后端 projection 为准，前端不维护第二套诊断口径。
- detail payload 支持前端 drilldown 和 share hash 恢复，但 drilldown/hash 不是新的后端 API。
- 当前没有独立 compare API；前端可用 list summary 与 detail payload 构建轻量 baseline compare。
