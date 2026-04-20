# Packages 分层与依赖约定

状态：current
文档类型：convention
适用范围：packages 分层规范
最后核对：2026-04-19

`packages/*` 不是普通公共代码堆放区，而是平台架构边界。所有新增代码都必须先判断其职责归属，再决定进入哪个包。

本轮补充一个统一前提：

- `packages/core` 不是“其他包都要模仿成 contract 包”
- 其他包要参考的是 `core` 的治理方式，而不是复制 `core` 的内容
- 也就是：每个包都要先定义稳定边界、公开入口、允许内容、禁止内容，再承载真实实现
- 当某段能力开始被多个地方复用、逻辑复杂度持续上升、并且需要独立演进时，可以新建 `packages/<pkg>` 子包先收敛边界
- `packages/` 下的每一个目录必须包含 `package.json`
- 新建 `packages/<pkg>` 时不要求立即提供实现代码，不要求立即创建 `src/` 目录，也不要求先放任何业务逻辑；`package.json` 是最低门槛，其余目录按演进需要逐步补齐

## 统一目录语法

除 `packages/core` 继续按自身 domain-host + schema-first 结构推进外，其他 `packages/*` 在进入实现阶段后默认参考以下统一目录语法设计。不是每个包都必须拥有全部目录，但如果某个语义存在，命名应保持一致。

```text
packages/<pkg>/
├─ src/
│  ├─ contracts/
│  ├─ schemas/
│  ├─ runtime/
│  ├─ providers/
│  ├─ repositories/
│  ├─ registry/
│  ├─ policies/
│  ├─ shared/
│  ├─ utils/
│  └─ index.ts
├─ test/
└─ package.json
```

这些目录的统一语义如下：

- `contracts/`
  - 本包对包外暴露的稳定 contract、facade、abstract interface
  - 目标是让调用方依赖“能力边界”，而不是依赖内部目录细节
- `schemas/`
  - 本包自己的稳定输入/输出结构约束
  - 能用 schema-first 表达的长期边界，优先放这里
- `runtime/`
  - 本包运行时装配、入口 facade 或执行时 wiring
  - 不等于 graph 或业务主流程；它强调“本包内部的运行态装配层”
- `providers/`
  - 对外部系统、底层驱动或 provider 的具体实现
- `repositories/`
  - 存储访问、读写、索引、cache 等持久化实现
- `registry/`
  - 注册表、catalog、manifest 索引、能力发现入口
- `policies/`
  - 规则、匹配器、默认策略、裁决逻辑
- `shared/`
  - 本包内部跨子域复用、且带明确领域语义的共享资产
  - 不面向全仓公共，不应演变为第二个 `shared` 包
- `utils/`
  - 纯函数、无副作用、低领域耦合工具
  - 禁止把 service、repository、driver、orchestration 伪装成 `utils/`

补充约束：

- `package.json` 是 `packages/<pkg>` 唯一强制的最低结构要求；`src/`、`test/` 和其他分组目录只在对应语义真正出现后再补
- 目录语法统一后，后续新增包内目录优先复用这些名称，不要每个包单独发明新术语
- `contracts/` 不应反向依赖 `runtime/`、`providers/`、`repositories/` 这类重实现目录
- `schemas/` 不应耦合外部 SDK 或执行态 wiring
- `shared/` 与 `utils/` 的职责必须分开：
  - `shared/` 保留业务语义
  - `utils/` 保留纯工具语义
- 文档先定义推荐终态结构，不要求本轮立即大规模搬文件；后续源码收敛应以这些目录语义为目标
- compat / facade / legacy 根入口的后续删除优先参考
  - [Compat 入口收缩候选](/docs/core/package-compat-sunset-candidates.md)
- `contracts/*` 与人工可读聚合入口要分开治理：
  - `contracts/*` 默认代表刻意保留的稳定 facade
  - 类似 `config/src/settings.ts` 这样的人工可读聚合入口，默认按“长期保留聚合层”治理
  - 只有“纯 compat 壳文件”才默认进入删除队列

## 分层模型

默认按“契约层 -> 配置层 -> SDK/内核层 -> 平台装配层 -> 专项 Agent -> 应用适配器”理解仓库边界。

这组分层的正式裁决见：

- [Runtime 分层 ADR](/docs/runtime/runtime-layering-adr.md)

当前最重要的三条红线是：

- `packages/core` 是 schema-first 契约层，不依赖业务实现包；当前允许依赖 `zod`，后续如需增加纯契约基础库必须先在本文记录理由
- `packages/runtime` 是 Runtime Kernel，长期目标是不认识任何具体官方 Agent，只依赖抽象 registry / session / graph / approval / recovery / observability contract
- `apps/*` 是启动适配器，只选择装配方案并暴露 HTTP/SSE/worker/UI 入口，不内联 agent prompt、graph 装配或 runtime 主链

本轮继续补充一条 backend/runtime 收敛约定：

- `apps/backend/agent-server/src/runtime/*` 下，`centers/`、`services/`、`core/` 默认优先保留宿主装配、Nest facade、query entry、error mapping 与少量 orchestration；
- 稳定、可复用、无 Nest 依赖的纯规则、纯投影、snapshot mutation、路径/命名/selector helper，默认继续往 `runtime/domain/<area>/` 下沉；
- 当前已经开始按此规则收敛的子域包括：
  - `runtime/domain/skills/*`
  - `runtime/domain/connectors/*`
  - `runtime/domain/metrics/*`
  - `runtime/domain/observability/*`
- 后续新增 backend runtime 逻辑时，若实现主要是“输入若干 record/context，返回派生结果/过滤结果/新 snapshot”，应优先落到 `runtime/domain/*`，而不是直接写进 `RuntimeCenters*Service`、`Runtime*QueryService` 或 `runtime/*.service.ts`

当前实施状态：

