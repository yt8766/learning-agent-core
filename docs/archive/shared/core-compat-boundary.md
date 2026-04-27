# Shared Core Compat Boundary

状态：history
文档类型：reference
适用范围：`packages/shared` 退场历史、`packages/core` compat 边界迁移参考
最后核对：2026-04-18

## 1. 这篇文档说明什么

本文档记录 `packages/shared` 退场前后，`packages/shared` 与 `packages/core` 之间曾经形成的真实边界：

- `packages/core`
  - 作为稳定主 contract 宿主
- `packages/shared`
  - 当时作为 compat re-export、前端默认组合、展示友好别名层

同时列出当时保留在 `shared` 的 compat 文件，用于解释为什么历史迁移会留下这些台账；不要把它再理解成当前还能继续写回 `shared` 的目录建议。

当前补充说明：

- `packages/shared` 已删除
- 本文只保留为迁移历史参考
- 当前稳定主 contract 默认以 `@agent/core` 为唯一公共宿主

## 2. 当前已明确的边界

- `@agent/core` 应承载：
  - schema-first 的稳定 DTO / Record / event / payload contract
  - 不依赖前端默认泛型与展示组合的主定义
  - 跨 runtime / backend / frontend / agents 的稳定边界接口
- `@agent/shared` 可以继续承载：
  - compat re-export
  - 前端默认类型参数包装
  - 展示型窄化别名
  - label / normalize 一类纯函数

判断标准：

- 如果同一个 contract 同时满足“跨包复用、稳定协议、不是纯展示拼装”，主定义必须继续留在 `@agent/core`
- 如果某个 shared 文件只是转发 `@agent/core` 的主类型，再补少量默认类型参数或展示包装，则它属于允许保留的 compat 层

## 3. 当前保留的 compat 文件

以下文件在 `packages/shared` 删除前保留于 `packages/shared/src/types/*`，但它们的主 contract 已经在 `@agent/core`：

- `knowledge-evidence.ts`
  - 仅转发 `EvidenceRecord` 与 `isCitationEvidenceSource`
- `delivery.ts`
  - 仅转发 `DeliveryCitationRecord`、`DeliverySourceSummaryRecord`
- `execution-trace.ts`
  - 仅转发 `ExecutionTrace` 相关共享记录
- `connectors.ts`
  - 仅转发 connector / governance 相关 shared alias
- `knowledge-memory.ts`
  - 主要转发 memory 主 contract，同时保留 `ReflectionResult` 这类 shared 侧组合类型
- `tasking-task-record.ts`
  - 主要承载前端/运行时友好的 `TaskRecord` compat 组合，并从 `@agent/core` 转发 `TaskRecord` / checkpoint runtime-state / health-check 相关主 contract
- `tasking-chat.ts`
  - 当前承接 `ChatCheckpointRecord` 的 compat 组合，并从 `@agent/core` 转发 checkpoint 主体与 wrapper schema
- `tasking-orchestration.ts`
  - 当前对 `AgentExecutionState`、`AgentMessage`、`ManagerPlan`、`ReviewRecord` 以及 `DispatchInstruction` / specialist context-finding / critique 子契约提供 compat 入口
- `tasking-planning.ts`
  - 当前对 `PlanDraftRecord`、`PlanQuestionRecord` 等 planning 主 contract 提供 compat 入口，并转发 `EntryDecisionRecord` / `ExecutionPlanRecord` / `PartialAggregationRecord` 的 schema-first 主定义
- `governance.ts`
  - 当前对 `ApprovalRecord`、approval scope policy、connector health、MCP capability 等主 contract 提供 compat 入口
- `platform-console.ts`
  - 以 `@agent/core` 的主 contract 为底座，补 shared 默认泛型参数
- `governance.ts`
  - 保留 shared 本地展示约束，同时对 `@agent/core` 的 policy / health / capability 主 contract 做 compat 包装

这些文件在当时不视为“边界违规”，前提是：

- 不再新增与 `@agent/core` 平行的第二份主定义
- 不把新的稳定公共 contract 再次直接落在 `shared`

## 4. 仍然值得继续收口的点

下面这些方向是在当时仍值得继续优化的点，保留它们是为了帮助理解后续为什么会继续把主 contract 收到 `core`：

1. `knowledge-memory.ts`
   - 可以继续评估 `ReflectionResult` 是否仍应留在 `shared`，还是需要拆到更明确的展示组合文件
2. `tasking-task-record.ts`
   - 当前主宿主已经迁入 `@agent/core`，且 `externalSources` / `learningCandidates` / `llmUsage`、预算门、复杂任务、黑板、治理评分、技能执行等稳定子状态也已改为 core-hosted schema；后续重点变成继续压缩 shared 侧剩余高变细化字段与本地窄化
3. `tasking-chat.ts`
   - 当前 `ChatCheckpointRecord` 主宿主已经迁入 `@agent/core`，且已开始复用 llm usage / evidence / 预算治理 / 技能执行等 core-hosted 子 schema；后续仍可继续把剩余 shared 侧复杂字段细化成更多 core-hosted 子 schema
4. `governance.ts`
   - 仍然同时承载 shared 本地定义与 core compat 包装，后续应持续压缩 shared 侧主定义范围
5. `platform-console.ts`
   - 当前模式是合理的，但如果默认泛型继续膨胀，需要进一步把 core 主定义与 shared 默认组合拆得更清楚

## 5. 本轮已完成的收口

- `packages/shared/src/index.ts`
  - 删除重复的 `platform-console` 根入口导出
- `docs/archive/shared/README.md`
  - 当时更新为“shared 允许依赖 core，但仅作为 compat 层”的真实规则
- `docs/maps/packages-overview.md`
  - 同步了 shared 的 compat / 默认组合定位

## 6. 后续修改规则

历史上改动 `packages/shared` 与 `packages/core` 时，默认遵守：

1. 先判断主 contract 是否应位于 `@agent/core`
2. 如果只是兼容旧消费方，优先新增 compat re-export，而不是复制一份主定义
3. 如果 shared 文件开始同时承担“主定义 + 展示组合 + compat 包装”三种职责，应继续拆分
4. 当时改完后至少执行：

```bash
pnpm exec tsc -p packages/runtime/tsconfig.json --noEmit
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```
