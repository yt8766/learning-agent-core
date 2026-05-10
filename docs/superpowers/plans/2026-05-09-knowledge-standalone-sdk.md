# Knowledge Standalone SDK Implementation Plan

状态：current
文档类型：plan
适用范围：`packages/knowledge`、`packages/memory`、`apps/backend/agent-server/src/runtime`
最后核对：2026-05-09

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `@agent/knowledge` publishable as a standalone SDK by removing every dependency and source import on monorepo-internal `@agent/*` packages.

**Architecture:** Move knowledge-owned vector/evidence/settings/embedding contracts into `packages/knowledge`, then invert current host coupling so backend/runtime/memory adapt to those SDK contracts. `@agent/knowledge` remains the owner of indexing, retrieval, RAG, local ingestion, and optional adapter surfaces; config, memory repositories, and runtime embedding factories stay in their real host packages.

**Tech Stack:** TypeScript, Zod, Vitest, pnpm workspaces, tsup, existing package exports, backend TypeScript typecheck.

---

## File Structure

- Create `packages/knowledge/test/package-boundary.test.ts`: boundary regression test that fails while `@agent/knowledge` has `@agent/*` manifest deps or source imports.
- Create `packages/knowledge/test/support/file-list.ts`: small recursive file scanner used by the boundary test.
- Create `packages/knowledge/src/contracts/indexing/knowledge-vector-writer.ts`: SDK-owned `KnowledgeVectorDocumentRecord` and `KnowledgeVectorIndexWriter`.
- Modify `packages/knowledge/src/contracts/indexing/index.ts`: export the new vector writer contract.
- Modify `packages/knowledge/src/indexing/types/indexing.types.ts`: import `KnowledgeVectorIndexWriter` from SDK-local contracts.
- Modify `packages/knowledge/src/indexing/pipeline/run-knowledge-indexing.ts`: import `KnowledgeVectorDocumentRecord` from SDK-local contracts.
- Modify `packages/knowledge/src/runtime/local-knowledge-source-ingestion.ts`: import `KnowledgeVectorIndexWriter` from SDK-local contracts.
- Modify `packages/knowledge/src/contracts/helpers/evidence.ts`: replace memory `EvidenceRecord` dependency with a knowledge-local structural type.
- Modify `packages/knowledge/src/contracts/helpers/evidence-utils.ts`: use the knowledge-local evidence type.
- Modify `packages/knowledge/src/contracts/schemas/knowledge-runtime.schema.ts`: remove `@agent/core` learning/eval/budget schema re-exports.
- Modify `packages/knowledge/src/contracts/types/knowledge-runtime.types.ts`: remove `@agent/core` learning/eval/budget type re-exports.
- Modify `packages/knowledge/src/runtime/local-knowledge-store.ts`: replace `loadSettings()`-derived types with `LocalKnowledgeStoreSettings` and optional embedding provider wiring.
- Modify `packages/knowledge/src/runtime/local-knowledge-store.helpers.ts`: remove `loadSettings()` and `import('@agent/adapters')`; accept SDK-local settings and injected embedding provider.
- Modify `packages/knowledge/test/indexing-pipeline.test.ts`, `packages/knowledge/test/source-ingestion-loader.test.ts`, `packages/knowledge/test/source-ingestion-runtime-store.test.ts`: import vector writer types from `@agent/knowledge`.
- Modify `packages/knowledge/test/local-knowledge-store.test.ts`: construct `LocalKnowledgeStoreSettings` directly and test injected embedding provider behavior.
- Modify `packages/memory/src/vector/knowledge-vector-documents.ts`: import vector contract type from `@agent/knowledge` and keep `loadKnowledgeVectorDocuments()` as memory-owned loader.
- Modify `packages/memory/src/vector/vector-index-repository.ts`: import `KnowledgeVectorDocumentRecord` from `@agent/knowledge` or from `knowledge-vector-documents.ts` after that file re-exports the SDK type.
- Modify `apps/backend/agent-server/src/runtime/domain/knowledge/runtime-knowledge-store.ts`: stop thin re-exporting raw knowledge functions; expose backend wrappers that map runtime settings into `LocalKnowledgeStoreSettings`.
- Create or modify `apps/backend/agent-server/src/runtime/domain/knowledge/runtime-knowledge-settings.adapter.ts`: centralize settings mapping.
- Modify backend runtime callers under `apps/backend/agent-server/src/runtime/**`: keep using domain wrapper functions so callers do not know SDK settings details.
- Modify `apps/backend/agent-server/src/runtime/services/runtime-knowledge.service.ts`: pass mapped local knowledge settings into `ingestKnowledgeSourcePayloads()`.
- Modify `apps/backend/agent-server/src/runtime/core/runtime-knowledge-search-repositories.ts`: type settings against backend adapter output, not `Parameters<typeof listKnowledgeArtifacts>[0]`.
- Modify `packages/knowledge/package.json`: remove `@agent/core`, `@agent/config`, and `@agent/memory`.
- Modify `pnpm-lock.yaml`: sync dependency graph after manifest change.
- Modify docs listed in the design spec: `docs/packages/knowledge/README.md`, `docs/packages/knowledge/sdk-architecture.md`, `docs/packages/knowledge/indexing-package-guidelines.md`, `docs/packages/knowledge/indexing-contract-guidelines.md`, `packages/knowledge/src/contracts/README.md`, and relevant `docs/architecture/ARCHITECTURE.md` passages.