- `packages/core` 已移除 `@agent/report-kit` 依赖，并由 `pnpm check:package-boundaries` 阻止回退
- `packages/platform-runtime` 已落地为官方组合根，backend/worker 默认 runtime 创建线已改由它装配
- `apps/backend` 与 `apps/worker` 禁止直接依赖 `@agent/agents-*`，官方 Agent 能力统一经 `@agent/platform-runtime` 暴露
- `packages/runtime/src/bridges/*` 已收敛为 runtime 内部 adapter；它们只转发 `RuntimeAgentDependencies` contract，不再直接 re-export 官方 Agent

1. 契约层

- `packages/core`

2. 配置层

- `packages/config`

3. Agent SDK 与 Runtime Kernel 层

- `packages/agent-kit`
- `packages/runtime`

4. 平台基础能力层

- `packages/adapters`
- `packages/knowledge`
- `packages/memory`
- `packages/tools`
- `packages/skill-runtime`
- `packages/report-kit`
- `packages/templates`

5. Platform Assembly 层

- `packages/platform-runtime`

6. 专项 Agent 层

- `agents/supervisor`
- `agents/data-report`
- `agents/coder`
- `agents/reviewer`

专项 Agent 层补充边界：

- `agents/supervisor` 只持有 supervisor 自身的 preset / route / dispatch / search/docs/router ministry
- `agents/supervisor` 不再直接依赖或 re-export `@agent/agents-coder`、`@agent/agents-reviewer`、`@agent/agents-data-report`
- sibling specialist 的官方组合与默认注入统一通过 `packages/platform-runtime`

7. 质量层

- `packages/evals`

迁移兼容说明：

- `packages/shared` 已于 `2026-04-18` 从 workspace 删除，历史台账保留在 `docs/shared/`
- 已删除的 `packages/agent-core` 历史说明统一保留在 `docs/archive/agent-core/`
- 新消费侧优先改用 `@agent/agent-kit`、`@agent/runtime`、`@agent/platform-runtime`、`@agent/adapters` 与对应稳定公开入口

## 每个包允许放什么

### `packages/core`

- 允许：稳定共享数据模型、Zod schema、由 schema 推导的 type、跨包 interface/facade contract、通用错误模型、pipeline contract
- 禁止：业务实现、外部 SDK 接入、graph/flow/runtime 执行逻辑、包内部私有结构
- 备注：
  - `packages/core` 是稳定 contract facade，不是“任何共用代码都能放”的公共杂物层
  - `packages/core` 默认只接受 schema-first 的稳定公共 contract
  - 所有稳定 JSON/DTO/event/error contract 默认遵循“schema 定义结构，type 由 schema 推导”
  - 类型定义默认使用 `z.infer<typeof Schema>`；如果没有 schema，就不应作为 `core` 的长期稳定公共 contract 落地
  - `packages/core/src/types/*` 后续不再接受新的“纯 interface/type 主定义文件”；如果某个文件承载稳定公共 contract，就必须补 schema 作为唯一结构源
  - `platform-console`、approval interrupt 这类跨端复用且不绑定前端默认类型参数的主 contract，应优先沉淀到 `packages/core`
  - `governance` 中跨 runtime / backend / memory 复用的稳定 policy 与 connector health contract，也应优先从 `shared` 回收到 `core`
  - `tasking` 中像 `HealthCheckResult` 这类不依赖前端默认组合、只表达稳定接口语义的 contract，也应优先放进 `packages/core`；当前已按 `HealthCheckResultSchema + z.infer` 落地
  - `governance` 中的 `ConnectorHealthRecord`、`ApprovalPolicyRecord`、`ApprovalScopePolicyRecord`、`McpCapability` 主 contract 也已切到 `schema-first`
  - `knowledge` 中的 `ExecutionTrace`、`EvidenceRecord`、`MemoryRecord`、`RuleRecord`、以及后续可独立稳定的 evidence / trace helper，也应优先从 `shared` 回收到 `core`
  - `primitives` 中像 `QueueStateRecord`、`LlmUsageModelRecord`、`LlmUsageRecord` 这类跨 runtime / backend / frontends 复用的稳定记录结构，也应优先放入 `packages/core`，`packages/shared` 只保留 compat re-export 或前端默认组合
  - `connectors` 中像 `ConnectorKnowledgeIngestionSummary`、`ConnectorCapabilityUsageRecord` 这类稳定摘要 contract，也应以 `packages/core` 为唯一主定义，并优先按 schema-first 维护
  - `DataReportBlueprintResultSchema` 这类稳定结构可以留在 `core`，但 `buildDataReportBlueprint`、scaffold、write、template resolve 等确定性生成实现必须留在 `report-kit`
  - `packages/core/package.json` 当前只允许 `zod` 作为依赖；禁止重新加入 `@agent/report-kit`、`@agent/runtime`、`@agent/agents-*` 或任何业务实现包

### `packages/config`

- 定位：系统配置与默认策略包
- 允许：
  - profile 定义
  - settings schema
  - feature flags
  - storage/path policy
  - budget/source/approval 默认策略
  - 配置加载、标准化与 facade
- 禁止：
  - graph、flow、agent 业务编排
  - tool executor
  - repository
  - provider 实例创建
  - runtime orchestration
- 推荐结构：
  - `contracts/`：settings facade、profile contract
  - `schemas/`：settings/profile/policy schema
  - `profiles/`：platform/company/personal/cli 默认配置
  - `policies/`：budget/source/approval/path policy
  - `loaders/`：env resolver、settings loader、normalizer
  - `shared/`：默认值、字段映射、常量
  - `utils/`：轻量解析 helper
- 说明：
  - `config` 参考 `core` 的地方，在于它也应该先提供稳定配置 contract，再承载 env 解析与默认值实现
  - `config` 当前已经补出 `contracts/settings-facade.ts` 作为包根稳定导出层；`settings.ts` / `settings/index.ts` 则保留为人工可读聚合入口
  - 不应继续把“读环境变量”和“系统默认策略”混成一个平铺目录

