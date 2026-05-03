# Knowledge Upload And Chat Lab MVP Implementation Plan

状态：snapshot
文档类型：plan
适用范围：`apps/backend/knowledge-server`、`apps/frontend/knowledge`
最后核对：2026-05-02

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the Knowledge App choose a target knowledge base and embedding model during upload, show upload/indexing progress, and run Chat Lab against real uploaded chunks with visible citation snippets.

**Architecture:** Keep `apps/backend/knowledge-server` as the canonical Knowledge API host. The frontend uses existing Knowledge App API/provider boundaries and adds display-only embedding model selection plus job progress projection. Chat Lab stays deterministic for the horizontal MVP: it searches stored chunks and returns answer/citation projections without adding a new LLM provider dependency.

**Tech Stack:** NestJS, React, Ant Design, Vitest, TypeScript, zod-backed API contracts where existing boundaries already use schemas.

---

### Task 1: Backend Knowledge Chat And Upload Progress

**Files:**

- Modify: `apps/backend/knowledge-server/src/knowledge/knowledge-frontend-mvp.controller.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/knowledge.controller.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/domain/knowledge-document.types.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/domain/knowledge-document.schemas.ts`
- Modify: `apps/backend/knowledge-server/src/knowledge/knowledge-document.service.ts`
- Test: `apps/backend/knowledge-server/test/knowledge/knowledge-chat-lab.controller.spec.ts`

- [ ] Add failing tests for `/chat`, `/messages/:id/feedback`, embedding model options, and job progress percent.
- [ ] Implement deterministic chunk search and citation projection in `knowledge-server`.
- [ ] Project `progress.percent` from job stage/status without leaking internal storage or embedding provider details.
- [ ] Run the targeted knowledge-server test.

### Task 2: Frontend Upload Selection And Progress

**Files:**

- Modify: `apps/frontend/knowledge/src/types/api.ts`
- Modify: `apps/frontend/knowledge/src/api/knowledge-api-provider.tsx`
- Modify: `apps/frontend/knowledge/src/api/knowledge-api-client.ts`
- Modify: `apps/frontend/knowledge/src/api/mock-knowledge-api-client.ts`
- Modify: `apps/frontend/knowledge/src/hooks/use-document-upload.ts`
- Modify: `apps/frontend/knowledge/src/pages/documents/documents-page.tsx`
- Modify: `apps/frontend/knowledge/src/pages/documents/document-upload-panel.tsx`
- Test: `apps/frontend/knowledge/test/knowledge-upload-progress.test.tsx`

- [ ] Add failing tests that require explicit knowledge base selection, embedding model selection, and visible upload progress.
- [ ] Extend the frontend API with `listEmbeddingModels`.
- [ ] Pass `embeddingModelId` through upload document creation metadata.
- [ ] Render progress bars for active uploads and document jobs.
- [ ] Run the targeted Knowledge App frontend test.

### Task 3: Frontend Chat Lab Citation Cards

**Files:**

- Modify: `apps/frontend/knowledge/src/pages/chat-lab/chat-lab-page.tsx`
- Modify: `apps/frontend/knowledge/src/api/mock-data.ts`
- Test: `apps/frontend/knowledge/test/knowledge-chat-lab-citations.test.tsx`

- [ ] Add failing tests that require Chat Lab to use the selected knowledge base and show citation quote/snippet cards.
- [ ] Replace citation title-only footer with cards showing title, quote, score, and trace link.
- [ ] Keep feedback actions wired to assistant message IDs.
- [ ] Run the targeted Chat Lab frontend test.

### Task 4: Documentation And Verification

**Files:**

- Modify: `docs/contracts/api/knowledge.md`
- Modify: `docs/apps/frontend/knowledge/knowledge-frontend.md`
- Modify: `docs/apps/backend/knowledge-server/knowledge-server.md`

- [ ] Document embedding model options, upload progress projection, and Chat Lab citation display.
- [ ] Run affected tests and type checks per `docs/packages/evals/verification-system-guidelines.md`.
- [ ] Summarize blockers if broader checks fail for unrelated existing worktree changes.
