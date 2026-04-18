# runtime 包结构规范

状态：current
文档类型：convention
适用范围：`packages/runtime`
最后核对：2026-04-18

本文档说明 `packages/runtime` 如何继续按“运行时编排层”而不是“全能 shared 层”收敛。

## 1. 目标定位

`packages/runtime` 负责把：

- adapters
- memory
- tools
- skill-runtime
- graphs / flows

这些能力装配成可运行、可审批、可恢复、可观测的主链 runtime。

它不负责底层 provider / repository / executor 实现。

## 2. 推荐结构

```text
packages/runtime/
├─ src/
│  ├─ contracts/
│  ├─ graphs/
│  ├─ flows/
│  ├─ orchestration/
│  ├─ session/
│  ├─ governance/
│  ├─ capabilities/
│  ├─ bridges/
│  ├─ runtime/
│  ├─ utils/
│  ├─ types/
│  └─ index.ts
├─ test/
└─ package.json
```

各目录语义：

- `contracts/`
  - runtime-facing stable facade，例如 `AgentRuntime`、`SessionCoordinator`、`WorkerRegistry`
- `graphs/`
  - graph 定义、编译入口、子图装配
- `flows/`
  - 节点实现、局部 flow helper
- `orchestration/`
  - 主链流水线、task orchestration、background jobs 等编排宿主
- `runtime/`
  - runtime 真实装配与运行态 helper
- `session/`
  - checkpoint、事件、会话恢复、压缩
- `governance/`
  - profile policy、worker registry、runtime governance helper
- `capabilities/`
  - capability pool 与 runtime capability 相关宿主
- `bridges/`
  - runtime 与 `agents/*` 的桥接层
  - 仅作为过渡收敛宿主，不对外暴露为稳定公共 API
- `utils/`
  - 纯函数工具

## 3. 当前收敛策略

本轮先做最轻的 facade 收敛：

1. 先补 `contracts/`
2. 根入口改为优先从 `contracts/` 暴露稳定 runtime-facing API
3. graph / flow / session / governance 的真实实现先保持原位

补充：

- `contracts/` 主要承载 `AgentRuntime`、`SessionCoordinator`、`WorkerRegistry`、`profile policy` 这类 runtime-facing 稳定边界
- `llm retry / structured generation` 这类更接近 runtime helper 的 facade，当前直接以 `runtime/llm-facade.ts` 作为真实宿主，不再额外保留 `contracts/llm-facade.ts`

后续再逐步推进：

1. `session/*` facade 与实现进一步分离
2. `governance/*` contract 与 helper 分离
3. `graphs/main/*` 与 `runtime/*` 中的编排语义继续收敛到 `orchestration/`
4. `runtime <-> agents/*` 依赖从实现级收敛到 `bridges/` + contract / registry

当前已落地：

- `src/bridges/*`
  - 已作为 runtime 直连 `agents/*` 的真实宿主
- `src/orchestration/agent-orchestrator.ts`
  - 已作为 `AgentOrchestrator` 的新宿主
- `src/orchestration/main-graph-runtime-modules.ts`
  - 已作为 runtime module assembly 的新宿主
- `src/runtime/agent-bridges/*`
  - compat wrapper 已删除
- `src/graphs/main/main.graph.ts`
  - compat wrapper 已删除
- `src/graphs/main/main-graph-runtime-modules.ts`
  - compat wrapper 已删除

补充：

- `src/flows/ministries/index.ts` 当前仍保留为目录聚合入口，用于把 ministry 名义上的对外消费收口到 `bridges/*`
- 这类目录聚合入口不视为纯 compat 源文件，但也不应再承接真实桥接实现

## 4. 当前最需要避免的误收敛

- 不要因为 `runtime` 是大包，就把所有跨 flow helper 都回塞进 `utils/`
- 不要把 graph wiring、执行编排、运行态 facade 三种不同语义都继续堆在 `runtime/`
- 不要让 `session/` 重新退化成零散 helper；它已经是一个独立大域
- 不要把 `bridges/` 当成长期公共 API；它只负责运行时过渡桥接

## 5. 第一批执行清单

建议按下面顺序推进，而不是一次性大搬家：

1. 先创建 `src/orchestration/` 与 `src/bridges/`
2. 先移动 bridge 真实宿主，再收 orchestration
3. 最后删薄旧 compat 出口

第一批已经完成的收敛文件：

- `src/runtime/agent-bridges/coder-runtime-bridge.ts`
- `src/runtime/agent-bridges/data-report-runtime-bridge.ts`
- `src/runtime/agent-bridges/reviewer-runtime-bridge.ts`
- `src/runtime/agent-bridges/supervisor-runtime-bridge.ts`
- `src/graphs/main/main-graph-runtime-modules.ts`
- `src/graphs/main/main.graph.ts`

其中：

- `src/bridges/*`
  - 已成为 runtime 直连 `agents/*` 的唯一真实宿主
- `src/orchestration/agent-orchestrator.ts`
  - 已成为 `AgentOrchestrator` 的 canonical host
- `src/orchestration/main-graph-runtime-modules.ts`
  - 已成为 runtime module assembly 的 canonical host
- 上述旧 wrapper 已删除，不再保留源码 compat 层

第一批验证重点：

- `packages/runtime/test/runtime-agent-bridge-boundary.test.ts`
- `packages/runtime/test/main-graph.test.ts`
- `packages/runtime/test/index.test.ts`
- `packages/runtime/test/session-coordinator-helpers.test.ts`
- `packages/runtime/test/model-routing-policy.test.ts`

## 6. 继续阅读

- [runtime 文档目录](/docs/runtime/README.md)
- [LangGraph 应用结构规范](/docs/langgraph-app-structure-guidelines.md)
- [Runtime Interrupts](/docs/runtime-interrupts.md)
- [Runtime State Machine](/docs/runtime-state-machine.md)