### `packages/knowledge`

- 允许：knowledge source/chunk repository、indexing pipeline、retrieval、citation/context assembly、knowledge search contract
- 禁止：最终回答生成、agent 主链编排、provider SDK 具体实现、app view model

### `packages/memory`

- 允许：memory/rule/runtime-state repository、semantic cache、memory search contract
- 禁止：agent 主链编排、delivery/review/research 流程控制

### `packages/tools`

- 允许：tool registry、tool definition、sandbox executor、filesystem executor、approval preflight、MCP transport
- 禁止：agent orchestration、chat/review/research prompt、graph/ministry 主逻辑

### `packages/skill-runtime`

- 定位：运行时技能资产治理包
- 允许：
  - skill manifest schema
  - runtime skill registry
  - skill source sync
  - installed skill metadata
  - trust / compatibility / availability 基础判断
  - skill catalog facade
- 禁止：
  - 仓库级 `skills/*` 代理技能文档
  - graph、agent orchestration
  - tool executor 主流程
  - memory/search 主链编排
  - app 层 view model
- 推荐结构：
  - `contracts/`：skill registry/source/install contract
  - `schemas/`：manifest/source/receipt/catalog schema
  - `registry/`：registry、catalog service、manifest loader
  - `sources/`：remote/local source reader、sync、source policy
  - `install/`：installer、receipt、integrity check
  - `policies/`：trust、compatibility、availability
  - `runtime/`：skill runtime facade、registry runtime
  - `shared/`：manifest normalizer、catalog mapper
  - `utils/`：纯函数工具
- 说明：
  - `skill-runtime` 应按“运行时技能资产层”理解，而不是 loader 杂物层
  - `skill-runtime` 当前已经补出 `contracts/skill-runtime-facade.ts` 作为包根稳定导出层
  - `docs/skills/*` 继续描述仓库代理技能；运行时 skill 的包级规则应独立沉淀到 `docs/skill-runtime/*`

### `packages/runtime`

- 定位：Runtime Kernel
- 允许：
  - graph 执行与 state machine kernel
  - session、checkpoint、approval interrupt/recovery
  - task lifecycle kernel
  - runtime observability kernel
  - 抽象 registry / worker / session / tool / memory / provider contract
  - 与主链有关的通用状态机和可恢复执行语义
- 禁止：
  - app controller/view model
  - 前端展示专属 DTO
  - 长期散落的 provider 细节
  - 官方 Agent 默认组合
  - 为当前 backend 页面方便而写入的治理中心展示聚合
- 迁移说明：
  - 当前 `src/bridges/*` 仍保留兼容壳，但已经只转发 `RuntimeAgentDependencies` contract，不再直接依赖官方 `@agent/agents-*`
  - 禁止让 `runtime` 反向 import `@agent/platform-runtime`；官方装配只能从 `platform-runtime -> runtime`

### `packages/platform-runtime`

- 定位：官方平台装配层 / Composition Root
- 允许：
  - 官方 Agent / workflow 出口
  - `PlatformRuntimeFacade` contract
  - `createOfficialAgentRegistry()`
  - 基于 capability / domain 的官方 agent descriptor 查询
  - `createOfficialRuntimeAgentDependencies({ agentRegistry? })`
  - `createPlatformRuntime({ runtime, agentRegistry })`
  - `createDefaultPlatformRuntime(options)`
  - backend 与 worker 可复用的 runtime facade 装配
- 禁止：
  - HTTP controller
  - worker 消费循环
  - 前端 view model
  - Agent prompt、graph 节点主实现
  - report-kit blueprint/scaffold/write 主流程
  - 变成第二个 `runtime` 或第二个 `backend`

### `packages/agent-kit`

- 定位：Agent SDK 层 / 编写 Agent 的轻量基础宿主
- 允许：
  - `BaseAgent`
  - 流式执行与 runtime-memory helper
  - 通用 `AgentDescriptor` / `AgentProvider` / `AgentRegistry` contract
  - planner strategy selector 这类 Agent authoring / orchestration 共用的轻量决策 helper
  - agent authoring 所需的轻量 helper
- 禁止：
  - session/checkpoint/platform center projection
  - backend/worker 装配
  - 官方 agent 默认注册表实现

### `packages/evals`

- 定位：评测与质量证明包
- 允许：
  - evaluator
  - benchmark
  - regression helper
  - quality gate runner
  - eval result schema 与 report formatter
- 禁止：
  - 运行时主链依赖逻辑
  - app 层业务编排
  - provider 适配实现
- 推荐结构：
  - `contracts/`：eval runner/result/quality gate contract
  - `schemas/`：eval result、prompt regression、benchmark report schema
  - `prompt-regression/`：suite、runner、reporter
  - `benchmarks/`：suite、runner、reporter
  - `quality-gates/`：verify gate、threshold checker、affected checker
  - `runtime/`：eval runtime facade
  - `shared/`：score calculator、result normalizer
- 说明：
  - `evals` 不应长期只是脚本和配置集合；后续应逐步承接质量 contract 与评测运行语义

### `packages/templates`

- 定位：模板资产与模板元数据包
- 允许：
  - page/scaffold/starter/report 模板资产
  - 模板 manifest、metadata、registry
  - 模板 schema
- 禁止：
  - 运行时调度逻辑
  - 工具执行逻辑
  - agent flow
  - 与模板无关的 service / runtime helper
- 推荐结构：
  - `contracts/`：template manifest/registry contract
  - `schemas/`：template manifest、slot、entry schema
  - `registries/`：page/scaffold/report template registry
  - `page-templates/`：页面或报表页面模板
  - `scaffold-templates/`：脚手架模板
  - `starter-templates/`：基础工程起步模板
  - `shared/`：模板 manifest、共享 assets
  - `utils/`：template id、命名辅助
