# 当前 core 包规范

状态：current
文档类型：convention
适用范围：`packages/core`
最后核对：2026-04-18

本规范是在仓库既有架构约束基础上，吸收外部 `core` 设计文档后形成的项目级执行标准。目标不是再写一份抽象原则，而是把以后该怎么落位、哪些必须合并、哪些必须留在 `shared` 的规则写成可以直接执行的规范。

## 1. 核心定位

`packages/core` 是本仓库的稳定契约层（Stable Contract Layer）。

它的唯一目标是为 `apps/*`、`packages/*`、`agents/*` 提供一份统一、可校验、可演进的公共语言，解决的是：

- 跨包共享的数据结构长什么样
- 这些结构如何被 schema 显式约束
- 包与包之间通过什么接口协作
- 长流程里的阶段、审批、中断、恢复、交付如何形成稳定协议
- 调用方应该依赖什么 contract，而不是依赖谁的内部实现

`core` 不是：

- 业务实现层
- graph / flow / runtime 编排层
- provider / SDK 接入层
- “任何共用代码都可以塞进来”的公共杂物层

## 2. 硬规则

以后凡是进入 `packages/core` 的新增或修改内容，默认同时满足以下规则：

1. `core` 是稳定主 contract 的唯一宿主。
2. 只要某个 contract 同时满足“跨包复用 + 语义稳定 + 非纯展示层”，主定义必须在 `core`。
3. 稳定 JSON / DTO / event / payload / snapshot / error contract 默认必须 `schema-first`。
4. 类型默认通过 `z.infer<typeof Schema>` 推导，不再长期维护平行手写 `interface/type` 主定义。
5. `core` 只定义 contract、schema、interface、错误语义和确定性 helper，不承载执行逻辑。
6. 所有对外暴露都统一经由 `packages/core/src/index.ts`。
7. 调用方禁止把 `packages/core/src/*` 当公共 API 深层依赖。

## 3. core 负责什么

### 3.1 稳定共享数据模型

应优先进入 `core` 的内容：

- `TaskRecord`
- `ChatCheckpointRecord`
- `ChatSessionRecord`
- `ChatMessageRecord`
- `ChatEventRecord`
- `ExecutionTrace`
- `ApprovalRecord`
- `McpCapability`
- `ConnectorHealthRecord`
- `QueueStateRecord`
- `LlmUsageRecord`
- `EvidenceRecord`
- `MemoryRecord`
- `RuleRecord`
- `SkillCard`
- `SkillSearchStateRecord`
- `BudgetState`
- `LearningEvaluationRecord`
- workflow / delivery / platform console / checkpoint / tasking 等稳定协议 DTO

不应进入 `core` 的内容：

- 某个 flow 内部临时 state patch
- 某个页面专用 view model
- 某个 service/repository 的内部返回结构
- 仅供单模块内部消费的 helper 类型

### 3.2 Schema-first 结构约束

稳定公共 contract 的默认模板固定为：

1. 领域目录下的 `schemas/*` 定义 schema
2. 同域 `types/*` 用 `z.infer` 导出类型
3. `index.ts` 暴露公共入口

规则补充：

- 只要是稳定 JSON-safe 结构，就不要只保留裸 `interface/type`
- `types/*` 默认只放 infer 结果、少量 barrel 与必要别名
- `types/*` 不再反向 re-export `contracts/*`；非 schema-first 技术契约统一由 `contracts/*` 与根 `index.ts` 暴露
- schema、值常量、枚举主定义优先放在各领域目录下的 `schemas/*`
- 无法 schema-first 的技术契约，应进入 `contracts/*` 或 `providers/*`

### 3.3 跨包能力接口

适合进入 `core` 的接口：

- LLM provider / embedding provider / tool provider interface
- facade / adapter contract
- 检索、生成、结构化输出的抽象接口
- pipeline 输入输出 contract

