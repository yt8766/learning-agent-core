# Worker App Retirement Implementation Plan

状态：completed
文档类型：plan
适用范围：`apps/worker` 退役、`apps/backend/agent-server` background runner、仓库治理脚本、CI 与文档清理
最后核对：2026-05-08

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete `apps/worker` as a standalone workspace app and make `apps/backend/agent-server` the only current background runner entrypoint.

**Architecture:** The existing `agent-server` runtime bootstrap already owns `RuntimeBackgroundRunnerContext`, `startBackgroundRunnerLoop()`, and queue/lease execution behavior. This plan removes the duplicate worker package, updates governance scripts and docs that still treat `apps/worker` as current, and keeps behavior covered through backend runtime tests.

**Tech Stack:** pnpm workspace, Vitest, TypeScript, Node governance scripts, GitHub Actions, Markdown docs.

---

## Task 1: Protect Agent-Server Background Bootstrap

**Files:**

- Modify: `apps/backend/agent-server/test/runtime/services/runtime-bootstrap.service.spec.ts`

- [x] **Step 1: Add the positive bootstrap test**

Add `启动 runtime background 时会启动 agent-server 内建 runner`, constructing an enabled `backgroundContext` and asserting:

```ts
expect(startBackgroundRunnerLoop).toHaveBeenCalledWith(backgroundContext, expect.any(Function));
```

- [x] **Step 2: Run the focused test**

Run:

```bash
pnpm exec vitest run apps/backend/agent-server/test/runtime/services/runtime-bootstrap.service.spec.ts
```

Expected: PASS.

## Task 2: Remove Worker From Governance Scripts

**Files:**

- Modify: `packages/runtime/test/turbo-typecheck-manifests.test.ts`
- Modify: `packages/runtime/test/package-boundaries-script.test.ts`
- Modify: `eslint.config.js`
- Modify: `scripts/typecheck.js`
- Modify: `scripts/check-staged.js`
- Modify: `scripts/check-package-boundaries.js`
- Modify: `scripts/check-backend-structure.js`
- Modify: `scripts/check-docs.js`

- [x] **Step 1: Update governance tests**

Remove `apps/worker/package.json` from `workspaceManifests` in `packages/runtime/test/turbo-typecheck-manifests.test.ts`.

In `packages/runtime/test/package-boundaries-script.test.ts`, replace the worker fixture in the “additional package and app hosts” test with:

```ts
await writeWorkspaceFile(
  rootDir,
  'apps/backend/agent-server/test/example.test.ts',
  `import { listScaffoldTemplates } from '${templatesSubpathImport}';`
);
```

Expected violation:

```ts
'apps/backend/agent-server/test/example.test.ts imports package subpath "@agent/templates/registries/scaffold-template-registry" from app code';
```

- [x] **Step 2: Update governance scripts**

Remove worker hardcoding from:

- `eslint.config.js`
- `scripts/typecheck.js`
- `scripts/check-staged.js`
- `scripts/check-package-boundaries.js`
- `scripts/check-backend-structure.js`
- `scripts/check-docs.js`

- [x] **Step 3: Verify**

Run:

```bash
pnpm exec vitest run packages/runtime/test/turbo-typecheck-manifests.test.ts packages/runtime/test/package-boundaries-script.test.ts
```

Expected: PASS.

## Task 3: Delete Worker Package And Update Workspace Lockfile

**Files:**

- Delete: `apps/worker/**`
- Modify: `pnpm-lock.yaml`

- [x] **Step 1: Delete the worker directory**

Run:

```bash
rm -rf apps/worker
```

- [x] **Step 2: Update pnpm lockfile**

Run:

```bash
pnpm install
```

Expected: `pnpm-lock.yaml` no longer contains the `apps/worker:` importer.

- [x] **Step 3: Verify workspace references**

Run:

```bash
rg -n "apps/worker|@agent/worker" package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json apps packages agents scripts .github --glob '!**/node_modules/**' --glob '!**/.turbo/**'
```

Expected: no current workspace/package/script references remain.

## Task 4: Update CI Path Filters

**Files:**

