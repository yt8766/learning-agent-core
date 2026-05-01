# Knowledge SDK Architecture

状态：current
文档类型：architecture
适用范围：`packages/knowledge`
最后核对：2026-05-01

## Goal

`packages/knowledge` is evolving toward a publishable RAG SDK. This document describes the target architecture and migration rules; it is not a claim that every listed source directory, subpath export, client helper, eval primitive, observability primitive, or optional adapter exists today.

Current horizontal MVP usage keeps frontend code behind backend Knowledge HTTP APIs plus app-local API client/DTO code. `src/core` is now the first publishable SDK facade slice; later facades such as `src/client`, `src/eval`, and `src/observability` must only be treated as current implementation after their source directories, package exports, tests, and docs land in the same migration slice.

## Principles

1. Interface-first: every external capability is injected through an interface.
2. Default implementations are optional and replaceable.
3. Core contracts do not depend on vendor SDKs or monorepo-internal runtime packages.
4. Browser-safe and node-only entrypoints are separate.
5. Vendor responses and errors are converted at adapter boundaries.
6. SDK code does not read host environment variables unless the host explicitly passes values to an adapter factory.

## Target Source Layout

This is the target source layout. Directories that do not exist in the current package must not be used as caller dependencies or documented as current import paths. When a migration slice adds one of these directories, it must update package exports, tests, and docs in the same slice.

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
- Current: `@agent/knowledge/core` exposes the SDK core contract facade: schema-first knowledge base/provider health records, provider interfaces, SDK error classes, constants, and the generic async pipeline type. It has no vendor SDK dependency.
- Target-only: `@agent/knowledge/client` is a planned public facade. Frontend code must not import it until a later slice actually adds `src/client` plus matching package exports, tests, and docs.
- Current: `@agent/knowledge/node` exposes node-only runtime factories, including `createDefaultKnowledgeSdkRuntime()` for OpenAI-compatible chat/embedding plus Supabase pgvector vector store, and `createKnowledgeRuntime()` for custom provider composition. It is intentionally not re-exported from the root package.
- Current: `@agent/knowledge/adapters/*` exposes the migrated official adapter surfaces that already have source ownership and package exports, including Supabase pgvector and OpenAI-compatible providers.
- Target planned: `@agent/knowledge/browser-entry` and any finer-grained runtime/indexing/retrieval/eval/observability subpaths are publishable SDK targets. They must not be treated as fully implemented until their package exports, tests, and docs land in the same migration slice.
- Compat exports must stay thin and must not create a second source of truth for schemas, adapters, or runtime behavior.

Current implemented public package entrypoint:

```text
@agent/knowledge
@agent/knowledge/core
@agent/knowledge/node
@agent/knowledge/adapters
@agent/knowledge/adapters/supabase
@agent/knowledge/adapters/openai-compatible
```

Target-only public subpaths. Each subpath below requires source ownership, package exports, tests, and docs in the same migration slice before callers may depend on it:

```text
@agent/knowledge/client
@agent/knowledge/runtime
@agent/knowledge/indexing
@agent/knowledge/retrieval
@agent/knowledge/eval
@agent/knowledge/observability
@agent/knowledge/browser-entry
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

Current `src/core` package export:

- Source: `packages/knowledge/src/core/index.ts`
- Public subpath: `@agent/knowledge/core`
- Build entries: `build/cjs/core/index.js`, `build/esm/core/index.mjs`, `build/types/knowledge/src/core/index.d.ts`
- Root package compatibility: `@agent/knowledge` explicitly re-exports non-conflicting core schemas, constants, `EmbeddingProvider`, and core errors. Vector-store related SDK types are exported from the root with `KnowledgeSdk*` aliases to avoid colliding with the existing retrieval/indexing `VectorStore` and `VectorSearchHit` contracts. New SDK consumers should prefer `@agent/knowledge/core` for the unaliased core names.

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

## Target Adapter Direction

The current concrete vendor adapters still live in `packages/adapters`; the knowledge package has not switched its default implementation to Supabase/OpenAI. The following are recommended target implementations for the knowledge app/API MVP and possible future publishable SDK adapter entrypoints:

- `adapters/supabase`: document store, chunk store, vector store, keyword search provider, trace sink, eval store.
- `adapters/openai`: embedding provider, generator, eval judge provider.

Adapter dependencies are optional or peer dependencies. They must not be required by `@agent/knowledge/core`.

Adapters must convert vendor responses, headers, request configuration, raw payloads, stack traces, and provider errors into SDK-owned schema-safe results or SDK-owned error models before they cross the adapter boundary. Raw vendor payloads must not leak into `src/core`, API DTOs, traces, eval records, or browser-facing clients.

Adapter factories must accept host-provided configuration explicitly. They must not read service keys, endpoints, model names, or other host environment variables directly.

## Adapter Placement

Current MVP knowledge adapters live in `packages/knowledge/src/adapters/*`. This includes Chroma vector search/store, OpenSearch-like keyword search, Supabase pgvector, LangChain indexing adapters, and provider presets. `packages/adapters` no longer exposes compatibility re-exports for migrated knowledge adapters.

`@agent/knowledge/adapters/*` is a target publishable SDK adapter surface, not a statement that all such subpath exports already exist today. Migration to that target must be incremental:

- Keep real vendor SDK lifecycle, credentials, and host environment loading outside `@agent/knowledge/core`.
- Do not duplicate an adapter implementation in `packages/knowledge` while the current implementation remains in `packages/adapters`.
- Remove old adapter-package entrypoints once a migration slice has moved ownership, tests, docs, and call sites to `@agent/knowledge`.
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

Query rewrite, hybrid retrieval/rerank-style fusion, and Small-to-Big context expansion are not merely post-MVP ideas. First-stage runtime capabilities already exist in the current package and should continue to converge in the SDK architecture as replaceable strategies, observable stages, and productized extension points. Citation contracts, citation preparation, and quote masking also exist today; a dedicated citation-checking stage is a future hardening point and must not be treated as current runtime behavior until implemented with tests and docs. Later slices expand, harden, and document those capabilities rather than introducing them from zero.

The default `packages/knowledge/src/runtime` chain must not generate the final answer. It prepares retrieval hits, assembled context, citations, diagnostics, and trace events for the host runtime. Final answer generation remains the responsibility of `packages/runtime`, apps, or `agents/*`.

Server-side hosts may inject a `Generator` through `host-integration` or equivalent optional interfaces after retrieval/context assembly. That integration is outside the current default runtime chain and must keep provider secrets, model clients, and raw generation payloads behind host-owned server boundaries.

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

Current horizontal MVP frontend usage must go through backend Knowledge HTTP APIs and app-local API client/DTO code.

Only after a later migration slice actually adds `src/core` / `src/client` plus matching package exports, tests, and docs may `apps/frontend/knowledge` import:

- `@agent/knowledge/core`
- `@agent/knowledge/client`

It must not import:

- `@agent/knowledge/runtime`
- `@agent/knowledge/node`
- `@agent/knowledge/adapters/*`
- generation, provider, model, vector, service-key, or host-secret related entrypoints

Browser-safe entrypoints must not import Node-only modules, service-key adapters, direct LLM/vector runtime wiring, or vendor SDKs that require server credentials. Node-only capabilities must stay behind `@agent/knowledge/node` or adapter subpath exports and be invoked by backend or host runtime code.

Future browser-safe adapters require a separate design and verification slice. They must prove that no secret, server credential, node-only dependency, raw provider SDK, or direct generation/vector operation can leak into the frontend bundle.
