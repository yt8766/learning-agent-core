# Knowledge Internal RAG Boundaries Implementation Plan

状态：current
文档类型：plan
适用范围：`packages/knowledge/src/observability`、`packages/knowledge/src/runtime`、`packages/knowledge/src/rag`、`packages/knowledge/src/indexing`、`packages/knowledge/src/eval`
最后核对：2026-05-10

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Map the course RAG SDK package boundaries into `packages/knowledge/src/*`, starting with observability/runtime metrics and continuing through indexing observer, trace-to-eval, and SDK surface cleanup.

**Architecture:** Keep `packages/knowledge` as one workspace package, but make its internal source folders match the course project's `core + indexing + adapters + runtime + observability + eval` boundaries. Runtime and indexing own execution facts; observability owns safe trace/event/metric collection; eval consumes traces.

**Tech Stack:** TypeScript, zod schemas, Vitest, pnpm workspace.

**Implementation status:** Completed on 2026-05-10. The stable `src/observability` boundary now owns observer helpers and safe wrappers; runtime RAG/retrieval/indexing emit trace metrics; eval can build samples from trace quality signals; `build:types` no longer emits test declarations.

---

## File Structure

- Modify: `packages/knowledge/src/contracts/schemas/knowledge-observability-eval.schema.ts`
  - Add `KnowledgeRagMetricSchema` and `metrics` on `KnowledgeRagTraceSchema`.
- Modify: `packages/knowledge/src/contracts/types/knowledge-observability-eval.types.ts`
  - Export inferred metric type.
- Create: `packages/knowledge/src/observability/index.ts`
  - Stable observability barrel for Knowledge SDK.
- Create: `packages/knowledge/src/observability/knowledge-rag-observer.ts`
  - Stable observer implementation now lives here.
- Delete: `packages/knowledge/src/runtime/observability/*`
  - Runtime observability compatibility re-export is removed after import migration.
- Modify: `packages/knowledge/src/rag/runtime/run-knowledge-rag.ts`
  - Emit final trace `metrics` from runtime counters.
  - Wrap observer calls so observer failures do not break successful runtime runs.
- Modify: `packages/knowledge/src/runtime/pipeline/run-knowledge-retrieval.ts`
  - Emit retrieval trace `metrics` from runtime counters.
  - Wrap observer calls.
- Modify: `packages/knowledge/src/index.ts`
  - Export `./observability`.
- Modify: `packages/knowledge/test/knowledge-observability-runtime.test.ts`
  - Add metrics schema/runtime observer tests.
- Modify: `packages/knowledge/test/run-knowledge-rag.test.ts`
  - Add runtime metrics and observer failure isolation regression.
- Modify: `packages/knowledge/test/run-knowledge-retrieval.test.ts`
  - Add retrieval metrics regression.
- Modify: `docs/packages/knowledge/observability-eval-contracts.md`
  - Document observability directory and runtime-owned metrics.
- Modify: `packages/knowledge/src/indexing/pipeline/run-knowledge-indexing.ts`
  - Add observer support for indexing events and quality-gate metrics.
- Modify: `packages/knowledge/src/indexing/types/indexing.types.ts`
  - Add optional observer/trace input fields.
- Modify: `packages/knowledge/test/indexing-pipeline.test.ts`
  - Add indexing observer regression tests.
- Modify/Create: `packages/knowledge/src/eval/knowledge-trace-sample-builder.ts`
  - Convert trace quality signals into eval samples.
- Modify: `packages/knowledge/test/knowledge-golden-eval.test.ts` or create `packages/knowledge/test/knowledge-trace-sample-builder.test.ts`
  - Add trace-to-eval-sample regressions.
- Modify: `packages/knowledge/test/sdk-entrypoints.test.ts`
  - Mark stable subpath entrypoints and prepare root export cleanup assertions.
- Modify: `packages/knowledge/tsconfig.types.json`
  - Exclude test declarations from build types if currently emitted.

## Task 1: Add Metric Contract

- [x] **Step 1: Write failing contract test**

Add to `packages/knowledge/test/knowledge-observability-runtime.test.ts`:

```ts
it('parses runtime metrics on a RAG trace', () => {
  const trace = KnowledgeRagTraceSchema.parse({
    traceId: 'trace-metrics',
    operation: 'rag.run',
    status: 'succeeded',
    startedAt: '2026-05-10T00:00:00.000Z',
    endedAt: '2026-05-10T00:00:01.000Z',
    events: [],
    metrics: [
      { traceId: 'trace-metrics', name: 'runtime.duration_ms', value: 1000, unit: 'ms', stage: 'generation' },
      { traceId: 'trace-metrics', name: 'retrieval.hit_count', value: 3, unit: 'count', stage: 'retrieval' }
    ]
  });

  expect(trace.metrics).toHaveLength(2);
});
```

- [x] **Step 2: Run red test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/knowledge-observability-runtime.test.ts
```

Expected: FAIL because `metrics` is not accepted on `KnowledgeRagTraceSchema`.

- [x] **Step 3: Implement schema**

In `packages/knowledge/src/contracts/schemas/knowledge-observability-eval.schema.ts`, add:

```ts
export const KnowledgeRagMetricUnitSchema = z.enum(['ms', 'count', 'tokens', 'ratio', 'bytes']);

export const KnowledgeRagMetricSchema = z
  .object({
    traceId: z.string().min(1),
    name: z.string().min(1),
    value: z.number().finite(),
    unit: KnowledgeRagMetricUnitSchema.optional(),
    stage: KnowledgeRagEventStageSchema.optional(),
    attributes: JsonObjectSchema.optional()
  })
  .strict();
```

Then add to `KnowledgeRagTraceSchema`:

```ts
metrics: z.array(KnowledgeRagMetricSchema).optional(),
```

- [x] **Step 4: Export type**

In `packages/knowledge/src/contracts/types/knowledge-observability-eval.types.ts`, export:

```ts
export type KnowledgeRagMetric = z.infer<typeof KnowledgeRagMetricSchema>;
export type KnowledgeRagMetricUnit = z.infer<typeof KnowledgeRagMetricUnitSchema>;
```

- [x] **Step 5: Run green test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/knowledge-observability-runtime.test.ts
```

Expected: PASS.

## Task 2: Move Observer Boundary

- [x] **Step 1: Create stable observability directory**

Create `packages/knowledge/src/observability/knowledge-rag-observer.ts` as the stable observer implementation.

- [x] **Step 2: Create stable barrel**

Create `packages/knowledge/src/observability/index.ts`:

```ts
export {
  InMemoryKnowledgeRagObserver,
  createInMemoryKnowledgeRagObserver,
  exportKnowledgeRagTrace,
  finishKnowledgeRagTrace,
  listKnowledgeRagTraces,
  recordKnowledgeRagEvent,
  startKnowledgeRagTrace
} from './knowledge-rag-observer';
export type {
  KnowledgeRagObserver,
  KnowledgeRagTraceFinishInput,
  KnowledgeRagTraceStartInput
} from './knowledge-rag-observer';
```

- [x] **Step 3: Remove compatibility re-export**

Delete `packages/knowledge/src/runtime/observability/*` after runtime and tests import from `packages/knowledge/src/observability`.

- [x] **Step 4: Export from root**

In `packages/knowledge/src/index.ts`, add:

```ts
export * from './observability';
```

- [x] **Step 5: Run boundary tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/root-exports.test.ts packages/knowledge/test/knowledge-observability-runtime.test.ts
```

Expected: PASS.

## Task 3: Emit RAG Runtime Metrics

- [x] **Step 1: Write failing runtime metrics test**

Add to `packages/knowledge/test/run-knowledge-rag.test.ts`:

```ts
it('records runtime-owned metrics in the final RAG trace', async () => {
  const observer = createInMemoryKnowledgeRagObserver();
  const hit = makeHit({ chunkId: 'metric-hit', score: 0.95 });

  await runKnowledgeRag({
    query: 'How are runtime metrics recorded?',
    accessibleKnowledgeBases,
    policy,
    plannerProvider: makePlannerProvider({
      rewrittenQuery: 'runtime metrics',
      queryVariants: ['runtime metrics'],
      selectedKnowledgeBaseIds: ['kb_runtime'],
      searchMode: 'hybrid',
      selectionReason: 'Runtime docs are relevant.',
      confidence: 0.91
    }),
    searchService: makeSearchService([hit]),
    answerProvider: makeAnswerProvider(async input => ({
      text: 'Metrics are runtime-owned.',
      citations: input.citations
    })),
    observer,
    traceId: 'trace-rag-metrics',
    idFactory: () => 'rag-metrics-run'
  });

  const trace = exportKnowledgeRagTrace(observer, 'trace-rag-metrics');
  expect(trace.metrics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: 'runtime.duration_ms', unit: 'ms' }),
      expect.objectContaining({ name: 'retrieval.hit_count', value: 1, unit: 'count' }),
      expect.objectContaining({ name: 'generation.grounded_citation_rate', value: 1, unit: 'ratio' })
    ])
  );
});
```

- [x] **Step 2: Run red test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/run-knowledge-rag.test.ts
```