- Modify: `.github/workflows/pr-check.yml`

- [x] **Step 1: Remove worker trigger path**

Remove:

```yaml
- 'apps/worker/**'
```

If needed, keep background runner coverage through:

```yaml
- 'apps/backend/agent-server/src/runtime/**'
- 'apps/backend/agent-server/test/runtime/**'
```

- [x] **Step 2: Verify**

Run:

```bash
rg -n "apps/worker|@agent/worker" .github
```

Expected: no matches.

## Task 5: Retire Worker Documentation Entrypoints

**Files:**

- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/apps/backend/README.md`
- Delete: `docs/apps/backend/worker/**`
- Modify: `docs/apps/backend/agent-server/agent-server-overview.md`
- Modify: `docs/architecture/ARCHITECTURE.md`
- Modify: `docs/conventions/project-conventions.md`
- Modify: `docs/conventions/backend-conventions.md`
- Modify: `docs/conventions/local-development-guide.md`
- Modify: `docs/conventions/langgraph-app-structure-guidelines.md`
- Modify: `docs/conventions/package-architecture-guidelines.md`
- Modify: `docs/packages/runtime/runtime-state-machine.md`
- Modify: `docs/packages/runtime/runtime-layering-adr.md`
- Modify: `docs/packages/platform-runtime/README.md`
- Modify: `docs/packages/platform-runtime/official-composition-root-adr.md`
- Modify: `docs/packages/config/runtime-profiles.md`
- Modify: `docs/packages/evals/verification-system-guidelines.md`
- Modify: `docs/context/platform-runtime-package-handoff.md`
- Modify: `docs/context/ai-handoff.md`

- [x] **Step 1: Delete obsolete worker docs**

Run:

```bash
rm -rf docs/apps/backend/worker
```

- [x] **Step 2: Replace current docs language**

Canonical statement:

```md
`apps/backend/agent-server` 是当前唯一官方后台消费入口；它通过 runtime bootstrap 启动内建 background runner，负责 queued task、learning job、lease reclaim、heartbeat 与 failure cleanup。
```

Retirement statement:

```md
`apps/worker` 已退役，不再作为 workspace package、部署进程、验证入口或文档入口存在。不要新增 `@agent/worker` 依赖，也不要恢复 `apps/worker/**`。
```

- [x] **Step 3: Scan docs**

Run:

```bash
rg -n "apps/worker|@agent/worker|独立 worker|worker-overview|backend/worker|backend 与 worker|worker 与 backend" README.md AGENTS.md docs --glob '!docs/archive/**' --glob '!docs/superpowers/specs/2026-05-07-worker-app-retirement-design.md' --glob '!docs/superpowers/plans/2026-05-07-worker-app-retirement.md'
```

Expected: no current-entrypoint matches.

- [x] **Step 4: Run docs check**

Run:

```bash
pnpm check:docs
```

Expected: PASS.

## Task 6: Final Verification And Cleanup

- [x] **Step 1: Run stale reference scans**

```bash
rg -n "apps/worker|@agent/worker" . --glob '!**/node_modules/**' --glob '!**/.turbo/**' --glob '!docs/archive/**' --glob '!docs/superpowers/specs/2026-05-07-worker-app-retirement-design.md' --glob '!docs/superpowers/plans/2026-05-07-worker-app-retirement.md'
```

Expected: no matches.

- [x] **Step 2: Run affected tests**

```bash
pnpm exec vitest run apps/backend/agent-server/test/runtime/helpers/runtime-background-runner.test.ts apps/backend/agent-server/test/runtime/services/runtime-bootstrap.service.spec.ts packages/runtime/test/turbo-typecheck-manifests.test.ts packages/runtime/test/package-boundaries-script.test.ts
```

Expected: PASS.

- [x] **Step 3: Run backend typecheck**

```bash
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

Expected: PASS.

- [x] **Step 4: Run docs check**

```bash
pnpm check:docs
```

Expected: PASS.

- [x] **Step 5: Verify lockfile importer removal**

```bash
rg -n "^  apps/worker:" pnpm-lock.yaml
```

Expected: no matches.