### Task 1: Add Boundary Regression Test

**Files:**

- Create: `packages/knowledge/test/package-boundary.test.ts`
- Create: `packages/knowledge/test/support/file-list.ts`

- [ ] **Step 1: Write the failing boundary test**

Create `packages/knowledge/test/support/file-list.ts`:

```ts
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

export async function listFiles(root: string, predicate: (path: string) => boolean): Promise<string[]> {
  const found: string[] = [];
  const entries = await readdir(root, { withFileTypes: true });

  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await listFiles(path, predicate)));
    } else if (predicate(path)) {
      found.push(path);
    }
  }

  return found;
}
```

Create `packages/knowledge/test/package-boundary.test.ts`:

```ts
import { readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

import { listFiles } from './support/file-list';

const packageRoot = join(import.meta.dirname, '..');

describe('@agent/knowledge package boundary', () => {
  it('does not depend on workspace @agent packages so it can be published as a standalone SDK', async () => {
    const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
    };
    const dependencyNames = Object.keys({
      ...manifest.dependencies,
      ...manifest.devDependencies,
      ...manifest.peerDependencies,
      ...manifest.optionalDependencies
    });

    expect(dependencyNames.filter(name => name.startsWith('@agent/'))).toEqual([]);
  });

  it('does not import workspace @agent packages from SDK source files', async () => {
    const sourceFiles = await listFiles(join(packageRoot, 'src'), file => file.endsWith('.ts'));
    const offenders: string[] = [];

    for (const file of sourceFiles) {
      const source = await readFile(file, 'utf8');
      if (source.includes("from '@agent/") || source.includes('from "@agent/') || source.includes("import('@agent/")) {
        offenders.push(relative(packageRoot, file));
      }
    }

    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --dir packages/knowledge test -- package-boundary.test.ts
```

Expected: FAIL. The first assertion lists `@agent/core`, `@agent/config`, and `@agent/memory`; the second assertion lists current source files importing `@agent/*`.

- [ ] **Step 3: Do not fix yet**

Leave the test red until Tasks 2-6 remove the actual coupling. Do not loosen the assertions.

### Task 2: Move Vector Writer Contract Into Knowledge

**Files:**

- Create: `packages/knowledge/src/contracts/indexing/knowledge-vector-writer.ts`
- Modify: `packages/knowledge/src/contracts/indexing/index.ts`
- Modify: `packages/knowledge/src/indexing/types/indexing.types.ts`
- Modify: `packages/knowledge/src/indexing/pipeline/run-knowledge-indexing.ts`
- Modify: `packages/knowledge/src/runtime/local-knowledge-source-ingestion.ts`
- Modify tests importing vector writer types from `@agent/memory`

- [ ] **Step 1: Write an export-focused failing test**

Append to `packages/knowledge/test/root-exports.test.ts` near existing root export assertions:

```ts
import type { KnowledgeVectorDocumentRecord, KnowledgeVectorIndexWriter } from '@agent/knowledge';

describe('@agent/knowledge vector writer contract exports', () => {
  it('exports the knowledge vector writer contract from the SDK boundary', async () => {
    const record: KnowledgeVectorDocumentRecord = {
      id: 'chunk-1',
      namespace: 'knowledge',
      sourceId: 'source-1',
      documentId: 'doc-1',
      chunkId: 'chunk-1',
      uri: '/docs/a.md',
      title: 'A',
      sourceType: 'repo-docs',
      content: 'hello',
      searchable: true
    };
    const written: KnowledgeVectorDocumentRecord[] = [];
    const writer: KnowledgeVectorIndexWriter = {
      async upsertKnowledge(nextRecord) {
        written.push(nextRecord);
      }
    };

    await writer.upsertKnowledge(record);

    expect(written).toEqual([record]);
  });
});
```

- [ ] **Step 2: Run the export test to verify it fails**

Run:

```bash
pnpm --dir packages/knowledge test -- root-exports.test.ts
```

Expected: FAIL with TypeScript or runtime import failure because the vector writer contract is not exported by `@agent/knowledge`.

- [ ] **Step 3: Add the SDK-local contract**

Create `packages/knowledge/src/contracts/indexing/knowledge-vector-writer.ts`:

```ts
export interface KnowledgeVectorDocumentRecord {
  id: string;
  namespace: 'knowledge';
  sourceId: string;
  documentId: string;
  chunkId: string;
  uri: string;
  title: string;
  sourceType: string;
  content: string;
  searchable: boolean;
}

export interface KnowledgeVectorIndexWriter {
  upsertKnowledge(record: KnowledgeVectorDocumentRecord): Promise<void>;
}
```

Modify `packages/knowledge/src/contracts/indexing/index.ts`:

```ts
export * from './schemas/index';
export * from './contracts/index';
export * from './knowledge-vector-writer';
```

- [ ] **Step 4: Replace knowledge imports**

In `packages/knowledge/src/indexing/types/indexing.types.ts`, replace:

```ts
import type { KnowledgeVectorIndexWriter } from '@agent/memory';
```

with:

```ts
import type { KnowledgeVectorIndexWriter } from '../../contracts/indexing';
```

In `packages/knowledge/src/indexing/pipeline/run-knowledge-indexing.ts`, replace:

```ts
import type { KnowledgeVectorDocumentRecord } from '@agent/memory';
```

with:

```ts
import type { KnowledgeVectorDocumentRecord } from '../../contracts/indexing';
```

In `packages/knowledge/src/runtime/local-knowledge-source-ingestion.ts`, replace:

```ts
import type { KnowledgeVectorIndexWriter } from '@agent/memory';
```

with:

```ts
import type { KnowledgeVectorIndexWriter } from '../contracts/indexing';
```

- [ ] **Step 5: Update knowledge tests to import SDK-local types**

In these tests, replace `@agent/memory` vector type imports with `@agent/knowledge`:

```ts
import type { KnowledgeVectorDocumentRecord, KnowledgeVectorIndexWriter } from '@agent/knowledge';
```

Files:

- `packages/knowledge/test/indexing-pipeline.test.ts`
- `packages/knowledge/test/source-ingestion-loader.test.ts`
- `packages/knowledge/test/source-ingestion-runtime-store.test.ts`

- [ ] **Step 6: Run focused tests**

Run:

```bash
pnpm --dir packages/knowledge test -- root-exports.test.ts indexing-pipeline.test.ts source-ingestion-loader.test.ts source-ingestion-runtime-store.test.ts
```

Expected: PASS for these files except failures caused by remaining `@agent/*` imports, which Task 6 will address.

### Task 3: Make Evidence Helpers SDK-Local

**Files:**

- Modify: `packages/knowledge/src/contracts/helpers/evidence.ts`
- Modify: `packages/knowledge/src/contracts/helpers/evidence-utils.ts`

- [ ] **Step 1: Add a structural evidence helper test**

Create or append to an existing knowledge helper test, preferably `packages/knowledge/test/evidence-utils.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { inferTrustClass, isCitationEvidenceSource, mergeEvidence, type KnowledgeEvidenceRecord } from '../src';

describe('knowledge evidence helpers', () => {
  it('accept SDK-local structural evidence records without memory package types', () => {
    const official: KnowledgeEvidenceRecord = {
      sourceType: 'document',
      sourceUrl: 'https://openai.com/docs',
      trustClass: 'official',
      summary: 'official docs'
    };
    const duplicate: KnowledgeEvidenceRecord = {
      sourceType: 'document',
      sourceUrl: 'https://openai.com/docs',
      trustClass: 'official',
      summary: 'duplicate docs'
    };

    expect(isCitationEvidenceSource(official)).toBe(true);
    expect(inferTrustClass('https://github.com/example/repo')).toBe('curated');
    expect(mergeEvidence([official], [duplicate])).toEqual([official]);
  });
});
```

- [ ] **Step 2: Run the helper test to verify it fails**

Run:

```bash
pnpm --dir packages/knowledge test -- evidence-utils.test.ts
```

Expected: FAIL because `KnowledgeEvidenceRecord` is not exported and helpers still import `EvidenceRecord` from `@agent/memory`.

- [ ] **Step 3: Implement SDK-local evidence type**

In `packages/knowledge/src/contracts/helpers/evidence-utils.ts`, replace the memory import with:

```ts
export interface KnowledgeEvidenceRecord {
  sourceType: string;
  sourceUrl?: string;
  trustClass: string;
  summary: string;
}
```

Then update signatures:

```ts
export function mergeEvidence(
  existing: KnowledgeEvidenceRecord[],
  incoming: KnowledgeEvidenceRecord[]
): KnowledgeEvidenceRecord[] {
  const merged = [...existing];
  for (const item of incoming) {
    const key = `${item.sourceType}:${item.sourceUrl ?? item.summary}`;
    if (!merged.some(candidate => `${candidate.sourceType}:${candidate.sourceUrl ?? candidate.summary}` === key)) {
      merged.push(item);
    }
  }
  return merged;
}

export function inferTrustClass(sourceUrl: string): KnowledgeEvidenceRecord['trustClass'] {
  try {
    const host = new URL(sourceUrl).hostname.toLowerCase();
    if (
      host.includes('openai.com') ||
      host.includes('anthropic.com') ||
      host.includes('deepseek.com') ||
      host.includes('openclaw.ai') ||
      host.includes('open-claw.org') ||
      host.includes('npmjs.com') ||
      host.includes('developer.mozilla.org')
    ) {
      return 'official';
    }
    if (host.includes('github.com')) {
      return 'curated';
    }
    return 'community';
  } catch {
    return 'unverified';
  }
}
```