不适合进入 `core` 的内容：

- OpenAI / Anthropic / MCP / browser / sandbox / filesystem 的具体实现
- SDK option 拼装
- transport / executor / registry 细节

### 3.4 流程级协议抽象

适合进入 `core` 的流程抽象：

- stage / phase / route enum
- interrupt / recover payload
- checkpoint / delivery / trace envelope
- graph 与 runtime 共享的稳定 state 片段
- SSE payload、审批协议、恢复协议

不适合进入 `core` 的内容：

- graph wiring
- node 实现
- flow 编排
- retry loop
- 实际调用工具、模型、文件系统的逻辑

### 3.5 错误与治理语义

`core` 可以承载：

- 错误码
- 错误分类
- 是否可重试
- 是否需要审批
- 是否可恢复
- 风险、治理、审查相关的结构化字段

但不负责错误处理实现。

## 4. 与 shared 的边界

### 4.1 必须继续并入 core 的内容

下面这类 contract，以后默认继续向 `core` 收口，不允许在 `shared` 长期双主定义：

- `tasking-planning`
- `tasking-orchestration`
- `tasking-chat`
- `tasking-runtime-state`
- `tasking-session`
- `tasking-checkpoint`
- `tasking-task-record`
- `tasking-thought-graph`
- `governance` 中稳定 policy / connector health / capability 主 contract
- `connectors` 中稳定摘要与能力记录
- `execution-trace`
- `skills-search` 的主状态、外围 DTO、connector discovery / install/search DTO
- `knowledge-runtime` 中稳定 runtime contract
- `platform-console` 的稳定主 contract
- `channels`、`delivery`、`workflow-route`、`architecture-records` 这类跨端稳定协议

### 4.2 应保留在 shared 的内容

下面这类内容可以继续留在 `shared`，但定位必须明确为 compat / facade / 展示组合层：

- `runtime-centers*`
- `console-centers*`
- `skills-sources`
- `skills-capabilities` 中面向 UI/治理的组合类型
- `tasking-chat.ts`、`tasking-task-record.ts` 中仍然存在真实 widening 的 overlay
- `primitives.ts` 中仍承担 shared-facing widening 的字段
- 默认泛型参数包装
- 展示友好的 label / normalize / formatter 纯函数

判断标准：

- `core` 解决“边界是什么”
- 历史上的 `shared` 解决“这些边界如何被更方便地消费”；当前这层职责应落到真实宿主本地 facade/compat

如果某个宿主本地 compat/facade 文件已经不再承担 widening、默认组合或 compat 职责，就不应继续保留。

### 4.3 shared 历史退场分类

在 `packages/shared` 退场过程中，剩余实现只允许落在下面四类之一：

- `overlay`
  - 依赖 runtime 扩展字段、默认泛型、shared-facing widening 的类型
- `consumption facade`
  - 面向 frontend / admin / runtime console 的组合记录、展示友好结构、默认包装
- `helper reclaim`
  - 迁移中的 workflow / prompt / bootstrap helper 过渡出口；终态必须回真实宿主
- `compat`
  - 已迁入 `core` 或真实宿主后的 alias / re-export

如果某段 shared 内容无法归入这四类，默认视为落位错误，应继续迁出。

补充硬规则：

- `helper / workflow / prompt / bootstrap registry` 永不进入 `packages/core`
- 这类实现也不应长期留在 `packages/shared`
- 它们的唯一主宿主必须是对应真实业务包，例如：
  - `agents/supervisor` 持有 workflow routing / preset / specialist / research planning / execution steps
  - `packages/runtime` 持有 runtime prompt helper，例如 `temporal-context`
  - `packages/skill-runtime` 只持有技能加载、注册、执行逻辑，不持有预置 bootstrap 技能主定义
- `packages/shared` 对这类能力最多只保留 compat re-export，不能再承载第二份实现

## 5. 推荐目录结构

