# Run Observatory API

状态：current
文档类型：integration
适用范围：`apps/backend/agent-server`、`apps/frontend/agent-admin`
最后核对：2026-04-19

本主题主文档：

- 总体前后端关系仍以 [frontend-backend-integration.md](/docs/integration/frontend-backend-integration.md) 为准

本文只覆盖：

- `GET /platform/workflow-presets` 的 workflow catalog 接口
- `GET /platform/run-observatory` 的 list 接口
- `GET /platform/run-observatory/:taskId` 的 detail 接口
- 第一阶段 `RunBundleRecord` 与 `RunSummaryRecord` 的主要结构
- canonical stage 在 observability detail 中的使用方式

本文说明当前 `Execution Observatory` 的 list + detail 接口，以及 detail 中的关联追踪语义。

## 1. 目标

该接口不是原始 event dump，而是面向 `agent-admin` 的单次运行观测投影。当前阶段重点解决：

- 让运营台可以先看见当前支持的流程，并从后台直接发起一次运行
- 单次 run 的阶段时间线
- trace waterfall
- checkpoint recoverability
- diagnostics
- interrupt / evidence 到 checkpoint/span 的关联线索

## 2. 接口

- `GET /platform/workflow-presets`
  - 返回 `WorkflowPresetDefinition[]`
  - 用于 `agent-admin` Runtime Summary 的 `Workflow Catalog`
  - 当前字段重点包括：
    - `id`
    - `displayName`
    - `command`
    - `approvalPolicy`
    - `requiredMinistries`
    - `outputContract`
- `GET /platform/run-observatory`
  - 返回 run observability summary 列表
  - 当前支持按：
    - `status`
    - `model`
    - `pricingSource`
    - `executionMode`
    - `interactionKind`
    - `q`
    - `hasInterrupt`
    - `hasFallback`
    - `hasRecoverableCheckpoint`
      过滤
  - `agent-admin` Runtime Queue 默认直接依赖这些服务端筛选；只有在 observability list 请求失败时才回退到本地 runtime task 兜底
- `GET /platform/run-observatory/:taskId`
  - 返回单次 run 的 observability detail
  - 当前后端会从：
    - task
    - latest checkpoint
    - trace
    - interrupt history
    - external sources
    - learning / governance projection
      聚合出一个统一的 `RunBundle`

当前 workflow launch 仍复用既有任务创建链路，而不是新增专用执行接口：

- 前端先请求 `GET /platform/workflow-presets`
- 用户选择 preset 后，将 `preset.command` 与输入目标拼成最终 `goal`
- 再调用既有 `POST /tasks`
- run 创建后，继续通过 observability list/detail 接口查看执行过程

## 3. 返回结构

列表接口当前返回 `RunSummaryRecord[]`。

第一阶段返回的主对象为 `RunBundleRecord`，重点字段：

- `run`
  - 单次运行摘要
- `timeline`
  - canonical stage timeline
- `traces`
  - span 级 trace
- `checkpoints`
  - checkpoint 摘要与 recoverability
- `interrupts`
  - interrupt / approval ledger
- `diagnostics`
  - fallback、approval blocked、recoverable failure、evidence insufficiency 等诊断
- detail 中新增的轻量关联字段：
  - `interrupts[].relatedCheckpointId`
  - `interrupts[].relatedSpanId`
  - `diagnostics[].linkedCheckpointId`
  - `diagnostics[].linkedSpanId`
  - `evidence[].linkedCheckpointId`
  - `evidence[].linkedSpanId`

## 4. 阶段语义

当前 observability 层统一使用这组 canonical stage：

- `plan`
- `route`
- `research`
- `execution`
- `review`
- `delivery`
- `interrupt`
- `recover`
- `learning`

前后端展示层应优先消费这组 stage，而不是直接依赖内部 node 名称。

## 5. 视角分享

`agent-admin` 当前会把以下 runtime observability 视角参数写入 dashboard hash/share url：

- `runtimeTaskId`
- `runtimeStatus`
- `runtimeModel`
- `runtimePricingSource`
- `runtimeExecutionMode`
- `runtimeInteractionKind`
- `runtimeFocusKind`
- `runtimeFocusId`
- `runtimeCompareTaskId`
- `runtimeGraphNodeId`

因此分享链接可以复现 Runtime Queue 的主要筛选视角，并在存在 `runtimeTaskId` 时直接打开同一个 selected run detail。若当前 detail 已聚焦到某个 `checkpoint`、`span` 或 `evidence`、当前已选择某个 compare baseline，或当前已启用某个 graph node 的节点级过滤，前端会把这些 observability 视角序列化进 hash，并在打开链接后自动恢复相同 drilldown / compare / node filter 位置。

当前 `agent-admin` 对 detail payload 的消费还包含一层前端内 drilldown：

- `linkedCheckpointId / linkedSpanId / relatedCheckpointId / relatedSpanId`
  - 会被渲染成可点击 badge
  - 点击后自动滚到并高亮当前面板内对应的 checkpoint / span / evidence 卡片
- 当 hash 中存在 `runtimeFocusKind / runtimeFocusId` 时，前端会基于当前 `RunBundleRecord` 生成 `Focused Context` 摘要卡片，展示该 focus target 的上下文和相关跳转入口
- 当前 focus target 会继续回写到 dashboard hash，便于 refresh / share 后恢复相同卡片焦点
- 当前 `Selected Run` 还会用 `GET /platform/run-observatory` 返回的 list summary 构建 lightweight baseline compare，不额外引入新的 compare API
- 当前 compare baseline 同样会回写到 dashboard hash，便于 refresh / share 后恢复相同对比对象
- 当前 graph node 过滤同样会回写到 dashboard hash，并在 detail 到位后重新构造成 `AgentGraphOverlayFilter`
- 当 baseline 已选定时，前端还会继续请求 baseline 的 detail payload，用于补 `timeline / traces / checkpoints / interrupts / evidence / diagnostics` 的结构级 diff
- 前端当前还会把新增/移除的具体 `trace / checkpoint / diagnostic / evidence / interrupt` 条目渲染出来，形成对象级增减清单

## 6. 当前限制

- 当前已提供基础 list + detail，并补了 `summary + detail-structure + itemized add/remove + same-id field diff` 级别的 compare；但仍没有独立 compare contract
- 当前 workflow catalog 解决的是“看见可执行流程并能启动”，还没有提供 graph 可视化编排器，也没有专门的“给一个输入直接逐节点单步执行”调试入口
- checkpoint 当前优先展示 latest checkpoint 摘要，不展开完整 state dump
- diagnostics 当前以后端 projection 为准，前端不应自行推导第二套口径

## 7. 继续阅读

- [Runtime Centers API](/docs/integration/runtime-centers-api.md)
- [前后端对接文档](/docs/integration/frontend-backend-integration.md)
