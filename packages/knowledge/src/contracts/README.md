# Knowledge and Memory Boundary

This package owns external knowledge RAG workflows:

- loading external knowledge documents
- chunking documents for indexing
- preserving source metadata on chunks
- handing knowledge chunks to the vector boundary
- retrieval-facing repositories and search services

`@agent/knowledge` owns the knowledge indexing vector writer contract used by indexing:

- `KnowledgeVectorDocumentRecord`
- `KnowledgeVectorIndexWriter`

The authoritative contract file is `packages/knowledge/src/contracts/indexing/knowledge-vector-writer.ts`. The contract is exported from the `@agent/knowledge` root entrypoint and the contracts indexing barrel.

`runKnowledgeIndexing()` does not call an embedder or vector store directly. It converts each indexed chunk into a `KnowledgeVectorDocumentRecord` and calls the injected `KnowledgeVectorIndexWriter.upsertKnowledge()`.

Host packages decide how to embed, persist, or index those records. Repository-internal `@agent/memory` implementations may implement this writer, but `@agent/knowledge` does not depend on `@agent/memory`.

Current package responsibilities:

- `@agent/knowledge`: external knowledge ingestion, chunk metadata, retrieval contracts, indexing schemas, the knowledge vector writer contract, and citation/evidence helpers.
- `@agent/memory`: runtime working-memory stores and optional repository-internal implementations of the knowledge vector writer boundary.
- `@agent/tools`: tool-surface contracts and tool runtime event schemas that are specific to tool execution.
- `@agent/runtime/src/contracts/governance`: governance, approval-scope, tool-definition, MCP-capability, and tool-execution request/result contracts consumed by runtime and tools.

P3-1 migration status:

- Knowledge schemas previously mirrored from `packages/core/src/knowledge/**` now have a package-local host under `packages/knowledge/src/contracts/**`.
- Memory schemas previously mirrored from `packages/core/src/memory/**` now have a package-local host under `packages/memory/src/contracts/**`.
- Tool surface/runtime-event schemas previously mirrored from `packages/core/src/tools/**` now have a package-local host under `packages/tools/src/contracts/**`.
- Governance schemas/helpers previously mirrored from `packages/core/src/governance/**` now have a package-local host under `packages/runtime/src/contracts/governance/**`.
- `packages/core/src/knowledge/**` and `packages/core/src/memory/**` have been removed. Do not restore compat barrels there; callers should import knowledge contracts from `@agent/knowledge` and memory contracts from `@agent/memory`.

When this boundary changes, update the package-local TypeScript contract in `@agent/knowledge`, then update knowledge indexing, host implementations, and this document in the same change.