为了兼顾“当前已有实现”与“后续可持续收敛”，`core` 目录默认按“领域目录 + 技术目录”理解：

- 当前执行结构：`contracts / providers / memory + domain folders`
- 目标收敛结构：继续让稳定 schema/type 落在真实领域目录中，避免重新长出第二层伪共享目录

### 5.1 当前可执行结构

```text
packages/core/
  src/
    contracts/     # 非 JSON-safe 的稳定技术契约
    providers/     # provider interface 与 provider shared contract
    memory/        # memory 领域稳定 schema
    <domain>/      # 各稳定 contract 的真实 schema/type/helper 宿主
    index.ts       # 唯一公共出口
```

### 5.2 目标收敛结构

后续如果继续演进，推荐按领域进一步拆为：

```text
packages/core/
  src/
    review/
      schemas/
        specialist-finding.schema.ts
        critique-result.schema.ts
      helpers/
        specialist-finding.ts
        critique-result.ts
    governance/
      schemas/
        governance.schema.ts
      types/
        governance.types.ts
      helpers/
        matchers.ts
    knowledge/
      schemas/
        knowledge-runtime.schema.ts
      types/
        knowledge-runtime.types.ts
      helpers/
        evidence.ts
    channels/
      schemas/
        channels.schema.ts
      types/
        channels.types.ts
    connectors/
      schemas/
        connectors.schema.ts
      types/
        connectors.types.ts
    workflow-route/
      schemas/
        workflow-route.schema.ts
      types/
        workflow-route.types.ts
    delivery/
      schemas/
        delivery.schema.ts
      types/
        delivery.types.ts
    execution-trace/
      schemas/
        execution-trace.schema.ts
      types/
        execution-trace.types.ts
    skills-search/
      schemas/
        skills-search.schema.ts
      types/
        skills-search.types.ts
    platform-console/
      schemas/
        platform-console.schema.ts
      types/
        platform-console.types.ts
    architecture/
      schemas/
        architecture-records.schema.ts
      types/
        architecture-records.types.ts
    tasking/
      schemas/
        planning.ts
        orchestration.ts
        chat.ts
        runtime-state.ts
        session.ts
        checkpoint.ts
        task-record.ts
        thought-graph.ts
        tasking.ts
      types/
        *.ts
    data-report/
      schemas/
        data-report.ts
        data-report-json.ts
        data-report-json-schema.ts
      types/
        *.ts
    contracts/
      chat/
        index.ts
      ministries/
        index.ts
      execution/
        index.ts
      architecture/
        index.ts
      platform-console/
        index.ts
      data-report/
        index.ts
      approval/
        index.ts
        pending-execution-context.ts
    providers/
      llm-provider.interface.ts
      embedding-provider.interface.ts
      tool-provider.interface.ts
      provider.types.ts
    memory/
      schemas/
        *.schema.ts
    primitives/
      schemas/
        primitives.schema.ts
      types/
        primitives.types.ts
    index.ts
```

这版结构的核心思想是：

- schema 与类型都优先落在真实领域目录，而不是先落到根级 `spec/*`
- `types/*` 仅保留少量兼容入口与历史过渡 alias，避免再次出现“schema 在一处、类型在另一处且难以对齐”
- `contracts/*` 只承载技术契约，不与 schema-first DTO 混放
- `contracts/*` 优先通过领域聚合入口暴露，例如 `contracts/ministries/index.ts`、`contracts/chat/index.ts`、`contracts/approval/index.ts`
- `contracts/approval/*`、`contracts/execution/*`
  - 默认承接审批恢复、批准执行等非 JSON-safe 技术契约，不要把这类 interface 再塞回 domain `types/*`
