# AgentOS Runtime Profile Architecture Design

状态：snapshot
文档类型：plan
适用范围：`packages/core`、`packages/runtime`、`packages/platform-runtime`、`agents/*`、`apps/backend/agent-server`、`apps/frontend/agent-chat`、`apps/frontend/agent-admin`
最后核对：2026-05-03

## 背景

当前仓库已经按多 Agent 自治系统演进，而不是普通聊天应用。既有架构文档已经明确：

- `packages/core` 是稳定 contract 层。
- `packages/runtime` 是 Runtime Kernel。
- `packages/platform-runtime` 是官方组合根 / 默认装配层。
- `agents/*` 是专项 Agent graph / flow / prompt / schema 宿主。
- `apps/*` 是启动、HTTP/SSE、worker、UI 适配层。

同时，当前主链已经具备 approval / interrupt / checkpoint / Evidence / BudgetGuard / ContextStrategy / ThoughtChain 等能力。下一步需要一个更统一的运行时治理模型，解释 Agent 如何被授权、如何装载上下文、如何请求工具、如何中断恢复、如何审计与验证。

本设计使用操作系统隐喻，但不把每个 Agent 等同于一个操作系统。更准确的定义是：

> AgentOS 是面向自治 Agent 的运行时治理模型。每个 Agent 运行在可裁剪的 Agent Runtime Profile 中；Runtime Kernel 提供确定性治理，Agent 负责概率性推理和结构化请求。

## 问题判断

“每个 Agent 都是一个微型操作系统”这个隐喻有启发性，但作为工程定义偏重，主要问题有：

- 并非所有 Agent 都需要 Memory、Syscall、Interrupt、Scheduler、Daemon 等完整 OS 能力。
- 如果每个 Agent 都自带调度、权限、记忆和恢复能力，会造成治理重复、权限扩散和状态不一致。
- Supervisor 容易膨胀成“大脑 + 调度器 + 权限中心 + 恢复中心”，重新形成单点大中心。
- 上下文如果仍是纯 prompt 字符串，就无法审计 Agent 看了什么、忽略了什么、为什么做出判断。
- 工具调用如果由 Agent 自判风险和审批，会让概率性推理穿透确定性权限边界。

因此本设计采用修正版：

```text
Runtime 像 OS。
Agent 像受管执行单元。
Context 像虚拟内存页。
Tool request 像 syscall。
Evidence 像证据库和审计日志。
Checkpoint 像进程快照。
Approval 像权限门。
Supervisor 是高权限 Agent，不是 Control Plane 本身。
```

## 目标

1. 建立 Agent Runtime Profile 模型，明确每个 Agent 能看什么、能请求什么、能消耗多少资源、如何被审计。
2. 把上下文从 prompt 字符串升级为可审计的 `ContextPage / ContextBundle / ContextManifest`。
3. 把工具调用统一收敛为 `ToolRequest -> PolicyDecision -> Tool Gateway -> Evidence`。
4. 支持阻塞和非阻塞的 missing context 信号，减少 Agent 缺上下文时硬猜。
5. 将验证提升为 Runtime 生命周期中的 `QualityGate` hook，而不是只依赖某个 Reviewer Agent。
6. 为 `agent-admin` 和 `agent-chat` 提供 projection contract，避免前端消费 raw runtime state。
7. 保持当前分层边界，不把 runtime、platform-runtime、apps/backend 或 Supervisor 重新做胖。

## 非目标

- 不实现真正的操作系统、沙箱内核或完整虚拟内存算法。
- 不要求所有 Agent 都升级为自治长任务 Agent。
- 不在第一阶段实现完整全局 Scheduler、多级优先队列、Agent Daemon 或 Agent Package Manager。
- 不把完整 ThoughtChain 或模型内部推理作为默认审计对象。
- 不把外部副作用统一描述为可 rollback；不可逆动作只能记录和补偿。
- 不让业务 Agent 直接 `spawn_agent` 或绕过 Control Plane 调度其他 Agent。

