# Runtime Centers API

状态：current
文档类型：integration
适用范围：`apps/backend/agent-server`、`apps/frontend/agent-admin`
最后核对：2026-04-15

本主题主文档：

- 总体对接关系仍以 [frontend-backend-integration.md](/docs/integration/frontend-backend-integration.md) 为准

本文只覆盖：

- `agent-admin` 依赖的 runtime center / approvals / platform console 接口
- admin 侧筛选字段与兼容别名语义

## 1. 这篇文档说明什么

本文档说明 `agent-admin` 当前依赖的 Runtime Center / Approvals Center / Platform Console 相关接口和筛选语义。

## 2. Platform Console

- `GET /platform/console?days=30&status=&model=&pricingSource=&runtimeExecutionMode=&runtimeInteractionKind=&approvalsExecutionMode=&approvalsInteractionKind=`
  - 获取整包 Platform Console 数据
  - 当前只会对 `runtime` 与 `approvals` 两块做过滤裁剪
  - 其他 center 仍保持全量返回

## 3. Runtime Center

- `GET /platform/runtime-center?days=30&status=&model=&pricingSource=&executionMode=&interactionKind=`
  - 获取 Runtime Center 数据

`executionMode` 的 canonical 写出始终对应 `executionPlan.mode`：

- `plan`
- `execute`
- `imperial_direct`

兼容读取旧别名：

- `standard -> execute`
- `planning-readonly -> plan`

`interactionKind` 当前支持：

- `approval`
- `plan-question`
- `supplemental-input`

导出接口：

- `GET /platform/runtime-center/export?...`
  - 沿用同一组 runtime 过滤参数
  - CSV 当前额外包含：
    - `filterExecutionMode`
    - `filterInteractionKind`
    - 每条 run 的 `executionMode`
    - 每条 run 的 `interactionKind`

## 4. Approvals Center

- `GET /platform/approvals-center?executionMode=&interactionKind=`
  - 获取 Approvals Center 数据
- `GET /platform/approvals-center/export?...`
  - 导出 Approvals Center

当前支持：

- `executionMode`
- `interactionKind`

CSV 当前额外包含：

- `filterExecutionMode`
- `filterInteractionKind`
- 每条审批项的 `executionMode`
- 每条审批项的 `interactionKind`

## 5. 当前约束

- 新任务、新导出、新分享链接只应写出 canonical `executionMode`
- 前后端筛选参数必须保持同一套语义，不要在 admin 侧再造别名

## 6. 继续阅读

- [前后端对接文档](/docs/integration/frontend-backend-integration.md)
- [backend 文档目录](/docs/backend/README.md)
