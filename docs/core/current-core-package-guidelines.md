# 当前 core 包规范

状态：current
文档类型：convention
适用范围：`packages/core`
最后核对：2026-04-17

本规范用于约束当前仓库中的 `packages/core` 应该放什么、不该放什么，以及它与 `shared / runtime / tools / agents/*` 的边界。

补充要求：

- `core` 默认优先采用 `spec/ + types/ + contracts/ + helpers/` 结构。
- `spec/`
  - 只放 `zod schema`、schema 组合、必要的 schema 常量。
- `types/`
  - 默认只放 `z.infer<typeof Schema>` 类型别名。
  - 不应继续放 `Schema`、`interface`、`function`。
  - 允许少量明确标注的 compat value export 或泛型组合容器继续存在，但这类例外应尽量集中在少数文件中，而不是重新扩散到各个 tasking 子域。
- `helpers/` 或 `utils/`
  - 放 `build*`、`match*`、`normalize*` 这类确定性逻辑。
- `providers/` / `contracts/`
  - 放无法直接用 schema-first 表达的稳定接口，例如 provider / adapter interface。
  - `contracts/` 当前也承接 `data-report*`、`architecture-records` 中带回调、provider、graph handler 或函数成员的技术契约。

## 1. 包定位

`packages/core` 是本仓库的稳定契约层（Stable Contract Layer）。

它负责定义跨包共享的公共语言，回答的是：

- 数据结构长什么样
- 如何校验这些结构
- 包与包之间通过什么接口协作
- 长流程中的审批、中断、恢复、阶段状态如何被结构化表达
- 错误、治理、消息、checkpoint、tasking 等领域对象如何形成稳定边界

`core` 不是业务实现层，不是 graph/runtime 编排层，也不是工具执行层。

## 2. 核心职责

### 2.1 稳定共享数据模型

`core` 负责维护跨包复用且语义稳定的主 contract，包括但不限于：

- `TaskRecord`
- `ChatCheckpointRecord`
- `ChatSessionRecord`
- `ChatMessageRecord`
- `ChatEventRecord`
- `AgentExecutionState`
- `SkillCard`
- `EvidenceRecord`
- `MemoryRecord`
- `RuleRecord`
- `McpCapability`
- `ApprovalRecord`
- `QueueStateRecord`
- `LlmUsageRecord`
- `ConnectorHealthRecord`
- `ExecutionTrace`
- `DataReportBlueprintResult`
- 与 tasking / checkpoint / governance / delivery / connectors / platform console 相关的稳定 DTO、Record、payload

固定规则：

1. 只放跨包稳定复用的数据模型。
2. 不放局部实现细节。
3. 不允许在其他包重复定义同语义主 contract。

### 2.2 Schema-first 结构约束

`core` 默认采用 schema-first。

固定要求：

1. 稳定公共 contract 必须先定义 schema。
2. 类型必须优先通过 `z.infer<typeof Schema>` 推导。
3. 只要是稳定 JSON / DTO / event / payload / error contract，就不应只写裸 `interface/type` 长期存在。
4. 稳定 contract 的 schema 默认应物理放在 `src/spec/` 下，而不是长期留在 `src/types/`。
5. `src/types/` 默认应只保留 `z.infer` 推导结果；如文件中同时存在 `Schema`、`interface`、`helper`，应继续拆分。

适合进入 `core` 的 schema：

- tasking planning / orchestration / chat / session / checkpoint
- approval / governance / connectors
- SSE payload
- interrupt / recover payload
- learning candidate / evidence / usage summary
- 其他跨 runtime / backend / frontend / agents 的稳定结构

允许例外：

- 极小型辅助泛型
- 第三方库交互时的过渡类型
- 非 JSON-safe 的内部技术类型

但这类例外不能成为 `core` 的主形态。

适合保留例外形态的典型场景：

- provider / facade / adapter 的纯接口定义
- 非 JSON-safe 的技术契约
- 迁移中的 compat barrel

这类内容应优先放在 `providers/`、`contracts/`、`helpers/`、`utils/` 等更准确目录，不应长期伪装成 `types` 主体。

### 2.3 跨包能力接口

`core` 可以定义能力接口，但不实现能力。

例如：

- LLM provider interface
- embedding provider interface
- tool provider interface
- provider shared types
- facade / adapter contract
- pipeline input/output contract

固定规则：

1. `core` 只定义接口，不接外部 SDK。
2. `core` 不负责 transport、executor、registry、sandbox、browser、MCP client 的真实实现。
3. 调用方应依赖 `core` 的接口，而不是底层具体实现。

### 2.4 流程级协议抽象

`core` 可以定义流程协议，但不承载流程执行。

允许放入 `core` 的流程抽象：

- route / phase / stage enum
- pipeline state contract
- approval / interrupt / recover payload
- checkpoint / trace / delivery envelope
- graph 与 runtime 之间共享的稳定 state 片段

禁止放入 `core` 的内容：

- graph wiring
- node 实现
- flow 编排逻辑
- retry loop
- tool 调用
- 文件写入
- LLM 调用

### 2.5 通用错误与治理语义

`core` 可以承载：

- 错误分类
- 错误码
- 是否可重试
- 是否需要审批
- 是否可恢复
- 治理/审查/风险的结构化字段语义

目标是让 backend、runtime、agents、frontend 对同一类失败和治理状态有一致表达。

## 3. 明确不负责什么

`packages/core` 禁止承载以下内容。

### 3.1 业务实现

例如：

- service
- repository
- graph
- flow
- session 协调
- orchestration
- review / learning / research / delivery 主链逻辑

### 3.2 外部 SDK 接入

例如：