- 说明：
  - `packages/templates` 负责“有哪些模板资产”，不负责“如何 preview / write / execute”
  - 当前平铺 `src/<template-name>` 的现状后续应逐步收敛到“按模板类型分层”

### `packages/report-kit`

- 定位：报表领域的确定性生成引擎
- 允许：
  - report blueprint
  - scaffold
  - assembly
  - write pipeline
  - report generation primitives
- 禁止：
  - graph、agent orchestration
  - tool registry
  - sandbox executor
  - backend service 内联编排
  - 通用 prompt 主流程
- 推荐结构：
  - `contracts/`：report blueprint/assembly/write contract
  - `schemas/`：blueprint/scaffold/write-plan schema
  - `blueprints/`：蓝图资产
  - `scaffold/`：脚手架构造与 inspect
  - `assembly/`：page/route/component assembly
  - `writers/`：file/materialization/write facade
  - `shared/`：模板映射、命名规则、领域共享 helper
  - `utils/`：低层纯函数
- 说明：
  - `report-kit` 负责“怎么生成报表资产”，不负责“什么时候调用、如何编排 LLM 节点”
  - 这层应继续与 `agents/data-report`、`packages/runtime` 的编排语义分离

## 依赖方向

必须满足：

- `core` 不得依赖任何 `@agent/*` 业务实现包；当前只允许 `zod`
- `config` 不得依赖 `runtime` 或任意 `agents/*`
- `adapters / memory / tools / skill-runtime` 只允许依赖 `config`、`core` 和必要第三方库
- `runtime` 可以依赖 `agent-kit / config / core / adapters / memory / tools / skill-runtime`
- `runtime` 长期不得依赖任何 `agents/*`；当前 `bridges/*` 是 runtime 内部稳定 adapter，而不是官方 Agent 的直接宿主
- `platform-runtime` 可以依赖 `runtime` 和官方 `agents/*`，但只做官方装配与 facade wiring
- `platform-runtime` 持有官方 agent descriptor / capability / specialist-domain registry；需要 capability dispatch 时，优先沿这层 contract 扩展，而不是把 dispatch 重新写回 `apps/*` 或 `runtime`
- `platform-runtime` 负责把 supervisor 返回的 specialist domain 继续 enrich 为官方 agent 匹配线索；runtime 主链消费的是 enrich 后的 route，而不是自行反查 registry
- `PlatformRuntimeFacade` 应作为 app 层读取官方默认装配能力的首选入口；应用侧不要继续直接 import `resolveWorkflowPreset`、`runDispatchStage`、`createOfficialRuntimeAgentDependencies`、`listWorkflowPresets`、`listSubgraphDescriptors`、`listWorkflowVersions` 这类主链装配 helper
- dispatch contract 应显式区分 `agentId`（偏好 / 首选 hint）与 `selectedAgentId`（本次 dispatch 实际收敛目标）；不要让 runtime / admin / chat 继续从 `to = executor|reviewer` 这类历史角色名反推官方 agent
- planner 的策略态应通过稳定 contract 暴露给 runtime / admin（例如 `plannerStrategy.mode = default | capability-gap | rich-candidates`），不要让治理侧继续从自由文本 summary 反推当前规划模式
- `agents/*` 可以依赖 `config / core / adapters / runtime / memory / tools / skill-runtime`
- `apps/*` 只能依赖各包公开入口
- `apps/backend` 与 `apps/worker` 不得直接依赖 `@agent/agents-*`，官方装配统一通过 `@agent/platform-runtime`
- 禁止 `apps/*` 直接依赖 `packages/*/src`、`agents/*/src` 或 `@agent/<pkg>/<subpath>`
- 禁止基础能力层反向依赖 `runtime` 或 `agents/*`

## 固定检查入口

包分层边界不是只靠代码评审约定，必须能被固定命令验证：

- `pnpm check:package-boundaries`
  - 扫描 app 与核心运行目录，阻止 `apps/*` 深层依赖 `packages/*/src`、`agents/*/src`
  - 阻止应用层把 `@agent/<pkg>/<subpath>` 当成稳定接口
  - 阻止 `@agent/<pkg>/src/*` 这类深层包导入
  - 对 `runtime / agents / backend / tools / skills` 的核心源码与测试，阻止继续从 `@agent/core/*`、`@agent/config/*`、`@agent/memory/*`、`@agent/adapters/*`、`@agent/tools/*` 等子路径导入
  - 阻止 `packages/core/package.json` 重新依赖 `@agent/*` 业务实现包
  - 阻止 `apps/backend` 与 `apps/worker` 源码或 package manifest 直接依赖 `@agent/agents-*`
  - 阻止 `apps/*` 直接从 `@agent/platform-runtime` import 主链装配 helper，要求应用层通过 facade / host adapter 消费官方默认装配
- `pnpm check:barrel-layout`
  - 扫描 `packages/*`、`agents/*`、`apps/*` 下命名目录的 `index.ts`
  - 阻止 `repositories / search / vector / embeddings / approval / watchdog / settings` 这类目录通过 `../` 回跳父级转发实现
  - 约束目录名与物理文件落位一致，避免再次出现“目录只有 barrel、实现还在父级”的假分层
- `pnpm check:architecture`
  - 聚合 `check:backend-structure`、`check:barrel-layout` 与 `check:package-boundaries`
  - 作为包分层治理的固定入口

## 放置规则

新增代码默认按以下规则落位：