In `packages/knowledge/src/contracts/helpers/evidence.ts`, replace the memory import with:

```ts
import type { KnowledgeEvidenceRecord } from './evidence-utils';
```

and update the function signature:

```ts
export function isCitationEvidenceSource(
  source: Pick<KnowledgeEvidenceRecord, 'sourceType' | 'sourceUrl' | 'trustClass'>
) {
  if (
    source.sourceType === 'freshness_meta' ||
    source.sourceType === 'web_search_result' ||
    source.sourceType === 'web_research_plan'
  ) {
    return false;
  }

  if (source.sourceUrl) {
    return true;
  }

  return source.sourceType === 'document' || source.sourceType === 'web';
}
```

- [ ] **Step 4: Run the helper test**

Run:

```bash
pnpm --dir packages/knowledge test -- evidence-utils.test.ts
```

Expected: PASS.

### Task 4: Remove Core Learning/Eval/Budget Re-Exports

**Files:**

- Modify: `packages/knowledge/src/contracts/schemas/knowledge-runtime.schema.ts`
- Modify: `packages/knowledge/src/contracts/types/knowledge-runtime.types.ts`
- Search and modify any callers that import these legacy names from `@agent/knowledge`

- [ ] **Step 1: Search legacy re-export consumers**

Run:

```bash
rg "BudgetInterruptState|BudgetState|EvaluationResult|LearningConflict|LearningEvaluation|SkillGovernanceRecommendation" packages apps agents docs -g '*.ts' -g '*.tsx'
```

Expected: Identify whether any TypeScript caller imports these names from `@agent/knowledge`. If callers exist, update them in this task to import from the true current host. If no callers exist, continue.

- [ ] **Step 2: Remove schema re-export imports and exports**

In `packages/knowledge/src/contracts/schemas/knowledge-runtime.schema.ts`, remove this import block:

```ts
import {
  BudgetInterruptStateSchema,
  BudgetStateSchema,
  EvaluationResultSchema,
  LearningConflictRecordSchema,
  LearningConflictScanResultSchema,
  LearningConflictScanSuggestionSchema,
  LearningEvaluationBudgetEfficiencySchema,
  LearningEvaluationRecordSchema,
  LearningEvaluationSourceSummarySchema,
  LearningEvaluationTimeoutStatsSchema,
  SkillGovernanceRecommendationSchema
} from '@agent/core';
```

Remove this export block:

```ts
export {
  BudgetInterruptStateSchema,
  BudgetStateSchema,
  EvaluationResultSchema,
  LearningConflictRecordSchema,
  LearningConflictScanResultSchema,
  LearningConflictScanSuggestionSchema,
  LearningEvaluationBudgetEfficiencySchema,
  LearningEvaluationRecordSchema,
  LearningEvaluationSourceSummarySchema,
  LearningEvaluationTimeoutStatsSchema,
  SkillGovernanceRecommendationSchema
};
```

- [ ] **Step 3: Remove type re-exports**

In `packages/knowledge/src/contracts/types/knowledge-runtime.types.ts`, remove:

```ts
export type {
  BudgetInterruptState,
  BudgetState,
  EvaluationResult,
  LearningConflictRecord,
  LearningConflictScanResult,
  LearningConflictScanSuggestion,
  LearningEvaluationBudgetEfficiency,
  LearningEvaluationRecord,
  LearningEvaluationSourceSummary,
  LearningEvaluationTimeoutStats,
  SkillGovernanceRecommendation
} from '@agent/core';
```

- [ ] **Step 4: Run knowledge typecheck**

Run:

```bash
pnpm --dir packages/knowledge typecheck
```

Expected: PASS or only failures from remaining config/adapters coupling that Task 5 fixes.

### Task 5: Replace Local Store Config and Embedding Coupling

**Files:**

- Modify: `packages/knowledge/src/runtime/local-knowledge-store.ts`
- Modify: `packages/knowledge/src/runtime/local-knowledge-store.helpers.ts`
- Modify: `packages/knowledge/test/local-knowledge-store.test.ts`

- [ ] **Step 1: Add tests for SDK-local settings and injected embedding**

In `packages/knowledge/test/local-knowledge-store.test.ts`, remove `loadSettings` import and add local helper:

```ts
import type { LocalKnowledgeStoreSettings } from '../src/runtime/local-knowledge-store';

function createTestKnowledgeSettings(root: string): LocalKnowledgeStoreSettings {
  return {
    workspaceRoot: root,
    knowledgeRoot: join(root, 'data/knowledge'),
    tasksStateFilePath: join(root, 'data/tasks/tasks.json'),
    embeddings: {
      provider: 'test-provider',
      model: 'test-model'
    }
  };
}
```

Update existing tests to use:

```ts
const settings = createTestKnowledgeSettings(root);
```

Replace the adapter-skip test with:

```ts
it('writes failed embeddings when no embedding provider is injected', async () => {
  const root = await mkdtemp(join(tmpdir(), 'knowledge-store-no-provider-'));
  tempRoots.push(root);
  const settings = createTestKnowledgeSettings(root);

  const embedding = await embedChunk(
    settings,
    {
      id: 'chunk_no_provider',
      store: 'cangjing',
      sourceId: 'source_no_provider',
      documentId: 'doc_no_provider',
      chunkIndex: 0,
      content: 'hello knowledge',
      tokenCount: 4,
      searchable: false,
      receiptId: 'receipt_no_provider',
      version: 'v1',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z'
    },
    'receipt_no_provider',
    'v1'
  );

  expect(embedding).toMatchObject({
    embeddingProvider: 'test-provider',
    embeddingModel: 'test-model',
    dimensions: 0,
    status: 'failed',
    failureReason: 'missing_embedding_provider'
  });
});

it('writes ready embeddings through an injected provider', async () => {
  const root = await mkdtemp(join(tmpdir(), 'knowledge-store-provider-'));
  tempRoots.push(root);
  const settings = createTestKnowledgeSettings(root);

  const embedding = await embedChunk(
    settings,
    {
      id: 'chunk_provider',
      store: 'cangjing',
      sourceId: 'source_provider',
      documentId: 'doc_provider',
      chunkIndex: 0,
      content: 'hello knowledge',
      tokenCount: 4,
      searchable: false,
      receiptId: 'receipt_provider',
      version: 'v1',
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z'
    },
    'receipt_provider',
    'v1',
    {
      provider: 'injected',
      model: 'embed-small',
      async embedQuery(content) {
        expect(content).toBe('hello knowledge');
        return [0.1, 0.2, 0.3];
      }
    }
  );

  expect(embedding).toMatchObject({
    embeddingProvider: 'injected',
    embeddingModel: 'embed-small',
    dimensions: 3,
    status: 'ready'
  });
});
```

- [ ] **Step 2: Run local store test to verify it fails**

Run:

```bash
pnpm --dir packages/knowledge test -- local-knowledge-store.test.ts
```

Expected: FAIL because `LocalKnowledgeStoreSettings` and provider injection signatures are not implemented yet.

- [ ] **Step 3: Add SDK-local settings and provider types**

In `packages/knowledge/src/runtime/local-knowledge-store.ts`, remove:

```ts
import { loadSettings } from '@agent/config';
```

Add:

```ts
export interface LocalKnowledgeRuntimePaths {
  wenyuanRoot: string;
  cangjingRoot: string;
}

export interface LocalKnowledgeEmbeddingSettings {
  provider: string;
  model: string;
  apiKey?: string;
}

export interface LocalKnowledgeStoreSettings {
  workspaceRoot: string;
  knowledgeRoot: string;
  tasksStateFilePath?: string;
  embeddings?: LocalKnowledgeEmbeddingSettings;
}

export interface LocalKnowledgeEmbeddingProvider {
  provider: string;
  model: string;
  embedQuery(content: string): Promise<number[]>;
}
```

Use `LocalKnowledgeStoreSettings` everywhere the file currently uses `RuntimeSettings`. Update `LocalKnowledgeStoreOptions`:

```ts
export interface LocalKnowledgeStoreOptions {
  repository?: LocalKnowledgeSnapshotRepository;
  runtimePaths?: LocalKnowledgeRuntimePaths;
  embeddingProvider?: LocalKnowledgeEmbeddingProvider;
  sourceProvider?: (settings: LocalKnowledgeStoreSettings) => Promise<LocalKnowledgeCandidate[]>;
}
```

- [ ] **Step 4: Update helper types and embedding implementation**

In `packages/knowledge/src/runtime/local-knowledge-store.helpers.ts`, remove:

```ts
import { loadSettings } from '@agent/config';
```

Add type-only imports:

```ts
import type { LocalKnowledgeEmbeddingProvider, LocalKnowledgeStoreSettings } from './local-knowledge-store';
```

Replace `RuntimeSettings` and `KnowledgeStorageSettings` with:

```ts
export type KnowledgeStorageSettings = Pick<LocalKnowledgeStoreSettings, 'knowledgeRoot'>;
```

Change `embedChunk` signature:

```ts
export async function embedChunk(
  settings: LocalKnowledgeStoreSettings,
  chunk: KnowledgeChunkRecord,
  receiptId: string,
  version: string,
  embeddingProvider?: LocalKnowledgeEmbeddingProvider
): Promise<KnowledgeEmbeddingRecord> {
  const now = new Date().toISOString();
  if (!embeddingProvider) {
    return failedEmbedding(settings, chunk, receiptId, version, now, 'missing_embedding_provider');
  }

  try {
    const vector = await embeddingProvider.embedQuery(chunk.content);
    if (!vector?.length) throw new Error('empty_embedding');
    return {
      id: `embedding_${hashText(chunk.id)}`,
      store: 'cangjing',
      sourceId: chunk.sourceId,
      documentId: chunk.documentId,
      chunkId: chunk.id,
      embeddingProvider: embeddingProvider.provider,
      embeddingModel: embeddingProvider.model,
      dimensions: vector.length,
      embeddedAt: now,
      receiptId,
      version,
      status: 'ready'
    };
  } catch (error) {
    return failedEmbedding(
      settings,
      chunk,
      receiptId,
      version,
      now,
      error instanceof Error ? error.message : 'embedding_failed'
    );
  }
}
```

Update `failedEmbedding()` to use defaults:

```ts
function failedEmbedding(
  settings: LocalKnowledgeStoreSettings,
  chunk: KnowledgeChunkRecord,
  receiptId: string,
  version: string,
  embeddedAt: string,
  failureReason: string
): KnowledgeEmbeddingRecord {
  return {
    id: `embedding_${hashText(chunk.id)}`,
    store: 'cangjing',
    sourceId: chunk.sourceId,
    documentId: chunk.documentId,
    chunkId: chunk.id,
    embeddingProvider: settings.embeddings?.provider ?? 'local',
    embeddingModel: settings.embeddings?.model ?? 'unconfigured',
    dimensions: 0,
    embeddedAt,
    receiptId,
    version,
    status: 'failed',
    failureReason
  };
}
```

- [ ] **Step 5: Pass provider through ingestion**

In `packages/knowledge/src/runtime/local-knowledge-store.ts`, update the call:

```ts
const embedding = await embedChunk(settings, chunk, receiptId, version, options.embeddingProvider);
```

Update `buildDefaultRuntimePaths`:

```ts
function buildDefaultRuntimePaths(settings: LocalKnowledgeStoreSettings): LocalKnowledgeRuntimePaths {
  return {
    wenyuanRoot: settings.tasksStateFilePath ? dirname(settings.tasksStateFilePath) : dirname(settings.knowledgeRoot),
    cangjingRoot: settings.knowledgeRoot
  };
}
```

- [ ] **Step 6: Run local store tests**

Run:

```bash
pnpm --dir packages/knowledge test -- local-knowledge-store.test.ts
```

Expected: PASS.

### Task 6: Update Memory and Backend Host Adapters

**Files:**

- Modify: `packages/memory/src/vector/knowledge-vector-documents.ts`
- Modify: `packages/memory/src/vector/vector-index-repository.ts`
- Modify: `apps/backend/agent-server/src/runtime/domain/knowledge/runtime-knowledge-store.ts`
- Create: `apps/backend/agent-server/src/runtime/domain/knowledge/runtime-knowledge-settings.adapter.ts`
- Modify: `apps/backend/agent-server/src/runtime/services/runtime-knowledge.service.ts`
- Modify: `apps/backend/agent-server/src/runtime/core/runtime-knowledge-search-repositories.ts`
- Update affected backend tests

- [ ] **Step 1: Update memory to consume knowledge vector contract**

In `packages/memory/src/vector/knowledge-vector-documents.ts`, replace local interface definitions with:

```ts
import type { KnowledgeVectorDocumentRecord, KnowledgeVectorIndexWriter } from '@agent/knowledge';

export type { KnowledgeVectorDocumentRecord, KnowledgeVectorIndexWriter };
```

Keep `loadKnowledgeVectorDocuments()` unchanged except that its return type now references the imported SDK type.

If `packages/memory/src/vector/vector-index-repository.ts` imports the type from `knowledge-vector-documents.ts`, leave the import path as is. If type errors occur, import directly:

```ts
import type { KnowledgeVectorDocumentRecord } from '@agent/knowledge';
import { loadKnowledgeVectorDocuments } from './knowledge-vector-documents';
```

- [ ] **Step 2: Add backend settings adapter**

Create `apps/backend/agent-server/src/runtime/domain/knowledge/runtime-knowledge-settings.adapter.ts`:

```ts
import type { LocalKnowledgeStoreSettings } from '@agent/knowledge';
import type { loadSettings } from '@agent/config';

type RuntimeSettings = ReturnType<typeof loadSettings>;

export function toLocalKnowledgeStoreSettings(settings: RuntimeSettings): LocalKnowledgeStoreSettings {
  return {
    workspaceRoot: settings.workspaceRoot,
    knowledgeRoot: settings.knowledgeRoot,
    tasksStateFilePath: settings.tasksStateFilePath,
    embeddings: {
      provider: settings.embeddings.provider,
      model: settings.embeddings.model,
      apiKey: settings.embeddings.apiKey || settings.mcp?.bigmodelApiKey || settings.zhipuApiKey || undefined
    }
  };
}
```

- [ ] **Step 3: Wrap knowledge store functions in backend domain**

Modify `apps/backend/agent-server/src/runtime/domain/knowledge/runtime-knowledge-store.ts` from thin re-export to wrappers:

```ts
import {
  buildKnowledgeDescriptor as buildSdkKnowledgeDescriptor,
  ingestLocalKnowledge as ingestSdkLocalKnowledge,
  listKnowledgeArtifacts as listSdkKnowledgeArtifacts,
  readKnowledgeOverview as readSdkKnowledgeOverview,
  type LocalKnowledgeStoreOptions
} from '@agent/knowledge';
import type { loadSettings } from '@agent/config';

import { toLocalKnowledgeStoreSettings } from './runtime-knowledge-settings.adapter';

type RuntimeSettings = ReturnType<typeof loadSettings>;

export async function ingestLocalKnowledge(settings: RuntimeSettings, options: LocalKnowledgeStoreOptions = {}) {
  return ingestSdkLocalKnowledge(toLocalKnowledgeStoreSettings(settings), options);
}

export async function readKnowledgeOverview(settings: RuntimeSettings, options: LocalKnowledgeStoreOptions = {}) {
  return readSdkKnowledgeOverview(toLocalKnowledgeStoreSettings(settings), options);
}

export async function listKnowledgeArtifacts(settings: RuntimeSettings, options: LocalKnowledgeStoreOptions = {}) {
  return listSdkKnowledgeArtifacts(toLocalKnowledgeStoreSettings(settings), options);
}

export function buildKnowledgeDescriptor(
  settings: RuntimeSettings,
  options: Pick<LocalKnowledgeStoreOptions, 'runtimePaths'> = {}
) {
  return buildSdkKnowledgeDescriptor(toLocalKnowledgeStoreSettings(settings), options);
}
```

- [ ] **Step 4: Map settings where backend directly calls SDK ingestion**

In `apps/backend/agent-server/src/runtime/services/runtime-knowledge.service.ts`, import:

```ts
import { toLocalKnowledgeStoreSettings } from '../domain/knowledge/runtime-knowledge-settings.adapter';
```

Replace calls like:

```ts
return ingestKnowledgeSourcePayloads(context.settings, payloads, context.vectorIndexRepository);
```

with:

```ts
return ingestKnowledgeSourcePayloads(
  toLocalKnowledgeStoreSettings(context.settings),
  payloads,
  context.vectorIndexRepository
);
```

Apply the same pattern to each `ingestKnowledgeSourcePayloads()` call in that service.

- [ ] **Step 5: Remove `Parameters<typeof listKnowledgeArtifacts>[0]` coupling**

In `apps/backend/agent-server/src/runtime/core/runtime-knowledge-search-repositories.ts`, replace:

```ts
export type RuntimeKnowledgeSettings = Parameters<typeof listKnowledgeArtifacts>[0];
```

with an explicit backend settings type:

```ts
import type { loadSettings } from '@agent/config';

export type RuntimeKnowledgeSettings = ReturnType<typeof loadSettings>;
```

Continue importing `listKnowledgeArtifacts` from the backend domain wrapper if possible:

```ts
import { listKnowledgeArtifacts } from '../domain/knowledge/runtime-knowledge-store';
```

- [ ] **Step 6: Run backend focused typecheck**

Run:

```bash
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit --pretty false
```

Expected: PASS or actionable type errors in files touched by this task. Fix those before continuing.

### Task 7: Remove Manifest Dependencies and Sync Lockfile

**Files:**