## 总体架构

```text
Human Layer
  - Human
  - Approver
  - Operator

App Layer
  - agent-chat
  - agent-admin

Control Plane Services
  - Scheduler
  - Permission Service
  - Agent Registry
  - Capability Registry
  - Model Router
  - Budget Manager
  - Audit Service
  - Recovery Policy Service
  - IPC Router

Privileged Agents
  - Supervisor Agent

Runtime Kernel
  - Graph Runner
  - Runtime State Machine
  - Context Assembler
  - Syscall Broker
  - Interrupt Controller
  - Checkpoint Manager
  - Quality Gate Runner
  - Observability Emitter

Agent Runtime Containers
  - Agent Policy / Brain
  - Profile View
  - Local Runtime State
  - Authorized Context View
  - Authorized Syscall View

Service Layer
  - Memory Service
  - Evidence Store
  - Artifact Store
  - Knowledge Index
  - Tool Gateway
  - Secret Manager
  - Evaluation Service
  - Repo / File Mount
  - External Connectors
```

一句话职责：

```text
Control Plane 决定能不能做。
Runtime Kernel 负责怎么跑。
Agent 负责想和请求。
Service Layer 负责存和执行。
```

## 分层职责

### Control Plane Services

Control Plane 是服务集合，不是一个超级 Agent。它负责跨任务、跨 Agent、跨资源的治理策略：

- Scheduler：决定是否调度、调度谁、何时重试或取消。
- Permission Service：根据 profile、资产、环境、数据类别和影响半径产出 `PolicyDecision`。
- Registry：维护 Agent、Capability、Tool、Skill、Model 的可用性和治理元数据。
- Budget Manager：管理 token、费用、工具调用数、墙钟时间和并发限制。
- Recovery Policy Service：决定是否恢复、采用哪种恢复策略、是否需要人工介入。
- IPC Router：转发结构化 Agent 消息，不传递裸上下文。

### Privileged Agents

Supervisor 是高权限 Agent，但不是 Control Plane 本身。

Supervisor 负责：

- 理解用户目标。
- 拆解任务。
- 请求调度合适的 Agent。
- 汇总结果。
- 识别缺上下文、缺能力和高风险动作。

Supervisor 不负责：

- 自己实现全局 Scheduler。
- 自己决定权限最终结论。
- 自己维护 Memory Service。
- 自己绕过 Runtime 直接执行工具或恢复任务。

### Runtime Kernel

Runtime Kernel 负责单个 task / graph 的执行生命周期：

- graph runner 与 state transition。
- context 装载和 manifest 生成。
- syscall broker 与 permission preflight。
- interrupt / resume / checkpoint。
- quality gate hook 执行。
- observability event 与 projection 输入。

Runtime Kernel 不认识具体官方 Agent 的业务实现，也不重新持有官方组合根知识。

### Agent Runtime Container

Agent Runtime Container 是一次 Agent 运行的受管容器：

```text
Agent Runtime Container
  = Agent Policy / Brain
  + AgentRuntimeProfile
  + Authorized Context View
  + Authorized Syscall View
  + Local Runtime State
```

Agent 可以很轻，也可以很复杂。不是所有 Agent 都必须拥有完整自治能力。

## Agent 分级

```text
L0 Function / Tool
  确定性能力，无自治。

L1 Stateless Agent
  有判断和结构化输出，无长期状态。
  例：分类、摘要、格式化、标签生成。

L2 Stateful Agent
  有任务状态、阶段记忆、局部恢复。
  例：长文档分析、计划生成。

L3 Tool-Using Agent
  能请求 syscall，但不直接执行工具。
  例：Coder、Researcher、Browser Agent。

L4 Autonomous Agent Container
  支持 interrupt、resume、budget、audit、IPC、quality gate。
  例：Supervisor、Data Report 主链、复杂 Coder。
```

## Profile 模型

`AgentRuntimeProfile` 是聚合视图，不是一个巨型 schema。第一版应拆成可组合 profile：