Expected: FAIL because `trace.metrics` is missing.

- [x] **Step 3: Implement metric builder**

In `packages/knowledge/src/rag/runtime/run-knowledge-rag.ts`, add a helper:

```ts
function buildRagRuntimeMetrics(input: {
  traceId: string;
  durationMs: number;
  plannerDurationMs: number;
  retrievalDurationMs: number;
  answerDurationMs: number;
  hitCount: number;
  selectedCount: number;
  groundedCitationRate: number;
}): KnowledgeRagMetric[] {
  return [
    { traceId: input.traceId, name: 'runtime.duration_ms', value: input.durationMs, unit: 'ms', stage: 'generation' },
    {
      traceId: input.traceId,
      name: 'planner.duration_ms',
      value: input.plannerDurationMs,
      unit: 'ms',
      stage: 'pre-retrieval'
    },
    {
      traceId: input.traceId,
      name: 'retrieval.duration_ms',
      value: input.retrievalDurationMs,
      unit: 'ms',
      stage: 'retrieval'
    },
    {
      traceId: input.traceId,
      name: 'generation.duration_ms',
      value: input.answerDurationMs,
      unit: 'ms',
      stage: 'generation'
    },
    { traceId: input.traceId, name: 'retrieval.hit_count', value: input.hitCount, unit: 'count', stage: 'retrieval' },
    {
      traceId: input.traceId,
      name: 'retrieval.selected_count',
      value: input.selectedCount,
      unit: 'count',
      stage: 'post-retrieval'
    },
    {
      traceId: input.traceId,
      name: 'generation.grounded_citation_rate',
      value: input.groundedCitationRate,
      unit: 'ratio',
      stage: 'generation'
    }
  ];
}
```

Pass `metrics` into `finishKnowledgeRagTrace()`.

- [x] **Step 4: Run green test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/run-knowledge-rag.test.ts
```

Expected: PASS.

## Task 4: Isolate Observer Failures

- [x] **Step 1: Write failing observer isolation test**

Add to `packages/knowledge/test/run-knowledge-rag.test.ts`:

```ts
it('does not fail a successful RAG run when observer recording throws', async () => {
  const result = await runKnowledgeRag({
    query: 'observer failure isolation',
    accessibleKnowledgeBases,
    policy,
    plannerProvider: makePlannerProvider({
      queryVariants: ['observer failure isolation'],
      selectedKnowledgeBaseIds: ['kb_runtime'],
      searchMode: 'hybrid',
      selectionReason: 'Runtime docs are relevant.',
      confidence: 0.9
    }),
    searchService: makeSearchService([makeHit()]),
    answerProvider: makeAnswerProvider(async input => ({
      text: 'Observer failures are isolated.',
      citations: input.citations
    })),
    observer: {
      startTrace() {
        throw new Error('observer unavailable');
      },
      recordEvent() {
        throw new Error('observer unavailable');
      },
      finishTrace() {
        throw new Error('observer unavailable');
      },
      exportTrace() {
        throw new Error('observer unavailable');
      },
      listTraces() {
        return [];
      }
    }
  });

  expect(result.answer.text).toBe('Observer failures are isolated.');
});
```

- [x] **Step 2: Run red test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/run-knowledge-rag.test.ts
```

Expected: FAIL because observer exceptions currently propagate.

- [x] **Step 3: Implement safe observer wrappers**

In `packages/knowledge/src/observability/knowledge-rag-observer.ts`, add:

```ts
export function tryStartKnowledgeRagTrace(
  observer: KnowledgeRagObserver | undefined,
  input: KnowledgeRagTraceStartInput
): void {
  try {
    observer?.startTrace(input);
  } catch {
    // Observer failures must not break runtime execution.
  }
}
```

Repeat for `tryRecordKnowledgeRagEvent()` and `tryFinishKnowledgeRagTrace()`.

Update runtime files to use `try*` helpers for runtime-owned calls.

