# Approval Recovery

状态：current
文档类型：integration
适用范围：`apps/backend/agent-server`、`apps/frontend/agent-chat`、`apps/frontend/agent-admin`
最后核对：2026-04-15

本主题主文档：

- 总体对接关系仍以 [frontend-backend-integration.md](/docs/integration/frontend-backend-integration.md) 为准

本文只覆盖：

- 审批、拒绝、恢复相关接口
- checkpoint / interrupt 的恢复语义
- 前端恢复与终态校准要求

## 1. 这篇文档说明什么

本文档说明当前 chat 侧审批、拒绝和恢复相关接口，以及它们和 checkpoint / interrupt 的关系。

## 2. 会话动作接口

- `POST /api/chat/approve`
  - 审批通过或恢复中断
- `POST /api/chat/reject`
  - 审批拒绝、取消中断或打回恢复
- `POST /api/chat/recover`
  - 从 checkpoint 恢复
- `POST /api/chat/learning/confirm`
  - 确认学习候选

## 3. 当前恢复语义

当前仓库仍以 `approval-recovery` 为主恢复链，但新的运行时语义应优先围绕：

- `interrupt_pending`
- `interrupt_resumed`
- `interrupt_rejected_with_feedback`

兼容层仍可能出现：

- `approval_required`
- `approval_resolved`
- `approval_rejected_with_feedback`

## 4. 前端恢复要求

- 前端必须优先以结构化 interrupt / checkpoint 状态收口
- 审批后如果流式终态遗漏，仍应通过 `checkpoint` + `messages / events` 做一次终态校准
- `agent-chat` 与 `agent-admin` 不应各自维护不同的审批状态解释

## 5. 相关状态

当前运行态里的关键状态包括：

- `waiting_approval`
- `completed`
- `failed`
- `cancelled`

恢复链路相关持久化语义还包括：

- `activeInterrupt`
- `interruptHistory`
- `pendingApproval` 兼容投影

## 6. 继续阅读

- [Runtime Interrupts](/docs/runtime-interrupts.md)
- [Runtime State Machine](/docs/runtime-state-machine.md)
- [前后端对接文档](/docs/integration/frontend-backend-integration.md)
