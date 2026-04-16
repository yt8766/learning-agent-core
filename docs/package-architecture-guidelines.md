# Packages 分层与依赖约定

状态：current
文档类型：convention
适用范围：packages 分层规范
最后核对：2026-04-16

`packages/*` 不是普通公共代码堆放区，而是平台架构边界。所有新增代码都必须先判断其职责归属，再决定进入哪个包。

## 分层模型

默认按四层理解 `packages/*`：

1. 契约层

- `packages/core`
- `packages/shared`
- `packages/config`

2. 平台基础能力层

- `packages/runtime`
- `packages/adapters`
- `packages/model`
- `packages/memory`
- `packages/tools`
- `packages/skill-runtime`

3. Agent 编排层

- `agents/supervisor`
- `agents/data-report`
- `agents/coder`
- `agents/reviewer`

4. 质量与资产层

- `packages/evals`
- `packages/templates`

迁移兼容说明：

- `packages/shared`、`packages/model` 目前仍保留部分迁移期兼容实现
- 已删除的 `packages/agent-core` 历史说明统一保留在 `docs/archive/agent-core/`
- 新消费侧优先改用 `@agent/runtime`、`@agent/adapters` 与对应 `agents/*` 公开入口

## 每个包允许放什么

### `packages/shared`

- 允许：DTO、Record、Enum、跨端 contract、展示型 schema、label/normalize 纯函数
- 禁止：LLM、prompt、retry、service、graph、node、executor、repository、副作用逻辑
- 补充：
  - `packages/shared` 不再作为稳定主 contract 的长期宿主；一旦某个 contract 与 `packages/core` 职责相同、或已经被 apps/runtime/backend/agents 作为公共边界复用，必须继续迁到 `packages/core`
  - 判定标准：如果同一个 contract 同时满足“跨包复用、稳定协议、不是纯展示拼装”，就不应继续留在 `packages/shared` 作为主定义
  - `platform-console` 这类“稳定泛型主 contract + 前端默认类型参数”的场景，优先把主 contract 放进 `packages/core`，`packages/shared` 只保留默认类型组合与兼容 re-export
  - `governance` 这类仍带前端默认约束和本地窄化枚举的展示 contract，可以继续留在 `packages/shared`，但稳定的 match-key、policy、connector health、MCP capability 主 contract 应优先收口到 `packages/core`
  - `tasking`、`knowledge` 这类容易继续膨胀的共享 contract，必须按子域拆成 barrel；`packages/shared/src/types/tasking.ts`、`knowledge.ts` 只能做 re-export，不再回退成单文件巨型类型集
  - `knowledge` 中像 `ExecutionTrace`、`EvidenceRecord`、`MemoryRecord`、`RuleRecord` 这类跨 runtime / backend / frontends 复用的主 contract，应优先放入 `packages/core`；`packages/shared` 只保留展示默认组合与 compat re-export
  - 超过 400 行的展示 contract 文件必须拆分成按域组织的 barrel，不再继续堆成单文件

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

### `packages/config`

- 允许：profile、settings schema、feature flags、storage/path policy、budget/source policy 默认值
- 禁止：业务流程、graph、flow、工具执行逻辑

### `packages/model`

- 允许：provider normalize、chat/embedding factory、fallback candidate、provider metadata
- 禁止：flow-specific prompt、业务 heuristic、graph/flow 编排

### `packages/memory`

- 允许：memory/rule/runtime-state repository、vector index、semantic cache、search contract
- 禁止：agent 主链编排、delivery/review/research 流程控制

### `packages/tools`

- 允许：tool registry、tool definition、sandbox executor、filesystem executor、approval preflight、MCP transport
- 禁止：agent orchestration、chat/review/research prompt、graph/ministry 主逻辑

### `packages/skill-runtime`

- 允许：运行时 skill registry、skill manifest loader、skill source sync 基础能力
- 禁止：仓库级 `skills/*` 代理技能文档、agent graph 逻辑

### `packages/runtime`

- 允许：graphs、flows、runtime orchestration、session、governance、主链 shared utils / capabilities
- 禁止：app controller/view model、前端展示专属 DTO、长期散落的 provider 细节

### `packages/evals`

- 允许：评测、回归、benchmarks、prompt 质量基建
- 禁止：运行时主链依赖逻辑

### `packages/templates`

- 允许：模板资产、模板元数据、模板 schema
- 禁止：运行时调度逻辑、工具执行逻辑、agent flow

## 依赖方向

必须满足：

