# Intel Engine Implementation Plan

状态：current
文档类型：reference
适用范围：`agents/intel-engine`、`apps/backend/agent-server`、`packages/core`、`config/intel`
最后核对：2026-04-24

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first version of the local frontend and AI intelligence system with `agents/intel-engine`, `Bree` scheduling, SQLite persistence, YAML-based routing, Minimax web search ingestion, and multi-Lark delivery.

**Architecture:** Implement `agents/intel-engine` as the dedicated specialist host with a thin graph entry and service-first runtime internals. Keep stable contracts in `packages/core`, schedule jobs from `apps/backend/agent-server`, and drive source/routing/channel behavior from `config/intel/*.yaml`.

**Tech Stack:** TypeScript, Zod, LangGraph, Bree, SQLite, fs-extra, Vitest, NestJS, Lark webhook, Minimax MCP integration

## Progress Snapshot

- `Phase 1` 已完成：宿主骨架、稳定 contract、YAML 配置、SQLite repository、backend scheduler skeleton 已落地
- `Phase 2` 已基本打通：`patrol/ingest` collection runner、Minimax `web_search` MCP、signal 归一化、打分、路由命中、delivery 入队 已落地
- `Phase 3` 已部分完成：Lark webhook 发送与 delivery retry 已落地；digest graph 仍待实现
- backend 侧已新增 `RuntimeIntelSchedulerService`、`intel-worker.mjs` 与 `runIntelScheduledJob()`，并通过 `INTEL_SCHEDULER_ENABLED=true` 显式启用

---

## File Map

### New files

- `agents/intel-engine/package.json`
- `agents/intel-engine/src/index.ts`
- `agents/intel-engine/src/graphs/intel/intel.graph.ts`
- `agents/intel-engine/src/flows/intel/index.ts`
- `agents/intel-engine/src/flows/intel/schemas/patrol-graph-state.schema.ts`
- `agents/intel-engine/src/flows/intel/schemas/digest-graph-state.schema.ts`
- `agents/intel-engine/src/flows/intel/schemas/delivery-retry-graph-state.schema.ts`
- `agents/intel-engine/src/flows/intel/nodes/load-source-config.node.ts`
- `agents/intel-engine/src/flows/intel/nodes/build-search-tasks.node.ts`
- `agents/intel-engine/src/flows/intel/nodes/persist-raw-events.node.ts`
- `agents/intel-engine/src/runtime/storage/intel-db.ts`
- `agents/intel-engine/src/runtime/storage/intel.repositories.ts`
- `agents/intel-engine/src/runtime/routing/intel-route-matcher.ts`
- `agents/intel-engine/src/runtime/delivery/lark-webhook-delivery.ts`
- `agents/intel-engine/src/services/patrol-intel.service.ts`
- `agents/intel-engine/src/services/ingest-intel.service.ts`
- `agents/intel-engine/src/services/digest-intel.service.ts`
- `agents/intel-engine/src/services/retry-delivery.service.ts`
- `packages/core/src/intel/schemas/intel-signal.schema.ts`
- `packages/core/src/intel/schemas/intel-alert.schema.ts`
- `packages/core/src/intel/schemas/intel-delivery.schema.ts`
- `packages/core/src/intel/index.ts`
- `packages/core/test/intel/intel-contracts.spec.ts`
- `apps/backend/agent-server/src/runtime/intel/intel-scheduler.ts`
- `apps/backend/agent-server/test/runtime/intel/intel-scheduler.spec.ts`
- `config/intel/sources.yaml`
- `config/intel/channels.yaml`
- `config/intel/routes.yaml`
- `agents/intel-engine/demo/smoke.ts`

### Existing files to modify

- `packages/core/src/index.ts`
- `docs/backend/README.md`
- `pnpm-lock.yaml`
- workspace root package/tsconfig/turbo files as needed to register the new agent package and demo/typecheck tasks

## Phase 1

### Task 1: Create the `agents/intel-engine` Host Skeleton

**Files:**

- Create: `agents/intel-engine/package.json`
- Create: `agents/intel-engine/src/index.ts`
- Create: `agents/intel-engine/src/graphs/intel/intel.graph.ts`
- Create: `agents/intel-engine/src/flows/intel/index.ts`

- [ ] Write a failing type-level or import smoke test that expects `@agent/intel-engine` exports and a graph creator.
- [ ] Run the targeted test or `tsc --noEmit` to confirm the host package does not exist yet.
- [ ] Add the minimal package manifest, root exports, and graph entry with thin wiring only.
- [ ] Re-run the targeted check until the package resolves cleanly.
- [ ] Commit the skeleton before adding runtime details.

### Task 2: Add Stable Intel Contracts In `packages/core`

**Files:**

