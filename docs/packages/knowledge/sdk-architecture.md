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

Entrypoint status:

- Current: `@agent/knowledge` exists as the current package root and exposes current retrieval/indexing contracts according to existing package exports.
- Migration-compatible: `@agent/knowledge/core` and `@agent/knowledge/client` are target public facades that may initially re-export or wrap current contracts/client helpers while migration is in progress.
- Target planned: `@agent/knowledge/browser`, `@agent/knowledge/node`, `@agent/knowledge/adapters/*`, and any finer-grained runtime/indexing/retrieval/eval/observability subpaths are publishable SDK targets. They must not be treated as fully implemented until their package exports, tests, and docs land in the same migration slice.
- Compat exports must stay thin and must not create a second source of truth for schemas, adapters, or runtime behavior.

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

## Responsibility Layers

Provider:

- Defines project-owned capability interfaces such as embedding, vector search, keyword search, rerank, trace, eval judge, or optional server-side generation.
- Accepts and returns SDK-owned schema/type values only.
- Does not expose vendor SDK clients, vendor response shapes, raw errors, headers, or request configuration to runtime, repository, client, API DTOs, or browser code.

Adapter:

- Implements provider or repository interfaces for a concrete vendor or infrastructure backend.
- Owns vendor SDK lifecycle, request mapping, response mapping, retry/error normalization, redaction, and credential handling at the boundary.
- Converts every vendor response and error into SDK-owned records or SDK-owned error models before returning.
- Is optional and must not be required by `@agent/knowledge/core`.

Repository:

- Is a host/backend-facing persistence abstraction.
- Reads and writes project-defined schemas/records only, such as knowledge sources, chunks, indexing receipts, eval records, trace records, or retrieval configuration records.
- Must not leak database, vector-store, ORM, storage, or vendor-specific types into contracts, runtime, API DTOs, or browser clients.
- Owns namespace, tenant, workspace, and knowledge-base scoping semantics.
- Owns idempotent writes, pagination, filtering, ordering, and query semantics for persistent records.
- May be implemented by host infrastructure or optional adapters, but its public contract remains SDK-owned.

Runtime:

- Orchestrates retrieval, context assembly, citation preparation, diagnostics, and trace emission using injected providers and repositories.
- Does not create vendor clients, read host environment variables, own auth/permission decisions, or generate the final answer in the default chain.
- Receives already-configured dependencies from backend/server host wiring.

Client:

- Is an HTTP/API client for browser/frontend or external callers.
- Calls the backend Knowledge API contract only.
- Does not hold provider secrets, service keys, model credentials, database credentials, or vector-store credentials.
- Must not directly access runtime, repository, adapter, provider SDKs, or node-only entrypoints.
- Owns request/response parsing, token attachment/refresh behavior where applicable, and API error projection handling.

Public entrypoints:

- Expose stable, documented boundaries for the layers above.
- Must separate browser-safe, node-only, adapter, runtime, repository, and client surfaces.
- Must not make target-only or migration-only surfaces look like current implemented guarantees.

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

## Backend and Server Host Boundary

Backend/server hosts may consume:

- `@agent/knowledge` current root exports during migration.
- `@agent/knowledge/core` target contracts once available.
- `@agent/knowledge/client` only when the backend is acting as an HTTP client to another Knowledge API host.
- `@agent/knowledge/runtime`, `@agent/knowledge/node`, repository interfaces, provider interfaces, or adapter subpaths only from server-side code after those entrypoints exist and their ownership is documented.

Backend/server hosts are responsible for:

- Auth, permission checks, workspace/tenant scoping, and policy enforcement.
- Reading environment variables, secrets, service keys, endpoint configuration, and model configuration.
- Creating vendor SDK clients or adapter instances at host-owned boundaries.
- Wiring runtime dependencies, repositories, providers, trace sinks, eval stores, and optional server-side generation contracts.
- Mapping SDK-owned records/results/errors into Knowledge API DTOs.
- Redacting diagnostics, traces, and API errors before they leave the server.

Backend/server hosts must not leak vendor raw responses, provider errors, SDK client config, request headers, service keys, tokens, stack traces, or database/vector vendor types into Knowledge API responses, frontend state, traces, eval records, or browser bundles.

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
