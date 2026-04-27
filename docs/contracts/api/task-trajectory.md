# Task Trajectory API

状态：current
文档类型：reference
适用范围：任务轨迹、轨迹步骤、轨迹产物与 replay 状态投影
最后核对：2026-04-26

本文记录 Phase 1 Task Trajectory 的 API 使用边界、计划接口、状态语义与兼容规则。

## 目的

Task Trajectory 用于把任务从“最终聊天结果”扩展为可观察、可导出、可评估、可 replay 的过程轨迹。

本阶段目标是先稳定 API 与 contract foundation：

- 让 `agent-chat` 能展示任务执行过程中的关键步骤、产物引用和终态。
- 让 `agent-admin` 能按任务查看 trajectory，并把轨迹作为治理、排障和审计输入。
- 让 runtime、evals 与后续 Skill Foundry 流程共享同一组 canonical schema。
- 为后续 replay 执行、轨迹导出、技能沉淀与评测回归留出兼容扩展点。

本文档不重复定义字段，字段兼容性以 `packages/core` schema 和 parse tests 为准。

## Consumers

- `apps/frontend/agent-chat`
- `apps/frontend/agent-admin`
- `apps/backend/agent-server`
- `packages/runtime`
- `packages/evals`
- Skill Foundry 后续流程

## Canonical Schemas

字段定义与兼容读取以 `@agent/core` canonical schemas 为准：

- `TaskTrajectoryRecordSchema`
- `TrajectoryStepRecordSchema`
- `TrajectoryArtifactRecordSchema`
- `TrajectoryReplayRecordSchema`
- `TrajectoryPublicIdSchema`
- `TrajectoryTimestampSchema`

任何 API payload、SSE projection、持久化投影、导出内容或 eval 输入都必须先能被对应 schema parse；文档只描述使用语义，不复制字段表。公共 trajectory id、task id、step id、artifact id、replay id、request id、checkpoint id、approval id、evidence id 等标识符必须使用 `TrajectoryPublicIdSchema`，不得为空字符串；`createdAt`、`updatedAt`、`startedAt`、`finishedAt`、`finalizedAt` 必须使用 `TrajectoryTimestampSchema`，即 ISO datetime。

## Planned Endpoints

| 方法   | 地址                                  | 参数           | 返回值                             | 说明                                                |
| ------ | ------------------------------------- | -------------- | ---------------------------------- | --------------------------------------------------- |
| `GET`  | `/api/trajectories/:taskId`           | path: `taskId` | `TaskTrajectoryRecordSchema`       | 获取指定任务的轨迹投影。                            |
| `GET`  | `/api/trajectories/:taskId/artifacts` | path: `taskId` | `TrajectoryArtifactRecordSchema[]` | 获取轨迹产物引用列表，不内联大体积内容。            |
| `GET`  | `/api/trajectories/:taskId/export`    | path: `taskId` | 导出 envelope，格式后续稳定        | 导出轨迹快照，用于排障、评测或 Skill Foundry 输入。 |
| `POST` | `/api/trajectories/:taskId/replay`    | path: `taskId` | `TrajectoryReplayRecordSchema`     | 创建 replay 状态投影；本阶段不要求真实执行 replay。 |

## 状态流转

轨迹状态按以下顺序兼容演进：

```text
running / interrupted -> succeeded / failed / cancelled / replayed
```

replay 状态使用以下 canonical status：

- `not_requested`
- `available`
- `unavailable`
- `running`
- `completed`
- `failed`

语义约束：

- `running` 表示原任务仍在执行，trajectory 可以继续追加步骤。
- `interrupted` 表示任务暂停在审批、补充输入或可恢复 checkpoint。
- `succeeded`、`failed`、`cancelled` 是原任务终态。
- `replayed` 表示该 trajectory 已经产生 replay 结果投影，不代表原任务终态被覆盖。
- `not_requested` 表示尚未请求 replay。
- `available` 表示当前轨迹满足 replay 前置条件。
- `unavailable` 表示当前轨迹缺少 replay 所需上下文或产物。
- `running`、`completed`、`failed` 表示 replay 请求自身状态。

## Error Semantics

| 错误码                     | 语义                                     | 建议 HTTP 状态 |
| -------------------------- | ---------------------------------------- | -------------- |
| `trajectory_not_found`     | 指定任务轨迹不存在，或当前调用方不可见。 | `404`          |
| `trajectory_not_finalized` | 需要终态轨迹的操作被用于未完成轨迹。     | `409`          |
| `replay_not_available`     | 当前轨迹不满足 replay 前置条件。         | `409`          |
| `replay_mode_unsupported`  | 请求的 replay 模式当前未被支持。         | `400`          |

错误响应应保持项目统一错误 envelope，并在可行时附带 task id、trajectory id、replay id 等诊断上下文；不得把底层 runtime、存储或 eval runner 的原始错误对象直接暴露给调用方。

## Compatibility Rules

- 新增字段必须保持向后兼容；旧消费者忽略未知字段时不得影响 trajectory 主时间线展示。
- 修改状态、错误码或 replay mode 前，必须先更新 `@agent/core` schema、parse tests 与本文档。
- 标识符和时间字段不得在 runtime、SSE adapter、导出器或 eval 输入中放宽；如需兼容旧数据，必须先在读取边界做迁移或显式 fallback，再输出 schema-parseable 投影。
- 轨迹步骤必须通过 `TrajectoryStepRecordSchema` 表达，不让调用方依赖内部 graph node 名称或临时日志格式。
- 轨迹产物必须通过 `TrajectoryArtifactRecordSchema` 表达；API 只返回引用、摘要、mime/type 等稳定投影，不内联大 artifact 内容。
- replay 状态必须通过 `TrajectoryReplayRecordSchema` 表达；本阶段可以返回状态投影，但不能伪装为真实 replay 执行结果。
- Task Trajectory 可以引用 EvidenceRecord，但不能替代 EvidenceRecord 的证据语义、来源可信度或审计边界。
- 导出格式稳定前必须带版本字段；后续扩展只能追加字段，不能破坏既有导入或 eval 消费。

## Chat SSE Projection

当前已落地的 chat SSE 接入不新增 `ChatEventRecord.type` 枚举，而是把 trajectory 放进现有事件 payload：

- `execution_step_started/completed/blocked/resumed` 承载单个 `trajectoryStep`。
- `node_progress` 承载完整 `taskTrajectory` 快照，payload 带 `projection = "task_trajectory"`。
- 后端投影 helper 位于 `apps/backend/agent-server/src/chat/chat-trajectory-events.adapter.ts`。
- 前端 OpenClaw 工作区消费 helper 位于 `apps/frontend/agent-chat/src/lib/chat-trajectory-projections.ts`。

这条链路的边界是“可观察投影”，不是独立执行器：如果真实 tool executor、approval runtime 或 evidence repository 尚未直接产出 trajectory，后端只能通过 adapter 从既有 `ChatEventRecord` 映射出 schema-parseable step/snapshot，不能伪造 replay 或越过真实执行状态。

## Non-goals

本阶段不实现：

- replay 执行
- 存储大 artifact 内容
- 替代 EvidenceRecord