- 跨端共享且稳定的数据结构：放 `core`
- 面向外部暴露的稳定 contract facade：放 `core`
- 运行时默认策略与配置：放 `config`
- 模型/provider/embedding 装配：放 `adapters`
- memory/rule/vector/cache 存取与搜索：放 `memory`
- executor/registry/sandbox/MCP：放 `tools`
- skill registry/manifest/source：放 `skill-runtime`
- report blueprint/scaffold/assembly/write：放 `report-kit`
- 模板资产、模板 manifest、模板 registry：放 `templates`
- 质量评测 contract、回归 runner、benchmark 基建：放 `evals`
- graph/flow/session/governance/runtime orchestration：放 `runtime` 或对应 `agents/*`

补充：

- “多个地方复用”不等于必须进入公共包
- “多个地方复用”也不等于必须进入 `core`
- 只有稳定、跨包、可长期演进的公共边界才进入 `core`
- 其他包参考 `core` 的重点是“先定义边界，再承载实现”，不是把所有实现都改造成 schema-only
- 宿主本地 compat / facade 不应因为复用而重新上提成新的 shared 包
- 带业务语义的 helper 不能因为复用而强行上提到公共契约层
- 如果一个 contract 需要同时被 runtime、backend、frontend、agents 中两个及以上消费，并且其语义不是“纯展示层”，默认就该继续迁到 `core`

## 按包定制的目标宿主与目录蓝图

下面这部分是对“其他包参考 `core` 治理方式，但不要照搬 `core` 目录形态”的进一步落地。

统一判断顺序固定为：

1. 先判断这个包最核心的主宿主是什么
2. 再围绕主宿主设计目录，而不是先套统一目录模板
3. 最后只补这个包真正需要的 `contracts/`、`schemas/`、`runtime/`、`registry/`、`policies/` 等目录

### `packages/adapters`

- 主宿主：
  - provider adapter
  - model factory
  - structured generation / retry / fallback
- 不应模仿 `core` 的点：
  - 它的重心不是 schema-first contract，而是“对外部模型能力做协议翻译与运行时装配”
  - `shared/` 与 `utils/` 可以存在，但不应继续承载 provider 主实现
- 推荐目标结构：

```text
packages/adapters/
  src/
    contracts/       # 外部可依赖的稳定 adapter 边界
    runtime/         # chat / embedding / provider factory
    providers/       # provider normalize、provider-specific adapter
    llm/             # 文本 / structured / stream adapter
    embeddings/      # embedding provider adapter
    prompts/         # adapter 级提示片段，如 JSON safety
    resilience/      # retry、fallback、reactive retry
    utils/           # 纯函数 helper
```

- 本包补充规则：
  - `prompts/` 比泛化 `shared/prompts` 更贴合真实职责
  - `resilience/` 比把 retry/fallback 都塞进 `utils/` 更利于后续继续扩展模型恢复策略

### `packages/config`

- 主宿主：
  - settings schema
  - profile defaults
  - policy defaults
  - config loading / normalization
- 不应模仿 `core` 的点：
  - 这里的“稳定边界”是配置读取与标准化边界，不是跨包业务 DTO 主定义
  - 不需要为了对齐模板把“loader”叫成 `runtime`
- 推荐目标结构：

```text
packages/config/
  src/
    contracts/       # settings facade、profile facade
    schemas/         # settings / flags / profile schema
    profiles/        # 平台 / 公司 / 个人 / CLI 预设
    policies/        # budget / source / approval / path 默认策略
    loaders/         # env resolver、settings loader、normalizer
    briefings/       # daily-tech-briefing 这类配置驱动生成
    shared/          # 默认值、字段映射、路径常量
    utils/           # 轻量解析 helper
```

- 本包补充规则：
  - `daily-tech-briefing.ts` 这类内容不应长期挂在 `runtime/` 名下，语义更接近 `briefings/` 或 `generated-defaults/`
  - `settings.ts` / `settings/index.ts` 可以继续保留为人工可读聚合入口，但不再作为真实宿主

### `packages/memory`

- 主宿主：
  - repository
  - search
  - vector index
  - memory governance / normalization
- 不应模仿 `core` 的点：
  - 这里的稳定边界主要是 repository/search facade，不是大量 schema-first 领域 contract
  - 不应把 repository 治理逻辑和运行时聚合逻辑混进 `shared/`
- 推荐目标结构：

```text
packages/memory/
  src/
    contracts/
    repositories/
    search/
    vector/
    embeddings/
    governance/      # scrub、retention、write policy、ingest policy
    normalization/   # memory record normalize、merge、sanitize
    runtime/         # 对 runtime 暴露的 memory facade
    utils/
```

- 本包补充规则：
  - 当前 `shared/memory-record-helpers.ts` 更适合下沉到 `normalization/`
  - `memory-repository-governance.ts` 已经说明 `governance/` 是真实存在的一级语义，不建议继续塞在 `repositories/`

### `packages/tools`

- 主宿主：
  - tool registry
  - tool definitions
  - tool executors
  - sandbox / approval / transport
- 不应模仿 `core` 的点：
  - 它不是 contract 包，而是工具平台内核
  - 目录应围绕“definition / executor / governance / transport”展开，而不是泛化成一层层 shared helper
- 推荐目标结构：

```text
packages/tools/
  src/
    contracts/
    registry/
    definitions/     # filesystem / connectors / scheduling / runtime-governance
    executors/
    approval/
    sandbox/
    transports/      # MCP / local / stdio / http transport
    scaffold/
    watchdog/
    utils/
```

- 本包补充规则：
  - `filesystem/`、`runtime-governance/`、`scheduling/` 这类现在既有 definition 又有 compat 文件，长期应被收敛为 `definitions/ + executors/`
  - `mcp/` 目录本质是 transport 与 capability 管理，不建议继续作为一个过大的混合目录增长
  - `packages/tools/test/data-report/*` 这类测试如果长期存在，说明报表能力边界已经外溢，应优先迁回 `report-kit`

### `packages/skill-runtime`

- 主宿主：
  - skill registry
  - source sync
  - install / receipt
  - trust / compatibility / availability policy