- `shared` 不得依赖任何业务包
- `config` 不得依赖 `runtime` 或任意 `agents/*`
- `model / memory / tools / skill-runtime` 只允许依赖 `shared`、`config` 和必要第三方库
- `runtime` 可以依赖 `shared / config / core / model / memory / tools / skill-runtime`
- `agents/*` 可以依赖 `shared / config / core / adapters / runtime / memory / tools / skill-runtime`
- `apps/*` 只能依赖各包公开入口
- 禁止 `apps/*` 直接依赖 `packages/*/src`
- 禁止基础能力层反向依赖 `runtime` 或 `agents/*`

## 固定检查入口

包分层边界不是只靠代码评审约定，必须能被固定命令验证：

- `pnpm check:package-boundaries`
  - 扫描 app 与核心运行目录，阻止 `apps/*` 深层依赖 `packages/*/src`
  - 阻止 `@agent/<pkg>/src/*` 这类深层包导入
  - 对 `runtime / agents / backend / tools / skills` 的核心源码与测试，阻止继续从 `@agent/config/*`、`@agent/memory/*`、`@agent/model/*`、`@agent/tools/*` 这类子路径导入
- `pnpm check:barrel-layout`
  - 扫描 `packages/*`、`agents/*`、`apps/*` 下命名目录的 `index.ts`
  - 阻止 `repositories / search / vector / embeddings / approval / watchdog / settings` 这类目录通过 `../` 回跳父级转发实现
  - 约束目录名与物理文件落位一致，避免再次出现“目录只有 barrel、实现还在父级”的假分层
- `pnpm check:architecture`
  - 聚合 `check:backend-structure`、`check:barrel-layout` 与 `check:package-boundaries`
  - 作为包分层治理的固定入口

## 放置规则

新增代码默认按以下规则落位：

- 跨端共享的数据结构：放 `shared`
- 面向外部暴露的稳定 contract facade：放 `core`
- 运行时默认策略与配置：放 `config`
- 模型/provider/embedding 装配：放 `model`
- memory/rule/vector/cache 存取与搜索：放 `memory`
- executor/registry/sandbox/MCP：放 `tools`
- skill registry/manifest/source：放 `skill-runtime`
- graph/flow/session/governance/agent runtime：放 `agent-core`

补充：

- “多个地方复用”不等于必须进入 `shared`
- “多个地方复用”也不等于必须进入 `core`
- 只有稳定、跨包、可长期演进的公共边界才进入 `core`
- `shared` 不再承载与 `core` 职责相同的稳定主 contract
- 只有展示组合、前端默认参数、compat re-export 这类内容才应该继续留在 `shared`
- 带业务语义的 helper 不能因为复用而强行上提到 `shared`
- 如果一个 contract 需要同时被 runtime、backend、frontend、agents 中两个及以上消费，并且其语义不是“纯展示层”，默认就该继续迁到 `core`

## 当前重点迁移方向

优先顺序：

1. `shared`

- runtime center / tasking / knowledge / connector & governance 展示 contract

2. `model`

- provider normalize
- chat / embedding factory
- fallback candidate 基础逻辑

3. `tools`

- `packages/report-kit` 已承接 data-report 真实实现
- `src/data-report/*`、`approval/*`、`mcp/*`、`sandbox/*`、`registry/*` 等目录作为包内组织结构保留
- 所有消费侧统一只从 `@agent/tools` 根入口导入
- 新增实现不得绕过根入口重新引入新的公开子路径

4. `agent-core`

- 将跨 flow 的 LLM 基础能力集中在单一区域
- `src/shared` 只保留带领域语义的跨 flow 能力
- `src/utils` 只保留纯函数工具

## 当前仍待继续收口的点

下面这些不算阻塞，但还没有完全做到“最终形态”：

- `packages/memory`、`packages/model` 的内部目录分层仍然存在，但对外已经统一改为根入口消费
- `packages/tools` 仍保留较多内部目录分层，后续如继续膨胀可再整理内部文件布局，但对外仍维持根入口消费
- `agent-admin` / `agent-chat` 仍有部分本地 UI 类型包装，后续可继续向 `@agent/shared` 收口

## 禁止项

以下行为默认禁止：

- 把“多个地方都要用”的业务逻辑直接塞进 `shared`
- 在 app 层重复定义本该属于 `shared` 的 contract
- 在 backend controller/service 内联 agent prompt、结构化输出 parse、graph 主链编排
- 在 `tools` 中新增 ministry/graph/review/research 编排逻辑
- 跨包深层 import，例如 `@agent/<pkg>/src/*`
- 让 `tools / model / memory / skills` 反向依赖 `agent-core`