- Create: `packages/core/src/intel/schemas/intel-signal.schema.ts`
- Create: `packages/core/src/intel/schemas/intel-alert.schema.ts`
- Create: `packages/core/src/intel/schemas/intel-delivery.schema.ts`
- Create: `packages/core/src/intel/index.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/intel/intel-contracts.spec.ts`

- [ ] Write failing contract parse tests for signal, alert, and delivery records.
- [ ] Run the spec test and confirm missing exports or schemas.
- [ ] Implement schema-first contracts with `z.infer`-based exports.
- [ ] Re-run the spec test and fix parse mismatches until it passes.
- [ ] Commit the contract layer.

### Task 3: Add YAML Configuration And Loaders

**Files:**

- Create: `config/intel/sources.yaml`
- Create: `config/intel/channels.yaml`
- Create: `config/intel/routes.yaml`
- Create: `agents/intel-engine/src/flows/intel/schemas/*.ts` as needed for parsed config
- Test: `agents/intel-engine/test/config/intel-config.spec.ts`

- [ ] Write a failing config parse test that loads all three YAML files and validates route/channel/topic shape.
- [ ] Run the test to verify missing file or parse failures.
- [ ] Add the initial YAML files with the agreed six categories and multi-channel route semantics.
- [ ] Implement config loader helpers with explicit zod validation.
- [ ] Re-run the config test and commit when the files parse successfully.

### Task 4: Add SQLite Runtime Storage

**Files:**

- Create: `agents/intel-engine/src/runtime/storage/intel-db.ts`
- Create: `agents/intel-engine/src/runtime/storage/intel.repositories.ts`
- Test: `agents/intel-engine/test/runtime/storage/intel.repositories.spec.ts`

- [ ] Write a failing repository test for creating and querying `raw_events`, `signals`, and `deliveries`.
- [ ] Run it to verify the storage layer is missing.
- [ ] Implement the SQLite connection, schema bootstrap, and repositories.
- [ ] Re-run the repository test until create/query/update flows pass.
- [ ] Commit the storage layer.

### Task 5: Register Bree Scheduler In Backend

**Files:**

- Create: `apps/backend/agent-server/src/runtime/intel/intel-scheduler.ts`
- Test: `apps/backend/agent-server/test/runtime/intel/intel-scheduler.spec.ts`

- [ ] Write a failing scheduler test that expects `intel-patrol`, `intel-ingest`, `intel-digest`, and `intel-delivery-retry` jobs to be registered.
- [ ] Run the test and confirm the scheduler module does not exist.
- [ ] Implement the Bree scheduler wrapper and job registration only.
- [ ] Re-run the scheduler test and a backend typecheck.
- [ ] Commit the backend integration skeleton.

## Phase 2

### Task 6: Build Patrol Graph State And Node Contracts

**Files:**

- Create: `agents/intel-engine/src/flows/intel/schemas/patrol-graph-state.schema.ts`
- Create: `agents/intel-engine/src/flows/intel/nodes/load-source-config.node.ts`
- Create: `agents/intel-engine/src/flows/intel/nodes/build-search-tasks.node.ts`
- Test: `agents/intel-engine/test/flows/intel/patrol-state.spec.ts`

- [ ] Write failing tests for patrol state parsing and for building search tasks from `sources.yaml`.
- [ ] Run the tests and confirm missing node implementations.
- [ ] Implement the minimal patrol state schema and task expansion nodes.
- [ ] Re-run the tests until task expansion is deterministic.
- [ ] Commit the patrol graph foundation.

### Task 7: Add Raw Ingestion And Signal Normalization

**Files:**

- Create: `agents/intel-engine/src/flows/intel/nodes/persist-raw-events.node.ts`
- Create: `agents/intel-engine/src/flows/intel/nodes/normalize-signals.node.ts`
- Test: `agents/intel-engine/test/flows/intel/normalize-signals.spec.ts`

- [ ] Write failing tests that take mocked search results and expect normalized signal candidates with category and product tags.
- [ ] Run the tests to verify the nodes are missing.
- [ ] Implement minimal raw-event persistence and normalization logic.
- [ ] Re-run tests and fix category/tag extraction until stable.
- [ ] Commit the ingestion + normalization step.

### Task 8: Add Dedupe, Scoring, And Alert Decisions

**Files:**

- Create: `agents/intel-engine/src/flows/intel/nodes/dedupe-and-merge.node.ts`
- Create: `agents/intel-engine/src/flows/intel/nodes/score-signal.node.ts`
- Create: `agents/intel-engine/src/flows/intel/nodes/decide-alerts.node.ts`
- Test: `agents/intel-engine/test/flows/intel/signal-decision.spec.ts`

