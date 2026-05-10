# Knowledge CLI Apps/CLI Migration Implementation Plan

状态：completed
文档类型：plan
适用范围：历史迁移记录；当前实现入口为 `apps/cli/knowledge-cli`，正式文档入口为 `docs/apps/knowledge-cli`
最后核对：2026-05-10

## 执行结果

迁移已完成：Knowledge CLI 当前实现已从旧入口 `apps/knowledge-cli` 迁入 `apps/cli/knowledge-cli`，正式文档入口仍保留为 `/docs/apps/knowledge-cli/knowledge-cli.md`。`pnpm-lock.yaml` 的 workspace importer 已同步到新路径，后续代理不要把本文当作待执行计划重复迁移；本文仅作为完成记录和历史实施背景保留。

> 历史执行说明：下方 checkbox 保留为原实施计划记录，不代表当前仍有待执行任务。迁移已完成，后续代理无需再按这些步骤逐项执行。

**Historical Goal:** Move `knowledge-cli` from `apps/knowledge-cli` to `apps/cli/knowledge-cli` and make scripts, docs, tests, and workspace discovery agree on that location.

**Historical Architecture:** Treat `knowledge-cli` as an application-level developer tool under `apps/cli/`, while keeping `packages/knowledge` as the SDK owner and leaving `agents/*` untouched. This was a directory and documentation migration only: no RAG behavior, backend API, package contract, or agent graph changes.

**Historical Tech Stack:** pnpm workspace, TypeScript, Vitest, tsx, existing `@agent/knowledge` public exports, repository docs checks.

---

## File Structure

- Move directory: `apps/knowledge-cli/` -> `apps/cli/knowledge-cli/`
- Preserve: `apps/cli/knowledge-cli/src/**`
- Preserve: `apps/cli/knowledge-cli/test/knowledge-cli.test.ts`
- Preserve with path review: `apps/cli/knowledge-cli/package.json`
- Preserve with path review: `apps/cli/knowledge-cli/tsconfig.json`
- Modify: `apps/cli/knowledge-cli/README.md`
- Modify: `docs/apps/knowledge-cli/knowledge-cli.md`
- Modify: `docs/apps/README.md`
- Modify: `docs/integration/knowledge-sdk-rag-rollout.md`
- Modify if still current: `docs/sdk/knowledge.md`
- Modify if still current: `docs/superpowers/plans/2026-05-09-knowledge-rag-next-steps.md`
- Keep unchanged: `pnpm-workspace.yaml`, because it already includes `apps/*/*`
- Keep unchanged: `packages/knowledge/**`, because the SDK public surface should not widen for this migration
- Keep unchanged: `agents/**`

## Task 1: Add a Failing Location Regression Test

**Files:**

- Create: `test/integration/workspace/knowledge-cli-location.int-spec.ts`

- [ ] **Step 1: Write the failing test**

Create `test/integration/workspace/knowledge-cli-location.int-spec.ts`:

```ts
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = join(import.meta.dirname, '..', '..', '..');

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

describe('knowledge-cli app location', () => {
  it('lives under apps/cli and does not keep the old root apps location', async () => {
    await expect(exists(join(repoRoot, 'apps', 'cli', 'knowledge-cli', 'package.json'))).resolves.toBe(true);
    await expect(exists(join(repoRoot, 'apps', 'knowledge-cli', 'package.json'))).resolves.toBe(false);
  });

  it('keeps pnpm workspace coverage for apps/cli/knowledge-cli', async () => {
    const workspace = await readFile(join(repoRoot, 'pnpm-workspace.yaml'), 'utf8');

    expect(workspace).toContain('apps/*/*');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm exec vitest run --config vitest.config.js test/integration/workspace/knowledge-cli-location.int-spec.ts
```

Expected: FAIL because `apps/cli/knowledge-cli/package.json` does not exist yet and `apps/knowledge-cli/package.json` still exists.

- [ ] **Step 3: Do not loosen the test**

Keep both assertions strict. The migration is not complete while both directories exist.

## Task 2: Move the CLI Directory

**Files:**

- Move: `apps/knowledge-cli/**` -> `apps/cli/knowledge-cli/**`

- [ ] **Step 1: Create the parent grouping directory**

Run:

```bash
mkdir -p apps/cli
```

Expected: `apps/cli` exists.

- [ ] **Step 2: Move the CLI app in one operation**

Run:

```bash
mv apps/knowledge-cli apps/cli/knowledge-cli
```

Expected: `apps/cli/knowledge-cli/package.json` exists and `apps/knowledge-cli` no longer exists.

- [ ] **Step 3: Confirm the moved files**

Run:

```bash
find apps/cli/knowledge-cli -maxdepth 3 -type f | sort
```

Expected output includes:

```text
apps/cli/knowledge-cli/README.md
apps/cli/knowledge-cli/package.json
apps/cli/knowledge-cli/src/args.ts
apps/cli/knowledge-cli/src/cli.ts
apps/cli/knowledge-cli/src/index.ts
apps/cli/knowledge-cli/src/local-doc-loader.ts
apps/cli/knowledge-cli/src/search.ts
apps/cli/knowledge-cli/src/snapshot.ts
apps/cli/knowledge-cli/src/trace.ts
apps/cli/knowledge-cli/src/types.ts
apps/cli/knowledge-cli/test/knowledge-cli.test.ts
apps/cli/knowledge-cli/tsconfig.json
```

- [ ] **Step 4: Run the location test to verify the move**

Run:

```bash
pnpm exec vitest run --config vitest.config.js test/integration/workspace/knowledge-cli-location.int-spec.ts
```

Expected: PASS.

## Task 3: Fix CLI Package Scripts and TypeScript Config

**Files:**

- Modify: `apps/cli/knowledge-cli/package.json`
- Modify only if needed: `apps/cli/knowledge-cli/tsconfig.json`

- [ ] **Step 1: Inspect package scripts after the move**

Run:

```bash
sed -n '1,80p' apps/cli/knowledge-cli/package.json
```

Expected current shape:

```json
{
  "name": "knowledge-cli",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "predev": "pnpm --dir ../../../packages/knowledge build:lib",
    "dev": "tsx src/index.ts",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "pnpm --dir ../../.. exec vitest run --config vitest.config.js apps/cli/knowledge-cli/test",
    "turbo:typecheck": "pnpm typecheck",
    "turbo:test:unit": "pnpm --dir ../../.. exec vitest run --config vitest.config.js apps/cli/knowledge-cli/test --exclude '**/*.int-spec.ts'"
  }
}
```

- [ ] **Step 2: Keep `predev` and test paths aligned with the new location**

No change is needed if the scripts already match this block:

```json
{
  "scripts": {
    "predev": "pnpm --dir ../../../packages/knowledge build:lib",
    "dev": "tsx src/index.ts",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "pnpm --dir ../../.. exec vitest run --config vitest.config.js apps/cli/knowledge-cli/test",
    "turbo:typecheck": "pnpm typecheck",
    "turbo:test:unit": "pnpm --dir ../../.. exec vitest run --config vitest.config.js apps/cli/knowledge-cli/test --exclude '**/*.int-spec.ts'"
  }
}
```

If a script still references `apps/knowledge-cli`, replace that substring with `apps/cli/knowledge-cli`.

- [ ] **Step 3: Verify `tsconfig.json` still extends the root config**

Run:

```bash
sed -n '1,80p' apps/cli/knowledge-cli/tsconfig.json
```

Expected:

```json
{
  "extends": "../../tsconfig.json",
  "include": ["src/**/*", "test/**/*"],
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "outDir": "./build/tmp",
    "types": ["node"],
    "noEmit": true
  }
}
```

Because the file moved one level deeper, update the first line to:

```json
{
  "extends": "../../../tsconfig.json",
  "include": ["src/**/*", "test/**/*"],
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "outDir": "./build/tmp",
    "types": ["node"],
    "noEmit": true
  }
}
```

- [ ] **Step 4: Run CLI typecheck**

Run:

```bash
pnpm --dir apps/cli/knowledge-cli typecheck
```

Expected: PASS.

## Task 4: Update CLI README and Current Docs

**Files:**

- Modify: `apps/cli/knowledge-cli/README.md`
- Modify: `docs/apps/knowledge-cli/knowledge-cli.md`
- Modify: `docs/apps/README.md`
- Modify: `docs/integration/knowledge-sdk-rag-rollout.md`
- Modify if still current: `docs/sdk/knowledge.md`
- Modify if still current: `docs/superpowers/plans/2026-05-09-knowledge-rag-next-steps.md`

- [ ] **Step 1: Update the moved CLI README**

Open:

```bash
sed -n '1,120p' apps/cli/knowledge-cli/README.md
```

Ensure it describes the source location as `apps/cli/knowledge-cli` and includes these commands:

````md
```bash
pnpm --dir apps/cli/knowledge-cli dev -- index --dir ../../../docs --indexFile /tmp/knowledge-index.json
pnpm --dir apps/cli/knowledge-cli dev -- retrieval --indexFile /tmp/knowledge-index.json --query "Knowledge SDK 接入指南"
pnpm --dir apps/cli/knowledge-cli dev -- ask --dir ../../../docs --query "Knowledge SDK 接入指南" --debug
```
````

- [ ] **Step 2: Update the app guide**

Open:

```bash
sed -n '1,120p' docs/apps/knowledge-cli/knowledge-cli.md
```

Ensure the header keeps this current scope:

```md
适用范围：`apps/cli/knowledge-cli`
```

Ensure the guide still says CLI is a local SDK verification entry, not a production backend replacement.

- [ ] **Step 3: Update the apps docs index if needed**

Open:

```bash
sed -n '1,80p' docs/apps/README.md
```

Keep the link target at:

```md
[knowledge-cli/knowledge-cli.md](/docs/apps/knowledge-cli/knowledge-cli.md)
```

