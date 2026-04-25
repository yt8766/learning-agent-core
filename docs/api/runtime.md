# Runtime API

状态：current
文档类型：reference
适用范围：`apps/backend/agent-server`、`apps/frontend/agent-admin`
最后核对：2026-04-25

本文记录 Runtime Center 查询、导出与筛选契约。

## Runtime Center

| 方法  | 路径                              | 用途                     | 关键契约                                                              |
| ----- | --------------------------------- | ------------------------ | --------------------------------------------------------------------- |
| `GET` | `/platform/runtime-center`        | 获取 Runtime Center 数据 | 返回 Runtime Center projection；backend 只做 HTTP 适配和 context 注入 |
| `GET` | `/platform/runtime-center/export` | 导出 Runtime Center CSV  | 沿用同一组筛选参数                                                    |

查询参数：

- `days`
- `status`
- `model`
- `pricingSource`
- `executionMode`
- `interactionKind`

## Execution Mode

canonical 写出值：

- `plan`
- `execute`
- `imperial_direct`

兼容读取别名：

- `standard -> execute`
- `planning-readonly -> plan`

新任务、新导出、新分享链接只应写出 canonical 值。

## Interaction Kind

当前支持：

- `approval`
- `plan-question`
- `supplemental-input`

## CSV 导出

导出结果必须额外包含：

- `filterExecutionMode`
- `filterInteractionKind`
- 每条 run 的 `executionMode`
- 每条 run 的 `interactionKind`

## 生产与消费边界

- Runtime Center 返回体由 `@agent/runtime` projection 组装。
- Backend 不在 controller/service 中重建 runtime projection。
- Frontend 不自行维护 execution mode legacy alias 映射；以后端返回和本文 canonical 规则为准。
