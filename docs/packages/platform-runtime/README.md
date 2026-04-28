# platform-runtime 文档目录

状态：current
文档类型：index
适用范围：`packages/platform-runtime`
最后核对：2026-04-20

`packages/platform-runtime` 是平台 runtime facade 与 registry contract 包；官方 agent 组合根位于 backend app 层。

本目录主文档：

- 本文是 `packages/platform-runtime` 的总体入口

本文只覆盖：

- platform runtime 职责边界
- 当前落地入口
- 与 runtime / agents / apps 的依赖关系

它的职责是提供可注入的 runtime facade、agent registry 与 platform centers；具体官方 agents 由 `apps/backend/agent-server/src/agents/*` 装配后注入。

当前已落地能力：

- 包根入口：`@agent/platform-runtime`
- 可注入 registry contract：
  - `AgentRegistry`（通用定义宿主：`@agent/runtime`）
  - `AgentProvider`（通用定义宿主：`@agent/runtime`）
  - `PlatformRuntimeFacade`
  - `PlatformAgentDescriptor` / `AgentDescriptor`（通用定义宿主：`@agent/runtime`）
- 默认装配入口：
  - `createPlatformRuntime({ runtime, agentRegistry, agentDependencies, metadata? })`
  - `createDefaultPlatformRuntimeOptions({ workspaceRoot?, settingsOptions?, ... })`
  - `createDefaultPlatformRuntime(options)`
- 动态 agent registry：
  - `StaticAgentRegistry`
  - 支持 `findAgentById`、`findAgentsByCapability`、`findAgentsByDomain`
  - 不直接 import 或依赖任何 `@agent/agents-*`

允许：

- 可注入 Agent 注册与默认 facade
- backend / worker 共享 runtime 启动线
- platform runtime facade 与 adapter
- 为测试、私有部署、未来第三方 Agent 保留可注入 registry

禁止：

- HTTP controller
- worker 消费循环
- 前端 view model
- Agent prompt、graph node、flow 主实现
- report blueprint/scaffold/write 主流程
- 业务策略判断或为了页面方便的展示聚合

当前实现：

- `platform-runtime` 不再依赖 `@agent/agents-coder`、`@agent/agents-data-report`、`@agent/agents-intel-engine`、`@agent/agents-reviewer`、`@agent/agents-supervisor`。
- 通用 `AgentDescriptor` / `AgentProvider` / `AgentRegistry` contract 已并入 `packages/runtime`；`platform-runtime` 只保留通用 registry 实现、默认 facade、platform centers 与 adapter。
- `apps/backend/agent-server/src/agents/*` 现在承载 `createOfficialAgentRegistry()` 与 `createOfficialRuntimeAgentDependencies()`。
- `createDefaultPlatformRuntime()` 只接受 app 层注入的 `agentRegistry`、`agentDependencies` 与 `metadata`，避免平台基础包硬编码官方 agent。
- `createDefaultPlatformRuntimeOptions()` 现在承载 platform profile、`process.cwd()` workspace root 与默认 runtime llm provider 的标准装配语义；backend / worker 如果只需要官方默认 runtime，再叠加各自 override，应优先复用这条入口，而不是在 app 层重复拼 `createDefaultRuntimeLlmProvider(...)`
- `PlatformRuntimeFacade` 当前显式暴露 `runtime + agentRegistry + agentDependencies + metadata`，其中 `metadata` 统一承接 workflow preset、subgraph descriptor、workflow version 等官方只读组合根信息；app 层如果需要读取这些能力，应优先从 facade / host 取值，而不是继续直接 import 主链 helper。
- backend 的 `createOfficialRuntimeAgentDependencies()` 现在会在 `resolveSpecialistRoute()` 结果上追加 registry enrich，使 runtime 主链拿到的是“领域判断 + 官方候选 agent 线索”，而不是只有抽象 specialist domain。
- specialist enrich 现在会优先使用 `requiredCapabilities -> registry.findAgentsByCapability()` 命中官方 agent，再回退到 `findAgentsByDomain()`，开始把 supervisor specialist route 往 capability-driven dispatch 推进。
- backend 的 `createOfficialRuntimeAgentDependencies()` 当前还会优先按 capability contract 解析 supervisor / coder / reviewer / data-report 官方模块，再回退固定 `official.*` id，避免组合根继续把 capability dispatch 写死成单一 agent id 约定。
- runtime task factory 的默认 counselor 选择也会优先消费这些官方 candidate agent ids，而不是只把 specialist domain 当成 counselor id。
- supervisor planning stage 生成的 `dispatches` 现在也会继续带上 `specialistDomain`、`requiredCapabilities`、`agentId`、`candidateAgentIds` 与 `selectedAgentId`，这样 checkpoint / projection / recovery 链路既能看到偏好候选，也能看到本次 dispatch 实际收敛到哪个官方 agent。
- supervisor / runtime 现在还会把上述能力态进一步沉淀为 `plannerStrategy` contract（`default` / `capability-gap` / `rich-candidates`），让 runtime center 与 admin workbench 直接观察当前规划为什么这样收敛。
- `packages/runtime/src/bridges/*` 仍保留为 runtime 内部兼容壳，但已经只读取 runtime contract，不再直接 re-export 官方 Agent。
- `@agent/platform-runtime` 包根入口现在只导出平台 facade、registry、adapter、centers 与 media 能力；官方 agent class、prompt、graph 根入口仍留在各自 `@agent/agents-*` 包内，并由 backend app 层组装。
- `platform-runtime` 可以依赖 `@agent/runtime`，但不能直接依赖官方 `@agent/agents-*`；`packages/runtime` 也不能反向依赖 `@agent/platform-runtime`。
- `pnpm check:package-boundaries` 现已阻止 `apps/*` 直接从 `@agent/platform-runtime` import `resolveWorkflowPreset`、`runDispatchStage`、`createOfficialRuntimeAgentDependencies`、`listWorkflowPresets`、`listSubgraphDescriptors`、`listWorkflowVersions` 这类主链装配 helper；应用层应通过 facade、RuntimeHost 或专门适配器读取这些能力。

验证入口：

```bash
pnpm exec tsc -p packages/platform-runtime/tsconfig.json --noEmit
pnpm --dir . exec vitest run --config vitest.config.js packages/platform-runtime/test
pnpm check:package-boundaries
```
