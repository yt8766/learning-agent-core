# Approvals API

状态：current
文档类型：reference
适用范围：`apps/backend/agent-server`、`apps/frontend/agent-chat`、`apps/frontend/agent-admin`
最后核对：2026-04-25

本文记录 Approvals Center、聊天审批动作与恢复契约。运行时 interrupt 细节见 [Runtime Interrupts](/docs/runtime/runtime-interrupts.md)。

## Approvals Center

| 方法   | 地址                                               | 参数                                                                                    | 返回值                                                    | 说明                            |
| ------ | -------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------- |
| `GET`  | `/api/platform/approvals-center`                   | query: `executionMode?: string`、`interactionKind?: string`                             | `PlatformConsoleRecord["approvals"]`                      | 获取 Approvals Center 数据。    |
| `GET`  | `/api/platform/approvals-center/export`            | query: `executionMode?: string`、`interactionKind?: string`、`format?: "csv" \| "json"` | `{ filename: string; mimeType: string; content: string }` | 导出 Approvals Center。         |
| `GET`  | `/api/platform/approval-policies`                  | 无                                                                                      | `ApprovalScopePolicyRecord[]`                             | 获取已保存的审批 scope policy。 |
| `POST` | `/api/platform/approval-policies/:policyId/revoke` | path: `policyId`                                                                        | `ApprovalScopePolicyRecord` 或更新后的 policy 列表投影    | 撤销指定审批 scope policy。     |

参数说明：

| 参数              | 类型              | 默认值 | 说明                                                                                  |
| ----------------- | ----------------- | ------ | ------------------------------------------------------------------------------------- |
| `executionMode`   | `string`          | 无     | 支持 `plan`、`execute`、`imperial_direct`；兼容读取 `standard`、`planning-readonly`。 |
| `interactionKind` | `string`          | 无     | 支持 `approval`、`plan-question`、`supplemental-input`。                              |
| `format`          | `"csv" \| "json"` | 无     | 仅导出接口支持。                                                                      |

返回值 `PlatformConsoleRecord["approvals"]` 至少应包含审批 summary、审批项列表和 policy 相关投影；具体字段以 core/platform-console schema 为准。

CSV 导出必须包含：

- `filterExecutionMode`
- `filterInteractionKind`
- 每条审批项的 `executionMode`
- 每条审批项的 `interactionKind`

## Chat 审批动作

| 方法   | 地址                              | 参数                                                                                                                                                                                 | 返回值              | 说明                           |
| ------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- | ------------------------------ |
| `POST` | `/api/chat/approve`               | body: `{ sessionId: string; intent?: string; reason?: string; actor?: string; feedback?: string; approvalScope?: "once" \| "session" \| "always"; interrupt?: ApprovalResumeInput }` | `ChatSessionRecord` | 审批通过或恢复中断。           |
| `POST` | `/api/chat/reject`                | body: `{ sessionId: string; intent?: string; reason?: string; actor?: string; feedback?: string; interrupt?: ApprovalResumeInput }`                                                  | `ChatSessionRecord` | 审批拒绝、取消中断或打回恢复。 |
| `POST` | `/api/chat/recover`               | body: `{ sessionId: string }`                                                                                                                                                        | `ChatSessionRecord` | 从当前 checkpoint 恢复。       |
| `POST` | `/api/chat/recover-to-checkpoint` | body: `{ sessionId: string; checkpointCursor?: number; checkpointId?: string; reason?: string }`                                                                                     | `ChatSessionRecord` | 恢复到指定 checkpoint。        |
| `POST` | `/api/chat/cancel`                | body: `{ sessionId: string; actor?: string; reason?: string }`                                                                                                                       | `ChatSessionRecord` | 取消当前运行。                 |
| `POST` | `/api/chat/learning/confirm`      | body: `{ sessionId: string; candidateIds?: string[]; actor?: string }`                                                                                                               | `ChatSessionRecord` | 确认学习候选。                 |

`ApprovalResumeInput` 的关键字段为 `{ interruptId?: string; action: "approve" | "reject" | "feedback" | "input" | "bypass" | "abort"; feedback?: string; value?: string; payload?: Record<string, unknown> }`。

字段语义：

| 字段          | 类型                      | 说明                                                                  |
| ------------- | ------------------------- | --------------------------------------------------------------------- |
| `interruptId` | `string`                  | 指定要恢复的 interrupt；缺省时由当前会话活动 interrupt 推断。         |
| `action`      | union                     | 恢复动作；`feedback` 用于带反馈打回，`input` 用于补充用户输入。       |
| `feedback`    | `string`                  | 人类反馈文本，通常随 `action: "feedback"` 或 reject-with-feedback。   |
| `value`       | `string`                  | 补充输入值，通常随 `action: "input"` 写入计划问题或 supplemental 流。 |
| `payload`     | `Record<string, unknown>` | 扩展结构化上下文；不得替代上面已有稳定字段。                          |

如果 body 未提供 `sessionId`，后端只允许从兼容 cookie `agent_session_id` 读取；新接入必须显式传 `sessionId`。

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