Do not change it to `/docs/apps/cli/cli/knowledge-cli.md`.

- [ ] **Step 4: Update rollout and SDK docs if stale references remain**

Run:

```bash
rg -n "apps/knowledge-cli|docs/apps/cli/cli/knowledge-cli" docs apps package.json turbo.json pnpm-workspace.yaml --glob '!apps/**/node_modules/**' --glob '!apps/**/dist/**'
```

Expected after cleanup: no matches outside the design spec and implementation plan where the old path is intentionally documented as historical input.

If `docs/integration/knowledge-sdk-rag-rollout.md` still says `apps/knowledge-cli`, replace it with:

```md
`apps/cli/knowledge-cli` 已提供本地目录 indexing、snapshot retrieval、抽取式 ask 和 JSONL trace，用于证明 SDK 可以脱离 Knowledge App 前端和生产 backend 跑最小闭环。前端仍应通过后端 API，不直连 SDK provider 或向量库。
```

If `docs/superpowers/plans/2026-05-09-knowledge-rag-next-steps.md` still links to `/docs/apps/cli/cli/knowledge-cli.md`, replace that link with:

```md
`docs/apps/knowledge-cli/knowledge-cli.md`
```

- [ ] **Step 5: Run docs check**

Run:

```bash
pnpm check:docs
```

Expected: PASS.

## Task 5: Verify CLI Behavior Still Works

**Files:**

- Test: `apps/cli/knowledge-cli/test/knowledge-cli.test.ts`

- [ ] **Step 1: Run the CLI unit tests**

Run:

```bash
pnpm --dir apps/cli/knowledge-cli test
```

Expected: PASS.

- [ ] **Step 2: Run a minimal index command**

Run:

```bash
pnpm --dir apps/cli/knowledge-cli dev -- index --dir ../../../docs --indexFile /tmp/knowledge-index.json
```

Expected output includes:

```text
Indexed
Chunks:
Snapshot: /tmp/knowledge-index.json
```

- [ ] **Step 3: Run a minimal retrieval command**

Run:

```bash
pnpm --dir apps/cli/knowledge-cli dev -- retrieval --indexFile /tmp/knowledge-index.json --query "Knowledge SDK 接入指南"
```

Expected output begins with:

```text
Top 3 retrieval hits
```

- [ ] **Step 4: Run a minimal ask command**

Run:

```bash
pnpm --dir apps/cli/knowledge-cli dev -- ask --indexFile /tmp/knowledge-index.json --query "Knowledge SDK 接入指南" --debug
```

Expected output includes:

```text
Answer
Citations:
Debug hits
```

## Task 6: Final Cleanup and Governance Verification

**Files:**

- Modify only if scans reveal stale references: docs and app metadata found by `rg`

- [ ] **Step 1: Confirm no stale source directory exists**

Run:

```bash
test ! -e apps/knowledge-cli && test -f apps/cli/knowledge-cli/package.json
```

Expected: command exits with code 0.

- [ ] **Step 2: Confirm no package-lock changes are needed**

Run:

```bash
git diff -- pnpm-lock.yaml
```

Expected: no diff. This migration should not modify dependency versions or workspace dependency graph.

- [ ] **Step 3: Run the stale path scan**

Run:

```bash
rg -n "apps/knowledge-cli|docs/apps/cli/cli/knowledge-cli" docs apps package.json turbo.json pnpm-workspace.yaml --glob '!apps/**/node_modules/**' --glob '!apps/**/dist/**'
```

Expected: only historical mentions in:

```text
docs/superpowers/specs/2026-05-10-knowledge-cli-apps-cli-rag-design.md
docs/superpowers/plans/2026-05-10-knowledge-cli-apps-cli-migration.md
```

- [ ] **Step 4: Run the minimum verification set**

Run:

```bash
pnpm --dir apps/cli/knowledge-cli typecheck
pnpm --dir apps/cli/knowledge-cli test
pnpm exec vitest run --config vitest.config.js test/integration/workspace/knowledge-cli-location.int-spec.ts
pnpm check:docs
```

Expected: all commands PASS.

- [ ] **Step 5: Inspect the final diff**

Run:

```bash
git status --short
git diff --stat
```

Expected:

- `apps/knowledge-cli/**` appears as moved/deleted.
- `apps/cli/knowledge-cli/**` appears as moved/added.
- docs reflect `apps/cli/knowledge-cli`.
- `agents/**` does not appear.
- `packages/knowledge/**` does not appear unless a verification-only issue required a targeted fix.

## Self-Review

- Spec coverage: The plan covers the CLI directory move, package script and `tsconfig` path review, docs cleanup, stale path scan, behavior verification, and explicit `agents/**` non-touch rule.
- Placeholder scan: The plan contains no `TBD`, `TODO`, or unspecified implementation steps.
- Type consistency: The only new test uses repository-level paths and does not introduce new application types.
- Scope control: The plan does not add provider configuration, production vector stores, observability packages, backend APIs, or agent graph changes.