- 不应模仿 `core` 的点：
  - 这是运行时技能资产治理宿主，不是技能 DTO 的公共总库
  - 目录应围绕生命周期设计，而不是围绕纯 contract 分层
- 推荐目标结构：

```text
packages/skill-runtime/
  src/
    contracts/
    schemas/
    registry/
    catalog/         # skill catalog、listing、query facade
    sources/
    install/
    policies/
    runtime/
    utils/
```

- 本包补充规则：
  - 当前只有 `registry/` 与 `sources/`，后续最应该补的是 `catalog/` 与 `install/`
  - 如果后续继续增长，不建议把 catalog 能力继续堆进 `registry/skill-registry.ts`

### `packages/runtime`

- 主宿主：
  - graph orchestration
  - flow nodes
  - runtime lifecycle
  - session coordination
  - capability governance
- 不应模仿 `core` 的点：
  - 这是最大的执行宿主，应该按“主链分区”组织，而不是按“合同先行的小目录”组织
  - `contracts/` 在这里是 facade，不是主角
- 推荐目标结构：

```text
packages/runtime/
  src/
    contracts/
    graphs/          # main / chat / recovery / learning
    flows/           # approval / chat / learning / ministries
    orchestration/   # runtime pipeline、task orchestration、background jobs
    session/         # turns、compression、sync、thinking
    governance/      # worker、profile、routing、approval lifecycle
    capabilities/
    bridges/         # runtime 内部 agent dependency adapter
    memory/
    runtime/         # AgentRuntime、streaming execution、assembly facade
    utils/
```

- 本包补充规则：
  - `graphs/main/*` 与 `runtime/*` 当前都在承载编排语义，后续应收敛出单独 `orchestration/`
  - `runtime/agent-bridges/*` 语义比继续挂在 `runtime/` 下更接近 `bridges/`
  - `session/` 已经形成独立大域，后续不应再把会话逻辑塞回 `utils/` 或根级 helper

### `packages/evals`

- 主宿主：
  - regression suite
  - benchmark suite
  - quality gate
  - result/report schema
- 不应模仿 `core` 的点：
  - 它是质量证明与执行宿主，不是静态 contract 汇总包
  - 目录应该围绕“运行评测”和“产出结果”组织
- 推荐目标结构：

```text
packages/evals/
  src/
    contracts/
    schemas/
    regressions/     # prompt / output / contract regression
    benchmarks/
    quality-gates/
    reporting/
    runtime/
    utils/
```

- 本包补充规则：
  - 当前 `prompt-regression/` 可以继续存在，但长期更建议提升为 `regressions/`，为非 prompt 回归留出空间
  - `benchmarks.ts` 已经很重，后续若继续增长，应拆成 `suite/`、`runner/`、`reporting/`

### `packages/templates`

- 主宿主：
  - template assets
  - template manifest
  - template registry
- 不应模仿 `core` 的点：
  - 模板包本质是“资产仓”，不是 contract-only 包
  - 目录必须优先反映模板资产类型，而不是统一技术层名
- 推荐目标结构：

```text
packages/templates/
  src/
    contracts/
    schemas/
    registries/
    starters/        # react-ts 等工程起步模板
    scaffolds/       # package-lib、agent-basic 等脚手架模板
    reports/         # single-report-table、bonus-center-data 等报表模板
    shared/          # manifest、slot、公共素材
    utils/
```

- 本包补充规则：
  - 对当前仓库而言，`page-templates/` 过于泛化，`reports/` 更贴近真实资产类型
  - 模板内部自己的 `pages/`、`services/`、`types/` 应继续在模板根下闭包维护，不要为了统一而拆碎
  - `src/types.ts` 这类根级聚合文件如果只承担模板元数据聚合，应逐步迁入 `contracts/` 或 `shared/`

### `packages/report-kit`

- 主宿主：
  - deterministic blueprint
  - scaffold
  - assembly
  - file write / materialization
- 不应模仿 `core` 的点：
  - 它的核心不是“公共 contract”，而是“报表生成引擎”
  - 目录应围绕生成流水线阶段，而不是围绕统一技术模板
- 推荐目标结构：

```text
packages/report-kit/
  src/
    contracts/
    schemas/
    blueprints/
    scaffold/
    assembly/
    materialization/ # write、emit、preview-ready output
    naming/          # route、component、file、slot naming
    utils/
```

- 本包补充规则：
  - 当前 `writers/` 的语义更接近 `materialization/`
  - `data-report-ast-postprocess.ts` 已经表明这里还存在 assembly 后处理阶段，后续可以在 `assembly/` 下补 `postprocess/`
  - `report-kit` 应继续只负责确定性产物生成，不承接 `agents/data-report` 的 graph runtime

## 当前最明显的边界风险

下面这些现象说明“推荐结构”还没有完全转化为真实宿主边界，后续应优先收口：

- `packages/runtime`
  - 已存在多个 `365+` 行文件，且 `session/*`、`flows/*`、`graphs/main/*` 同时承载编排语义，说明需要继续按主链阶段拆分
- `packages/templates`
  - 模板资产体量远大于 registry 与 contract，说明这个包后续应该按资产类型治理，而不是继续在 `src/` 下平铺模板名
- `packages/tools`
  - 测试中仍覆盖 data-report 相关能力，提示工具平台与报表生成边界仍有重叠
- `packages/memory`
  - repository、governance、normalization 仍有混放，后续容易继续把治理逻辑误塞回 repository
- `packages/config`
  - `runtime/` 目录命名过宽，容易继续吸进不属于配置宿主的运行态逻辑

## 第一批执行清单

下面这份清单把“推荐结构”进一步收敛成可执行批次。默认采用：

1. 先补或固定测试
2. 再搬真实宿主
3. 最后删薄 compat / 聚合入口

### Wave 1: `packages/runtime`

- 目标：
  - 先把“主链编排”和“运行态 facade”分开
  - 再把 `agent-bridges` 从 `runtime/` 里剥出来