```ts
type AgentRuntimeProfile = {
  descriptor: AgentDescriptor;
  contextAccess: ContextAccessProfile;
  syscall: SyscallProfile;
  permission: PermissionProfile;
  resource: ResourceProfile;
  observability: ObservabilityProfile;
  recovery: RecoveryProfile;
  outputContract: OutputContractProfile;
};
```

各 profile 职责：

- `AgentDescriptor`：`agentId`、role、level、description、capabilities。
- `ContextAccessProfile`：可读 context kind、可写候选 kind、memory view scope、context token budget。
- `SyscallProfile`：允许请求哪些 syscall group、哪些 tool、哪些参数约束。
- `PermissionProfile`：action、asset、environment、data class、blast radius、approval policy。
- `ResourceProfile`：token、cost、wall time、tool call count、并发限制、模型等级。
- `ObservabilityProfile`：decision log、tool trace、evidence、audit、state transition。
- `RecoveryProfile`：checkpoint、resume、本地回滚、外部补偿、side effect ledger。
- `OutputContractProfile`：schema name、schema version、parse strategy、compat policy。

## Context Virtual Memory

上下文不再只是字符串，而是带治理元数据的 page。

```ts
type ContextPage = {
  id: string;
  kind: ContextKind;

  authority: 'system' | 'user' | 'project' | 'verified' | 'agent' | 'external';
  trustLevel: 'high' | 'medium' | 'low';
  freshness: 'current' | 'recent' | 'stale' | 'unknown';

  scope: 'task' | 'session' | 'project' | 'team' | 'user' | 'system';
  owner?: string;
  ttl?: string;

  sourceRefs: string[];
  evidenceRefs?: string[];
  artifactRefs?: string[];

  tokenCost: number;
  readonly: boolean;

  payload: {
    text?: string;
    summary?: string;
    dataRef?: string;
    data?: unknown;
  };
};
```

原则：

- 给模型看的可以是 `text` 或 `summary`。
- 给系统审计和恢复用的应该是 `evidenceRefs`、`artifactRefs` 或 `dataRef`。
- Agent 可以请求上下文，但最终由 Runtime 决定是否加载。
- 高权威、当前任务相关、已验证 Evidence 优先；低信任、过期、越权内容不得装载。

每次执行生成：

```ts
type ContextManifest = {
  bundleId: string;
  taskId: string;
  agentId: string;
  createdAt: string;

  loadedPages: {
    pageId: string;
    kind: ContextKind;
    reason: string;
    tokenCost: number;
    authority: string;
    trustLevel: string;
  }[];

  omittedPages: {
    pageId: string;
    reason: 'low_relevance' | 'token_budget' | 'low_trust' | 'stale' | 'permission_denied';
  }[];

  totalTokenCost: number;
};
```

`ContextManifest` 用于审计和 UI projection，不要求直接暴露 raw prompt。

## Missing Context Signal

缺上下文不一定是失败，也不一定总是 interrupt。它可以是阻塞中断，也可以是非阻塞 observability event。

```ts
type MissingContextSignal = {
  kind: 'missing_context';
  taskId: string;
  agentId: string;

  requested: {
    contextKind: 'contract' | 'code' | 'docs' | 'evidence' | 'memory' | 'user_input';
    query: string;
    reason: string;
    blocking: boolean;
    expectedAuthority?: 'system' | 'user' | 'project' | 'verified' | 'external';
  }[];
};
```

Runtime 策略：

```text
blocking = true
  -> WaitingForContext
  -> retrieve or ask user
  -> resume

blocking = false
  -> emit observability event
  -> opportunistic retrieval
  -> Agent may continue with lower confidence
```

## Tool Syscall Boundary

Agent 不直接操作外部世界。它只能发出 `ToolRequest`，最终审批结论由 Permission Service 计算。

