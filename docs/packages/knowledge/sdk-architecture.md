# Knowledge SDK Architecture

状态：current
文档类型：architecture
适用范围：`packages/knowledge`
最后核对：2026-05-01

## Goal

`packages/knowledge` is a publishable RAG SDK. It provides schema-first contracts, provider interfaces, default pipelines, optional default adapters, API client helpers, eval primitives, and observability primitives.

## Principles

1. Interface-first: every external capability is injected through an interface.
2. Default implementations are optional and replaceable.
3. Core contracts do not depend on vendor SDKs or monorepo-internal runtime packages.
4. Browser-safe and node-only entrypoints are separate.
5. Vendor responses and errors are converted at adapter boundaries.
6. SDK code does not read host environment variables unless the host explicitly passes values to an adapter factory.

## Target Source Layout

```text
packages/knowledge/src/
  core/
    schemas/
    types/
    interfaces/
    errors/
    pipeline/
    constants/
  client/
  runtime/
  indexing/
  retrieval/
  generation/
  eval/
  observability/
  adapters/
    supabase/
    openai/
    qdrant/
    weaviate/
  node/
  browser/
```

## Public Entrypoints

```text
@agent/knowledge
@agent/knowledge/core
@agent/knowledge/client
@agent/knowledge/runtime
@agent/knowledge/indexing
@agent/knowledge/retrieval
@agent/knowledge/eval
@agent/knowledge/observability
@agent/knowledge/browser
@agent/knowledge/node
@agent/knowledge/adapters/supabase
@agent/knowledge/adapters/openai
@agent/knowledge/adapters/qdrant
@agent/knowledge/adapters/weaviate
```

## Core Boundary

`src/core` owns:

- Zod schemas.
- Types inferred from schemas.
- Provider interfaces.
- Error models.
- Pipeline type abstractions.
- Stable status constants.

`src/core` may depend on `zod`.

`src/core` must not depend on:

- `@agent/core`
- `@agent/memory`
- `@agent/config`
- `@agent/adapters`
- `@supabase/supabase-js`
- `openai`
- `node:fs`
- `react`
- NestJS

## MVP Provider Interfaces

```ts
export interface EmbeddingProvider {
  embed(input: EmbedTextInput): Promise<EmbedTextResult>;
  embedBatch?(input: EmbedBatchInput): Promise<EmbedBatchResult>;
  healthCheck?(): Promise<ProviderHealth>;
}

export interface VectorStore {
  upsert(input: VectorUpsertInput): Promise<VectorUpsertResult>;
  search(input: VectorSearchInput): Promise<VectorSearchResult>;
  delete(input: VectorDeleteInput): Promise<VectorDeleteResult>;
  healthCheck?(): Promise<ProviderHealth>;
}

export interface Generator {
  generate(input: GenerateInput): Promise<GenerateResult>;
}

export interface TraceSink {
  startTrace(input: StartTraceInput): Promise<RagTrace>;
  recordSpan(input: RecordTraceSpanInput): Promise<RagTraceSpan>;
  endTrace(input: EndTraceInput): Promise<RagTrace>;
}
```

## MVP Default Adapters

First publishable adapters:

- `adapters/supabase`: document store, chunk store, vector store, keyword search provider, trace sink, eval store.
- `adapters/openai`: embedding provider, generator, eval judge provider.

Adapter dependencies are optional or peer dependencies. They must not be required by `@agent/knowledge/core`.

Adapters must convert vendor responses, headers, request configuration, raw payloads, stack traces, and provider errors into SDK-owned schema-safe results or SDK-owned error models before they cross the adapter boundary. Raw vendor payloads must not leak into `src/core`, API DTOs, traces, eval records, or browser-facing clients.

Adapter factories must accept host-provided configuration explicitly. They must not read service keys, endpoints, model names, or other host environment variables directly.

## Runtime MVP

The first runtime flow is:

```text
query
-> embedding
-> vector search
-> keyword search
-> RRF merge
-> context assembly
-> generation
-> citations
-> trace
```

Query rewrite, rerank, Small-to-Big, and citation checking are extension points after the MVP.

Runtime traces and errors must use redacted JSON-safe projections. Trace span metadata and API error details may include stable IDs, timings, status values, redacted summaries, and bounded diagnostics, but must not include secrets, tokens, raw provider responses, raw headers, SDK client configuration, or third-party error objects.

## Frontend Usage Boundary

`apps/frontend/knowledge` may import:

- `@agent/knowledge/core`
- `@agent/knowledge/client`

It must not import:

- `@agent/knowledge/node`
- `@agent/knowledge/adapters/openai`
- `@agent/knowledge/adapters/supabase` when service keys are required
- `@agent/knowledge/runtime` for direct LLM or vector operations

Browser-safe entrypoints must not import Node-only modules, service-key adapters, direct LLM/vector runtime wiring, or vendor SDKs that require server credentials. Node-only capabilities must stay behind `@agent/knowledge/node` or adapter subpath exports and be invoked by backend or host runtime code.
