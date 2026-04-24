# Intel Verify Evidence Merge Implementation Plan

状态：current
文档类型：reference
适用范围：`agents/intel-engine`、`apps/backend/agent-server/src/runtime/intel`、Intel 验证与证据归并链路
最后核对：2026-04-24

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore Intel-related verification and make patrol evidence merge deterministic from raw search result to final signal source references.

**Architecture:** Keep the existing `agents/intel-engine` graph/service/repository boundaries. Add a narrow SQLite error diagnostic helper, unify content hash/source id helpers, make raw event/source writes idempotent, and replace the current `normalizedSignals[index]` source binding with a final-signal mapping produced by dedupe/merge.

**Tech Stack:** TypeScript, Zod, Vitest, `better-sqlite3`, `fs-extra`, existing `@agent/core` Intel schemas.

---

## File Structure

- Modify `agents/intel-engine/src/runtime/storage/intel-db.ts`: add ABI mismatch diagnostic helper around database open.
- Modify `agents/intel-engine/src/runtime/storage/intel.repositories.ts`: make raw event insert idempotent and keep signal source upsert behavior deterministic.
- Create `agents/intel-engine/src/flows/intel/nodes/intel-evidence-helpers.ts`: shared deterministic `contentHash` and `signalSourceId` helpers.
- Modify `agents/intel-engine/src/flows/intel/nodes/run-web-search.ts`: use the shared hash helper.
- Modify `agents/intel-engine/src/flows/intel/nodes/persist-raw-events.ts`: use the shared hash helper.
- Modify `agents/intel-engine/src/flows/intel/nodes/dedupe-and-merge.ts`: merge same-run duplicate `dedupeKey` signals and expose final signal mapping.
- Create `agents/intel-engine/src/flows/intel/nodes/attach-signal-sources.ts`: build `IntelSignalSource[]` from raw results and final signal mapping.
- Modify `agents/intel-engine/src/flows/intel/schemas/patrol-graph-state.schema.ts`: add `signalMergeMap` state for final signal mapping.
- Modify `agents/intel-engine/src/services/patrol-intel.service.ts`: replace lightweight normalized-index source writes with final signal evidence attachment.
- Modify `agents/intel-engine/test/runtime/storage/intel.repositories.test.ts`: cover ABI diagnostic and raw/source idempotency.
- Modify `agents/intel-engine/test/flows/intel/normalize-signals.spec.ts`: cover same-run dedupe evidence attachment.
- Modify `agents/intel-engine/test/services/patrol-intel.service.spec.ts`: cover patrol source refs on final signal ids.
- Modify `agents/intel-engine/test/flows/intel/digest.int-spec.ts`: assert digest evidence counts for official/community refs.
- Modify `apps/backend/agent-server/test/runtime/intel/intel-runner.spec.ts`: keep scheduled job coverage aligned with final-signal evidence behavior.
- Modify `docs/backend/frontend-ai-intel-system-design.md`: update current status and remove stale Prettier blocker note.

Do not assign multiple workers to these files at the same time: `intel.repositories.ts`, `patrol-intel.service.ts`, `patrol-graph-state.schema.ts`, `intel.graph.ts`, `intel-runner.spec.ts`.

## Task 1: SQLite Diagnostic And Raw Event Idempotency

**Files:**

- Modify: `agents/intel-engine/src/runtime/storage/intel-db.ts`
- Modify: `agents/intel-engine/src/runtime/storage/intel.repositories.ts`
- Modify: `agents/intel-engine/test/runtime/storage/intel.repositories.test.ts`

- [ ] **Step 1: Add failing tests for ABI diagnostic and raw event idempotency**

Add tests that call a pure helper with this native mismatch text:

```ts
const error = new Error(
  "The module 'better_sqlite3.node' was compiled against a different Node.js version using NODE_MODULE_VERSION 137. This version of Node.js requires NODE_MODULE_VERSION 127."
);
const normalized = normalizeIntelDatabaseOpenError(error);
expect(normalized.message).toContain('better-sqlite3');
expect(normalized.message).toContain('NODE_MODULE_VERSION');
expect(normalized.cause).toBe(error);
```

Add a raw event idempotency assertion:

```ts
const firstId = repositories.rawEvents.insert(rawEventInput);
const secondId = repositories.rawEvents.insert({ ...rawEventInput, snippet: 'updated snippet' });
expect(secondId).toBe(firstId);
```

- [ ] **Step 2: Run the focused storage test and confirm it fails**

Run:

