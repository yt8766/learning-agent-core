# Knowledge RAG Course Reference Implementation Plan

状态：current
文档类型：plan
适用范围：`packages/knowledge`
最后核对：2026-05-11

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 合理吸收 `/Users/dev/Downloads/2026.5.9 企业知识库课程收官资料汇总/课堂代码/rag` 的 RAG 能力模式，补强 `packages/knowledge` 的检索后解释、候选选择、预算裁剪与文档化边界。

**Architecture:** 不迁移课程项目的多包结构，也不复制 `@rag-sdk/*` 类型；将课程项目的能力语义重写进当前 `@agent/knowledge` 的 schema-first contract、runtime stage、adapter boundary 和 docs 体系。第一批实现聚焦 post-retrieval selection trace，因为当前 `packages/knowledge` 已有 filter/rank/diversifier 诊断，但还缺逐候选 `selected/dropped/reason/stage` 解释。

**Tech Stack:** TypeScript, Zod v4, Vitest, pnpm, `@agent/knowledge`, docs under `docs/packages/knowledge`.

---

## Scope

本计划只吸收课程项目中适合当前 `packages/knowledge` 的通用 RAG 能力：

- 检索前：query normalize / rewrite / query variants / diagnostics，当前仅做 gap analysis，不在第一批改动里重写主链。
- 检索：adapter 统一接口、snapshot demo、memory retriever，当前仅记录参考方向，不恢复独立 `packages/adapters`。
- 检索后：selection trace、drop reason、budget trim、duplicate/source coverage diagnostics，作为本计划的第一批实现。
- 观测评测：runtime event / trace / trace-to-eval，当前只更新文档边界，不改 observability schema。

不做：

- 不从课程项目复制 `packages/core`、`packages/runtime`、`packages/indexing`、`packages/adapters` 多包结构。
- 不恢复已删除的 `@agent/adapters` 兼容入口。
- 不让 LangChain、Chroma、pgvector、OpenSearch、Supabase 原始类型穿透到 `contracts`、`runtime`、`client`、`browser`。
- 不把最终回答生成主链沉到 `packages/knowledge`。

## File Structure

- Create: `docs/packages/knowledge/rag-course-reference-gap-analysis.md`
  - 记录课程项目能力、当前 `packages/knowledge` 现状、可吸收项、禁止照搬项、落点和验证入口。
- Modify: `docs/packages/knowledge/README.md`
  - 增加 gap analysis 文档入口，并明确课程项目只能作为能力参考。
- Modify: `packages/knowledge/src/contracts/schemas/knowledge-retrieval.schema.ts`
  - 新增 post-retrieval selection trace schema，扩展 `PostRetrievalDiagnosticsSchema`。
- Modify: `packages/knowledge/src/runtime/types/retrieval-runtime.types.ts`
  - 从 schema 推导并导出 selection trace 类型，保持 runtime diagnostics 与 contract 一致。
- Create: `packages/knowledge/src/runtime/defaults/post-retrieval-selection-trace.ts`
  - 提供纯函数：比较每个 stage 的输入/输出，生成逐候选 trace。
- Modify: `packages/knowledge/src/runtime/pipeline/run-knowledge-retrieval.ts`
  - 在 filter/rank/diversify/postProcessor 之后汇总 selection trace 并写入 diagnostics。
- Test: `packages/knowledge/test/post-retrieval-selection-trace.test.ts`
  - 覆盖纯函数：low-score drop、duplicate drop、budget trim drop、selected。
- Test: `packages/knowledge/test/run-knowledge-retrieval.test.ts`
  - 覆盖 pipeline diagnostics 输出 selection trace。
- Modify: `docs/packages/knowledge/knowledge-retrieval-runtime.md`
  - 记录 post-retrieval selection trace 的真实行为与使用方式。

## Task 1: Course Reference Gap Analysis

**Files:**

- Create: `docs/packages/knowledge/rag-course-reference-gap-analysis.md`
- Modify: `docs/packages/knowledge/README.md`

- [ ] **Step 1: Write the gap analysis document**

Create `docs/packages/knowledge/rag-course-reference-gap-analysis.md` with this content:

````markdown
# RAG Course Reference Gap Analysis

状态：current
文档类型：analysis
适用范围：`packages/knowledge`
最后核对：2026-05-11

## Reference Source

参考项目：`/Users/dev/Downloads/2026.5.9 企业知识库课程收官资料汇总/课堂代码/rag`

该项目是教学用多包 RAG SDK，适合作为能力 checklist，不作为当前仓库的代码结构来源。当前仓库的真实宿主是 `packages/knowledge`，所有吸收动作必须落入 `@agent/knowledge` 的 schema-first contract、runtime stage、retrieval service、adapter boundary、observability/eval 文档体系。

## Capability Mapping

| 课程项目能力                                                 | 当前合理落点                                                                                           | 处理方式                                                                    |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `packages/core/src/spec/*`                                   | `packages/knowledge/src/contracts/*` 或 `packages/knowledge/src/core/*`                                | 只参考 schema-first 思路，不复制 `@rag-sdk/core` 类型                       |
| `packages/indexing/src/pipeline/run-indexing.ts`             | `packages/knowledge/src/indexing/pipeline/run-knowledge-indexing.ts`                                   | 参考 stage observation 与 fanout 思路                                       |
| `packages/runtime/src/pipeline/run-runtime.ts`               | `packages/knowledge/src/runtime/pipeline/run-knowledge-retrieval.ts`                                   | 参考 stage timing 与 diagnostics，不复制 generator 主链                     |
| `packages/runtime/src/defaults/post-retrieval-strategies.ts` | `packages/knowledge/src/runtime/defaults/*`                                                            | 优先吸收 selection trace、budget trim、source coverage、near duplicate 语义 |
| `packages/adapters/src/*`                                    | `packages/knowledge/src/adapters/*`                                                                    | 只参考 adapter boundary，不恢复独立 `packages/adapters`                     |
| `packages/observability/src/*`                               | `packages/knowledge/src/observability/*` 和 `contracts/schemas/knowledge-observability-eval.schema.ts` | 只映射到 Knowledge RAG trace contract                                       |
| `packages/eval/src/*`                                        | `packages/knowledge/src/eval/*`                                                                        | 参考 trace-to-sample 闭环                                                   |
| `app/cli/src/rag/runtime/*`                                  | `packages/knowledge/demo/*` 或 test support                                                            | 参考 snapshot smoke，不作为生产 runtime                                     |

## First Absorption Slice

第一批只做 post-retrieval selection trace：

1. 每个候选 hit 记录 `chunkId`、`sourceId`、`selected`、`stage`、`reason`、`score`。
2. 被 filter/rank/diversifier/postProcessor 丢弃的候选必须有稳定 reason。
3. diagnostics 中保留 `selectionTrace`，trace event 中只记录计数，避免日志过大。
4. 不改变 `KnowledgeRetrievalResult.hits` 的行为。

## Do Not Copy

- 不复制课程项目多包结构。
- 不复制 `@rag-sdk/*` 包名、类型名或 public API。
- 不恢复 `packages/adapters` 作为当前实现入口。
- 不把最终 answer generation 放进 `packages/knowledge` 默认 retrieval runtime。
- 不让第三方 SDK 原始类型进入 stable contract。

## Verification

实现 post-retrieval selection trace 时至少执行：

```bash
pnpm --dir packages/knowledge exec vitest run test/post-retrieval-selection-trace.test.ts test/run-knowledge-retrieval.test.ts
pnpm exec tsc -p packages/knowledge/tsconfig.json --noEmit
pnpm check:docs
```
````

````

- [ ] **Step 2: Add README entry**

Modify `docs/packages/knowledge/README.md` under `当前文档：` by adding:

```markdown
- rag-course-reference-gap-analysis.md
````

- [ ] **Step 3: Run docs check**

Run:

```bash
pnpm check:docs
```

Expected: PASS. If it fails because of existing unrelated docs issues, record the failing rule and continue with the package-specific implementation verification in later tasks.

- [ ] **Step 4: Commit Task 1**

Run:

```bash
git add docs/packages/knowledge/rag-course-reference-gap-analysis.md docs/packages/knowledge/README.md
git commit -m "docs: map knowledge rag course reference"
```

Expected: commit succeeds without `--no-verify`.

## Task 2: Selection Trace Contract

**Files:**

- Modify: `packages/knowledge/src/contracts/schemas/knowledge-retrieval.schema.ts`
- Modify: `packages/knowledge/src/runtime/types/retrieval-runtime.types.ts`
- Test: `packages/knowledge/test/contracts-boundary.test.ts`

- [ ] **Step 1: Write failing schema test**

Append this test to `packages/knowledge/test/contracts-boundary.test.ts` inside the existing `describe` block for retrieval contracts, or create a new `describe('post-retrieval selection trace contract', ...)` block if no matching block exists:

```ts
import { PostRetrievalDiagnosticsSchema } from '../src/contracts/schemas/knowledge-retrieval.schema';