- [x] **Step 4: Run green test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/run-knowledge-rag.test.ts
```

Expected: PASS.

## Task 5: Emit Retrieval Runtime Metrics

- [x] **Step 1: Add retrieval metrics regression**

In `packages/knowledge/test/run-knowledge-retrieval.test.ts`, add an observer test that exports the trace and expects:

```ts
expect(trace.metrics).toEqual(
  expect.arrayContaining([
    expect.objectContaining({ name: 'runtime.duration_ms', unit: 'ms' }),
    expect.objectContaining({ name: 'retrieval.duration_ms', unit: 'ms' }),
    expect.objectContaining({ name: 'retrieval.hit_count', unit: 'count' }),
    expect.objectContaining({ name: 'retrieval.selected_count', unit: 'count' })
  ])
);
```

- [x] **Step 2: Run red test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/run-knowledge-retrieval.test.ts
```

Expected: FAIL because retrieval trace metrics are missing.

- [x] **Step 3: Implement retrieval metrics**

In `packages/knowledge/src/runtime/pipeline/run-knowledge-retrieval.ts`, build metrics from:

- total `Date.now() - startMs`
- retrieval latency / diagnostics latency
- final hit count
- selected count

Pass them to `finishKnowledgeRagTrace()`.

- [x] **Step 4: Run green test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/run-knowledge-retrieval.test.ts
```

Expected: PASS.

## Task 6: Docs And Verification

- [x] **Step 1: Update docs**

Update `docs/packages/knowledge/observability-eval-contracts.md`:

- `packages/knowledge/src/observability` is the stable observability boundary.
- `packages/knowledge/src/runtime/observability` has been removed.
- runtime owns metric facts.
- observer failures do not break runtime.

- [x] **Step 2: Run focused tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/knowledge-observability-runtime.test.ts packages/knowledge/test/run-knowledge-rag.test.ts packages/knowledge/test/run-knowledge-retrieval.test.ts
```

Expected: PASS.

- [x] **Step 3: Run package validation**

Run:

```bash
pnpm --dir packages/knowledge test
pnpm --dir packages/knowledge typecheck
pnpm check:docs
pnpm build:lib
```

Expected: PASS.

- [x] **Step 4: Run diff whitespace check**

Run:

```bash
git diff --check -- packages/knowledge/src packages/knowledge/test docs/packages/knowledge docs/superpowers/specs docs/superpowers/plans
```

Expected: no output and exit 0.

## Task 7: Add Indexing Observer Events

- [x] **Step 1: Write failing indexing observer test**

Add to `packages/knowledge/test/indexing-pipeline.test.ts`:

```ts
it('emits indexing observer events and trace metrics from pipeline diagnostics', async () => {
  const observer = createInMemoryKnowledgeRagObserver();

  await runKnowledgeIndexing({
    loader: loaderFromDocuments([{ id: 'doc-1', content: 'Runtime observability indexing.' }]),
    vectorIndex: createMemoryVectorWriter(),
    sourceConfig: { sourceId: 'docs', sourceType: 'repo-docs', trustClass: 'internal' },
    observer,
    traceId: 'trace-indexing-metrics'
  });

  const trace = exportKnowledgeRagTrace(observer, 'trace-indexing-metrics');
  expect(trace.operation).toBe('indexing.run');
  expect(trace.events.map(event => event.name)).toEqual(
    expect.arrayContaining([
      'indexing.run.start',
      'indexing.load.complete',
      'indexing.chunk.complete',
      'indexing.embed.complete',
      'indexing.store.complete'
    ])
  );
  expect(trace.metrics).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: 'indexing.loaded_document_count', value: 1, unit: 'count' }),
      expect.objectContaining({ name: 'indexing.chunk_count', unit: 'count' })
    ])
  );
});
```

- [x] **Step 2: Run red test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/indexing-pipeline.test.ts
```

Expected: FAIL because `runKnowledgeIndexing()` does not accept observer/traceId.

- [x] **Step 3: Add indexing observer inputs**

In `packages/knowledge/src/indexing/types/indexing.types.ts`, add optional fields to `KnowledgeIndexingRunOptions`:

```ts
observer?: KnowledgeRagObserver;
traceId?: string;
```

- [x] **Step 4: Emit indexing events and metrics**

In `packages/knowledge/src/indexing/pipeline/run-knowledge-indexing.ts`, use observability helpers to start an `indexing.run` trace, emit stage completion events, and finish with metrics derived from `KnowledgeIndexingResult`.

- [x] **Step 5: Run green test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/indexing-pipeline.test.ts
```