- 第一批要搬的文件：
  - `src/runtime/agent-bridges/*.ts` -> `src/bridges/`
  - `src/graphs/main/main-graph-runtime-modules.ts`
  - `src/graphs/main/main.graph.ts`
  - `src/runtime/agent-runtime.ts`
  - `src/runtime/streaming-execution.ts`
- 第一批要新建或补强的目录：
  - `src/orchestration/`
  - `src/bridges/`
- 第一批验证重点：
  - `packages/runtime/test/index.test.ts`
  - `packages/runtime/test/main-graph.test.ts`
  - `packages/runtime/test/runtime-agent-bridge-boundary.test.ts`
  - `packages/runtime/test/session-coordinator-helpers.test.ts`
  - `packages/runtime/test/model-routing-policy.test.ts`
- 第一批收口标准：
  - `runtime/agent-bridges/*` 不再作为真实宿主
  - 主链 orchestration 不再同时散落在 `graphs/main/*` 和 `runtime/*`

### Wave 2: `packages/tools`

- 目标：
  - 把 tool definition、executor、transport 三类语义拆清
  - 压缩旧目录中既放 definition 又放 compat 的混态
- 第一批要搬的文件：
  - `src/filesystem/filesystem-tool-definitions.ts` -> `src/definitions/filesystem-tool-definitions.ts`
  - `src/connectors/connector-tool-definitions.ts` -> `src/definitions/connector-tool-definitions.ts`
  - `src/runtime-governance/runtime-governance-tool-definitions.ts` -> `src/definitions/runtime-governance-tool-definitions.ts`
  - `src/scheduling/scheduling-tool-definitions.ts` -> `src/definitions/scheduling-tool-definitions.ts`
  - `src/mcp/mcp-http-transport.ts` -> `src/transports/mcp-http-transport.ts`
  - `src/mcp/mcp-local-adapter-transport.ts` -> `src/transports/mcp-local-adapter-transport.ts`
  - `src/mcp/mcp-stdio-transport.ts` -> `src/transports/mcp-stdio-transport.ts`
  - `src/mcp/mcp-transport-handlers.ts` -> `src/transports/mcp-transport-handlers.ts`
- 第一批要保留但删薄的 compat 入口：
  - `src/filesystem/*`
  - `src/connectors/*`
  - `src/runtime-governance/*`
  - `src/scheduling/*`
- 第一批验证重点：
  - `packages/tools/test/registry/tool-registry.test.ts`
  - `packages/tools/test/filesystem/filesystem-executor.test.ts`
  - `packages/tools/test/connectors/connectors-executor.test.ts`
  - `packages/tools/test/runtime-governance/runtime-governance-executor.test.ts`
  - `packages/tools/test/mcp/mcp-client-manager.stdio.test.ts`
  - `packages/tools/test/mcp/mcp-client-manager.local-http.test.ts`
- 第一批收口标准：
  - 新增 definition 不再落到旧平铺目录
  - transport 实现不再继续堆进 `mcp/`

### Wave 3: `packages/templates`

- 目标：
  - 先把模板资产按类型归类
  - 再收紧根级聚合文件
- 第一批要迁移的目录：
  - `src/react-ts` -> `src/starters/react-ts`
  - `src/scaffold/agent-basic` -> `src/scaffolds/agent-basic`
  - `src/scaffold/package-lib` -> `src/scaffolds/package-lib`
  - `src/single-report-table` -> `src/reports/single-report-table`
  - `src/bonus-center-data` -> `src/reports/bonus-center-data`
- 第一批要整理的文件：
  - `src/types.ts`
  - `src/contracts/template-definitions.ts`
  - `src/registries/frontend-template-registry.ts`
  - `src/registries/scaffold-template-registry.ts`
- 第一批验证重点：
  - `packages/templates/test/template-registry.test.ts`
  - `packages/templates/test/scaffold-template-registry.test.ts`
  - `packages/templates/test/root-exports.test.ts`
- 第一批收口标准：
  - `src/` 根下不再继续新增模板资产目录
  - registry 只负责索引与解析，不承接模板资产实现

### Wave 4: `packages/memory`

- 目标：
  - 把 repository、governance、normalization 分成独立宿主
  - 为后续 runtime facade 预留明确入口
- 第一批要搬的文件：
  - `src/shared/memory-record-helpers.ts` -> `src/normalization/memory-record-helpers.ts`
  - `src/repositories/memory-repository-governance.ts` -> `src/governance/memory-repository-governance.ts`
  - `src/search/memory-scrubber-service.ts` -> `src/governance/memory-scrubber-service.ts`
- 第一批要观察是否拆分的文件：
  - `src/repositories/memory-repository.ts`
  - `src/repositories/runtime-state-repository.ts`
  - `src/vector/vector-index-repository.ts`
- 第一批验证重点：
  - `packages/memory/test/memory-repository.test.ts`
  - `packages/memory/test/memory-governance-and-search.test.ts`
  - `packages/memory/test/memory-scrubber-service.test.ts`
  - `packages/memory/test/runtime-state-repository.test.ts`
  - `packages/memory/test/vector-index-repository.test.ts`
- 第一批收口标准：
  - `shared/` 不再承接 memory normalize 主实现
  - repository 不再兼任治理逻辑宿主

### Wave 5: `packages/config`

- 目标：
  - 收紧配置宿主语义，避免 `runtime/` 继续外溢
- 第一批要搬的文件：
  - `src/runtime/settings-loader.ts` -> `src/loaders/settings-loader.ts`
  - `src/runtime/settings-paths.ts` -> `src/loaders/settings-paths.ts`
  - `src/runtime/daily-tech-briefing.ts` -> `src/briefings/daily-tech-briefing.ts`
- 第一批验证重点：
  - `packages/config/test/settings.test.ts`
  - `packages/config/test/root-exports.test.ts`