- `tasking`、`data-report` 当前已采用独立 top-level domain folder，内部再分 `schemas / types`
- `skills` 当前也采用独立 top-level domain folder，内部再分 `schemas / types`
- `review` 当前采用独立 domain folder，内部再分 `schemas / helpers`
- `governance`、`knowledge` 当前采用独立 domain folder，内部再分 `schemas / types / helpers`
- `channels`、`connectors`、`workflow-route`、`delivery`、`execution-trace`、`skills-search`、`platform-console`、`architecture` 当前采用独立 domain folder，内部再分 `schemas / types`
- `primitives` 当前也采用独立 domain folder，内部再分 `schemas / types`
- 旧 `spec/*` compat 入口已删除；当前只保留必要的 `types/*` 与 `contracts/*` compat 入口

## 6. 当前目录的职责边界

### 领域目录下的 `schemas/`

只放：

- `zod schema`
- schema 组合
- schema 常量
- 枚举主定义和值常量

不放：

- interface
- helper 函数
- provider contract
- 执行逻辑

### `types/`

只放：

- `z.infer<typeof Schema>`
- 少量 barrel
- 极少量兼容 alias

补充约束：

- 不再通过 `types/*` 反向暴露 `contracts/*`
- 调用方如需 graph handler、registry entry、generate input 这类技术契约，应直接走 `contracts/*` 的根入口导出

不放：

- schema
- helper
- 业务函数
- 大量手写 interface 主定义

### `contracts/`

只放无法或不适合 schema-first 的稳定技术契约，例如：

- graph handlers
- callback members
- 泛型组合容器
- 非 JSON-safe contract

### `providers/`

只放 provider interface、provider shared type，不放任何 provider 实现。

当前真实宿主包括：

- `providers/provider.types.ts`
  - `ProviderBudgetState`、`ProviderUsage`、`ProviderHealthSnapshot`
- `providers/llm-provider.interface.ts`
  - `ILLMProvider` 及其消息 / 角色 / model info / options contract
- `providers/embedding-provider.interface.ts`
  - `IEmbeddingProvider`
- `providers/tool-provider.interface.ts`
  - `IToolProvider`

### 领域目录下的辅助逻辑

确定性、纯函数式、与稳定 contract 紧密耦合的辅助逻辑，优先贴着所属 domain folder 落位，例如：

- `governance/helpers/matchers.ts`
- `knowledge/helpers/evidence.ts`
- `review/helpers/*`

不再新增泛化的 `helpers/` 目录。

### `memory/`

用于承载 memory 领域稳定 schema。只要是共享记忆记录的结构约束，允许留在 `core`；如果是 repository/search/service 行为，应留在 `packages/memory`。

## 7. 当前建议继续合并/优化的点

### 7.1 目录与命名优化

- `src/review/*`
  - 已成为 review contract 的真实物理宿主；旧 `src/spec/review/*` 已删除
- `src/governance/*`
  - 已成为治理 contract 与 matcher helper 的真实物理宿主；旧平铺 `src/spec/types` 入口已删除
- `src/knowledge/*`
  - 已成为 knowledge runtime contract 与 evidence helper 的真实物理宿主；旧平铺 `src/spec/types` 入口已删除
- `src/channels/*`
  - 已成为跨端 DTO 的真实物理宿主；旧平铺 `src/spec/types` 入口已删除
- `src/connectors/*`
  - 已成为 connector summary / usage contract 的真实物理宿主；旧平铺 `src/spec/types` 入口已删除
- `src/workflow-route/*`
  - 已成为 routing contract 的真实物理宿主；旧平铺 `src/spec/types` 入口已删除
- `src/delivery/*`
  - 已成为 citation / source summary contract 的真实物理宿主；旧平铺 `src/spec/types` 入口已删除
- `src/execution-trace/*`
  - 已成为 trace contract 的真实物理宿主；旧平铺 `src/spec/types` 入口已删除
- `src/skills-search/*`
  - 已成为 skills search / connector configure DTO 的真实物理宿主；旧平铺 `src/spec/types` 入口已删除