Expected: PASS.

## Task 8: Add Trace-To-Eval Sample Builder

- [x] **Step 1: Write failing trace-to-sample test**

Create `packages/knowledge/test/knowledge-trace-sample-builder.test.ts`:

```ts
it('creates quality-signal eval samples from failed or empty retrieval traces', () => {
  const samples = buildKnowledgeEvalSamplesFromTraces([
    {
      traceId: 'trace-empty',
      operation: 'rag.run',
      status: 'succeeded',
      startedAt: '2026-05-10T00:00:00.000Z',
      events: [],
      query: { text: 'missing policy' },
      retrieval: { hits: [], citations: [] },
      metrics: [{ traceId: 'trace-empty', name: 'retrieval.hit_count', value: 0, unit: 'count', stage: 'retrieval' }]
    }
  ]);

  expect(samples).toContainEqual(
    expect.objectContaining({
      traceId: 'trace-empty',
      query: { text: 'missing policy' },
      attributes: expect.objectContaining({ signal: 'empty_retrieval' })
    })
  );
});
```

- [x] **Step 2: Run red test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/knowledge-trace-sample-builder.test.ts
```

Expected: FAIL because `buildKnowledgeEvalSamplesFromTraces` does not exist.

- [x] **Step 3: Implement builder**

Create `packages/knowledge/src/eval/knowledge-trace-sample-builder.ts` with a pure function that emits `KnowledgeEvalSample` records for:

- `runtime.run.fail`
- zero `retrieval.hit_count`
- high drop ratio when selected count is much lower than candidate count
- low `generation.grounded_citation_rate`
- indexing quality gate failures

- [x] **Step 4: Export builder**

Update `packages/knowledge/src/eval/index.ts` to export the builder.

- [x] **Step 5: Run green test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/knowledge-trace-sample-builder.test.ts
```

Expected: PASS.

## Task 9: Root Export And Build Type Cleanup

- [x] **Step 1: Add build type leak regression**

Add to `packages/knowledge/test/sdk-entrypoints.test.ts`:

```ts
it('does not emit test declarations in build type output', () => {
  const packageRoot = resolve(__dirname, '..');
  const emittedTestTypePath = resolve(packageRoot, 'build/types/test');

  expect(existsSync(emittedTestTypePath)).toBe(false);
});
```

- [x] **Step 2: Run red test after build**

Run:

```bash
pnpm --dir packages/knowledge build:types
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/sdk-entrypoints.test.ts
```

Expected: FAIL if `build/types/test` exists.

- [x] **Step 3: Exclude tests from type build**

Update `packages/knowledge/tsconfig.types.json` so type build includes `src/**/*` and excludes `test/**/*`.

- [x] **Step 4: Keep root adapter exports as compatibility**

Do not remove root adapter exports in this implementation. Update docs to say adapter factories are currently root-compatible, but preferred stable imports are subpaths like `@agent/knowledge/adapters/minimax`.

- [x] **Step 5: Run green test**

Run:

```bash
pnpm --dir packages/knowledge build:types
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/sdk-entrypoints.test.ts
```

Expected: PASS.

## Task 10: Final Validation

- [x] **Step 1: Run focused tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/knowledge/test/knowledge-observability-runtime.test.ts packages/knowledge/test/run-knowledge-rag.test.ts packages/knowledge/test/run-knowledge-retrieval.test.ts packages/knowledge/test/indexing-pipeline.test.ts packages/knowledge/test/knowledge-trace-sample-builder.test.ts packages/knowledge/test/sdk-entrypoints.test.ts
```

Expected: PASS.

- [x] **Step 2: Run package validation**

Run:

```bash
pnpm --dir packages/knowledge test
pnpm --dir packages/knowledge typecheck
pnpm check:docs
pnpm build:lib
```

Expected: PASS.

- [x] **Step 3: Run docs stale scan**

Run:

```bash
rg -n "runtime/observability|observability|metrics|trace sample|build/types/test|root adapter" docs packages/knowledge/README.md packages/knowledge/src
```

Expected: only current descriptions or compatibility notes remain.

- [x] **Step 4: Run diff whitespace check**

Run:

```bash
git diff --check -- packages/knowledge/src packages/knowledge/test docs/packages/knowledge docs/superpowers/specs docs/superpowers/plans
```

Expected: no output and exit 0.