- [ ] Write failing tests for `pending`, `confirmed`, `P0`, and `P1` decisions, including `pending -> confirmed` upgrade behavior.
- [ ] Run the tests to verify the scoring nodes do not exist.
- [ ] Implement minimal dedupe, scoring, and alert decision logic.
- [ ] Re-run the tests until status transitions and priority scoring match the design.
- [ ] Commit the decision layer.

### Task 9: Add Route Matching And Delivery Queue Creation

**Files:**

- Create: `agents/intel-engine/src/runtime/routing/intel-route-matcher.ts`
- Create: `agents/intel-engine/src/flows/intel/nodes/match-routes.node.ts`
- Create: `agents/intel-engine/src/flows/intel/nodes/enqueue-deliveries.node.ts`
- Test: `agents/intel-engine/test/runtime/routing/intel-route-matcher.spec.ts`

- [ ] Write failing tests for multi-rule matching, multi-channel merges, and final channel de-duplication.
- [ ] Run the tests and confirm route matching is not implemented.
- [ ] Implement route matching and delivery enqueue logic with 24-hour duplicate suppression.
- [ ] Re-run the tests until one signal can target multiple Lark channels without duplicate deliveries.
- [ ] Commit the routing layer.

### Task 10: Wire Patrol Graph And Add A Demo Smoke

**Files:**

- Modify: `agents/intel-engine/src/graphs/intel/intel.graph.ts`
- Create: `agents/intel-engine/demo/smoke.ts`
- Test: `agents/intel-engine/test/graphs/intel.graph.int-spec.ts`

- [ ] Write a failing integration-style test that runs the patrol graph with mocked search results and expects queued deliveries.
- [ ] Run the test to confirm the graph is not wired end-to-end.
- [ ] Wire the graph to the implemented nodes and add a minimal demo entry.
- [ ] Re-run the integration test and demo command until the happy path passes.
- [ ] Commit the patrol graph milestone.

## Phase 3

### Task 11: Add Lark Delivery Runtime

**Files:**

- Create: `agents/intel-engine/src/runtime/delivery/lark-webhook-delivery.ts`
- Test: `agents/intel-engine/test/runtime/delivery/lark-webhook-delivery.spec.ts`

- [ ] Write a failing test for sending a delivery payload to a mocked Lark webhook target.
- [ ] Run the test to confirm the sender is missing.
- [ ] Implement the minimal Lark sender with structured result recording.
- [ ] Re-run the test until success and failure responses are both handled.
- [ ] Commit the delivery runtime.

### Task 12: Add Digest Graph

**Files:**

- Create: `agents/intel-engine/src/flows/intel/schemas/digest-graph-state.schema.ts`
- Create: digest nodes under `agents/intel-engine/src/flows/intel/nodes/`
- Modify: `agents/intel-engine/src/graphs/intel/intel.graph.ts` or split if needed
- Test: `agents/intel-engine/test/flows/intel/digest.int-spec.ts`

- [ ] Write a failing digest integration test that groups same-day signals into frontend, AI, and management summaries.
- [ ] Run the test to verify digest nodes do not exist.
- [ ] Implement the minimal digest state, grouping, rendering, and persistence logic.
- [ ] Re-run the digest integration test until summaries and queued digest deliveries are created.
- [ ] Commit the digest graph.

### Task 13: Add Delivery Retry Graph

**Files:**

- Create: `agents/intel-engine/src/flows/intel/schemas/delivery-retry-graph-state.schema.ts`
- Create: retry nodes under `agents/intel-engine/src/flows/intel/nodes/`
- Create: `agents/intel-engine/test/flows/intel/delivery-retry.int-spec.ts`

- [ ] Write a failing retry integration test that loads failed deliveries and retries only eligible records.
- [ ] Run the test to verify retry flow is missing.
- [ ] Implement retry filtering, resend, status updates, and expiry closure.
- [ ] Re-run the retry integration test until success/failure/closed states are correct.
- [ ] Commit the retry graph.

### Task 14: Add Backend Boot Integration And Verification

**Files:**

- Modify: backend bootstrap/runtime host files as needed to start the intel scheduler
- Modify: docs and package scripts as needed
- Test: affected backend and workspace smoke tests

- [ ] Add the intel scheduler to backend startup in the narrowest possible boot path.
- [ ] Run targeted backend tests first, then the intel-engine demo.
- [ ] Run type, spec, unit, demo, and integration verification for the affected scope.
- [ ] Update docs if the runtime integration differs from the current design.
- [ ] Commit the final integration milestone.

## Verification

Run at minimum for affected scope:

- `pnpm exec tsc -p agents/intel-engine/tsconfig.json --noEmit`
- `pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit`
- `pnpm test:spec:affected`
- `pnpm test:unit:affected`
- `pnpm test:demo:affected`
- `pnpm test:integration:affected`
- `pnpm check:docs`

If the affected runners are blocked by unrelated issues, fall back to targeted commands and record the blocker explicitly in the delivery note.