it('parses post-retrieval selection trace entries', () => {
  const parsed = PostRetrievalDiagnosticsSchema.parse({
    filtering: {
      enabled: true,
      beforeCount: 2,
      afterCount: 1,
      droppedCount: 1,
      maskedCount: 0,
      reasons: {
        'low-score': 1
      }
    },
    ranking: {
      enabled: true,
      strategy: 'deterministic-signals',
      scoredCount: 1,
      signals: ['retrieval-score']
    },
    diversification: {
      enabled: true,
      strategy: 'source-parent-section-coverage',
      beforeCount: 1,
      afterCount: 1,
      maxPerSource: 3,
      maxPerParent: 2
    },
    selectionTrace: [
      {
        chunkId: 'chunk-low-score',
        sourceId: 'source-a',
        selected: false,
        stage: 'filtering',
        reason: 'low-score',
        score: 0.01
      },
      {
        chunkId: 'chunk-selected',
        sourceId: 'source-b',
        selected: true,
        stage: 'post-processor',
        reason: 'selected',
        score: 0.92,
        order: 0
      }
    ]
  });

  expect(parsed.selectionTrace).toHaveLength(2);
  expect(parsed.selectionTrace?.[0]?.reason).toBe('low-score');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --dir packages/knowledge exec vitest run test/contracts-boundary.test.ts
```

Expected: FAIL with an error that `selectionTrace` is not part of `PostRetrievalDiagnosticsSchema`, or with an import conflict if the file already imports the schema. If an import conflict appears, merge the import into the existing import line and rerun until the schema failure is observed.

- [ ] **Step 3: Add schema**

Modify `packages/knowledge/src/contracts/schemas/knowledge-retrieval.schema.ts` near the post-retrieval schemas:

```ts
export const PostRetrievalSelectionStageSchema = z.enum(['filtering', 'ranking', 'diversification', 'post-processor']);

export const PostRetrievalSelectionReasonSchema = z.enum([
  'selected',
  'low-score',
  'duplicate-chunk',
  'duplicate-parent',
  'low-context-value',
  'unsafe-content',
  'conflict-risk',
  'source-limit',
  'parent-limit',
  'max-chunks',
  'max-prompt-chars',
  'post-processor-min-score'
]);

export const PostRetrievalSelectionTraceEntrySchema = z.object({
  chunkId: z.string(),
  sourceId: z.string(),
  selected: z.boolean(),
  stage: PostRetrievalSelectionStageSchema,
  reason: PostRetrievalSelectionReasonSchema,
  score: z.number().optional(),
  order: z.number().int().nonnegative().optional(),
  duplicateOf: z.string().optional(),
  metadata: z.record(z.string(), JsonValueSchema).optional()
});
```

Then extend `PostRetrievalDiagnosticsSchema`:

```ts
export const PostRetrievalDiagnosticsSchema = z.object({
  filtering: PostRetrievalFilterDiagnosticsSchema,
  ranking: PostRetrievalRankingDiagnosticsSchema,
  diversification: PostRetrievalDiversificationDiagnosticsSchema,
  selectionTrace: z.array(PostRetrievalSelectionTraceEntrySchema).optional()
});
```

- [ ] **Step 4: Export runtime inferred types**

Modify `packages/knowledge/src/runtime/types/retrieval-runtime.types.ts`:

```ts
import {
  PostRetrievalDiagnosticsSchema,
  PostRetrievalSelectionTraceEntrySchema
} from '../../contracts/schemas/knowledge-retrieval.schema';
```

Then add:

```ts
export type PostRetrievalSelectionTraceEntry = z.infer<typeof PostRetrievalSelectionTraceEntrySchema>;
```

Keep the existing `export type PostRetrievalDiagnostics = z.infer<typeof PostRetrievalDiagnosticsSchema>;`.

- [ ] **Step 5: Run schema test**

Run:

```bash
pnpm --dir packages/knowledge exec vitest run test/contracts-boundary.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

Run:

```bash
git add packages/knowledge/src/contracts/schemas/knowledge-retrieval.schema.ts packages/knowledge/src/runtime/types/retrieval-runtime.types.ts packages/knowledge/test/contracts-boundary.test.ts
git commit -m "feat: add knowledge post-retrieval selection trace contract"
```

Expected: commit succeeds without `--no-verify`.

## Task 3: Selection Trace Builder

**Files:**

- Create: `packages/knowledge/src/runtime/defaults/post-retrieval-selection-trace.ts`
- Test: `packages/knowledge/test/post-retrieval-selection-trace.test.ts`

- [ ] **Step 1: Write failing unit tests**

Create `packages/knowledge/test/post-retrieval-selection-trace.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import type { RetrievalHit } from '@agent/knowledge';
import {
  buildPostRetrievalSelectionTrace,
  type PostRetrievalTraceStageSnapshot
} from '../src/runtime/defaults/post-retrieval-selection-trace';

function makeHit(overrides: Partial<RetrievalHit> = {}): RetrievalHit {
  return {
    chunkId: 'chunk-1',
    documentId: 'doc-1',
    sourceId: 'source-1',
    title: 'Guide',
    uri: '/guide.md',
    sourceType: 'repo-docs',
    trustClass: 'internal',
    content: 'useful content',
    score: 0.8,
    citation: {
      sourceId: 'source-1',
      chunkId: 'chunk-1',
      title: 'Guide',
      uri: '/guide.md',
      sourceType: 'repo-docs',
      trustClass: 'internal'
    },
    ...overrides
  };
}

describe('buildPostRetrievalSelectionTrace', () => {
  it('marks filter drops using diagnostics reasons', () => {
    const kept = makeHit({ chunkId: 'kept', score: 0.9 });
    const lowScore = makeHit({ chunkId: 'low', score: 0.01 });
    const stages: PostRetrievalTraceStageSnapshot[] = [
      {
        stage: 'filtering',
        inputHits: [kept, lowScore],
        outputHits: [kept],
        droppedReason: 'low-score'
      },
      {
        stage: 'post-processor',
        inputHits: [kept],
        outputHits: [kept]
      }
    ];

    const trace = buildPostRetrievalSelectionTrace(stages);

    expect(trace).toEqual([
      {
        chunkId: 'low',
        sourceId: 'source-1',
        selected: false,
        stage: 'filtering',
        reason: 'low-score',
        score: 0.01
      },
      {
        chunkId: 'kept',
        sourceId: 'source-1',
        selected: true,
        stage: 'post-processor',
        reason: 'selected',
        score: 0.9,
        order: 0
      }
    ]);
  });

  it('marks diversification drops as source-limit or parent-limit', () => {
    const selected = makeHit({ chunkId: 'selected', sourceId: 'source-a', score: 0.9 });
    const sourceLimited = makeHit({ chunkId: 'source-limited', sourceId: 'source-a', score: 0.8 });
    const parentLimited = makeHit({
      chunkId: 'parent-limited',
      sourceId: 'source-b',
      score: 0.7,
      metadata: { parentId: 'parent-1' }
    });

    const trace = buildPostRetrievalSelectionTrace([
      {
        stage: 'diversification',
        inputHits: [selected, sourceLimited, parentLimited],
        outputHits: [selected],
        droppedReasonByChunkId: {
          'source-limited': 'source-limit',
          'parent-limited': 'parent-limit'
        }
      },
      {
        stage: 'post-processor',
        inputHits: [selected],
        outputHits: [selected]
      }
    ]);

    expect(trace.map(entry => [entry.chunkId, entry.reason])).toEqual([
      ['source-limited', 'source-limit'],
      ['parent-limited', 'parent-limit'],
      ['selected', 'selected']
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --dir packages/knowledge exec vitest run test/post-retrieval-selection-trace.test.ts
```

Expected: FAIL with module not found for `post-retrieval-selection-trace`.

- [ ] **Step 3: Add trace builder**

Create `packages/knowledge/src/runtime/defaults/post-retrieval-selection-trace.ts`:

```ts
import type { RetrievalHit } from '../../index';
import type { PostRetrievalSelectionTraceEntry } from '../types/retrieval-runtime.types';

export type PostRetrievalTraceStage = 'filtering' | 'ranking' | 'diversification' | 'post-processor';

export type PostRetrievalTraceDropReason = PostRetrievalSelectionTraceEntry['reason'];

export interface PostRetrievalTraceStageSnapshot {
  stage: PostRetrievalTraceStage;
  inputHits: RetrievalHit[];
  outputHits: RetrievalHit[];
  droppedReason?: Exclude<PostRetrievalTraceDropReason, 'selected'>;
  droppedReasonByChunkId?: Record<string, Exclude<PostRetrievalTraceDropReason, 'selected'>>;
}

export function buildPostRetrievalSelectionTrace(
  stages: PostRetrievalTraceStageSnapshot[]
): PostRetrievalSelectionTraceEntry[] {
  const dropped = new Map<string, PostRetrievalSelectionTraceEntry>();
  let latestOutput: RetrievalHit[] = [];

  for (const stage of stages) {
    latestOutput = stage.outputHits;
    const outputIds = new Set(stage.outputHits.map(hit => hit.chunkId));

    for (const hit of stage.inputHits) {
      if (outputIds.has(hit.chunkId) || dropped.has(hit.chunkId)) {
        continue;
      }

      dropped.set(hit.chunkId, {
        chunkId: hit.chunkId,
        sourceId: hit.sourceId,
        selected: false,
        stage: stage.stage,
        reason: stage.droppedReasonByChunkId?.[hit.chunkId] ?? stage.droppedReason ?? 'post-processor-min-score',
        score: hit.score
      });
    }
  }

  const selected = latestOutput.map((hit, order) => ({
    chunkId: hit.chunkId,
    sourceId: hit.sourceId,
    selected: true,
    stage: 'post-processor' as const,
    reason: 'selected' as const,
    score: hit.score,
    order
  }));

  return [...dropped.values(), ...selected];
}
```

- [ ] **Step 4: Run trace builder tests**

Run:

```bash
pnpm --dir packages/knowledge exec vitest run test/post-retrieval-selection-trace.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

Run:

```bash
git add packages/knowledge/src/runtime/defaults/post-retrieval-selection-trace.ts packages/knowledge/test/post-retrieval-selection-trace.test.ts
git commit -m "feat: build knowledge post-retrieval selection trace"
```

Expected: commit succeeds without `--no-verify`.

## Task 4: Pipeline Diagnostics Wiring

**Files:**

- Modify: `packages/knowledge/src/runtime/pipeline/run-knowledge-retrieval.ts`
- Modify: `packages/knowledge/src/runtime/defaults/default-post-retrieval-diversifier.ts`
- Test: `packages/knowledge/test/run-knowledge-retrieval.test.ts`

- [ ] **Step 1: Write failing pipeline test**

Append this test to `packages/knowledge/test/run-knowledge-retrieval.test.ts` inside `describe('runKnowledgeRetrieval', ...)`:

```ts
it('includes post-retrieval selection trace diagnostics', async () => {
  const lowScore = makeHit({ chunkId: 'low-score', score: 0 });
  const selected = makeHit({ chunkId: 'selected', score: 0.92 });

  const result = await runKnowledgeRetrieval({
    request: baseRequest,
    searchService: makeSearchService([lowScore, selected]),
    includeDiagnostics: true,
    pipeline: { queryNormalizer: makeSingleVariantNormalizer() }
  });

  expect(result.diagnostics?.postRetrieval?.selectionTrace).toEqual([
    expect.objectContaining({
      chunkId: 'low-score',
      selected: false,
      stage: 'filtering',
      reason: 'low-score'
    }),
    expect.objectContaining({
      chunkId: 'selected',
      selected: true,
      stage: 'post-processor',
      reason: 'selected',
      order: 0
    })
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --dir packages/knowledge exec vitest run test/run-knowledge-retrieval.test.ts --testNamePattern "selection trace diagnostics"
```

Expected: FAIL because `selectionTrace` is undefined.

- [ ] **Step 3: Import the trace builder**

Modify `packages/knowledge/src/runtime/pipeline/run-knowledge-retrieval.ts` imports:

```ts
import { buildPostRetrievalSelectionTrace } from '../defaults/post-retrieval-selection-trace';
```

- [ ] **Step 4: Build selection trace after post-processing**

In `runKnowledgeRetrieval`, after:

```ts
const processedHits = await postProcessor.process(diversifyResult.hits, effectiveNormalized);
```

add:

```ts
const selectionTrace = buildPostRetrievalSelectionTrace([
  {
    stage: 'filtering',
    inputHits: mergedHits,
    outputHits: filterResult.hits,
    droppedReason: 'low-score'
  },
  {
    stage: 'ranking',
    inputHits: filterResult.hits,
    outputHits: rankResult.hits
  },
  {
    stage: 'diversification',
    inputHits: rankResult.hits,
    outputHits: diversifyResult.hits,
    droppedReason: 'source-limit'
  },
  {
    stage: 'post-processor',
    inputHits: diversifyResult.hits,
    outputHits: processedHits,
    droppedReason: 'post-processor-min-score'
  }
]);
```

Then extend diagnostics:

```ts
postRetrieval: {
  filtering: filterResult.diagnostics,
  ranking: rankResult.diagnostics,
  diversification: diversifyResult.diagnostics,
  selectionTrace
},
```

- [ ] **Step 5: Preserve trace event size**

Keep `recordRetrievalEvent(... runtime.post_retrieval.select ...)` unchanged except for count attributes. Do not add full `selectionTrace` to the observer event payload in this task.

- [ ] **Step 6: Run pipeline test**

Run:

```bash
pnpm --dir packages/knowledge exec vitest run test/run-knowledge-retrieval.test.ts --testNamePattern "selection trace diagnostics"
```

Expected: PASS.

- [ ] **Step 7: Run focused package tests**

Run:

```bash
pnpm --dir packages/knowledge exec vitest run test/post-retrieval-selection-trace.test.ts test/run-knowledge-retrieval.test.ts test/contracts-boundary.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Task 4**

Run:

```bash
git add packages/knowledge/src/runtime/pipeline/run-knowledge-retrieval.ts packages/knowledge/test/run-knowledge-retrieval.test.ts
git commit -m "feat: expose knowledge selection trace diagnostics"
```

Expected: commit succeeds without `--no-verify`.

## Task 5: Knowledge Runtime Documentation

**Files:**

- Modify: `docs/packages/knowledge/knowledge-retrieval-runtime.md`
- Modify: `docs/packages/knowledge/README.md`

- [ ] **Step 1: Update runtime docs**

Add this section to `docs/packages/knowledge/knowledge-retrieval-runtime.md` after the existing diagnostics section:

````markdown
## Post-Retrieval Selection Trace

`runKnowledgeRetrieval({ includeDiagnostics: true })` exposes `diagnostics.postRetrieval.selectionTrace`.

Each entry explains one candidate decision:

```ts
{
  chunkId: string;
  sourceId: string;
  selected: boolean;
  stage: 'filtering' | 'ranking' | 'diversification' | 'post-processor';
  reason:
    | 'selected'
    | 'low-score'
    | 'duplicate-chunk'
    | 'duplicate-parent'
    | 'low-context-value'
    | 'unsafe-content'
    | 'conflict-risk'
    | 'source-limit'
    | 'parent-limit'
    | 'max-chunks'
    | 'max-prompt-chars'
    | 'post-processor-min-score';
  score?: number;
  order?: number;
}
```
````

This trace is intended for debugging, admin UI explanations, eval sampling, and observability projection. Runtime events keep only aggregate counts by default to avoid large trace payloads.

The trace is inspired by the course RAG project under `/Users/dev/Downloads/2026.5.9 企业知识库课程收官资料汇总/课堂代码/rag`, but the current implementation is owned by `@agent/knowledge` schemas and does not copy the course project's package layout or `@rag-sdk/*` public contracts.

````

- [ ] **Step 2: Confirm README index still points to runtime docs**

Ensure `docs/packages/knowledge/README.md` contains both:

```markdown
- [knowledge-retrieval-runtime.md](/docs/packages/knowledge/knowledge-retrieval-runtime.md)
- rag-course-reference-gap-analysis.md
````

- [ ] **Step 3: Run docs scan**

Run:

```bash
rg -n "rag-course|selectionTrace|Post-Retrieval Selection Trace|@rag-sdk|packages/adapters" docs/packages/knowledge docs/sdk AGENTS.md
```

Expected: Output mentions the new gap analysis and runtime docs. Any line that suggests restoring `@rag-sdk/*` or independent `packages/adapters` for current implementation must be edited to point at `@agent/knowledge/adapters/*`.

- [ ] **Step 4: Run docs check**

Run:

```bash
pnpm check:docs
```

Expected: PASS.

- [ ] **Step 5: Commit Task 5**

Run:

```bash
git add docs/packages/knowledge/knowledge-retrieval-runtime.md docs/packages/knowledge/README.md docs/packages/knowledge/rag-course-reference-gap-analysis.md
git commit -m "docs: explain knowledge selection trace diagnostics"
```

Expected: commit succeeds without `--no-verify`.

## Task 6: Final Verification

**Files:**

- Verify changed files from Tasks 1-5.

- [ ] **Step 1: Run focused unit and contract tests**

Run:

```bash
pnpm --dir packages/knowledge exec vitest run test/post-retrieval-selection-trace.test.ts test/run-knowledge-retrieval.test.ts test/contracts-boundary.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run package typecheck**

Run:

```bash
pnpm exec tsc -p packages/knowledge/tsconfig.json --noEmit
```

Expected: PASS.

- [ ] **Step 3: Run docs check**

Run:

```bash
pnpm check:docs
```

Expected: PASS.

- [ ] **Step 4: Run package build if package exports changed**

Only if `packages/knowledge/package.json`, public exports, or generated declaration paths changed in a task, run:

```bash
pnpm --dir packages/knowledge build:lib
```

Expected: PASS. For this plan, package exports should not change.

- [ ] **Step 5: Review git diff**

Run:

```bash
git diff --stat
git diff -- packages/knowledge/src/contracts/schemas/knowledge-retrieval.schema.ts packages/knowledge/src/runtime/types/retrieval-runtime.types.ts packages/knowledge/src/runtime/defaults/post-retrieval-selection-trace.ts packages/knowledge/src/runtime/pipeline/run-knowledge-retrieval.ts
```

Expected: Diff only contains selection trace contract, pure builder, pipeline diagnostics wiring, tests, and docs. No unrelated package boundary or adapter migration appears.

- [ ] **Step 6: Final commit if any verification-only edits were made**

If Task 6 required fixes, commit them:

```bash
git add packages/knowledge docs/packages/knowledge
git commit -m "fix: stabilize knowledge selection trace verification"
```

Expected: commit succeeds without `--no-verify`.

## Self-Review

- Spec coverage: The plan covers course reference analysis, first absorption slice, schema contract, runtime diagnostics wiring, tests, docs, and verification.
- Placeholder scan: The plan contains no open placeholders; every task has exact files, commands, expected results, and code snippets for new logic.
- Type consistency: `PostRetrievalSelectionTraceEntrySchema` is the schema source of truth; runtime types are inferred from it; `buildPostRetrievalSelectionTrace()` returns `PostRetrievalSelectionTraceEntry[]`; pipeline writes that array to `diagnostics.postRetrieval.selectionTrace`.