- OpenAI / Anthropic / MiniMax / Zhipu SDK
- MCP transport/client
- 浏览器 / 终端 / sandbox / filesystem executor
- 数据库 / 向量库 client

### 3.3 包内部私有结构

例如：

- 某个包的内部 helper 返回结构
- 某个模块内部 state patch
- 只在单包内使用的 view model
- 依赖某个目录布局的隐式约定

## 4. 与 shared 的边界

### 4.1 `core` 是主 contract 宿主

如果一个结构满足以下条件，应优先进入 `core`：

- 跨包复用
- 语义稳定
- 不是纯展示层
- 需要被多个消费方共同依赖
- 值得被 schema 显式约束

`core` 解决的是：边界是什么。

### 4.2 `shared` 不是第二个 `core`

`shared` 更适合放：

- 前端/后台消费更友好的默认组合类型
- compat re-export
- 展示辅助纯函数
- normalize / label / mapper / formatter
- 前端默认泛型参数组合

`shared` 解决的是：怎么更方便消费这些边界。

### 4.3 迁移规则

如果 `shared` 与 `core` 同时出现同语义主 contract：

1. 默认以 `core` 为唯一主宿主。
2. `shared` 只保留 compat re-export 或消费组合层。
3. 不允许长期双轨维护。

## 5. 当前 core 的实际子域

结合当前仓库，`packages/core` 已经承载或应继续承载这些子域：

- `spec/`
- `helpers/`
- `providers/`
- `approval/`
- `memory/`
- `types/tasking-*`
- `types/governance.ts`
- `types/knowledge.ts`
- `spec/connectors.ts` + `types/connectors.ts`
- `spec/platform-console.ts` + `contracts/platform-console.ts` + `types/platform-console.ts`
- `types/primitives.ts`
- `types/data-report.ts`
- `types/data-report-json.ts`
- `types/data-report-json-schema.ts`
- `types/delivery.ts`
- `types/execution-trace.ts`
- `types/workflow-route.ts`
- `types/architecture-records.ts`

这些文件的角色应继续朝“稳定协议定义”收敛，而不是长成实现层。

新增约束：

- `platform-console`、`workflow-route`、`delivery`、`execution-trace`、`architecture-records` 现在已经建立 `spec + types` 或 `spec + types + contracts` 模板，后续同类 contract 默认复制这套结构，不再回退到单文件裸 `interface` 主定义。
- `data-report.ts`、`data-report-json.ts`、`data-report-json-schema.ts` 已开始按“稳定 JSON contract -> spec/types；非 JSON-safe runtime contract -> contracts”拆分，后续新增字段时也应保持这条边界。

## 6. 目录规范

当前建议结构：

```text
packages/core/
  src/
    spec/
    helpers/
    approval/
    memory/
    providers/
    shared/
      schemas/
    types/
      *.ts  # 默认只放 z.infer 类型别名
    index.ts
```

约束：

1. 所有源码只放在 `src/` 下。
2. 所有对外导出统一从 `src/index.ts` 暴露。
3. 不新增 `src` 之外的源码目录。
4. 不允许让调用方依赖 `packages/core/src/*` 深层路径作为稳定公共入口。
5. `types/` 下文件应按子域拆分，不允许重新膨胀为单个巨型总表文件。
6. 新增稳定 schema 时，默认先放到 `spec/`，再在 `types/` 里推导类型；不要再直接在 `types/` 新写 schema。

## 7. 依赖规则

### 允许依赖

`core` 应尽量轻量，默认只允许依赖：

- `zod`
- 必要的极轻量类型辅助
- 仓库中不带业务实现的最小稳定依赖

### 禁止依赖

`core` 不应依赖：

- `runtime`
- `agents/*`
- `tools`
- `memory` 的实现层
- `model` 的实现层
- `report-kit` 的资产生成实现层
- 外部 SDK

原则：

`core` 只能依赖比自己更基础、不会把实现细节带进来的东西。

## 8. 新增代码落位规则

看到一段新代码，按下面判断：

### 应进入 `core`

- 它是稳定协议
- 它是跨包共享的数据结构
- 它需要被 schema 明确定义
- 它是调用方应依赖的接口，而不是某个包内部细节
- 它描述的是审批 / 恢复 / checkpoint / governance / tasking / event / payload 等公共边界

### 不应进入 `core`

- 它只在一个包内使用
- 它是业务 helper
- 它依赖外部 SDK
- 它有副作用
- 它是 graph / flow / runtime 的执行逻辑
- 它只是“多个地方可能复用”的普通工具函数

## 9. core 中允许的方法类型

`core` 不应该成为“公共方法仓库”。

允许存在的方法只应是非常有限的一类：

- schema 组合辅助
- contract normalize / compat helper
- 与稳定协议直接相关的纯函数
- 不带副作用、且明显属于 contract 语义的一致化函数

例如可以接受：

- `normalizeApprovalDecision`
- `coerceConnectorHealthStatus`
- `isRecoverableInterruptPayload`
- `parseTaskRecordSchemaSafe`

不应接受：

- `runTaskPipeline`
- `buildPromptMessages`
- `retryGenerateObject`
- `resolveWorkflowPreset`
- `executeSandboxAction`

## 10. Definition of Done

一个内容要进入 `packages/core`，至少应满足：

1. 明确属于稳定公共边界。
2. 不含业务实现。
3. 如为稳定结构，优先提供 schema。
4. type 优先通过 `z.infer` 推导。
5. 不引入外部 SDK 或执行层依赖。
6. 从 `src/index.ts` 暴露。
7. 能清楚解释为什么它不该放进 `shared`、`runtime`、`tools` 或某个 agent 包。

## 11. 当前一句话总结

`packages/core` 在你当前项目里，只负责稳定 contract、schema 和跨包边界定义；不负责运行时执行。
