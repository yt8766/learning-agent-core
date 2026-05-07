# Root Data Deprecation Design

状态：draft
文档类型：spec
适用范围：`packages/config`、`packages/memory`、`packages/skill`、`packages/knowledge`、`packages/runtime`、`packages/tools`、`apps/backend/agent-server`、`docs/**`
最后核对：2026-05-07

## 1. Goal

Deprecate the repository root `data/` directory as a runtime persistence layer.

The target state is:

- Production and recoverable local development use Postgres-backed repositories.
- LangGraph checkpoint and store state use the existing LangGraph Postgres integration when enabled.
- Local and test fallback remains available, but it is in-memory and ephemeral.
- New code must not write runtime state, memory, rules, skills, knowledge snapshots, schedules, connectors, or briefings to root-level `data/*`.
- Existing root `data/*` files may be imported once during migration, then treated as legacy input only.

This is not a simple file cleanup. Current code still treats `data/*` as the default storage root through `packages/config`, `packages/memory`, `packages/skill`, `packages/knowledge`, runtime wiring, and tool executors.

## 2. Current Evidence

Root `data/` still has active code paths:

- `packages/config/src/shared/settings-defaults.ts` defines default paths for `data/memory`, `data/rules`, `data/runtime`, `data/skills`, and `data/knowledge`.
- `packages/memory/src/repositories/runtime-state-repository.ts` loads and saves `data/runtime/tasks-state.json`, which includes tasks, learning queues, chat projections, checkpoints, governance, usage, and eval audit data.
- `packages/memory/src/repositories/memory-repository.ts`, `rule-repository.ts`, and `semantic-cache-repository.ts` still provide file-backed memory, rules, evidence, profile, reflection, resolution candidate, and cache storage.
- `packages/skill` still has file-backed draft and registry storage, and agent-server workspace draft wiring resolves `data/skills/drafts/workspace-drafts.json`.
- Runtime knowledge search still has snapshot repositories that read knowledge artifacts from the configured knowledge root.
- Tool executors write schedules, connector drafts, runtime archives, cancellations, and recoveries under `data/runtime`.
- `data/rules/rules.jsonl` is tracked by Git and must be removed through an explicit migration, not by local cleanup.

Database-backed paths exist, but they do not cover the whole root `data/*` surface. Postgres currently covers selected backend domains such as identity and knowledge repositories, and LangGraph Postgres covers graph checkpoints/store only when explicitly configured.

## 3. Architecture

Persistence is split into three explicit layers.

### 3.1 Business Postgres

Business Postgres stores durable product/runtime state:

- runtime tasks and queues
- chat projections and checkpoint projections
- governance and audit records
- skill drafts, registry entries, install receipts, and lab records
- memory records and related evidence/profile/reflection data
- rules
- semantic cache entries
- knowledge source/chunk/ingestion snapshots where runtime needs durable lookup
- schedules, connector drafts, briefings, archives, cancellations, and recoveries

Postgres clients, SQL rows, and vendor errors stay inside infrastructure/repository adapters. Business layers consume project-defined repository interfaces and schema-validated DTOs.

### 3.2 LangGraph Postgres

LangGraph checkpoint/store persistence remains separate from business Postgres repositories.

Existing `LANGGRAPH_CHECKPOINTER=postgres` and `LANGGRAPH_STORE=postgres` behavior stays the canonical graph-state path. Graphs, nodes, flows, and backend services must not instantiate LangGraph Postgres classes directly.

### 3.3 In-memory Fallback

`BACKEND_PERSISTENCE=memory` remains valid for local/test runs.

Memory mode must not persist to root `data/*`. It is explicitly ephemeral, and admin/runtime health surfaces should show that state will not survive restart.

## 4. Repository Boundaries

Stable contracts use schema-first definitions. Durable public DTOs and event payloads belong in `packages/core` only when they are true cross-package contracts. Repository interfaces stay in their real host packages.

Recommended ownership:

- `apps/backend/agent-server/src/infrastructure/database`
  - Postgres provider, migrations, schema bootstrap, health checks.