```ts
type ToolRequest = {
  requestId: string;
  taskId: string;
  agentId: string;

  syscallType: 'resource' | 'mutation' | 'execution' | 'external' | 'control_plane' | 'runtime';

  toolName: string;
  intent: string;
  args: unknown;

  agentRiskHint?: {
    action: 'read' | 'write' | 'execute' | 'delete' | 'publish' | 'spend';
    assetScope: string[];
    environment?: 'sandbox' | 'workspace' | 'staging' | 'production';
    dataClasses?: ('public' | 'internal' | 'confidential' | 'secret' | 'pii')[];
    blastRadius?: 'local' | 'project' | 'team' | 'external' | 'production';
  };

  idempotencyKey?: string;
  expectedEvidence: string[];
};
```

Permission Service 产出：

```ts
type PolicyDecision = {
  decision: 'allow' | 'needs_approval' | 'deny';
  reason: string;
  decidedBy: 'permission_service';
  requiredApprovalPolicy?: 'human' | 'two_person';
  normalizedRisk: {
    action: string;
    assetScope: string[];
    environment: string;
    dataClasses: string[];
    blastRadius: string;
    level: 'low' | 'medium' | 'high' | 'critical';
  };
};
```

执行流程：

```text
Agent emits ToolRequest
  -> schema parse
  -> capability check
  -> risk normalize
  -> budget check
  -> approval if needed
  -> adapter execute
  -> normalize result
  -> write EvidenceRecord
  -> resume Agent
```

业务 Agent 不直接 `spawn_agent`。它只能发 `request_agent` 类控制平面请求，由 Supervisor / Scheduler 决定是否调度。

## Permission 与 Risk

风险不是单一动作等级，而是组合：

```text
Risk = Action × Asset × Environment × DataClass × BlastRadius
```

示例：

```text
read public docs in local      -> low
read secret in production      -> high
write temp artifact in sandbox -> low
write repo source in workspace -> medium
delete production data         -> critical
send external email            -> high
```

`PermissionProfile` 不使用 `maxDataClass`，因为数据类别不是严格线性等级。应使用集合：

```ts
type PermissionProfile = {
  allowedActions: ('read' | 'write' | 'execute' | 'delete' | 'publish' | 'spend')[];
  allowedAssetScopes: string[];
  allowedEnvironments: ('sandbox' | 'workspace' | 'staging' | 'production')[];
  allowedDataClasses: ('public' | 'internal' | 'confidential' | 'secret' | 'pii')[];
  maxBlastRadius: 'local' | 'project' | 'team' | 'external' | 'production';
  defaultApprovalPolicy: 'none' | 'auto' | 'human' | 'two_person';
};
```

## Memory Service

长期 Memory 不属于单个 Agent，而属于 Runtime Service。Agent 只获得授权后的 Memory View。

Agent 不能直接写长期记忆，只能产出：

```ts
type MemoryCandidate = {
  claim: string;
  scope: 'task' | 'session' | 'project' | 'team' | 'user' | 'system';
  owner?: string;
  evidenceRefs: string[];
  confidence: number;
  proposedByAgentId: string;
  reason: string;
  ttl?: string;
};
```

Memory Service 负责：

- schema 校验。
- evidence 绑定。
- confidence 评分。
- 冲突检测。
- scope / owner / TTL / privacy 处理。
- 自动沉淀或进入审批。

## IPC Contract

Agent 之间不共享裸上下文，只交换结构化 envelope。

```ts
type AgentMessageEnvelope<T> = {
  messageId: string;
  correlationId: string;
  parentMessageId?: string;

  from: string;
  to: string | string[];

  type: AgentMessageType;
  schemaVersion: string;

  createdAt: string;
  expiresAt?: string;

  priority: 'low' | 'normal' | 'high';

  budgetHint?: {
    tokens?: number;
    costUsd?: number;
    wallTimeMs?: number;
  };

  capabilityGrantRefs?: string[];
  traceId: string;

  payload: T;
};
```

`capabilityGrantRefs` 必须由 Permission Service 颁发，带 TTL、scope 和 traceId。Agent 不允许自行构造或转授权限。

## Logs 与 Evidence

