# Knowledge RAG Ops Redesign Implementation Plan

状态：current
文档类型：plan
适用范围：`apps/frontend/knowledge`
最后核对：2026-05-05

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the full `apps/frontend/knowledge` application into an enterprise RAG Operations Console.

**Architecture:** Keep the existing React + Ant Design application and API hooks, but reorganize the UI around the RAG lifecycle: ingestion, indexing, retrieval, answer grounding, feedback, observability, and evaluation. Shared page chrome, KPI strips, workflow panels, status cards, and table shells live in `pages/shared/ui.tsx`; page-specific content stays in its existing route file.

**Tech Stack:** React 19, Ant Design 6, @ant-design/x, React Router, Vite, Vitest, static CSS modules imported from `src/main.tsx`.

---

### Task 1: Lock The New RAG Ops Surface With Tests

**Files:**

- Modify: `apps/frontend/knowledge/test/app-render.test.tsx`
- Modify: `apps/frontend/knowledge/test/knowledge-production-workflows.test.tsx`

- [ ] **Step 1: Write failing shell assertions**

Add assertions that the authenticated workspace renders the new RAG Ops brand, lifecycle navigation labels, and health wording:

```tsx
expect(html).toContain('RAG Ops 控制台');
expect(html).toContain('摄取管线');
expect(html).toContain('检索实验室');
expect(html).toContain('Trace 观测');
expect(html).toContain('评测回归');
```

- [ ] **Step 2: Run the app render test and verify it fails**

Run: `pnpm --dir apps/frontend/knowledge test -- app-render.test.tsx`

Expected: FAIL because the current shell still says `Knowledge 知识库控制台` and the pages do not expose the new lifecycle copy.

- [ ] **Step 3: Add page-level expectations**

Extend existing page render tests to look for RAG lifecycle labels such as `摄取`, `索引`, `检索`, `引用`, `反馈`, and `评测`.

- [ ] **Step 4: Run the affected tests and verify they fail for missing copy**

Run: `pnpm --dir apps/frontend/knowledge test -- app-render.test.tsx knowledge-production-workflows.test.tsx`

Expected: FAIL with missing text assertions.

### Task 2: Rebuild Shared App Chrome

**Files:**

- Modify: `apps/frontend/knowledge/src/app/layout/app-shell.tsx`
- Modify: `apps/frontend/knowledge/src/app/App.tsx`
- Modify: `apps/frontend/knowledge/src/pages/shared/ui.tsx`
- Create: `apps/frontend/knowledge/src/styles/knowledge-rag-ops.css`
- Modify: `apps/frontend/knowledge/src/main.tsx`

- [ ] **Step 1: Update top-level product language**

Rename the shell brand from `Knowledge 知识库控制台` to `RAG Ops 控制台`, and group navigation around the lifecycle without changing route paths.

- [ ] **Step 2: Add shared layout primitives**

Add `RagOpsPage`, `MetricStrip`, `LifecycleRail`, `StatusPill`, and `InsightList` helpers in `pages/shared/ui.tsx`.

- [ ] **Step 3: Move new styles into a separate CSS file**

Create `knowledge-rag-ops.css` and import it after `knowledge-pro.css` from `main.tsx`, avoiding more growth in the existing 900+ line stylesheet.

- [ ] **Step 4: Run the shell test**

Run: `pnpm --dir apps/frontend/knowledge test -- app-render.test.tsx`

Expected: PASS once the shell and overview copy are updated.

### Task 3: Redesign Core RAG Pages

**Files:**

- Modify: `apps/frontend/knowledge/src/pages/overview/overview-page.tsx`
- Modify: `apps/frontend/knowledge/src/pages/knowledge-bases/knowledge-bases-page.tsx`
- Modify: `apps/frontend/knowledge/src/pages/knowledge-bases/knowledge-base-detail-page.tsx`
- Modify: `apps/frontend/knowledge/src/pages/documents/documents-page.tsx`
- Modify: `apps/frontend/knowledge/src/pages/documents/document-detail-page.tsx`

- [ ] **Step 1: Redesign Overview**

Make the first screen a RAG health command center with KPI strip, lifecycle rail, risk queue, quality trend, and next actions.

- [ ] **Step 2: Redesign Knowledge Bases**

Show knowledge spaces as governed RAG assets with health, document/chunk coverage, eval score, warnings, and filters.

- [ ] **Step 3: Redesign Documents**

Make the documents page a pipeline workbench with upload, parse/chunk/embed/index stages, processing state, and failure recovery.

- [ ] **Step 4: Run affected tests**

Run: `pnpm --dir apps/frontend/knowledge test -- knowledge-production-workflows.test.tsx knowledge-upload-flow.test.tsx knowledge-document-detail.test.tsx`

Expected: PASS after markup remains behavior-compatible.

### Task 4: Redesign Experiment, Observability, Evaluation, Users, And Settings

**Files:**

- Modify: `apps/frontend/knowledge/src/pages/chat-lab/chat-lab-page.tsx`
- Create: `apps/frontend/knowledge/src/pages/chat-lab/chat-lab-layout.tsx`
- Modify: `apps/frontend/knowledge/src/pages/observability/observability-page.tsx`
- Modify: `apps/frontend/knowledge/src/pages/evals/evals-page.tsx`
- Modify: `apps/frontend/knowledge/src/pages/users/users-page.tsx`
- Modify: `apps/frontend/knowledge/src/pages/settings/settings-page.tsx`
- Modify: `apps/frontend/knowledge/src/pages/settings/settings-models-page.tsx`
- Modify: `apps/frontend/knowledge/src/pages/settings/settings-keys-page.tsx`
- Modify: `apps/frontend/knowledge/src/pages/settings/settings-storage-page.tsx`
- Modify: `apps/frontend/knowledge/src/pages/settings/settings-security-page.tsx`

- [ ] **Step 1: Split Chat Lab layout**

Move shell-only layout sections into `chat-lab-layout.tsx` so `chat-lab-page.tsx` does not keep accumulating UI structure.

- [ ] **Step 2: Reframe Chat Lab as Retrieval Lab**

Add visible panels for selected knowledge bases, route diagnostics, citations, feedback, and eval handoff.

- [ ] **Step 3: Reframe Observability as Trace analysis**

Make trace list, span timeline, answer, retrieved chunks, and latency metrics visible in a three-zone layout.

- [ ] **Step 4: Reframe Evals as Regression hub**

Show datasets, run history, metric comparison, and release gate language.

- [ ] **Step 5: Align Users and Settings**

Use governance language for role access, model profiles, API keys, storage budgets, and security posture.

### Task 5: Docs And Verification

**Files:**

- Modify: `docs/apps/frontend/knowledge/product-design.md`
- Modify: `docs/apps/frontend/knowledge/antd-pro-ui.md`
- Modify if stale: `docs/apps/frontend/knowledge/knowledge-chat-lab.md`

- [ ] **Step 1: Update product design docs**

Document the RAG Ops Console positioning, page map, route behavior, and page responsibilities.

- [ ] **Step 2: Check stale docs**

Mark or rewrite any Ant Design Pro legacy wording that conflicts with the new RAG Ops surface.

- [ ] **Step 3: Run verification**

Run:

```bash
pnpm --dir apps/frontend/knowledge test -- app-render.test.tsx knowledge-production-workflows.test.tsx knowledge-governance-pages-api.test.tsx knowledge-upload-flow.test.tsx knowledge-document-detail.test.tsx
pnpm --dir apps/frontend/knowledge typecheck
```

Expected: all commands exit 0, or any unrelated blocker is recorded with command output and scope.
