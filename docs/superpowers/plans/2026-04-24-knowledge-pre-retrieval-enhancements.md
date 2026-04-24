# Knowledge Pre-Retrieval Enhancements Implementation Plan

状态：snapshot
文档类型：plan
适用范围：`packages/knowledge`
最后核对：2026-04-24

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real pre-retrieval processing to `packages/knowledge` by shipping deterministic query rewrite, multi-query retrieval orchestration, richer diagnostics, and supporting tests/docs.

**Architecture:** Keep `packages/knowledge` as the retrieval-runtime host and extend the existing `queryNormalizer -> retrieval -> post-process -> context assembly` pipeline instead of moving logic into runtime or apps. The first delivery stays deterministic and schema-friendly: `DefaultQueryNormalizer` produces normalized query variants and diagnostics metadata, `runKnowledgeRetrieval()` fans out retrieval across variants, merges hits, then preserves the existing post-processing/context assembly contract.

**Tech Stack:** TypeScript, Vitest, zod-backed core contracts, package-local retrieval runtime in `packages/knowledge`

---

### Task 1: Extend retrieval runtime types and pipeline contract

**Files:**

- Modify: `packages/knowledge/src/runtime/types/retrieval-runtime.types.ts`
- Modify: `packages/knowledge/src/runtime/pipeline/run-knowledge-retrieval.ts`
- Modify: `packages/knowledge/src/index.ts`

- [ ] Add normalized request fields for original query, rewrite status, rewrite reason, and retrieval query variants.
- [ ] Update retrieval diagnostics to report original query, rewrite status, query variant count, and executed query list.
- [ ] Update `runKnowledgeRetrieval()` so it can execute multiple retrieval queries, merge hits by `chunkId`, keep the best score per hit, and then run existing post-processing/context assembly.
- [ ] Re-export any new public runtime types from `packages/knowledge/src/index.ts`.

### Task 2: Implement deterministic default query rewrite + multi-query generation

**Files:**

- Modify: `packages/knowledge/src/runtime/defaults/default-query-normalizer.ts`
- Create: `packages/knowledge/src/runtime/defaults/default-query-normalizer.helpers.ts`
- Modify: `packages/knowledge/src/runtime/defaults/retrieval-runtime-defaults.ts`

- [ ] Extract focused helper functions for whitespace cleanup, colloquial rewrite normalization, keyword extraction, and query variant dedupe.
- [ ] Keep the default implementation deterministic and low-risk: normalize whitespace/punctuation, rewrite common colloquial phrasing into more retrieval-friendly form, and generate a small bounded set of query variants.
- [ ] Preserve backward compatibility so callers that only care about `normalizedQuery` and `topK` continue to work.

### Task 3: Add tests for rewrite, multi-query retrieval, and diagnostics

**Files:**

- Create: `packages/knowledge/test/default-query-normalizer.test.ts`
- Modify: `packages/knowledge/test/run-knowledge-retrieval.test.ts`
- Modify: `packages/knowledge/test/root-exports.test.ts`

- [ ] Add unit tests for deterministic rewrite behavior, query variant generation, dedupe, and fallback passthrough behavior.
- [ ] Add pipeline tests proving multiple query variants call search multiple times, merged hits are deduped by `chunkId`, and diagnostics include the new fields.
- [ ] Update root export assertions if new runtime types/helpers become public.

### Task 4: Refresh demo and knowledge docs

**Files:**

- Modify: `packages/knowledge/demo/retrieval-runtime.ts`
- Modify: `docs/knowledge/knowledge-retrieval-runtime.md`
- Modify: `docs/knowledge/README.md`

- [ ] Update the retrieval runtime demo to show rewrite/multi-query behavior and richer diagnostics output.
- [ ] Update docs so the current runtime description matches the shipped behavior, including what is implemented now versus future extensions like decomposition or HyDE.

### Task 5: Verify package-level behavior

**Files:**

- No code changes required

- [ ] Run `pnpm --dir packages/knowledge test`
- [ ] Run `pnpm --dir packages/knowledge typecheck`
- [ ] Run `pnpm --dir packages/knowledge demo`
- [ ] If package verification passes, optionally run `pnpm --dir packages/knowledge verify` for the full package check.