默认不记录完整 ThoughtChain 或模型内部推理。审计需要的是可验证记录：

```ts
type ObservabilityProfile = {
  decisionLog: boolean;
  rationaleSummary: boolean;
  toolTrace: boolean;
  evidence: boolean;
  audit: boolean;
  approvalHistory: boolean;
  stateTransitions: boolean;
};
```

区分：

- ThoughtChain：给用户理解执行过程。
- Evidence：外部事实、工具结果、测试结果、文档引用。
- Audit：谁在何时做了什么，是否获批。
- DecisionLog：关键决策摘要，不是完整内部推理。

## Recovery 与 Side Effect Ledger

`rollback` 不是通用能力。外部副作用很多不可逆，只能补偿。

```ts
type RecoveryProfile = {
  checkpoint: boolean;
  resume: boolean;
  rollbackLocalState: boolean;
  compensateExternalEffects: boolean;
  sideEffectLedger: boolean;
};
```

```ts
type SideEffectRecord = {
  effectId: string;
  taskId: string;
  agentId: string;
  toolRequestId: string;

  effectType: 'file_write' | 'command' | 'message' | 'deploy' | 'payment' | 'external_api';
  idempotencyKey?: string;

  reversible: boolean;
  retryable: boolean;
  compensationActionRef?: string;

  approvalRef?: string;
  evidenceRef: string;
  createdAt: string;
};
```

Side Effect Ledger 必须记录是否幂等、是否可重试、是否可撤销、补偿动作和 evidence ref。

## Quality Gates

验证不是单个 Reviewer Agent 的职责，而是 Runtime 生命周期 hook。

```ts
type QualityGate = {
  gateId: string;
  hook: 'pre_plan' | 'post_plan' | 'pre_action' | 'post_action' | 'pre_delivery' | 'post_delivery';

  requiredForRisk: ('low' | 'medium' | 'high' | 'critical')[];
  evaluator: 'schema' | 'test' | 'reviewer' | 'policy' | 'source_check' | 'custom';

  onFail: 'block' | 'request_revision' | 'require_approval' | 'warn';
};
```

第一阶段 gate：

- schema gate：Agent 输出必须 parse。
- evidence gate：事实型结论必须有 evidence ref。
- test gate：代码改动必须有测试或说明无法测试。
- policy gate：高风险动作必须有 `PolicyDecision`。
- delivery gate：最终答复必须引用关键 evidence / verification。

## Runtime Flow

第一阶段闭环：

```text
User Task
  -> Supervisor plans
  -> Runtime selects AgentRuntimeProfile
  -> ContextAssembler builds ContextBundle + ContextManifest
  -> Agent runs with authorized context
  -> Agent emits structured output / ToolRequest / MissingContextSignal
  -> PermissionService returns PolicyDecision
  -> SyscallBroker executes allowed tool
  -> EvidenceStore records result
  -> QualityGate evaluates
  -> RuntimeProjectionBuilder exposes admin/chat views
```

状态语义可以先作为 `governancePhase` 接入，避免一次性替换既有状态机：

```ts
type GovernancePhase =
  | 'context_loading'
  | 'agent_running'
  | 'policy_checking'
  | 'waiting_context'
  | 'waiting_approval'
  | 'tool_executing'
  | 'quality_checking'
  | 'delivering';
```

## Admin / Chat Projection

前端不消费 raw runtime state。

```text
Runtime internal state
  -> RuntimeProjectionBuilder
  -> Admin / Chat DTO
  -> agent-admin / agent-chat
```

`agent-admin` 可展示：

- task id / current agent / governance phase。
- selected profile。
- context manifest summary。
- latest policy decision。
- pending interrupt。
- quality gate results。
- evidence refs。
- budget summary。
- side effect summary。

`agent-chat` 可展示：

- Missing Context card。
- Approval card。
- Evidence card。
- Tool trace。
- Think / ThoughtChain projection。
- 验证和交付摘要。

不得展示：

- 完整内部 prompt。
- 完整模型内部推理。
- 未裁剪 raw state。
- secret payload。

