# Packages 分层与依赖约定

状态：current
适用范围：packages 分层规范
最后核对：2026-04-15

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
- `packages/skills`

3. Agent 编排层

- `agents/supervisor`
- `agents/data-report`
- `agents/coder`
- `agents/reviewer`
- `packages/agent-core`

4. 质量与资产层

- `packages/evals`
- `packages/templates`

迁移兼容说明：

- `packages/agent-core`、`packages/shared`、`packages/model` 目前仍保留，作为迁移期兼容实现与历史依赖来源
- 新消费侧优先改用 `@agent/runtime`、`@agent/adapters`、`@agent/agents-*`

## 每个包允许放什么

### `packages/shared`

- 允许：DTO、Record、Enum、跨端 contract、展示型 schema、label/normalize 纯函数
- 禁止：LLM、prompt、retry、service、graph、node、executor、repository、副作用逻辑

### `packages/core`

- 允许：稳定共享数据模型、Zod schema、由 schema 推导的 type、跨包 interface/facade contract、通用错误模型、pipeline contract
- 禁止：业务实现、外部 SDK 接入、graph/flow/runtime 执行逻辑、包内部私有结构
- 备注：
  - `packages/core` 是稳定 contract facade，不是“任何共用代码都能放”的公共杂物层
  - 所有稳定 JSON/DTO/event/error contract 默认遵循“schema 定义结构，type 由 schema 推导”

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

### `packages/skills`

- 允许：运行时 skill registry、skill manifest loader、skill source sync 基础能力
- 禁止：仓库级 `skills/*` 代理技能文档、agent graph 逻辑

### `packages/agent-core`

- 允许：graphs、flows、runtime orchestration、session、governance、LLM interaction policy
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
- `config` 不得依赖 `agent-core`
- `model / memory / tools / skills` 只允许依赖 `shared`、`config` 和必要第三方库
- `agent-core` 可以依赖 `shared / config / model / memory / tools / skills`
- `apps/*` 只能依赖各包公开入口
- 禁止 `apps/*` 直接依赖 `packages/*/src`
- 禁止基础能力层反向依赖 `agent-core`

## 固定检查入口

包分层边界不是只靠代码评审约定，必须能被固定命令验证：

- `pnpm check:package-boundaries`
  - 扫描 app 与核心运行目录，阻止 `apps/*` 深层依赖 `packages/*/src`
  - 阻止 `@agent/<pkg>/src/*` 这类深层包导入
  - 对 `agent-core / backend / tools / skills` 的核心源码与测试，阻止继续从 `@agent/config/*`、`@agent/memory/*`、`@agent/model/*`、`@agent/tools/*` 这类子路径导入
- `pnpm check:architecture`
  - 聚合 `check:backend-structure` 与 `check:package-boundaries`
  - 作为包分层治理的固定入口

## 放置规则

新增代码默认按以下规则落位：

- 跨端共享的数据结构：放 `shared`
- 面向外部暴露的稳定 contract facade：放 `core`
- 运行时默认策略与配置：放 `config`
- 模型/provider/embedding 装配：放 `model`
- memory/rule/vector/cache 存取与搜索：放 `memory`
- executor/registry/sandbox/MCP：放 `tools`
- skill registry/manifest/source：放 `skills`
- graph/flow/session/governance/agent runtime：放 `agent-core`

补充：

- “多个地方复用”不等于必须进入 `shared`
- “多个地方复用”也不等于必须进入 `core`
- 只有稳定、跨包、可长期演进的公共边界才进入 `core`
- 只有稳定 contract 才能进入 `shared`
- 带业务语义的 helper 不能因为复用而强行上提到 `shared`

## 当前重点迁移方向

优先顺序：

1. `shared`

- runtime center / execution trace / connector & governance 展示 contract

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
