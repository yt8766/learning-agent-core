# 当前 core 包合规检查

状态：current
文档类型：reference
适用范围：`packages/core`
最后核对：2026-04-18

本检查基于 [当前 core 包规范](/docs/packages/core/current-core-package-guidelines.md) 对 `packages/core` 的当前实现做现实核对，重点判断三件事：

- `core` 是否已经成为稳定主 contract 宿主
- 历史上的 `shared` 是否已经完成退场，并把 compat / facade 收回真实宿主
- 当前目录结构距离目标形态还差哪些明确动作

## 1. 结论

如果只按“包边界是否正确”判断，`packages/core` 当前已经基本站稳稳定契约层定位。

如果按“是否完全达到目标目录终态”判断，当前仍处在可控的收敛阶段，剩余工作主要是：

- 继续做目录命名与子域拆分
- 清理少量历史依赖和过时文档结论
- 持续清理宿主本地 compat/facade 中仍然冗余的历史迁移痕迹

换句话说，方向已经对了，接下来不是重新定义方向，而是按既定方向继续做精细化收口。

## 2. 当前已经满足的点

- `packages/core/src` 当前已经以 `contracts / providers + domain folders` 为主结构；`knowledge`、`memory`、`governance`、`tools` 旧领域目录已删除，task/checkpoint/channel 仍需复用的轻量字段已本地化到 `tasking/schemas/*-fields.ts`。
- 当前没有把 graph、flow、service、repository、runtime orchestration、tool executor 这类实现层逻辑塞进 `core`。
- `tasking`、`skills`、`connectors`、`channels`、`workflow-route`、`delivery`、`platform-console`、`execution-trace`、`skills-search`、`architecture-records`、`primitives` 等仍留在 core 的稳定子域，已经大量采用 `schema-first` 方式托管；data-report、knowledge、memory、governance、tools 的完整领域 contract 已迁出到真实宿主。
- 历史上的 `packages/shared` 相关 tasking / governance / connectors / trace contract 已经完成退场，现由 `core` 或真实宿主承接。
- `packages/core/src/index.ts` 仍是统一公共出口，符合稳定 facade 约束。

## 3. 当前仍需继续收口的点

### 3.1 目录层面

- review 相关 stable schema 与 normalize helper 已迁入 `review/*`
- `pending-execution-context.ts` 已收敛到 `contracts/approval/*`
- `helpers/` 泛化目录已清理；治理 matcher 与 evidence 判定逻辑不再由 core 旧 `governance/*` / `knowledge/*` 目录承载
- `channels`、`connectors`、`workflow-route`、`delivery`、`execution-trace` 已补出独立 domain folder，旧平铺 `spec/types` 文件已删除
- `skills-search`、`platform-console`、`architecture-records` 也已补出独立 domain folder，旧平铺 `spec/types` 文件已删除
- `primitives` 也已补出独立 domain folder，旧平铺 `spec/types` 入口已删除
- `packages/core/src` 内部当前已基本不再依赖旧平铺入口；`core-contract-exports.int-spec.ts` 也已切到根出口与物理宿主直接对齐
- `packages/core/test/core-compat-boundary.test.ts` 已补上实现层边界检查，当前会阻止 `packages/core/src` 内部重新引用旧平铺 compat 入口
- `tasking/*`
  - 已成为真实 top-level domain host；后续收敛重点不再是“把它们搬进目录”，而是继续删薄 compat 平铺入口与压缩历史描述

### 3.1.1 当前 compat 入口状态

以下平铺入口当前已经删除，不再作为 compat re-export 保留：

- `spec/*`
- `types/*`
- `contracts/chat-graph.ts`
- `contracts/*-ministry.ts`
- `contracts/approved-execution-agent.ts`
- `contracts/architecture-records.ts`
- `contracts/platform-console.ts`

当前主宿主已经分别位于：

- `tasking/*`
- `skills/*`
- `review/*`
- `skills-search/*`
- `platform-console/*`
- `architecture/*`
- `primitives/*`
- `contracts/chat/*`
- `contracts/ministries/*`
- `contracts/execution/*`
- `contracts/architecture/*`
- `contracts/platform-console/*`

### 3.2 依赖层面

- 历史迁移阶段曾额外关注 `packages/core/package.json` 中的高层或 compat 依赖
- 当前阅读时，应以源码和 lockfile 的最新状态为准，而不是以下历史 blocker 描述
- `data-report`、`data-report-json`、`architecture-records` 这组类型入口已去掉 `types/* -> contracts/*` 的反向 re-export，contract 现统一由 `contracts/*` 和根入口直接暴露
- `packages/core/test/core-contract-exports.int-spec.ts` 现已补上根出口与物理宿主之间的一致性 integration 回归，并继续覆盖 chat / ministries / platform-console 等 contracts compat re-export；后续目录重构默认应保持这组对齐

