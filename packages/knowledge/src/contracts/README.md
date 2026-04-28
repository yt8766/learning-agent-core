# Knowledge and Memory Boundary

This package owns external knowledge RAG workflows:

- loading external knowledge documents
- chunking documents for indexing
- preserving source metadata on chunks
- handing knowledge chunks to the vector boundary
- retrieval-facing repositories and search services

`@agent/memory` owns the current runtime vector boundary used by indexing:

- `KnowledgeVectorDocumentRecord`
- `KnowledgeVectorIndexWriter`
- `LocalVectorIndexRepository.upsertKnowledge()`

`runKnowledgeIndexing()` does not call an embedder or vector store directly. It converts each indexed chunk into a `KnowledgeVectorDocumentRecord` and calls `KnowledgeVectorIndexWriter.upsertKnowledge()`. The memory vector implementation performs embedding and vector index persistence behind that boundary.

Current package responsibilities:

- `@agent/knowledge`: external knowledge ingestion, chunk metadata, retrieval contracts, indexing schemas, and citation/evidence helpers.
- `@agent/memory`: runtime working-memory stores plus the shared vector index boundary for memory, rule, and knowledge records.
- `@agent/tools`: tool-surface contracts and tool runtime event schemas that are specific to tool execution.
- `@agent/runtime/src/contracts/governance`: governance, approval-scope, tool-definition, MCP-capability, and tool-execution request/result contracts consumed by runtime and tools.

P3-1 migration status:

- Knowledge schemas previously mirrored from `packages/core/src/knowledge/**` now have a package-local host under `packages/knowledge/src/contracts/**`.
- Memory schemas previously mirrored from `packages/core/src/memory/**` now have a package-local host under `packages/memory/src/contracts/**`.
- Tool surface/runtime-event schemas previously mirrored from `packages/core/src/tools/**` now have a package-local host under `packages/tools/src/contracts/**`.
- Governance schemas/helpers previously mirrored from `packages/core/src/governance/**` now have a package-local host under `packages/runtime/src/contracts/governance/**`.
- `packages/core/src/knowledge/**` and `packages/core/src/memory/**` have been removed. Do not restore compat barrels there; callers should import knowledge contracts from `@agent/knowledge` and memory contracts from `@agent/memory`.

When this boundary changes, update the TypeScript contract in `@agent/memory` first, then update knowledge indexing and this document in the same change.