- `apps/backend/agent-server/src/domains/*/repositories`
  - Backend domain Postgres repositories and mappers.
- `packages/runtime` or backend runtime host
  - Runtime state repository interface and provider composition.
- `packages/memory`
  - Memory/rule/cache repository interfaces and in-memory implementation.
- `packages/skill`
  - Skill registry/draft/install repository interfaces and in-memory implementation.
- `packages/knowledge`
  - Knowledge artifact contracts and runtime-facing repository interfaces.
- `packages/tools`
  - Tool executors consume repository/facade interfaces instead of direct filesystem paths.

`packages/core` must not become a pseudo-shared implementation package. It should only hold stable schemas and inferred types.

## 5. Data Model Draft

Avoid one generic runtime key-value table as the primary design. JSONB is acceptable for extension fields, but core entities need explicit tables and indexes.

Minimum table groups:

- `runtime_tasks`
- `runtime_learning_jobs`
- `runtime_learning_queue`
- `runtime_chat_sessions`
- `runtime_chat_messages`
- `runtime_chat_events`
- `runtime_chat_checkpoints`
- `runtime_governance_records`
- `runtime_usage_audit`
- `runtime_eval_history`
- `skills_registry`
- `skill_drafts`
- `skill_install_receipts`
- `memory_records`
- `memory_events`
- `memory_evidence_links`
- `memory_profiles`
- `memory_reflections`
- `memory_resolution_candidates`
- `rules`
- `semantic_cache_entries`
- `knowledge_sources`
- `knowledge_chunks`
- `knowledge_ingestion_receipts`
- `runtime_schedules`
- `connector_drafts`
- `briefing_runs`
- `briefing_history`
- `legacy_data_import_receipts`
- `legacy_data_import_errors`

Every table with user, workspace, organization, session, task, or run scope needs explicit scope columns instead of relying on implicit JSON fields.

## 6. Migration Sequence

### Phase 1: Persistence Gate

Add the canonical persistence selector:

```text
BACKEND_PERSISTENCE=memory | postgres
DATABASE_URL=postgres://...
LEGACY_DATA_IMPORT=off | once
```

Rules:

- `memory` is ephemeral and never writes root `data/*`.
- `postgres` requires `DATABASE_URL` and fails fast when it is missing.
- `once` imports existing root `data/*` files into Postgres and records receipts.

### Phase 2: Runtime State

Migrate `FileRuntimeStateRepository` production wiring first.

Add:

- `RuntimeStateRepository` provider selection.
- `InMemoryRuntimeStateRepository`.
- `PostgresRuntimeStateRepository`.
- Migration from `data/runtime/tasks-state.json`.

This removes the largest single root `data` dependency.

### Phase 3: Skills

Migrate:

- workspace drafts
- registry
- installed records
- install receipts
- lab/stable records

`packages/skill` keeps interfaces and in-memory behavior. Postgres implementation lives in backend/host infrastructure.

### Phase 4: Memory, Rules, Cache

Migrate:

- memory records
- memory events
- evidence links
- profiles
- reflections
- resolution candidates
- rules
- semantic cache

Short term, these go to business Postgres. LangGraph Store remains graph runtime infrastructure and is not used as an implicit replacement for all memory repositories.

### Phase 5: Knowledge Snapshots

Runtime search stops reading `data/knowledge` directly.

Knowledge repositories are injected into runtime search factories. In memory mode, tests and demos use fixtures or in-memory repositories. In Postgres mode, runtime search consumes the database-backed knowledge repository.

### Phase 6: Tool Artifacts

Migrate tool-created artifacts:

- schedules
- connector drafts
- runtime archives
- cancellations
- recoveries
- briefings

New writes must go through repository/facade interfaces. Legacy JSON may only be read by import code.

### Phase 7: Root Data Removal

After all production write paths are removed:

- Delete tracked `data/rules/rules.jsonl`.
- Remove root `data/*` defaults from `packages/config`.
- Update `.gitignore` so root `data/*` is no longer documented as current runtime storage.
- Add a repository check that rejects new hard-coded root `data/*` runtime writes.
- Update all docs that still describe `data/*` as current default storage.