## MVP Scope

第一阶段只做最小闭环：

1. Profile 拆分 contract。
2. `ContextPage v2` + `ContextManifest`。
3. `ToolRequest v2` + `PolicyDecision`。
4. `MissingContextSignal`。
5. `QualityGate` hook 与 `QualityGateResult`。
6. Admin / Chat projection DTO。

暂缓：

- 完整全局 Scheduler。
- 复杂多级优先队列。
- Agent Daemon。
- Agent Package Manager。
- 完整虚拟内存淘汰算法。
- 完整长期 Memory 冲突合并系统。
- 跨团队 capability marketplace。
- 两人审批 / 多级审批。
- 完整 Side Effect compensation 引擎。

## 落点

```text
packages/core
  - AgentDescriptor
  - AgentRuntimeProfile
  - ContextPage / ContextBundle / ContextManifest
  - MissingContextSignal
  - ToolRequest / PolicyDecision
  - QualityGate / QualityGateResult
  - RuntimeProjection DTO
  - SideEffectRecord

packages/runtime
  - ContextAssembler
  - SyscallBroker
  - QualityGateRunner
  - MissingContextSignal handling
  - RuntimeProjectionBuilder

packages/platform-runtime
  - official agent descriptors
  - default profile registry
  - profile selection facade

agents/*
  - graph / flows / prompts / schemas
  - agent-specific output schema
  - agent-specific quality gate declaration

apps/backend/agent-server
  - HTTP/SSE DTO mapping
  - approval resume
  - admin projection endpoint

apps/frontend/agent-chat
  - Missing Context card
  - Approval card
  - Evidence card
  - Tool trace and verification projection

apps/frontend/agent-admin
  - Profile view
  - ContextManifest view
  - PolicyDecision view
  - QualityGate view
  - Budget / SideEffect view
```

## 迁移策略

1. 先在 `packages/core` 定义 schema-first contract，保持字段可选和兼容。
2. 在 `packages/runtime` 先以 projection / governance phase 接入，不破坏既有 runtime status。
3. 以 Coder 或 Data Report 其中一条主链试点 profile + context manifest + tool request。
4. 将现有 approval / interrupt payload 映射到 `PolicyDecision` 和 `MissingContextSignal`。
5. 在 `agent-admin` 先展示投影摘要，不直接暴露 raw state。
6. 稳定后再扩展到更多 Agent 和更复杂 Permission / QualityGate。

## 风险与防御

- 风险：Profile 过度抽象，第一阶段实现拖重。
  - 防御：先定义可组合 contract，MVP 只接最小字段。
- 风险：Supervisor 重新吸收 Control Plane 职责。
  - 防御：文档和 contract 明确 Scheduler / Permission / Recovery 属于服务。
- 风险：ContextPage 被重新当成 prompt 字符串。
  - 防御：保留 `payload.dataRef`、`evidenceRefs`、`artifactRefs`。
- 风险：Agent 自判风险导致越权。
  - 防御：`ToolRequest` 只允许 `agentRiskHint`，最终 `PolicyDecision` 由 Permission Service 产生。
- 风险：前端耦合 raw runtime state。
  - 防御：所有 UI 只消费 projection DTO。
- 风险：审计依赖完整 ThoughtChain。
  - 防御：审计使用 decision log、tool trace、evidence、approval history 和 state transitions。

## 结论

本设计保留 OS 隐喻的结构优势，但避免把每个 Agent 都设计成操作系统。最终边界是：

```text
AgentOS 是 Runtime 治理模型。
Runtime Kernel 是 OS 化执行内核。
Agent 是受管执行单元。
Profile 是能力和权限视图。
Control Plane 是治理服务集合。
Supervisor 是高权限 Agent，不是 Control Plane 本身。
```

第一阶段应优先完成 profile、context、syscall、policy、quality gate 和 projection 的最小闭环。这个闭环完成后，系统会从“Agent 编排”升级为“可治理的自治运行时”。
