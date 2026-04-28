# Runtime Contract Import Boundaries

状态：current
文档类型：reference
适用范围：`packages/runtime`、`apps/backend/agent-server`、`agents/supervisor`、`agents/coder`、`agents/reviewer`
最后核对：2026-04-28

After the P3-1 core contract split, runtime, backend, and specialist agents must import migrated domain contracts from their owning packages instead of `@agent/core`.

Current boundaries:

- Memory records, rules, evidence, runtime state snapshots, and memory search contracts come from `@agent/memory`.
- Knowledge evaluation, learning evaluation, learning conflict, evidence merge, trust inference, and installed-skill normalization helpers come from `@agent/knowledge`.
- Tool definitions, tool execution results, tool usage summaries, approval resume inputs, sandbox providers, and runtime governance helpers come from `@agent/runtime`.
- Tool registries, MCP client/registry types, and connector runtime helpers come from `@agent/tools`.
- `@agent/core` remains the stable home for tasking, chat, channel, workflow, skill card, review, route, and DTO contracts that have not been migrated.

When reading `RuntimeStateSnapshot` from `@agent/memory`, callers should treat persisted arrays as loose historical records and narrow them at the runtime/backend boundary before passing them into typed runtime logic. Prefer existing schemas when strict compatibility is safe; otherwise use a small local guard that preserves known legacy records.