- 第一批收口标准：
  - `runtime/` 不再作为配置默认宿主
  - `settings.ts` / `settings/index.ts` 仅保留聚合职责

### Wave 6: `packages/skill-runtime`

- 目标：
  - 把 registry、catalog、install、policy 拆成完整生命周期
- 第一批要新增的目录：
  - `src/catalog/`
  - `src/install/`
  - `src/policies/`
- 第一批要观察是否拆分的文件：
  - `src/registry/skill-registry.ts`
  - `src/sources/agent-skill-loader.ts`
- 第一批验证重点：
  - `packages/skill-runtime/test/agent-skill-loader.test.ts`
  - `packages/skill-runtime/test/root-exports.test.ts`
- 第一批收口标准：
  - catalog listing/query 不再继续堆进 `skill-registry.ts`

### Wave 7: `packages/evals`

- 目标：
  - 把 benchmark、regression、reporting、quality gate 分开
- 第一批要搬或新建的目录：
  - `src/prompt-regression/` -> `src/regressions/`
  - 新建 `src/reporting/`
  - 新建 `src/quality-gates/`
- 第一批要观察是否拆分的文件：
  - `src/benchmarks/benchmarks.ts`
- 第一批验证重点：
  - `packages/evals/test/benchmarks.test.ts`
  - `packages/evals/test/prompt-regression.test.ts`
  - `packages/evals/test/root-exports.test.ts`

### Wave 8: `packages/report-kit`

- 目标：
  - 把 write 阶段收紧为 materialization 语义
  - 明确 naming/postprocess 是 assembly 邻域，而不是散 helper
- 第一批要搬的文件：
  - `src/writers/data-report-write.ts` -> `src/materialization/data-report-write.ts`
- 第一批要新增的目录：
  - `src/naming/`
- 第一批要观察是否拆分的文件：
  - `src/assembly/data-report-assembly.ts`
  - `src/assembly/data-report-ast-postprocess.ts`
- 第一批验证重点：
  - `packages/report-kit/test/data-report-blueprint.test.ts`
  - `packages/report-kit/test/root-exports.test.ts`

### Wave 9: `packages/adapters`

- 目标：
  - 把 prompt / retry / fallback 从泛化 helper 收敛成明确宿主
- 第一批要搬的文件：
  - `src/shared/prompts/json-safety-prompt.ts` -> `src/prompts/json-safety-prompt.ts`
  - `src/utils/llm-retry.ts` -> `src/resilience/llm-retry.ts`
  - `src/utils/retry.ts` -> `src/resilience/retry.ts`
  - `src/utils/reactive-context-retry.ts` -> `src/resilience/reactive-context-retry.ts`
  - `src/utils/model-fallback.ts` -> `src/resilience/model-fallback.ts`
- 第一批验证重点：
  - `packages/adapters/test/runtime-provider-factory.test.ts`
  - `packages/adapters/test/chat-and-embedding-factory.test.ts`
  - `packages/adapters/test/safe-generate-object.test.ts`
  - `packages/adapters/test/root-exports.test.ts`

## 执行时的固定停止条件

每个 wave 完成前，默认至少满足下面四个条件：

1. 新宿主目录已经成为真实实现入口
2. 旧路径如果保留，只剩 compat / 聚合职责
3. 根出口未破坏
4. 对应包测试与文档已同步更新

## 本轮优先收敛包

当前优先按“先补文档、后搬源码”的顺序，收敛以下几个结构仍偏扁平的包：

1. `packages/config`
2. `packages/skill-runtime`
3. `packages/templates`
4. `packages/report-kit`
5. `packages/evals`

这几个包当前都需要先建立：

- 明确职责声明
- 推荐目录结构
- 允许 / 禁止内容清单
- 与 `core` 不同但同样稳定的公开边界

## 当前重点迁移方向

优先顺序：

1. `shared`

- runtime center / tasking / knowledge / connector & governance 展示 contract

2. `adapters`

- provider normalize
- chat / embedding factory
- embedding factory
- fallback candidate 基础逻辑

3. `tools`

- `packages/report-kit` 已承接 data-report 真实实现
- `src/data-report/*`、`approval/*`、`mcp/*`、`sandbox/*`、`registry/*` 等目录作为包内组织结构保留
- 所有消费侧统一只从 `@agent/tools` 根入口导入
- 新增实现不得绕过根入口重新引入新的公开子路径

4. `runtime / agents/*`

- 将跨 flow 的 LLM 基础能力集中在单一区域
- `src/shared` 只保留带领域语义的跨 flow 能力
- `src/utils` 只保留纯函数工具

## 当前仍待继续收口的点

下面这些不算阻塞，但还没有完全做到“最终形态”：

- `packages/memory` 的内部目录分层仍然存在，但对外已经统一改为根入口消费
- `packages/tools` 仍保留较多内部目录分层，后续如继续膨胀可再整理内部文件布局，但对外仍维持根入口消费
- `packages/config`、`packages/skill-runtime`、`packages/templates`、`packages/report-kit`、`packages/evals` 当前已先定义推荐终态结构，但源码目录仍未完全收敛到该结构
- `agent-admin` / `agent-chat` 仍有部分本地 UI 类型包装，后续可继续按 `@agent/core + 本地 facade` 收口

## 禁止项

以下行为默认禁止：

- 把“多个地方都要用”的业务逻辑直接塞进新的公共包壳
- 在 app 层重复定义本该属于 `core` 或宿主本地 facade 的 contract
- 在 backend controller/service 内联 agent prompt、结构化输出 parse、graph 主链编排
- 在 `tools` 中新增 ministry/graph/review/research 编排逻辑
- 跨包深层 import，例如 `@agent/<pkg>/src/*`
- 让 `tools / model / memory / skill-runtime` 反向依赖 `runtime` 或 `agents/*`