### 3.3 runtime overlay / facade 边界

- 下面涉及 `packages/shared/src/*` 与 `@agent/shared` 的条目，保留的是删包前迁移轨迹
- 当前现役规则应理解为：
  - `@agent/core` 负责 stable base host
  - runtime / backend / supervisor / frontend 各自用宿主本地 aggregate、facade 与 compat 承接运行态差异
  - 不再新增 `@agent/shared`

### 3.4 本轮新增确认

以下台账在本轮只保留高层结论，不再展开逐文件迁移明细：

- stable contract 已系统性回收到 `@agent/core`
  - 覆盖 tasking、governance、knowledge、skills、execution-trace、workflow/planning primitives 等主要子域
- runtime / backend / memory / supervisor / admin 的主链类型消费已改为：
  - `@agent/core` 承接稳定 contract
  - 各宿主本地 `types.ts`、`*-helpers.ts`、`*-architecture-helpers.ts`、`*-records.ts` 承接 aggregate、facade 与 compat
- 原先由 `packages/shared` 承接的 `runtime-centers*`、`console-centers*`、`skills-sources`、`data-report contract`、`BootstrapSkillRecord`、`ExecutionPlanRecord` 等 facade / compat 入口，已分别迁回 backend、admin、runtime、supervisor、`@agent/agents-data-report` 或 `@agent/core`
- 最新全仓结果已经满足：
  - `packages/shared` 之外的源码与测试文件对 `@agent/shared` 的 import 为 `0`
  - 业务包 `package.json` 不再声明 `@agent/shared`
  - `packages/shared` 目录本体已删除，只保留 `docs/archive/shared/*` 作为历史归档
- 这意味着后续关注点不再是“shared 还能不能继续减薄”，而是：
  - `packages/core` 自身目录与依赖是否继续收敛
  - 宿主本地 compat/facade 是否还能进一步删薄
  - 历史迁移文档是否继续压缩

### 3.5 历史 shared 终态判断

删包前最后一轮判断里，shared 曾被允许只剩四类历史残留：

- `overlay`
- `consumption facade`
- `helper reclaim`
- `compat`

当前这一步已经完成，不再需要把这四类残留继续维持为独立包形态。

### 3.6 稳定 contract 与剩余 blocker 分界

- 本轮已继续迁出到 `@agent/core`
  - `UserProfileRecord`
  - `ResolutionCandidateRecord`
  - `MemoryEventRecord`
  - `MemoryEvidenceLinkRecord`
  - `SkillManifestRecord`
  - `SkillSourceRecord`
  - `InstalledSkillRecord`
  - `SkillInstallReceipt`
  - `CompanyAgentRecord`
  - `WorkflowVersionRecord`
  - `WorkflowPresetDefinition`
- 仍需后续继续处理的不是 stable contract 主定义，而是：
  - 宿主本地 compat/facade 的继续删薄

补充：

- backend、runtime、memory、supervisor、agent-admin、skill 都已经建立各自的本地 facade / aggregate / helper 宿主
- 这些宿主中的业务文件不再直接从 `@agent/shared` 导入稳定 contract 或 aggregate record
- 后续若继续重构，应优先删薄这些宿主本地 compat 层，而不是重新引入公共 shared 包
- `apps/backend/agent-server/src/runtime/*`
  - 最新继续清理后，业务文件中的 shared 直连已清到 `0`
  - `runtime-architecture-helpers.ts` 也已改为宿主本地实现，当前已不再有 shared 直连
- `packages/memory/src/repositories/runtime-state-repository.ts`
  - 最新继续清理后，业务文件中的 shared 直连已清到 `0`
  - 当前剩余 shared 命中只来自宿主内 `runtime-state-task.types.ts` 这一层 aggregate 适配
- `packages/skill/src/*`
  - 最新继续清理后，业务文件中的 shared 直连已清到 `0`
- `apps/frontend/agent-admin/src/types/admin/*`
  - 最新继续清理后，业务类型文件中的 shared 直连已清到 `0`
  - 当前剩余 shared 命中只来自宿主内 `tasking-task.types.ts` 这一层 aggregate 适配
- `agent-admin` 已显式依赖 `@agent/core`，并将 `PlatformApprovalRecord` 改为默认从 core 消费
- `platform-console` 的 stable contract 已由 `@agent/core` 承接；shared 当前只保留 shared-facing 默认泛型包装

判断说明：

