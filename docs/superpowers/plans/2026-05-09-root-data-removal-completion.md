# Root Data Removal Completion Implementation Plan

状态：current
文档类型：plan
适用范围：`root data removal`、`apps/backend/agent-server`、`packages/memory`、`packages/knowledge`、`packages/runtime`、`scripts`
最后核对：2026-05-09

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the remaining root `data/` retirement work so the tracked root `data/` directory can be deleted safely.

**Architecture:** Runtime code already no longer has unapproved root-data writes according to `pnpm check:no-root-data-runtime`. The remaining work is to finish legacy import domain routing, remove tracked legacy files, tighten guardrails so root `data/*` cannot return, and clean stale documentation that still describes root data as current storage.

**Tech Stack:** TypeScript, Node.js scripts, Vitest, backend agent-server legacy import runner, repository/facade boundaries, `pnpm check:no-root-data-runtime`, `pnpm check:docs`.

---

## Current Evidence

- `pnpm check:no-root-data-runtime` currently passes.
- `git ls-files data` still reports `data/rules/rules.jsonl`.
- Root `data/` must not be deleted until the tracked legacy file is either imported or explicitly confirmed as empty migration input.
- Current stale-doc scan still finds historical references in older specs/plans. Current docs may mention root `data/*` only as legacy import input or historical reference.
- Existing legacy import skeleton lives under `apps/backend/agent-server/src/runtime/legacy-data-import/`.

## File Structure

- Create: `scripts/check-no-tracked-root-data.mjs`
  - Fails if Git still tracks files under root `data/`.
- Modify: `package.json`
  - Add `check:no-tracked-root-data`.
- Modify: `scripts/check-no-root-data-runtime.mjs`
  - Add a strict assertion that allowlisted transitional source hits are zero before final deletion.
- Create: `apps/backend/agent-server/src/runtime/legacy-data-import/legacy-data-import-domain-writer.ts`
  - Defines the explicit domain writer interface used by the import repository.
- Create: `apps/backend/agent-server/src/runtime/legacy-data-import/composite-legacy-data-import.repository.ts`
  - Writes import staging receipts/errors and forwards validated records to domain writers.
- Modify: `apps/backend/agent-server/src/runtime/legacy-data-import/index.ts`
  - Exports the composite repository and writer interface.
- Test: `apps/backend/agent-server/test/legacy-data-import/composite-legacy-data-import.repository.test.ts`
  - Proves imported records reach the correct domain writer and repeated receipts still skip duplicates.
- Delete after import confirmation: `data/rules/rules.jsonl`
- Modify docs:
  - `docs/superpowers/specs/2026-05-07-root-data-deprecation-design.md`
  - `docs/superpowers/plans/2026-05-07-root-data-deprecation.md`
  - `docs/conventions/local-development-guide.md`
  - `docs/conventions/backend-conventions.md`
  - `docs/apps/backend/agent-server/legacy-data-import.md`

## Task 1: Add A Tracked Root Data Guard

**Files:**

- Create: `scripts/check-no-tracked-root-data.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the failing script test command**

Run:

```bash
node ./scripts/check-no-tracked-root-data.mjs
```

Expected before implementation:

```text
Error: Cannot find module
```

- [ ] **Step 2: Create the guard script**

Create `scripts/check-no-tracked-root-data.mjs`:

```js
#!/usr/bin/env node
/* global console, process */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const { stdout } = await execFileAsync('git', ['ls-files', 'data']);
const tracked = stdout
  .split('\n')
  .map(line => line.trim())
  .filter(Boolean);