```bash
pnpm --dir agents/intel-engine test -- test/runtime/storage/intel.repositories.test.ts
```

Expected before implementation: missing `normalizeIntelDatabaseOpenError` export or SQLite unique constraint on repeated `contentHash`.

- [ ] **Step 3: Implement the diagnostic helper**

In `intel-db.ts`, export:

```ts
export function normalizeIntelDatabaseOpenError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (/better_sqlite3|better-sqlite3|NODE_MODULE_VERSION|different Node\.js version/i.test(message)) {
    return new Error(
      `Failed to open Intel SQLite database because better-sqlite3 was built for a different Node.js ABI. Reinstall or rebuild workspace dependencies, then rerun pnpm verify. Original error: ${message}`,
      { cause: error }
    );
  }
  return error instanceof Error ? error : new Error(message);
}
```

Wrap only `new Database(databaseFile)`:

```ts
let database: Database.Database;
try {
  database = new Database(databaseFile);
} catch (error) {
  throw normalizeIntelDatabaseOpenError(error);
}
```

- [ ] **Step 4: Make raw event insert idempotent**

Change the raw event insert SQL to use `ON CONFLICT(content_hash) DO UPDATE`, then return the existing/new row id by querying `content_hash`:

```ts
const selectByHash = database.prepare(`SELECT id FROM raw_events WHERE content_hash = ?`);
```

`insert(input)` should run the upsert, then return `Number((selectByHash.get(input.contentHash) as { id: number }).id)`.

- [ ] **Step 5: Re-run storage tests**

Run:

```bash
pnpm --dir agents/intel-engine test -- test/runtime/storage/intel.repositories.test.ts
```

Expected: PASS.

## Task 2: Deterministic Evidence Helpers

**Files:**

- Create: `agents/intel-engine/src/flows/intel/nodes/intel-evidence-helpers.ts`
- Modify: `agents/intel-engine/src/flows/intel/nodes/run-web-search.ts`
- Modify: `agents/intel-engine/src/flows/intel/nodes/persist-raw-events.ts`
- Test: `agents/intel-engine/test/flows/intel/normalize-signals.spec.ts`

- [ ] **Step 1: Write failing helper expectations**

Add assertions:

```ts
expect(
  resolveIntelContentHash({
    taskId: 'task',
    url: 'https://x.test/a',
    publishedAt: '2026-04-24T00:00:00.000Z',
    title: 'Title'
  })
).toMatch(/^[a-f0-9]{40}$/);
expect(resolveIntelSignalSourceId('signal_1', 'hash_1')).toBe('signal_source_signal_1_hash_1');
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```bash
pnpm --dir agents/intel-engine test -- test/flows/intel/normalize-signals.spec.ts
```

Expected before implementation: missing helper import.

- [ ] **Step 3: Implement shared helpers**

Create `intel-evidence-helpers.ts`:

```ts
import { createHash } from 'node:crypto';

export interface IntelContentHashInput {
  taskId: string;
  url: string;
  publishedAt: string;
  title: string;
}

export function resolveIntelContentHash(input: IntelContentHashInput): string {
  return createHash('sha1').update(`${input.taskId}:${input.url}:${input.publishedAt}:${input.title}`).digest('hex');
}

