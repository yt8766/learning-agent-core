# Runtime Contract Import Boundaries

状态：current
文档类型：reference
适用范围：`packages/runtime`、`apps/backend/agent-server`、`agents/supervisor`、`agents/coder`、`agents/reviewer`
最后核对：2026-05-09

After the P3-1 core contract split, runtime, backend, and specialist agents must import migrated domain contracts from their owning packages instead of `@agent/core`.

Current boundaries:

- Memory records, rules, evidence, runtime state snapshots, and memory search contracts come from `@agent/memory`.
- Agent/task learning, review evaluation, budget, conflict, and skill governance contracts come from `@agent/core`, including `EvaluationResult`, `LearningEvaluationRecord`, `BudgetState`, `LearningConflict*`, and `SkillGovernanceRecommendation`.
- Knowledge-owned retrieval, indexing, RAG, Knowledge SDK eval, trace, and workbench contracts come from `@agent/knowledge`, including `KnowledgeEvalCase`, `KnowledgeEvalRun`, `KnowledgeEvalRunResult`, `KnowledgeTrace*`, and `KnowledgeWorkbench*` schemas/types. `@agent/knowledge` also owns structural helpers such as evidence merge, trust inference, and installed-skill normalization, but it no longer re-exports agent/task learning, review evaluation, budget, conflict, or skill governance schemas/types.
- Stable tool definitions, tool execution requests/results, tool family records, tool usage summaries, and approval resume inputs come from `@agent/core`.
- Runtime-owned approval service, sandbox providers/executors, execution watchdog, tools center projection, and connector governance mutation helpers come from `@agent/runtime`.
- Tool registries, MCP client/registry types, connector draft helpers, tool definitions, and tool executors come from `@agent/tools`.
- `@agent/runtime` may depend on `@agent/tools`; `@agent/tools` must not depend on `@agent/runtime`.
- `@agent/core` remains the stable home for tasking, chat, channel, workflow, skill card, review, route, and DTO contracts that have not been migrated.

When reading `RuntimeStateSnapshot` from `@agent/memory`, callers should treat persisted arrays as loose historical records and narrow them at the runtime/backend boundary before passing them into typed runtime logic. Prefer existing schemas when strict compatibility is safe; otherwise use a small local guard that preserves known legacy records.