- 如果结构已经是稳定、跨包、非纯展示层 contract，应继续以 `core` 为唯一主宿主
- 如果结构同时带有 runtime/admin/skill-source facade 字段，应先拆分主 contract 与 facade 扩展层，再决定是否迁 core
- `WorkflowPresetDefinition` 的主 contract 已收敛到 `core`；shared 侧当前只保留 compat alias
- 真正还需要后续继续处理的，已经主要是运行态 overlay 与 consumption facade，而不是稳定 contract 主定义
- `LearningJob` / `LearningQueueItem` 当前已退出 shared 公开面；runtime / memory 分别承接宿主本地 learning 记录
- `specialist-routing` 一类 shared compat 类型若在切向 core 时会触发 stricter typing 回归，应继续保留 shared compat 入口并列入白名单，而不是误记为 stable contract 未迁完

### 3.7 现在离删除 shared 还差什么

从 `core` 宿主边界角度看，当前离删除 `shared` 还差的内容已经比较明确：

- 不是继续大面积把 stable contract 从 `shared` 迁到 `core`
- 而是继续收口 `runtime overlay + consumption facade + compat-only 残留`

当前最主要的剩余项：

- `TaskRecord` / `ChatCheckpointRecord` 的 compat field-slice 与少量 shared widening
- `platform-console` 上仍依赖 shared-facing 默认泛型的组合面

补充：

- `governance.ts` 中除 `ApprovalInterruptRecord` 外，其余 `ApprovalRecord` / `ApprovalPolicyRecord` / `ApprovalScopeMatchInput` / `ApprovalScopePolicyRecord` / `McpCapability` 已全部降成 core compat alias
- `ApprovalInterruptRecord` 当前也已不再被 shared 内部其它类型复用，更接近 compat 出口而不是内部 widening host

- `console-centers*` 已完成 shared 退场；剩余 blocker 已进一步收敛到 `platform-console` 组合面与少量 shared-facing facade 包装

补充：

- `RuntimeProfile` 作为稳定 profile primitive 已在主链消费侧改为默认从 `@agent/config` 获取
- 它不再应被记为 shared 当前 blocker；shared 侧真正还保留的是 facade 记录与 compat 出口
- `CounselorSelectorConfig` 已作为稳定 planning/governance contract 收口到 `@agent/core`
- `WorkerDefinition` 已作为稳定 runtime/governance contract 收口到 `@agent/core`

因此，后续如果有人再把“shared 还不能删”解释成“core 还没成为 stable contract 主宿主”，那已经是不准确的旧结论。

## 4. 这轮确认后的合并结论

下面这些子域，后续应继续坚持“`core` 唯一主宿主”：

- `tasking-planning`
- `tasking-orchestration`
- `tasking-chat`
- `tasking-runtime-state`
- `tasking-session`
- `tasking-checkpoint`
- `tasking-task-record`
- `tasking-thought-graph`
- `governance` 主 contract
- `connectors` 主 contract
- `execution-trace`
- `skills-search`
- `knowledge-runtime`
- `platform-console`
- `channels`
- `delivery`
- `workflow-route`
- `architecture-records`

下面这些子域，当前仍允许保留在 `shared` 作为 compat / facade：

- `skills-capabilities` 中面向前端/治理的组合层
- `tasking-chat.ts`、`tasking-task-record.ts` 的 overlay
- `primitives.ts` 中真实 shared-facing widening

## 5. 已修正的规范认知

当前已修正两类容易误导后续 AI 的问题：

- `docs/conventions/package-architecture-guidelines.md` 不再把已删除的 `packages/agent-core` 当作当前包边界模板；当前实现入口收敛到 `runtime / agents/*`
- `docs/packages/core/current-core-package-audit.md` 旧版本里对 `packages/core/package.json` 依赖状态的描述已经过时，不能继续保留

## 6. 后续收敛优先级

建议按下面顺序推进：

1. 先把命名不清晰的目录收敛为按领域分桶的结构
2. 再继续删薄 compat 平铺入口与历史迁移叙述
3. 持续压缩 shared overlay，只保留真实 widening
4. 每次迁移后同步更新 `docs/packages/core/*`、`docs/archive/shared/*` 与包分层规范

## 7. 当前判断

如果问“现在能不能把 `packages/core` 当作以后严格执行的主规范来用”，答案是可以。

如果问“现在是不是已经到最终目录终态”，答案是否。当前更准确的状态是：

- 包边界已经基本正确
- 子域归属已经明确
- 目录和依赖还需要继续做第二阶段精细化收敛

这也是接下来继续推进时最重要的边界：不要再回到双主宿主和随手落位的状态。
