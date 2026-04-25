# Approvals API

状态：current
文档类型：reference
适用范围：`apps/backend/agent-server`、`apps/frontend/agent-chat`、`apps/frontend/agent-admin`
最后核对：2026-04-25

本文记录 Approvals Center、聊天审批动作与恢复契约。运行时 interrupt 细节见 [Runtime Interrupts](/docs/runtime/runtime-interrupts.md)。

## Approvals Center

| 方法  | 路径                                | 用途                       | 关键契约                                     |
| ----- | ----------------------------------- | -------------------------- | -------------------------------------------- |
| `GET` | `/platform/approvals-center`        | 获取 Approvals Center 数据 | 支持 `executionMode`、`interactionKind` 筛选 |
| `GET` | `/platform/approvals-center/export` | 导出 Approvals Center CSV  | 沿用同一组筛选参数                           |

CSV 导出必须包含：

- `filterExecutionMode`
- `filterInteractionKind`
- 每条审批项的 `executionMode`
- 每条审批项的 `interactionKind`

## Chat 审批动作

| 方法   | 路径                         | 用途                         |
| ------ | ---------------------------- | ---------------------------- |
| `POST` | `/api/chat/approve`          | 审批通过或恢复中断           |
| `POST` | `/api/chat/reject`           | 审批拒绝、取消中断或打回恢复 |
| `POST` | `/api/chat/recover`          | 从 checkpoint 恢复           |
| `POST` | `/api/chat/learning/confirm` | 确认学习候选                 |

## 事件语义

新链路优先使用：

- `interrupt_pending`
- `interrupt_resumed`
- `interrupt_rejected_with_feedback`

兼容事件仅用于历史会话和旧链路：

- `approval_required`
- `approval_resolved`
- `approval_rejected_with_feedback`

## 恢复与终态

- 前端必须以结构化 interrupt / checkpoint 状态收口，不在 chat 和 admin 中各自维护一套审批解释。
- 审批动作后如果 SSE 终态遗漏，前端必须通过 `checkpoint` 做终态校准，再按需补拉 `messages / events`。
- 关键运行态字段包括 `activeInterrupt`、`interruptHistory`、`pendingApproval`、`pendingApprovals`、`approvalCursor`。
- `waiting_approval`、`completed`、`failed`、`cancelled` 是当前前端需要识别的关键会话状态。