- `src/platform-console/*`
  - 已成为 platform approval schema 的真实物理宿主；旧平铺 `src/spec/types` 入口已删除
- `src/architecture/*`
  - 已成为 architecture descriptor / diagram schema 的真实物理宿主；旧平铺 `src/spec/types` 入口已删除
- `src/skills/*`
  - 已成为 skills contract 的真实物理宿主，内部按 `schemas / types` 分层；旧平铺 `src/spec/types` 入口已删除
- `src/primitives/*`
  - 已成为基础枚举与 workflow primitive contract 的真实物理宿主；旧平铺 `src/spec/types` 入口已删除
- `src/contracts/approval/pending-execution-context.ts`
  - 已作为稳定审批技术契约收敛到 `contracts/approval/*`
- `src/tasking/*`
  - 已成为 tasking planning / orchestration / checkpoint / task record / thought graph 的真实物理宿主；旧平铺 `src/spec/types` 入口已删除
- `src/data-report/*`
  - 已成为 data-report contract 的真实物理宿主；旧平铺 `src/spec/types` 入口已删除

### 7.1.1 Compat Entrypoints

顶层平铺 compat 入口已经删除；当前默认不再为 `types/*.ts`、`spec/*.ts` 或平铺 `contracts/*.ts` 保留第二套公共路径。

当前约束是：

- 新增调用方默认优先引用根入口或真实领域目录
- `packages/core/src` 内部源码不得重新引入任何平铺 compat 入口
- `packages/core/test/core-compat-boundary.test.ts` 已作为自动化 guardrail 存在；新增内部源码如果重新依赖已删除的 compat 路径，应视为回归而不是可接受例外
- 根入口 `src/index.ts` 对已经完成物理迁移的子域，应直接 re-export 真实 domain host

### 7.2 依赖优化

- `@agent/core` 作为稳定契约层，应持续减少对高层包的依赖
- `packages/core/package.json` 不应反向依赖已退场的 compat 包；如出现类似依赖，应优先清理，避免 contract 层对实现层形成反向耦合
- `types/* -> contracts/*` 的反向 re-export 也应视为层次反耦合；稳定 contract 应由 `contracts/*` 直接对外暴露，而不是借道 `types/*`
- domain folder 内的 `types/*` 也必须直接依赖同域 `schemas/*`，不要再通过 compat 平铺入口绕一层

### 7.3 文档与执行优化

- 新增稳定 contract 时，默认同时更新 `docs/packages/core/*`
- 如果某个宿主本地 facade 已经不再承担真实 widening，要同步删文档里的“兼容保留”说明
- 评审时优先检查“主 contract 是否进了 core”，而不是只检查“有没有复用”

## 8. 以后新增内容如何判断落位

新增一个结构时，按下面顺序判断：

1. 它是不是跨包稳定 contract？
2. 它是不是调用方应该依赖的公共边界？
3. 它是不是 JSON-safe 且值得 schema 显式校验？
4. 它是不是不应耦合具体实现？

如果以上大多为“是”，优先进入 `core`。

如果它满足以下任一条件，就不要进 `core`：

- 只在一个模块里使用
- 明显绑定 graph/flow/runtime 节点
- 含副作用
- 明显是 view model、service DTO、repository 私有结构
- 只是“多个地方都能复用”的业务 helper

## 9. 修改后的最小检查清单

只要本轮触达 `packages/core` 相关代码或规范，默认至少检查：

1. 主 contract 是否只保留一份宿主
2. 是否遵守 schema-first
3. `types/*` 是否仍然只承担 infer/alias
4. shared 是否只剩 compat / widening / 组合职责
5. 文档是否同步更新到 `docs/packages/core/` 与关联规范

本规范从现在开始作为 `packages/core` 的执行主文档。后续新增能力、迁移 shared、设计 DTO 与接口时，优先按这份规范判断，而不是回退到“哪里方便先放哪里”。