if (tracked.length > 0) {
  console.error('[check-no-tracked-root-data] tracked root data files remain:');
  for (const file of tracked) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

console.log('[check-no-tracked-root-data] OK');
```

- [ ] **Step 3: Add the root script**

Modify `package.json` scripts:

```json
"check:no-tracked-root-data": "node ./scripts/check-no-tracked-root-data.mjs"
```

- [ ] **Step 4: Run the guard and confirm it catches the remaining tracked file**

Run:

```bash
pnpm check:no-tracked-root-data
```

Expected:

```text
[check-no-tracked-root-data] tracked root data files remain:
- data/rules/rules.jsonl
```

This failure is correct until Task 5 removes the tracked file.

## Task 2: Route Legacy Import Records To Domain Writers

**Files:**

- Create: `apps/backend/agent-server/src/runtime/legacy-data-import/legacy-data-import-domain-writer.ts`
- Create: `apps/backend/agent-server/src/runtime/legacy-data-import/composite-legacy-data-import.repository.ts`
- Modify: `apps/backend/agent-server/src/runtime/legacy-data-import/index.ts`
- Test: `apps/backend/agent-server/test/legacy-data-import/composite-legacy-data-import.repository.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/backend/agent-server/test/legacy-data-import/composite-legacy-data-import.repository.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

import {
  CompositeLegacyDataImportRepository,
  InMemoryLegacyDataImportRepository,
  type LegacyDataImportDomainWriter,
  type LegacyDataImportRecord
} from '../../src/runtime/legacy-data-import';

describe('CompositeLegacyDataImportRepository', () => {
  it('stages a legacy record and forwards it to the matching domain writer', async () => {
    const staging = new InMemoryLegacyDataImportRepository();
    const memoryWriter: LegacyDataImportDomainWriter = {
      importLegacyRecord: vi.fn(async () => undefined)
    };
    const skillsWriter: LegacyDataImportDomainWriter = {
      importLegacyRecord: vi.fn(async () => undefined)
    };
    const repository = new CompositeLegacyDataImportRepository(staging, {
      memory: memoryWriter,
      skills: skillsWriter
    });
    const record: LegacyDataImportRecord = {
      domain: 'memory',
      sourceFile: '/workspace/data/memory/records.jsonl',
      sourceFormat: 'jsonl',
      itemKey: 'memory:/workspace/data/memory/records.jsonl:0',
      payload: { id: 'memory-1', content: 'Remember repo rules' },
      importedAt: '2026-05-09T00:00:00.000Z'
    };

    await repository.importLegacyRecord(record);

    expect(staging.records).toEqual([record]);
    expect(memoryWriter.importLegacyRecord).toHaveBeenCalledWith(record);
    expect(skillsWriter.importLegacyRecord).not.toHaveBeenCalled();
  });

  it('records an import error when the matching writer rejects the payload', async () => {
    const staging = new InMemoryLegacyDataImportRepository();
    const repository = new CompositeLegacyDataImportRepository(staging, {
      rules: {
        importLegacyRecord: vi.fn(async () => {
          throw new Error('rules_schema_mismatch');
        })
      }
    });

    await expect(
      repository.importLegacyRecord({
        domain: 'rules',
        sourceFile: '/workspace/data/rules/rules.jsonl',
        sourceFormat: 'jsonl',
        itemKey: 'rules:/workspace/data/rules/rules.jsonl:0',
        payload: { bad: true },
        importedAt: '2026-05-09T00:00:00.000Z'
      })
    ).rejects.toThrow('rules_schema_mismatch');
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/legacy-data-import/composite-legacy-data-import.repository.test.ts
```

Expected:

```text
FAIL ... CompositeLegacyDataImportRepository is not exported
```

- [ ] **Step 3: Add the domain writer interface**

Create `apps/backend/agent-server/src/runtime/legacy-data-import/legacy-data-import-domain-writer.ts`:

```ts
import type { LegacyDataImportRecord } from './legacy-data-import.types';

export interface LegacyDataImportDomainWriter {
  importLegacyRecord(record: LegacyDataImportRecord): Promise<void>;
}

export type LegacyDataImportDomainWriters = Partial<
  Record<LegacyDataImportRecord['domain'], LegacyDataImportDomainWriter>
>;
```

- [ ] **Step 4: Add the composite repository**

Create `apps/backend/agent-server/src/runtime/legacy-data-import/composite-legacy-data-import.repository.ts`:

```ts
import type { LegacyDataImportDomainWriters } from './legacy-data-import-domain-writer';
import type {
  LegacyDataImportError,
  LegacyDataImportReceipt,
  LegacyDataImportRecord,
  LegacyDataImportRepository
} from './legacy-data-import.types';

export class CompositeLegacyDataImportRepository implements LegacyDataImportRepository {
  constructor(
    private readonly stagingRepository: LegacyDataImportRepository,
    private readonly domainWriters: LegacyDataImportDomainWriters
  ) {}

  hasReceipt(receiptKey: string): Promise<boolean> {
    return this.stagingRepository.hasReceipt(receiptKey);
  }

  async importLegacyRecord(record: LegacyDataImportRecord): Promise<void> {
    await this.stagingRepository.importLegacyRecord(record);
    await this.domainWriters[record.domain]?.importLegacyRecord(record);
  }

  recordReceipt(receipt: LegacyDataImportReceipt): Promise<void> {
    return this.stagingRepository.recordReceipt(receipt);
  }

  hasError(errorKey: string): Promise<boolean> {
    return this.stagingRepository.hasError(errorKey);
  }

  recordError(error: LegacyDataImportError): Promise<void> {
    return this.stagingRepository.recordError(error);
  }
}
```

- [ ] **Step 5: Export the new repository**

Modify `apps/backend/agent-server/src/runtime/legacy-data-import/index.ts`:

```ts
export { CompositeLegacyDataImportRepository } from './composite-legacy-data-import.repository';
export type { LegacyDataImportDomainWriter, LegacyDataImportDomainWriters } from './legacy-data-import-domain-writer';
```

- [ ] **Step 6: Run the test and verify it passes**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/legacy-data-import/composite-legacy-data-import.repository.test.ts
```

Expected:

```text
PASS apps/backend/agent-server/test/legacy-data-import/composite-legacy-data-import.repository.test.ts
```

## Task 3: Wire Legacy Import Bootstrap To Composite Repository

**Files:**

- Modify: `apps/backend/agent-server/src/runtime/legacy-data-import/legacy-data-import.factory.ts`
- Test: `apps/backend/agent-server/test/legacy-data-import/legacy-data-import.runner.test.ts`
- Docs: `docs/apps/backend/agent-server/legacy-data-import.md`

- [ ] **Step 1: Add a failing factory test**

Append to `apps/backend/agent-server/test/legacy-data-import/legacy-data-import.runner.test.ts`:

```ts
it('wraps the staging repository with domain writers when provided', async () => {
  const calls: unknown[] = [];
  const result = await createLegacyDataImportRunnerFromEnv({
    env: {
      LEGACY_DATA_IMPORT: 'once',
      BACKEND_PERSISTENCE: 'memory'
    },
    dataRoot: '/workspace/data',
    domainWriters: {
      memory: {
        importLegacyRecord: async record => {
          calls.push(record);
        }
      }
    }
  });

  expect(result.repository?.constructor.name).toBe('CompositeLegacyDataImportRepository');
  expect(calls).toEqual([]);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/legacy-data-import/legacy-data-import.runner.test.ts
```

Expected:

```text
FAIL ... domainWriters does not exist
```

- [ ] **Step 3: Extend the factory options**

Modify `apps/backend/agent-server/src/runtime/legacy-data-import/legacy-data-import.factory.ts`:

```ts
import { CompositeLegacyDataImportRepository } from './composite-legacy-data-import.repository';
import type { LegacyDataImportDomainWriters } from './legacy-data-import-domain-writer';

export interface LegacyDataImportRunnerFactoryOptions {
  env?: NodeJS.ProcessEnv;
  dataRoot?: string;
  repository?: LegacyDataImportRepository;
  domainWriters?: LegacyDataImportDomainWriters;
  createSqlClient?: (databaseUrl: string) => LegacyDataImportSqlClient;
}
```

When creating the repository, wrap it only when `domainWriters` is present:

```ts
const stagingRepository = options.repository ?? (await createLegacyDataImportRepository(env, options.createSqlClient));
const repository = options.domainWriters
  ? new CompositeLegacyDataImportRepository(stagingRepository, options.domainWriters)
  : stagingRepository;
```

- [ ] **Step 4: Document the bootstrap boundary**

Add to `docs/apps/backend/agent-server/legacy-data-import.md`:

```md
`createLegacyDataImportRunnerFromEnv()` may receive `domainWriters`. When provided, the runner first records the import staging row and then forwards the parsed record to the writer for that domain. Writers own schema validation and mapping into memory/rules/knowledge/skills/runtime repositories. The runner must not import backend domain services directly.
```

- [ ] **Step 5: Run the import tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/legacy-data-import/legacy-data-import.runner.test.ts apps/backend/agent-server/test/legacy-data-import/composite-legacy-data-import.repository.test.ts
```

Expected:

```text
PASS apps/backend/agent-server/test/legacy-data-import/legacy-data-import.runner.test.ts
PASS apps/backend/agent-server/test/legacy-data-import/composite-legacy-data-import.repository.test.ts
```

## Task 4: Remove The Tracked Root Data File

**Files:**

- Delete: `data/rules/rules.jsonl`

- [ ] **Step 1: Inspect the tracked legacy file**

Run:

```bash
git ls-files data/rules/rules.jsonl
sed -n '1,80p' data/rules/rules.jsonl
```

Expected:

```text
data/rules/rules.jsonl
```

If the file has records, run the legacy import fixture or copy the content into a test fixture before deletion. If it is empty or only contains local seed data, delete it in Step 2.

- [ ] **Step 2: Delete the tracked file**

Run:

```bash
rm data/rules/rules.jsonl
```

- [ ] **Step 3: Verify no tracked root data remains**

Run:

```bash
pnpm check:no-tracked-root-data
```

Expected:

```text
[check-no-tracked-root-data] OK
```

## Task 5: Clean Current Documentation That Blocks Deletion

**Files:**

- Modify: `docs/superpowers/specs/2026-05-07-root-data-deprecation-design.md`
- Modify: `docs/superpowers/plans/2026-05-07-root-data-deprecation.md`
- Modify: `docs/conventions/local-development-guide.md`
- Modify: `docs/conventions/backend-conventions.md`
- Modify: `docs/skills/runtime-skills-vs-repo-skills.md`

- [ ] **Step 1: Run the stale-doc scan**

Run:

```bash
rg -n "默认.*data/|data/runtime|data/memory|data/knowledge|data/skills|data/browser-replays|data/generated|root data" docs AGENTS.md
```

Expected: hits remain only when the paragraph says one of:

```text
legacy import
历史参考
不得写入
不得读取
旧路径
```

- [ ] **Step 2: Rewrite current docs to the final wording**

Use this wording wherever a current doc still says root `data/*` is a default runtime location:

```md
Root `data/*` is legacy migration input only. Current runtime persistence uses explicit repositories, `profile-storage/<profile>/...` local fallbacks, or artifact storage under `artifacts/...`; new runtime code must not read or write root `data/*`.
```

- [ ] **Step 3: Mark old historical plans clearly**

For old plan/spec sections that intentionally preserve historical paths, add this note above the path list:

```md
> Historical note: the paths below describe the pre-migration state and must not be used as current implementation guidance.
```

- [ ] **Step 4: Run docs check**

Run:

```bash
pnpm check:docs
```

Expected:

```text
docs check passed
```

## Task 6: Tighten Root Data Runtime Guard For Final Deletion

**Files:**

- Modify: `scripts/check-no-root-data-runtime.mjs`

- [ ] **Step 1: Confirm the current guard has no transitional hits**

Run:

```bash
pnpm check:no-root-data-runtime
```

Expected:

```text
[check-no-root-data-runtime] OK
```

No `transitional root data hits remain` block should be printed.

- [ ] **Step 2: Remove unused allowlist entries**

In `scripts/check-no-root-data-runtime.mjs`, replace the current allowlist with an empty list:

```js
const ALLOWLIST = [];
```

- [ ] **Step 3: Run the guard again**

Run:

```bash
pnpm check:no-root-data-runtime
```

Expected:

```text
[check-no-root-data-runtime] OK
```

## Task 7: Final Verification Before Deleting Root Data

**Files:**

- Modify only if failures require it: affected source/test/docs from Tasks 1-6.

- [ ] **Step 1: Run targeted tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/legacy-data-import/legacy-data-import.runner.test.ts apps/backend/agent-server/test/legacy-data-import/composite-legacy-data-import.repository.test.ts packages/memory/test/semantic-cache-repository.test.ts packages/knowledge/test/local-knowledge-store.test.ts packages/runtime/test/sandbox-executor-browser-artifacts.test.ts
```

Expected:

```text
Test Files  5 passed
```

- [ ] **Step 2: Run type checks**

Run:

```bash
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit --pretty false
pnpm exec tsc -p packages/memory/tsconfig.json --noEmit --pretty false
pnpm exec tsc -p packages/knowledge/tsconfig.json --noEmit --pretty false
pnpm exec tsc -p packages/runtime/tsconfig.json --noEmit --pretty false
```

Expected: all commands exit `0`.

- [ ] **Step 3: Run governance checks**

Run:

```bash
pnpm check:no-root-data-runtime
pnpm check:no-tracked-root-data
pnpm check:docs
```

Expected:

```text
[check-no-root-data-runtime] OK
[check-no-tracked-root-data] OK
docs check passed
```

- [ ] **Step 4: Run package and backend builds**

Run:

```bash
pnpm build:lib
pnpm --dir apps/backend/agent-server build
```

Expected: both commands exit `0`. Existing circular dependency warnings are acceptable only if the exit code remains `0`.

## Self-Review

- Spec coverage: this plan covers final tracked data deletion, legacy import domain routing, strict root-data guards, stale docs, and final verification. It does not re-plan already completed repository seams for memory, knowledge, skill, browser artifacts, tools, intel, report-kit, or config defaults.
- Placeholder scan: no `TBD`, `TODO`, or unspecified “add tests” steps remain.
- Type consistency: `LegacyDataImportDomainWriter`, `LegacyDataImportDomainWriters`, and `CompositeLegacyDataImportRepository` are introduced before later tasks use them.

## Completion Signal

The root `data/` directory can be deleted only after Task 7 passes and `git ls-files data` prints nothing.