- Modify: `packages/knowledge/package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Remove workspace dependencies**

In `packages/knowledge/package.json`, remove:

```json
"@agent/core": "workspace:*",
"@agent/config": "workspace:*",
"@agent/memory": "workspace:*",
```

Keep existing third-party dependencies.

- [ ] **Step 2: Sync lockfile**

Run:

```bash
pnpm install
```

Expected: `pnpm-lock.yaml` updates. The `packages/knowledge` importer should no longer list `@agent/core`, `@agent/config`, or `@agent/memory`.

- [ ] **Step 3: Run the boundary test**

Run:

```bash
pnpm --dir packages/knowledge test -- package-boundary.test.ts
```

Expected: PASS.

### Task 8: Update Documentation and Cleanup Old Boundary Text

**Files:**

- Modify: `docs/packages/knowledge/README.md`
- Modify: `docs/packages/knowledge/sdk-architecture.md`
- Modify: `docs/packages/knowledge/indexing-package-guidelines.md`
- Modify: `docs/packages/knowledge/indexing-contract-guidelines.md`
- Modify: `packages/knowledge/src/contracts/README.md`
- Modify: `docs/architecture/ARCHITECTURE.md`

- [ ] **Step 1: Scan stale docs**

Run:

```bash
rg -n "@agent/(config|core|memory|adapters)|KnowledgeVectorIndexWriter|KnowledgeVectorDocumentRecord|memory vector boundary|允许依赖" docs/packages/knowledge packages/knowledge/src/contracts/README.md docs/architecture/ARCHITECTURE.md
```

Expected: Stale mentions appear in knowledge docs and architecture docs.

- [ ] **Step 2: Update knowledge README boundary**

In `docs/packages/knowledge/README.md`, replace the old dependency-direction bullets with:

```md
- 依赖方向：
  - `@agent/knowledge` 是可独立发布 SDK，不依赖任何 `@agent/*` workspace 包。
  - SDK 内部只承载 knowledge-owned schema、type、provider interface、indexing/retrieval runtime、local ingestion facade 与官方可选 adapter。
  - 仓库内部如需连接 `@agent/config`、`@agent/memory`、`@agent/adapters` 或 runtime provider，必须在 backend/runtime/platform 的 host adapter 中把这些能力适配为 `@agent/knowledge` 暴露的接口。
  - `@agent/memory` 可以实现 `KnowledgeVectorIndexWriter`，但 writer contract 主定义归 `@agent/knowledge`。
```

- [ ] **Step 3: Update indexing docs**

In `docs/packages/knowledge/indexing-package-guidelines.md` and `docs/packages/knowledge/indexing-contract-guidelines.md`, replace statements saying embedding/vector persistence is owned by `@agent/memory` boundary with:

```md
`runKnowledgeIndexing()` 不直接持有 embedder，也不直接绑定真实 vector store。它把 chunk 转为 `KnowledgeVectorDocumentRecord` 后写入调用方注入的 `KnowledgeVectorIndexWriter`。这两个 writer contract 由 `@agent/knowledge` 定义；仓库内部的 `@agent/memory` vector repository 可以实现该接口，但不是 knowledge SDK 的依赖。
```

Update code examples to:

```ts
import type { KnowledgeChunk, KnowledgeSource, KnowledgeVectorIndexWriter } from '@agent/knowledge';
```

- [ ] **Step 4: Update contracts README**

In `packages/knowledge/src/contracts/README.md`, replace the “Knowledge and Memory Boundary” dependency wording with:

```md
`@agent/knowledge` owns the knowledge indexing vector writer contract:

- `KnowledgeVectorDocumentRecord`
- `KnowledgeVectorIndexWriter`

`runKnowledgeIndexing()` converts indexed chunks into `KnowledgeVectorDocumentRecord` values and calls the injected `KnowledgeVectorIndexWriter.upsertKnowledge()` method. Host packages decide how to persist, embed, or index those records. In this repository, `@agent/memory` may implement that writer, but `@agent/knowledge` does not depend on `@agent/memory`.
```

- [ ] **Step 5: Run docs check**

Run:

```bash
pnpm check:docs
```

Expected: PASS.

### Task 9: Final Verification

**Files:**

- No new implementation files unless earlier tasks uncovered missing adapters.

- [ ] **Step 1: Run knowledge verification**

Run:

```bash
pnpm --dir packages/knowledge typecheck
pnpm --dir packages/knowledge test
pnpm --dir packages/knowledge build:lib
```

Expected: all PASS.

- [ ] **Step 2: Run affected package checks**

Run:

```bash
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit --pretty false
pnpm exec tsc -p packages/memory/tsconfig.json --noEmit --pretty false
```

Expected: both PASS.

- [ ] **Step 3: Re-run dependency search**

Run:

```bash
rg -n "@agent/" packages/knowledge/src packages/knowledge/test packages/knowledge/demo packages/knowledge/package.json
```

Expected: no matches except intentionally escaped text inside `package-boundary.test.ts` if the test scans for the string. If the test file itself causes a match, refine the command to:

```bash
rg -n "@agent/" packages/knowledge/src packages/knowledge/demo packages/knowledge/package.json
```

Expected: no matches.

- [ ] **Step 4: Inspect dependency graph**

Run:

```bash
jq -r '.name as $name | [$name, ((.dependencies // {}) + (.devDependencies // {}) + (.peerDependencies // {}) + (.optionalDependencies // {}) | keys | map(select(startswith("@agent/"))) | join(","))] | @tsv' packages/*/package.json
```

Expected: `@agent/knowledge` has an empty second column.

- [ ] **Step 5: Summarize result**

Prepare final delivery notes with:

- Code boundary changes.
- Tests and commands actually run.
- Docs updated.
- Any unrelated pre-existing dirty worktree changes ignored.