export function resolveIntelSignalSourceId(signalId: string, contentHash: string): string {
  return `signal_source_${signalId}_${contentHash}`.replace(/[^a-zA-Z0-9_:.-]+/g, '_');
}
```

- [ ] **Step 4: Replace duplicate hash logic**

Use `resolveIntelContentHash()` in `run-web-search.ts` and `persist-raw-events.ts`. Remove the local `createHash` import from `run-web-search.ts`.

- [ ] **Step 5: Re-run focused tests**

Run:

```bash
pnpm --dir agents/intel-engine test -- test/flows/intel/normalize-signals.spec.ts
```

Expected: PASS.

## Task 3: Dedupe Final Signal Mapping

**Files:**

- Modify: `agents/intel-engine/src/flows/intel/nodes/dedupe-and-merge.ts`
- Modify: `agents/intel-engine/src/flows/intel/schemas/patrol-graph-state.schema.ts`
- Test: `agents/intel-engine/test/flows/intel/normalize-signals.spec.ts`

- [ ] **Step 1: Add failing same-run dedupe test**

Create two incoming signals with the same `dedupeKey` and different ids. Assert:

```ts
const state = dedupeAndMergeNode({ existingSignals: [], incomingSignals: [first, second] });
expect(state.mergedSignals).toHaveLength(1);
expect(state.signalMergeMap).toEqual({
  [first.id]: state.mergedSignals[0].id,
  [second.id]: state.mergedSignals[0].id
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```bash
pnpm --dir agents/intel-engine test -- test/flows/intel/normalize-signals.spec.ts
```

Expected before implementation: duplicate merged signals or missing `signalMergeMap`.

- [ ] **Step 3: Add state schema for merge map**

Add to `PatrolGraphStateSchema`:

```ts
signalMergeMap: z.record(z.string(), z.string()).default({}),
```

- [ ] **Step 4: Implement same-run dedupe**

In `dedupe-and-merge.ts`, maintain both `byDedupeKey` and `signalMergeMap`. When incoming has no existing entry, add it to the map. When a later incoming has the same key, merge it into the existing final signal and update `signalMergeMap[incoming.id]`.

- [ ] **Step 5: Re-run focused tests**

Run:

```bash
pnpm --dir agents/intel-engine test -- test/flows/intel/normalize-signals.spec.ts
```

Expected: PASS.

## Task 4: Attach Signal Sources To Final Signals

**Files:**

- Create: `agents/intel-engine/src/flows/intel/nodes/attach-signal-sources.ts`
- Modify: `agents/intel-engine/src/services/patrol-intel.service.ts`
- Test: `agents/intel-engine/test/services/patrol-intel.service.spec.ts`

- [ ] **Step 1: Add failing patrol evidence test**

Use a mocked search result set with two official/community results that normalize to one `dedupeKey`. After `executePatrolIntelRun()`, assert `repositories.signalSources.listBySignal(finalSignalId)` returns two refs and both use the final signal id.

- [ ] **Step 2: Run the patrol service test and confirm it fails**

Run:

```bash
pnpm --dir agents/intel-engine test -- test/services/patrol-intel.service.spec.ts
```

Expected before implementation: sources are attached to incoming ids or collide on `signal_source_${signal.id}`.

- [ ] **Step 3: Implement source attachment helper**

Create `attach-signal-sources.ts` with a function that accepts `rawResults`, `normalizedSignals`, `signalMergeMap`, and `createdAt`, then returns `IntelSignalSource[]`. Use `resolveIntelSignalSourceId(finalSignalId, contentHash)`.

- [ ] **Step 4: Replace service source binding**

In `executePatrolIntelRun()`, replace the `normalized.normalizedSignals.map((signal, index) => ...)` block with the new helper and pass `merged.signalMergeMap`.

- [ ] **Step 5: Re-run patrol service test**

Run:

```bash
pnpm --dir agents/intel-engine test -- test/services/patrol-intel.service.spec.ts
```

Expected: PASS.

## Task 5: Digest And Backend Runner Regression

**Files:**

- Modify: `agents/intel-engine/test/flows/intel/digest.int-spec.ts`
- Modify: `apps/backend/agent-server/test/runtime/intel/intel-runner.spec.ts`

- [ ] **Step 1: Add digest evidence assertions**

In digest integration coverage, assert rendered markdown includes:

```ts
expect(markdown).toContain('Evidence: 2 sources (1 official / 1 community)');
```

- [ ] **Step 2: Keep backend runner aligned**

If backend runner tests inspect queued summaries, add an assertion that patrol-created sources can be read before digest runs. Keep production `intel-runner.ts` unchanged unless tests expose a real orchestration gap.

- [ ] **Step 3: Run focused integration and backend tests**

Run:

```bash
pnpm --dir agents/intel-engine test:integration
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/runtime/intel
```

Expected: PASS.

## Task 6: Documentation And Full Verification

**Files:**

- Modify: `docs/backend/frontend-ai-intel-system-design.md`
- Modify: `docs/superpowers/specs/2026-04-24-intel-verify-evidence-merge-design.md`

- [ ] **Step 1: Update Intel current state**

Record that patrol now persists source refs against final merged signals and digest reads them as evidence summary. Replace the stale Prettier blocker note with the final verification status from this implementation.

- [ ] **Step 2: Run package verification**

Run:

```bash
pnpm --dir agents/intel-engine verify
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/runtime/intel
pnpm check:docs
```

Expected: PASS.

- [ ] **Step 3: Run root verification**

Run:

```bash
pnpm verify
```

Expected: PASS. If native ABI still fails, the error must mention `better-sqlite3`, `NODE_MODULE_VERSION`, and reinstall/rebuild guidance.

- [ ] **Step 4: Commit implementation**

Stage only files touched for this Intel implementation and commit with:

```bash
git commit -m "fix: stabilize intel evidence merge"
```
