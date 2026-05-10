# Execution Fabric API

状态：current
文档类型：reference
适用范围：执行节点、执行请求、策略判定与执行结果投影
最后核对：2026-04-26

本文记录 Phase 1 Execution Fabric 的 API 使用边界、计划接口、状态语义与兼容规则。

> 边界说明：本文中的 `/api/execution/*` 是 planned governance / projection endpoint，用于描述后续 Execution Fabric 对执行节点、能力、策略判定、请求与结果的统一治理投影。当前已经落地的真实工具执行入口不是 `/api/execution/*`，而是 [Agent Tool Execution API](/docs/contracts/api/tool-execution.md) 中的 `/api/agent-tools/*`。两者复用 `@agent/core` execution canonical schemas，但职责不同：`/api/agent-tools/*` 负责现阶段工具执行 request、审批恢复、结果与治理补拉；`/api/execution/*` 负责后续跨执行节点的治理读取和投影稳定化。

## 目的

Execution Fabric 用于把“可执行能力”从单一聊天流程中拆出，形成可观测、可审批、可治理的执行节点与执行请求投影。

本阶段目标是先稳定 API 与 contract foundation：

- 让 `agent-chat` 能展示一次执行请求的策略判定、排队、运行和终态。
- 让 `agent-admin` 能治理执行节点、能力声明、策略判定与健康检查结果。
- 让后端、runtime 与 agent-server 内建 background runner 在同一组 canonical schema 上交换执行投影。
- 为后续真实执行节点管理、工具执行器迁移与 replay 留出兼容扩展点。

本文档不重复定义字段，字段兼容性以 `packages/core` schema 和 parse tests 为准。

## Consumers

- `apps/frontend/agent-chat`
- `apps/frontend/agent-admin`
- `apps/backend/agent-server`
- `packages/runtime`

## Canonical Schemas

字段定义与兼容读取以 `@agent/core` canonical schemas 为准：

- `ExecutionNodeRecordSchema`
- `ExecutionCapabilityRecordSchema`
- `ExecutionPolicyDecisionRecordSchema`
- `ExecutionRequestRecordSchema`
- `ExecutionResultRecordSchema`

任何 API payload、SSE projection、持久化投影或导出内容都必须先能被对应 schema parse；文档只描述使用语义，不复制字段表。公共 `requestId`、`taskId`、`nodeId`、`capabilityId`、`resultId`、`decisionId`、`artifactIds`、`evidenceIds` 等标识符不得为空字符串；`createdAt`、`startedAt`、`finishedAt` 使用 ISO datetime；`durationMs` 必须为非负数。

## Planned Endpoints

以下 endpoint 是 Execution Fabric 的 planned governance / projection endpoint，不代表当前已经存在第二套工具执行实现。需要创建或恢复真实 tool execution request 时，使用 [tool-execution.md](/docs/contracts/api/tool-execution.md) 的 `/api/agent-tools/*`。

| 方法   | 地址                                        | 参数                  | 返回值                         | 说明                                                    |
| ------ | ------------------------------------------- | --------------------- | ------------------------------ | ------------------------------------------------------- |
| `GET`  | `/api/execution/nodes`                      | query: 待 schema 定义 | `ExecutionNodeRecordSchema[]`  | 获取执行节点列表投影，用于 admin 治理与 chat 能力提示。 |
| `GET`  | `/api/execution/nodes/:nodeId`              | path: `nodeId`        | `ExecutionNodeRecordSchema`    | 获取单个执行节点详情与能力摘要。                        |
| `GET`  | `/api/execution/requests/:requestId`        | path: `requestId`     | `ExecutionRequestRecordSchema` | 获取单次执行请求投影，包含策略判定与执行状态。          |
| `POST` | `/api/execution/nodes/:nodeId/health-check` | path: `nodeId`        | `ExecutionResultRecordSchema`  | 触发计划内健康检查投影；本阶段不要求真实远端执行。      |

## 状态流转

执行请求状态按以下顺序兼容演进：

```text
pending_policy -> pending_approval / queued / denied -> running -> succeeded / failed / cancelled
```

策略判定使用以下 canonical decision：

- `allow`
- `require_approval`
- `deny`

语义约束：

- `pending_policy` 表示请求已创建，但还没有完成策略判定。
- `pending_approval` 表示策略判定需要人类审批，后续必须接入审批门或恢复语义。
- `queued` 表示策略允许执行，等待 runtime 或 worker 调度。
- `denied` 表示策略拒绝，不能进入 `running`。
- `running` 表示执行已经开始，后续必须进入终态。
- `succeeded`、`failed`、`cancelled` 是执行请求终态。

## Error Semantics

| 错误码                        | 语义                                           | 建议 HTTP 状态 |
| ----------------------------- | ---------------------------------------------- | -------------- |
| `execution_node_not_found`    | 指定执行节点不存在，或当前租户/会话不可见。    | `404`          |
| `execution_request_not_found` | 指定执行请求不存在，或当前调用方不可见。       | `404`          |
| `execution_node_forbidden`    | 调用方无权查看、健康检查或使用该执行节点。     | `403`          |
| `execution_policy_denied`     | 策略判定拒绝本次执行请求，不能进入排队或运行。 | `403`          |

错误响应应保持项目统一错误 envelope，并在可行时附带 request id、node id、policy decision id 等诊断上下文；不得暴露第三方 executor 原始错误对象。

## Compatibility Rules

- 新增字段必须保持向后兼容；旧消费者忽略未知字段时不得影响核心状态展示。
- 修改状态、错误码或 decision 前，必须先更新 `@agent/core` schema、parse tests 与本文档。
- API 返回体只暴露项目自定义 schema，不让第三方执行器、队列或策略引擎类型穿透。
- 执行节点能力应通过 `ExecutionCapabilityRecordSchema` 表达，不通过调用方猜测内部 tool 名称。
- 策略判定必须写入结构化 `ExecutionPolicyDecisionRecordSchema`，不能只返回布尔值或自然语言说明。
- 执行结果必须通过 `ExecutionResultRecordSchema` 投影；大体积日志、文件或 artifact 只引用外部证据或 artifact id。
- 新 endpoint 可以追加 query/filter，但不得改变既有 endpoint 的基础语义。

## Non-goals

本阶段不实现：

- 真实执行节点管理
- 工具执行器重写
- 策略编辑
- replay