## 7. Legacy Import

`LEGACY_DATA_IMPORT=once` reads old local files and imports them into Postgres.

Supported sources:

- `data/runtime/tasks-state.json`
- `data/runtime/schedules/*.json`
- `data/runtime/briefings/*.json`
- `data/runtime/connectors/*.json`
- `data/memory/*.jsonl`
- `data/memory/*.json`
- `data/rules/rules.jsonl`
- `data/knowledge/**/records.json`
- `data/skills/**/*.json`

Import behavior:

- Validate every record with project schemas before insert.
- Write success receipts to `legacy_data_import_receipts`.
- Write parse or mapping failures to `legacy_data_import_errors`.
- Do not mutate or delete source files during import.
- Refuse repeated import. Any future force re-import behavior requires a separate approved migration change with its own audit semantics.

## 8. Error Handling

Postgres mode:

- Missing `DATABASE_URL` fails at startup.
- Migration/bootstrap failure fails at startup.
- Repository mapper parse failures become project persistence errors.
- Tool persistence failures return explicit governance/tool result errors.
- Vendor SQL errors do not leak raw rows, stack traces, or connection details into API responses.

Memory mode:

- Health endpoints report `ephemeral`.
- Restart recovery is unavailable by design.
- Tests must not assert durable state across process restarts in memory mode.

Legacy import:

- Bad records do not disappear silently.
- Import summary reports imported, skipped, and failed counts per source.
- Fatal source-level errors stop import for that source and record the reason.

## 9. Testing

Each migrated domain needs:

- schema parse tests
- in-memory repository behavior tests
- Postgres mapper and SQL parameter tests
- repository provider selection tests
- legacy import fixture tests
- affected TypeScript checks
- docs checks for updated guidance

Repository-wide checks should include:

- no new root `data/*` write paths
- no application-layer imports from implementation internals
- no third-party database types crossing repository boundaries

Expected command families:

```bash
pnpm exec vitest run --config vitest.config.js <affected-tests>
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm exec tsc -p packages/runtime/tsconfig.json --noEmit
pnpm check:docs
pnpm check:no-root-data-runtime
```

`pnpm check:no-root-data-runtime` is a new proposed guard and should be added during implementation.

## 10. Documentation Updates

Update current documentation instead of adding parallel notes.

Required current docs:

- `README.md`
- `docs/conventions/local-development-guide.md`
- `docs/conventions/backend-conventions.md`
- `docs/conventions/project-conventions.md`
- `docs/packages/memory/storage-and-search.md`
- `docs/packages/skill/README.md`
- `docs/packages/runtime/langgraph-postgres-checkpointer.md`
- `docs/apps/backend/agent-server/*` runtime and knowledge docs
- `docs/contracts/api/*` docs that mention runtime, knowledge, skill, or workspace draft storage
- `AGENTS.md` if execution or cleanup rules change

Outdated `data/*` descriptions should either be removed or rewritten as legacy import guidance. Historical notes may move to `docs/archive/`, but current docs must not keep root `data/*` as the default storage instruction.

## 11. Success Criteria

The migration is complete when:

- No production/runtime code writes root `data/runtime`, `data/memory`, `data/knowledge`, or `data/skills`.
- `data/rules/rules.jsonl` is removed from Git.
- `packages/config` no longer exposes root `data/*` as default durable paths.
- Postgres mode covers all durable state previously stored under root `data/*`.
- Memory mode is explicit, ephemeral, and verified.
- Legacy import can move old local JSON/JSONL into Postgres with receipts.
- Docs no longer describe root `data/*` as current default storage.
- The new repository guard rejects future root `data/*` persistence regressions.

## 12. Non-goals

- Do not delete root `data/` before repository providers and import paths exist.
- Do not move implementation repositories into `packages/core`.
- Do not use a generic JSON dump table as the only persistence design.
- Do not make LangGraph Postgres Store responsible for every business memory/rule/skill record.
- Do not preserve file persistence as a hidden local fallback after the cutover.
