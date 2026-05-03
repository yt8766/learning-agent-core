# AgentOS Runtime Profile

状态：current
文档类型：architecture
适用范围：`packages/core`、`packages/runtime`、`packages/platform-runtime`
最后核对：2026-05-03

## 定位

AgentOS Runtime Profile 是自治 Agent 的运行时治理模型。它不表示每个 Agent 都是操作系统，而表示每个 Agent 运行在 Runtime 提供的受管 profile 中。

更准确地说：

- Agent 是执行单元，负责理解目标、执行策略和产出结果。
- Runtime Profile 是治理外壳，定义上下文、权限、系统调用、预算、恢复和输出契约。
- Control Plane / Platform Runtime 负责装配默认 profile、调度、审批、审计和跨 Agent 协作边界。

这个模型保留 OS 隐喻里有价值的部分：内存视图、系统调用、权限、日志、中断和恢复；同时避免把每个轻量 Agent 都实现成完整微型 OS。

## 第一阶段能力

- `AgentRuntimeProfile`：描述 Agent 的能力、上下文权限、系统调用权限、资源预算、恢复和输出契约。
- `ContextPage / ContextBundle / ContextManifest`：记录 Agent 看见了什么、为什么加载、哪些内容被省略。
- `ToolRequest / PolicyDecision`：Agent 只提出请求，审批结论由 Permission Service 计算。
- `MissingContextSignal`：支持阻塞和非阻塞缺上下文信号。
- `QualityGate / QualityGateResult`：把验证建模为 Runtime 生命周期 hook。
- `AgentRuntimeTaskProjection`：给 admin/chat 的裁剪投影，不暴露 raw runtime state。

## 当前落点

- `packages/core/src/tasking/schemas/agent-runtime-profile.ts`
  - profile descriptor、context access、syscall、permission、resource、observability、recovery、output contract。
- `packages/core/src/tasking/schemas/agent-runtime-context.ts`
  - context page、bundle、manifest、missing context signal。
- `packages/core/src/tasking/schemas/agent-runtime-syscall.ts`
  - tool request 与 policy decision contract。
- `packages/core/src/tasking/schemas/agent-runtime-quality.ts`
  - quality gate 与 gate result contract。
- `packages/core/src/tasking/schemas/agent-runtime-projection.ts`
  - runtime task projection DTO。
- `packages/runtime/src/runtime/agentos/`
  - deterministic helper：context assembler、syscall policy decision、quality gate evaluation、projection builder。
- `packages/platform-runtime/src/agentos/default-agent-runtime-profiles.ts`
  - 官方默认 profile registry：`supervisor`、`coder`、`reviewer`、`data-report`。

## 边界

- `packages/core` 只放 schema-first contract。
- `packages/runtime` 放 deterministic helper：context assembler、policy helper、quality gate helper、projection builder。
- `packages/platform-runtime` 放默认官方 profile registry。
- `apps/*` 只消费 projection DTO。

## 治理语义

### Context Manifest

Context Manifest 是 Agent 的受控上下文账本。它记录：

- 哪些 context page 被加载；
- 每个 page 的 authority、trust level 和 token cost；
- 哪些 page 因权限、低信任、过期或 token budget 被省略；
- 当前 bundle 的总 token cost。

后续 UI 和审计应读取 manifest summary 或 projection，不应直接依赖 runtime 内部 context state。

### Syscall Policy

Agent 不直接决定能否执行外部动作。Agent 只发出 `ToolRequest`，Permission Service 归一化风险并返回 `PolicyDecision`。

风险维度按：

```text
Action × Asset Scope × Environment × Data Class × Blast Radius
```

高风险动作、敏感数据类型或外部影响半径默认进入审批，而不是由业务 Agent 自行放行。

### Quality Gate

Quality Gate 是 runtime 生命周期的一部分，不只是某个 Review Agent 的责任。

第一阶段支持：

- schema gate；
- test gate；
- reviewer gate；
- policy gate；
- source check gate；
- custom gate。

`onFail: "warn"` 会产生 `warned`，阻断型 gate 才产生 `failed`。投影层只暴露 gate result，不暴露内部执行细节。

### Projection

`AgentRuntimeTaskProjection` 是给 `agent-chat` 和 `agent-admin` 的稳定视图。它只包含：

- 当前治理阶段；
- 当前 Agent / Profile；
- context manifest summary；
- 最新 policy decision；
- pending interrupt；
- quality gate results；
- evidence refs；
- budget summary；
- side effect summary。

projection builder 会通过 core schema 归一化输出，避免 raw runtime state 或额外字段穿透到 app 层。

## 默认 Profile

默认 profile 由 `packages/platform-runtime` 持有，因为它认识官方 Agent 组合根。

当前默认 profile：

- `supervisor`
  - Level 4，负责规划、路由、汇总；
  - 只读权限为主；
  - 可请求其他 Agent，但不是 Control Plane 本身。
- `coder`
  - Level 3，具备 read/write/execute；
  - 可 `apply_patch` 和 `run_test`；
  - 高风险动作仍需审批。
- `reviewer`
  - Level 2，偏只读和验证；
  - 无 mutation syscall；
  - 默认审批策略较轻。
- `data-report`
  - Level 4，负责结构化报表生成；
  - 可创建 artifact 和运行验证；
  - 不直接发布外部副作用。

默认 profile registry 对外导出冻结后的默认值；resolver 返回 schema parse 后的独立副本，避免消费者污染全局治理配置。

## 禁止回退

- 不让 Agent 自判最终审批结论。
- 不让业务 Agent 直接拥有无限递归调度能力。
- 不把完整内部推理写入审计。
- 不把不可逆外部副作用描述为可 rollback。
- 不让 `apps/*` 读取 raw runtime state 或绕过 projection DTO。
- 不把官方 Agent profile 放进 `packages/runtime` 或 `packages/core`。

## 后续演进

- 将 default profile 接入 Runtime Center / Agent Registry 的只读治理视图。
- 将 policy decision helper 对接真实 Permission Service。
- 将 quality gate result 连接到 task lifecycle 和 Evidence Center。
- 为 side effect ledger 补齐幂等、补偿和不可逆副作用记录。
- 在前端只消费 `AgentRuntimeTaskProjection`，不读取底层 runtime state。
