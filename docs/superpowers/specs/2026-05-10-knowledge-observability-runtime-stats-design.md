# Knowledge Internal RAG Boundaries Design

状态：draft
文档类型：spec
适用范围：`packages/knowledge/src/observability`、`packages/knowledge/src/runtime`、`packages/knowledge/src/rag`、`packages/knowledge/src/indexing`、`packages/knowledge/src/eval`
最后核对：2026-05-10

## Goal

Map the course sample project `/课堂代码/rag` onto this repository's single `packages/knowledge` SDK package, then tighten internal boundaries without splitting a new workspace package.

## Scope

- Treat `packages/knowledge/src/*` as the internal equivalent of the course project's `core + indexing + adapters + runtime + observability + eval` package split.
- Create `packages/knowledge/src/observability/` as the stable observability boundary for Knowledge SDK traces, events, metrics, safe observer calls, and future exporters.
- Remove `packages/knowledge/src/runtime/observability/`; observability now lives only under `packages/knowledge/src/observability`.
- Add schema-first runtime metrics to the existing `KnowledgeRagTrace` contract and let runtime code produce metrics from its own counters.
- Extend the same observer model to indexing so ingestion quality can be diagnosed with the same trace/event/metric vocabulary.
- Position eval as a trace consumer rather than only a hand-written golden fixture runner.
- Stage root export and build artifact cleanup after runtime behavior is stable.

## Non-Goals

- Do not create a new workspace package.
- Do not add HTTP, JSONL, or vendor exporters in this slice.
- Do not move eval logic into runtime metrics.
- Do not change backend public trace response shape beyond additive projection from SDK metrics.
- Do not break current root exports immediately; vendor adapter root exports should be marked as compatibility first, then retired in a later cleanup.

## Architecture

The course project uses separate workspace packages. In this repository, the equivalent boundaries live under `packages/knowledge/src`:

```text
course rag/packages/core           -> packages/knowledge/src/core + contracts
course rag/packages/indexing       -> packages/knowledge/src/indexing
course rag/packages/adapters       -> packages/knowledge/src/adapters
course rag/packages/runtime        -> packages/knowledge/src/runtime + rag
course rag/packages/observability  -> packages/knowledge/src/observability
course rag/packages/eval           -> packages/knowledge/src/eval
```

Runtime remains the source of truth for execution facts: stage durations, hit counts, selected counts, dropped counts, context size, citation grounding ratio, and failure stage. Observability receives those facts through project-owned schemas and is responsible for safe buffering, in-memory export, redaction/sampling extension points, and future exporter boundaries.

The directory shape is:

```text
packages/knowledge/src/observability/
  index.ts
  knowledge-rag-observer.ts
  (future) exporters/
  (future) redaction/
  (future) sampling/
```

`packages/knowledge/src/runtime/observability` is deleted after callers migrate to `../../observability`.

`packages/knowledge/src/runtime` and `packages/knowledge/src/rag` should be documented as two layers, not two competing runtimes:

- `runtime/` owns generic retrieval pipeline behavior: query normalization, retrieval, post-retrieval, context expansion, context assembly, retrieval diagnostics, and retrieval metrics.
- `rag/` owns answer-oriented orchestration: planner selection, use of retrieval runtime, answer provider, no-answer policy, streaming/non-streaming facade, and final generation metrics.

## Contract

Add `KnowledgeRagMetricSchema`:

- `traceId: string`
- `name: string`
- `value: number`
- `unit?: "ms" | "count" | "tokens" | "ratio" | "bytes"`
- `stage?: KnowledgeRagEventStage`
- `attributes?: JsonObject`

Add `metrics?: KnowledgeRagMetric[]` to `KnowledgeRagTraceSchema`.

Metric names in this slice:

- `runtime.duration_ms`
- `planner.duration_ms`
- `retrieval.duration_ms`
- `generation.duration_ms`
- `retrieval.hit_count`
- `retrieval.selected_count`
- `generation.grounded_citation_rate`

All fields are additive and optional.

## Runtime Behavior

`runKnowledgeRag()` and `runKnowledgeRetrieval()` continue returning the same results. When an observer is provided, they include `metrics` in the final trace. Observer calls are wrapped so observer failures do not fail a successful runtime run.

Streaming and non-streaming RAG should eventually use the same observability helpers and metric vocabulary. The current backend streaming reconstruction can remain as compatibility, but the target is native observer support in the SDK streaming path.

## Indexing Behavior

`runKnowledgeIndexing()` should keep returning diagnostics and quality gates, but should also be able to emit observer events:

- `indexing.run.start`
- `indexing.load.complete`
- `indexing.chunk.complete`
- `indexing.embed.complete`
- `indexing.store.complete`
- `indexing.run.fail`

Indexing observer events should include counts and quality-gate summaries, not raw document content, raw embeddings, provider responses, or secret-bearing configuration.

## Eval Behavior

Golden eval fixtures remain useful as deterministic local regression data, but eval's main product role should be trace consumption:

```text
runtime/indexing trace
  -> quality signals
  -> eval sample
  -> regression metrics
```

Initial trace-derived signals:

- failed run
- empty retrieval
- high post-retrieval drop ratio
- low grounded citation rate
- indexing quality gate failure

## Backend Projection

`KnowledgeTraceService.projectSdkTrace()` should prefer SDK trace metrics for additive span attributes when useful, while keeping the current backend `KnowledgeTrace` shape unchanged.

## Root Export And Build Cleanup

The root SDK entrypoint currently exports many vendor adapter factories directly. That is useful for discoverability but weaker as a long-term SDK boundary. Cleanup should be staged:

1. Keep current root exports as compatibility.
2. Document preferred imports from `@agent/knowledge/adapters/*`.
3. Add tests for stable subpath entrypoints.
4. Later remove or narrow vendor exports from the root only after callers migrate.

Build output should also exclude test declaration files such as `build/types/test/*.d.ts`, because a publishable SDK should expose source entrypoints rather than test artifacts.

## Phased Plan

1. Formalize `packages/knowledge/src/observability`.
2. Add RAG and retrieval runtime metrics.
3. Isolate observer failures from runtime success paths.
4. Add indexing observer support.
5. Add trace-to-eval sample conversion.
6. Clean up root exports and type build outputs.

## Verification

- Unit tests for metric schema parse and sensitive attribute rejection.
- Runtime tests proving final traces include metrics derived from runtime diagnostics.
- Runtime tests proving an observer throwing during event recording does not break a successful RAG run.
- Indexing tests proving observer events mirror diagnostics and quality gates.
- Eval tests proving traces can produce quality-signal samples.
- Backend trace projection tests proving metrics can be consumed without leaking raw provider data.
- Root export/build tests proving stable subpaths remain available and test declarations do not leak into build types.
