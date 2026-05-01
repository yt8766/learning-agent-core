# Knowledge SDK Architecture

状态：current
文档类型：architecture
适用范围：`packages/knowledge`
最后核对：2026-05-01

## Goal

`packages/knowledge` is evolving toward a publishable RAG SDK. It provides schema-first contracts, provider interfaces, default retrieval pipelines, optional default adapters, API client helpers, eval primitives, and observability primitives.

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
  eval/
  observability/
  host-integration/
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

## Current Contracts and Core Migration

Current stable knowledge contracts live under `packages/knowledge/src/contracts`. The target `src/core` boundary is the publishable SDK contract facade and future long-term public boundary.

Migration rules:

- Add `src/core` as a facade or new boundary without duplicating stable schemas.
- Re-export or gradually move existing `src/contracts` schemas through controlled compatibility layers.
- A stable schema may have only one source of truth at any time.
- If a schema moves from `src/contracts` to `src/core`, all callers, docs, tests, and compat exports must be updated in the same migration slice.
- Do not maintain parallel schema definitions for the same DTO, event, trace, provider input, or retrieval result.

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

`Generator` is a host-injected, server-side optional extension contract. It is not part of the current default `packages/knowledge/src/runtime` retrieval chain and does not change the package boundary: final answer generation is owned by host runtime, apps, or agents, not by `packages/knowledge`.

## MVP Default Adapters

Target publishable adapters:

- `adapters/supabase`: document store, chunk store, vector store, keyword search provider, trace sink, eval store.
- `adapters/openai`: embedding provider, generator, eval judge provider.

Adapter dependencies are optional or peer dependencies. They must not be required by `@agent/knowledge/core`.

Adapters must convert vendor responses, headers, request configuration, raw payloads, stack traces, and provider errors into SDK-owned schema-safe results or SDK-owned error models before they cross the adapter boundary. Raw vendor payloads must not leak into `src/core`, API DTOs, traces, eval records, or browser-facing clients.

Adapter factories must accept host-provided configuration explicitly. They must not read service keys, endpoints, model names, or other host environment variables directly.

## Adapter Placement

Current MVP vendor adapters still live in `packages/adapters`. This includes concrete provider, vector-store, keyword-search, loader, and SDK-client integrations such as Chroma, OpenSearch-like search, embedding providers, and any service-key runtime wiring.

`@agent/knowledge/adapters/*` is a target publishable SDK adapter surface, not a statement that all such subpath exports already exist today. Migration to that target must be incremental:

- Keep real vendor SDK lifecycle, credentials, and host environment loading outside `@agent/knowledge/core`.
- Do not duplicate an adapter implementation in `packages/knowledge` while the current implementation remains in `packages/adapters`.
- Introduce thin compat re-exports only when a migration slice defines ownership, tests, and deprecation behavior.
- Convert vendor responses and errors at the adapter boundary before returning SDK-owned contracts.
- Never allow optional adapter dependencies to contaminate `@agent/knowledge/core`.

## Runtime MVP

The first default runtime flow is retrieval and context assembly only:

```text
query
-> embedding
-> vector search
-> keyword search
-> RRF merge
-> context assembly
-> citations
-> trace
```

Query rewrite, rerank, Small-to-Big, and citation checking are extension points after the MVP.

The default `packages/knowledge/src/runtime` chain must not generate the final answer. It prepares retrieval hits, assembled context, citations, diagnostics, and trace events for the host runtime. Final answer generation remains the responsibility of `packages/runtime`, apps, or `agents/*`.

Server-side hosts may inject a `Generator` through `host-integration` or equivalent optional interfaces after retrieval/context assembly. That integration is outside the current default runtime chain and must keep provider secrets, model clients, and raw generation payloads behind host-owned server boundaries.

Runtime traces and errors must use redacted JSON-safe projections. Trace span metadata and API error details may include stable IDs, timings, status values, redacted summaries, and bounded diagnostics, but must not include secrets, tokens, raw provider responses, raw headers, SDK client configuration, or third-party error objects.

## Frontend Usage Boundary

`apps/frontend/knowledge` may import:

- `@agent/knowledge/core`
- `@agent/knowledge/client`

It must not import:

- `@agent/knowledge/runtime`
- `@agent/knowledge/node`
- `@agent/knowledge/adapters/*`
- generation, provider, model, vector, service-key, or host-secret related entrypoints

Browser-safe entrypoints must not import Node-only modules, service-key adapters, direct LLM/vector runtime wiring, or vendor SDKs that require server credentials. Node-only capabilities must stay behind `@agent/knowledge/node` or adapter subpath exports and be invoked by backend or host runtime code.

Future browser-safe adapters require a separate design and verification slice. They must prove that no secret, server credential, node-only dependency, raw provider SDK, or direct generation/vector operation can leak into the frontend bundle.
