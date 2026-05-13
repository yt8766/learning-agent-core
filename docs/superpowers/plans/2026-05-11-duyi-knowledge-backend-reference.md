# Duyi Knowledge Backend Reference Implementation Plan

状态：current
文档类型：plan
适用范围：`packages/knowledge`、`apps/backend/agent-server/src/domains/knowledge`
最后核对：2026-05-11

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 合理吸收 `/Users/dev/Downloads/2026.5.9 企业知识库课程收官资料汇总/课堂代码/duyi-knowledge-bases` 的后端知识库实现经验，补强当前 `@agent/knowledge` SDK 与 `agent-server` Knowledge domain 的可解释检索、ingestion 质量门和文档生命周期闭环。

**Architecture:** 不迁移参考项目的 Next/BFF 单体结构，也不复制 `@duyi/specs`、Prisma schema 或课程项目包名；当前仓库继续以 `packages/knowledge` 作为 SDK/contract 宿主，以 `apps/backend/agent-server/src/domains/knowledge` 作为后端装配与资源治理宿主。参考项目只作为能力 checklist：RAG pipeline、pgvector 检索、retrieval trace、文档上传/追加/删除、资源权限和后台 debug 回看必须被映射到当前 schema-first contract、repository/facade 和 observability/eval 边界。

**Tech Stack:** TypeScript, Zod v4, Vitest, pnpm, Nest-style agent-server domain services, `@agent/knowledge`, PostgreSQL/pgvector boundary, docs under `docs/packages/knowledge` and `docs/apps/backend/agent-server`.

---

## Scope

本计划执行的是“合理参考”，不是搬运工程：

- 参考 `duyi-knowledge-bases/apps/ai-service/src/rag/pipeline.ts` 的 query -> retrieval -> rerank -> context -> citation -> status 闭环，但实现仍落在 `packages/knowledge/src/rag` 与 `apps/backend/agent-server/src/domains/knowledge/rag`。
- 参考 `duyi-knowledge-bases/apps/ai-service/src/ingestion/*` 的 chunk hash、offset、token count、embedding fail-fast 与 job 状态语义，但质量门必须落在当前 `KnowledgeIngestionWorker` 和 `@agent/knowledge` indexing contract。
- 参考 `duyi-knowledge-bases/apps/web` 的 live retrieval debug 与 persisted trace 思路，但 trace schema 与 projection 必须使用当前 `packages/knowledge/src/observability` 和 `KnowledgeTraceService`。
- 参考知识库资源权限、文档追加、删除阻断和模型配置一致性场景，但不复制参考项目的 auth/session/Prisma/BFF 代码。

不做：

- 不新增 `@duyi/*`、`@rag-sdk/*` 或第二套 shared/specs 包。
- 不把 Next.js route handler、Prisma model、课程项目 `.env` 或 Docker compose 复制到当前仓库。
- 不让 LangChain、pgvector、OpenSearch、Chroma、Supabase、Prisma 原始对象穿透 `packages/knowledge/src/contracts` 或前端 DTO。
- 不在 controller/service 内重建 RAG pipeline；controller 只保留 HTTP shell，domain service 只装配 SDK facade/repository/provider。

## File Structure

- Create: `docs/packages/knowledge/duyi-knowledge-bases-reference-gap-analysis.md`
  - 记录参考项目能力、当前仓库对应落点、可吸收项、禁止照搬项和验证入口。
- Modify: `docs/packages/knowledge/README.md`
  - 增加 gap analysis 入口。
- Modify: `docs/apps/backend/agent-server/knowledge.md`
  - 记录 backend Knowledge domain 如何吸收参考项目的 ingestion、trace、文档生命周期语义。
- Modify: `packages/knowledge/src/contracts/schemas/knowledge-retrieval.schema.ts`
  - 增加 post-retrieval selection trace contract。
- Modify: `packages/knowledge/src/runtime/types/retrieval-runtime.types.ts`
  - 导出 schema 推导类型。
- Create: `packages/knowledge/src/runtime/defaults/post-retrieval-selection-trace.ts`
  - 纯函数生成逐候选 selected/dropped/reason/stage 解释。
- Modify: `packages/knowledge/src/runtime/pipeline/run-knowledge-retrieval.ts`
  - 把 selection trace 接入 diagnostics。
- Modify: `apps/backend/agent-server/src/domains/knowledge/services/knowledge-trace.service.ts`
  - 把 SDK retrieval diagnostics 的 selection trace 聚合为 redacted backend span。
- Modify: `apps/backend/agent-server/src/domains/knowledge/rag/knowledge-rag-sdk.facade.ts`
  - 在 trace snapshot 中保留候选数、选中数、丢弃原因计数，避免完整正文进入 trace projection。
- Test: `packages/knowledge/test/contracts-boundary.test.ts`
- Test: `packages/knowledge/test/post-retrieval-selection-trace.test.ts`
- Test: `packages/knowledge/test/run-knowledge-retrieval.test.ts`
- Test: `apps/backend/agent-server/test/knowledge-domain/knowledge-rag-sdk-trace-projection.spec.ts`
- Test: `apps/backend/agent-server/test/knowledge-domain/knowledge-ingestion-sdk-pipeline.spec.ts`

## Task 1: Reference Gap Analysis

**Files:**

- Create: `docs/packages/knowledge/duyi-knowledge-bases-reference-gap-analysis.md`
- Modify: `docs/packages/knowledge/README.md`
- Modify: `docs/apps/backend/agent-server/knowledge.md`

- [ ] **Step 1: Write the gap analysis document**

Create `docs/packages/knowledge/duyi-knowledge-bases-reference-gap-analysis.md`:

````markdown
# Duyi Knowledge Bases Reference Gap Analysis

状态：current
文档类型：analysis
适用范围：`packages/knowledge`、`apps/backend/agent-server/src/domains/knowledge`
最后核对：2026-05-11

## Reference Source

参考项目：`/Users/dev/Downloads/2026.5.9 企业知识库课程收官资料汇总/课堂代码/duyi-knowledge-bases`

该项目是课程型企业知识库完整样板，覆盖 Next/BFF、PostgreSQL/pgvector、文档 ingestion、RAG pipeline、retrieval trace、知识库权限与后台 debug。当前仓库只吸收能力语义，不复制它的包结构、BFF 路由、Prisma schema 或 `@duyi/specs` contract。

## Capability Mapping

| 参考项目能力                                                                            | 当前仓库落点                                                                                                   | 处理方式                                                              |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `apps/ai-service/src/rag/pipeline.ts` 的 query/retrieval/rerank/context/citation/status | `packages/knowledge/src/rag/*` 与 `apps/backend/agent-server/src/domains/knowledge/rag/*`                      | 保留当前 SDK planner/retrieval/answer 分层，补齐 trace 和 diagnostics |
| `apps/ai-service/src/rag/retriever.ts` 的 vector + keyword candidate merge              | `packages/knowledge/src/retrieval/hybrid-retrieval-engine.ts` 与 backend `KnowledgeDomainSearchServiceAdapter` | 继续使用 RRF，不照搬 keyword boost 作为终态                           |
| `apps/ai-service/src/ingestion/chunker.ts` 的 chunk hash、offset、token count           | `packages/knowledge/src/indexing/chunkers/*` 与 `KnowledgeIngestionWorker`                                     | 补质量门和 metadata，不复制课程 chunker 文件                          |
| live retrieval debug 与 persisted retrieval trace                                       | `packages/knowledge/src/observability/*`、`KnowledgeTraceService`、Knowledge Chat Lab                          | trace projection 必须 redacted，不保存 vendor 原始对象                |
| KB role、public KB、member relation                                                     | 当前 identity/knowledge domain permission service                                                              | 只作为场景校验，不迁移参考项目 auth/session                           |
| 文档追加、删除、运行中 job 阻断、embedding model mismatch 阻断                          | `KnowledgeDocumentService`、`KnowledgeBaseService`、repository contract                                        | 用后端 domain 测试覆盖                                                |

## Absorption Order

1. 先补 post-retrieval selection trace，让每个候选能解释 selected/dropped/stage/reason。
2. 再把 backend trace projection 收敛为候选数、选中数、丢弃原因计数，供 Chat Lab 与 Observability 使用。
3. 复核 ingestion 质量门：embedding 数量、空向量、维度、vector upsert count 均必须 fail-fast。
4. 复核文档生命周期：追加、删除、运行中 job、embedding model mismatch 都必须有稳定错误码。

## Do Not Copy

- 不复制 `apps/web` API route 或 BFF 结构。
- 不复制 `@duyi/specs`。
- 不复制 Prisma schema 或 migration。
- 不复制 `.env`、local PostgreSQL compose 或课程演示账号。
- 不把最终 answer generation 放进 `runKnowledgeRetrieval()`。

## Verification

本主题实现时至少执行：

```bash
pnpm --dir packages/knowledge exec vitest run test/contracts-boundary.test.ts test/post-retrieval-selection-trace.test.ts test/run-knowledge-retrieval.test.ts
pnpm --dir apps/backend/agent-server exec vitest run test/knowledge-domain/knowledge-rag-sdk-trace-projection.spec.ts test/knowledge-domain/knowledge-ingestion-sdk-pipeline.spec.ts
pnpm exec tsc -p packages/knowledge/tsconfig.json --noEmit
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm check:docs
```
````

````

- [ ] **Step 2: Add the knowledge README entry**

Modify `docs/packages/knowledge/README.md` under `当前文档：`:

```markdown
- duyi-knowledge-bases-reference-gap-analysis.md
````

- [ ] **Step 3: Add the backend knowledge note**

Append this section to `docs/apps/backend/agent-server/knowledge.md`:

```markdown
## Duyi Knowledge Bases Reference Boundary

`/Users/dev/Downloads/2026.5.9 企业知识库课程收官资料汇总/课堂代码/duyi-knowledge-bases` 可作为企业知识库业务闭环参考，但不能作为源码搬运来源。当前后端只吸收四类语义：RAG pipeline 可解释性、ingestion 质量门、retrieval trace debug、文档生命周期阻断。

后端 controller 仍只做 HTTP shell；资源权限、文档任务、trace projection 和 SDK runtime 装配必须留在 `apps/backend/agent-server/src/domains/knowledge`。稳定 contract 仍来自 `@agent/knowledge` 或 `packages/core/src/contracts/knowledge-service`，不得新增 `@duyi/specs` 或第二套 shared contract。
```

- [ ] **Step 4: Run docs check**

Run:

```bash
pnpm check:docs
```

Expected: PASS. If it fails on unrelated existing docs, record the exact rule name and continue only after confirming the new files are not the cause.

- [ ] **Step 5: Commit Task 1**

Run:

```bash
git add docs/packages/knowledge/duyi-knowledge-bases-reference-gap-analysis.md docs/packages/knowledge/README.md docs/apps/backend/agent-server/knowledge.md
git commit -m "docs: map duyi knowledge backend reference"
```

Expected: commit succeeds without `--no-verify`.

## Task 2: SDK Selection Trace Contract

**Files:**

- Modify: `packages/knowledge/src/contracts/schemas/knowledge-retrieval.schema.ts`
- Modify: `packages/knowledge/src/runtime/types/retrieval-runtime.types.ts`
- Test: `packages/knowledge/test/contracts-boundary.test.ts`

- [ ] **Step 1: Write the failing contract test**

Append this test inside the existing `describe('@agent/knowledge contracts boundary', ...)` block in `packages/knowledge/test/contracts-boundary.test.ts`:

```ts
it('parses post-retrieval selection trace entries', () => {
  const diagnostics = PostRetrievalDiagnosticsSchema.parse({
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

  expect(diagnostics.selectionTrace).toHaveLength(2);
  expect(diagnostics.selectionTrace?.[0]?.reason).toBe('low-score');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --dir packages/knowledge exec vitest run test/contracts-boundary.test.ts
```

Expected: FAIL because `selectionTrace` is stripped or unavailable on `PostRetrievalDiagnosticsSchema`.

- [ ] **Step 3: Add the schema**

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

- [ ] **Step 4: Export inferred runtime type**

Modify `packages/knowledge/src/runtime/types/retrieval-runtime.types.ts`:

```ts
import {
  PostRetrievalDiagnosticsSchema,
  PostRetrievalSelectionTraceEntrySchema
} from '../../contracts/schemas/knowledge-retrieval.schema';

export type PostRetrievalDiagnostics = z.infer<typeof PostRetrievalDiagnosticsSchema>;
export type PostRetrievalSelectionTraceEntry = z.infer<typeof PostRetrievalSelectionTraceEntrySchema>;
```

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
git commit -m "feat: add knowledge retrieval selection trace contract"
```

Expected: commit succeeds without `--no-verify`.

## Task 3: Selection Trace Builder And Pipeline Wiring

**Files:**

- Create: `packages/knowledge/src/runtime/defaults/post-retrieval-selection-trace.ts`
- Modify: `packages/knowledge/src/runtime/pipeline/run-knowledge-retrieval.ts`
- Test: `packages/knowledge/test/post-retrieval-selection-trace.test.ts`
- Test: `packages/knowledge/test/run-knowledge-retrieval.test.ts`

- [ ] **Step 1: Write the failing builder test**

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
  it('marks filter drops and selected candidates', () => {
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

    expect(buildPostRetrievalSelectionTrace(stages)).toEqual([
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
});
```

- [ ] **Step 2: Run builder test to verify it fails**

Run:

```bash
pnpm --dir packages/knowledge exec vitest run test/post-retrieval-selection-trace.test.ts
```

Expected: FAIL with module not found for `post-retrieval-selection-trace`.

- [ ] **Step 3: Implement the builder**

Create `packages/knowledge/src/runtime/defaults/post-retrieval-selection-trace.ts`:

```ts
import type { RetrievalHit } from '../../index';
import type { PostRetrievalSelectionTraceEntry } from '../types/retrieval-runtime.types';

export type PostRetrievalTraceStage = 'filtering' | 'ranking' | 'diversification' | 'post-processor';
export type PostRetrievalTraceDropReason = Exclude<PostRetrievalSelectionTraceEntry['reason'], 'selected'>;

export interface PostRetrievalTraceStageSnapshot {
  stage: PostRetrievalTraceStage;
  inputHits: RetrievalHit[];
  outputHits: RetrievalHit[];
  droppedReason?: PostRetrievalTraceDropReason;
  droppedReasonByChunkId?: Record<string, PostRetrievalTraceDropReason>;
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

  const selected = latestOutput.map(
    (hit, order): PostRetrievalSelectionTraceEntry => ({
      chunkId: hit.chunkId,
      sourceId: hit.sourceId,
      selected: true,
      stage: 'post-processor',
      reason: 'selected',
      score: hit.score,
      order
    })
  );

  return [...dropped.values(), ...selected];
}
```

- [ ] **Step 4: Run builder test**

Run:

```bash
pnpm --dir packages/knowledge exec vitest run test/post-retrieval-selection-trace.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing pipeline diagnostics test**

Add this assertion to an existing `runKnowledgeRetrieval` diagnostics test in `packages/knowledge/test/run-knowledge-retrieval.test.ts`, using the test fixture that returns two hits and filters one low score:

```ts
expect(result.diagnostics?.postRetrieval?.selectionTrace).toEqual(
  expect.arrayContaining([
    expect.objectContaining({
      chunkId: 'chunk-low-score',
      selected: false,
      stage: 'filtering',
      reason: 'low-score'
    }),
    expect.objectContaining({
      selected: true,
      stage: 'post-processor',
      reason: 'selected',
      order: 0
    })
  ])
);
```

- [ ] **Step 6: Run pipeline test to verify it fails**

Run:

```bash
pnpm --dir packages/knowledge exec vitest run test/run-knowledge-retrieval.test.ts
```

Expected: FAIL because `selectionTrace` is missing from `diagnostics.postRetrieval`.

- [ ] **Step 7: Wire the builder into retrieval pipeline**

Modify `packages/knowledge/src/runtime/pipeline/run-knowledge-retrieval.ts`:

```ts
import { buildPostRetrievalSelectionTrace } from '../defaults/post-retrieval-selection-trace';
```

After filter/rank/diversify/post-process stages, build diagnostics with:

```ts
const selectionTrace = buildPostRetrievalSelectionTrace([
  {
    stage: 'filtering',
    inputHits: mergedHits,
    outputHits: filteredHits,
    droppedReason: 'low-score'
  },
  {
    stage: 'ranking',
    inputHits: filteredHits,
    outputHits: rankedHits
  },
  {
    stage: 'diversification',
    inputHits: rankedHits,
    outputHits: diversifiedHits,
    droppedReason: 'source-limit'
  },
  {
    stage: 'post-processor',
    inputHits: diversifiedHits,
    outputHits: postProcessedHits,
    droppedReason: 'post-processor-min-score'
  }
]);

const postRetrievalDiagnostics = {
  filtering: filterDiagnostics,
  ranking: rankDiagnostics,
  diversification: diversifyDiagnostics,
  selectionTrace
};
```

If the local variable names differ, use the actual stage variables already present in the file and preserve existing diagnostics fields.

- [ ] **Step 8: Run focused package tests**

Run:

```bash
pnpm --dir packages/knowledge exec vitest run test/post-retrieval-selection-trace.test.ts test/run-knowledge-retrieval.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit Task 3**

Run:

```bash
git add packages/knowledge/src/runtime/defaults/post-retrieval-selection-trace.ts packages/knowledge/src/runtime/pipeline/run-knowledge-retrieval.ts packages/knowledge/test/post-retrieval-selection-trace.test.ts packages/knowledge/test/run-knowledge-retrieval.test.ts
git commit -m "feat: explain knowledge post-retrieval selection"
```

Expected: commit succeeds without `--no-verify`.

## Task 4: Backend Trace Projection

**Files:**

- Modify: `apps/backend/agent-server/src/domains/knowledge/services/knowledge-trace.service.ts`
- Modify: `apps/backend/agent-server/src/domains/knowledge/rag/knowledge-rag-sdk.facade.ts`
- Test: `apps/backend/agent-server/test/knowledge-domain/knowledge-rag-sdk-trace-projection.spec.ts`

- [ ] **Step 1: Write failing trace projection test**

Add this test to `apps/backend/agent-server/test/knowledge-domain/knowledge-rag-sdk-trace-projection.spec.ts`:

```ts
it('projects selection trace as redacted retrieval selection counts', () => {
  const service = new KnowledgeTraceService();
  const traceId = service.startTrace({
    userId: 'user-1',
    message: 'refund policy',
    conversationId: 'conv-1'
  });

  service.projectSdkTrace(traceId, {
    traceId: 'sdk-trace-1',
    operation: 'runtime.run',
    status: 'completed',
    startedAt: '2026-05-11T00:00:00.000Z',
    endedAt: '2026-05-11T00:00:01.000Z',
    events: [
      {
        eventId: 'event-1',
        traceId: 'sdk-trace-1',
        name: 'runtime.retrieval.complete',
        stage: 'retrieval',
        timestamp: '2026-05-11T00:00:00.500Z',
        retrieval: {
          hits: [],
          citations: [],
          diagnostics: {
            retrievalMode: 'hybrid',
            candidateCount: 3,
            selectedCount: 1,
            selectionTrace: [
              {
                chunkId: 'chunk-low',
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
                score: 0.9,
                order: 0
              }
            ]
          }
        }
      }
    ],
    metrics: []
  });

  const projected = service.getTrace(traceId);
  const retrievalSpan = projected?.spans.find(span => span.name === 'runtime.retrieval.complete');

  expect(retrievalSpan?.metadata).toMatchObject({
    retrievalMode: 'hybrid',
    candidateCount: 3,
    selectedCount: 1,
    droppedCount: 1,
    dropReasons: {
      'low-score': 1
    }
  });
  expect(JSON.stringify(retrievalSpan?.metadata)).not.toContain('refund policy original chunk body');
});
```

- [ ] **Step 2: Run backend projection test to verify it fails**

Run:

```bash
pnpm --dir apps/backend/agent-server exec vitest run test/knowledge-domain/knowledge-rag-sdk-trace-projection.spec.ts
```

Expected: FAIL because `dropReasons` or `droppedCount` is not projected.

- [ ] **Step 3: Add redacted selection summary helper**

Modify `apps/backend/agent-server/src/domains/knowledge/services/knowledge-trace.service.ts`:

```ts
function summarizeSelectionTrace(
  selectionTrace:
    | Array<{
        selected: boolean;
        reason?: string;
      }>
    | undefined
): { droppedCount: number; dropReasons: Record<string, number> } {
  const dropReasons: Record<string, number> = {};

  for (const entry of selectionTrace ?? []) {
    if (entry.selected) {
      continue;
    }

    const reason = entry.reason ?? 'unknown';
    dropReasons[reason] = (dropReasons[reason] ?? 0) + 1;
  }

  return {
    droppedCount: Object.values(dropReasons).reduce((sum, count) => sum + count, 0),
    dropReasons
  };
}
```

In the retrieval event projection, merge this summary into metadata:

```ts
const selectionSummary = summarizeSelectionTrace(diagnostics?.selectionTrace);

return {
  retrievalMode: diagnostics?.retrievalMode,
  candidateCount: diagnostics?.candidateCount,
  selectedCount: diagnostics?.selectedCount ?? event.retrieval.hits.length,
  ...selectionSummary
};
```

- [ ] **Step 4: Keep RAG facade trace snapshot small**

Modify `apps/backend/agent-server/src/domains/knowledge/rag/knowledge-rag-sdk.facade.ts` so `buildTraceRetrievalSnapshot()` stores aggregate selection counts only:

```ts
diagnostics: {
  retrievalMode: toTraceRetrievalMode(retrieval.diagnostics?.effectiveSearchMode),
  candidateCount: retrieval.diagnostics?.candidateCount ?? retrieval.hits.length,
  selectedCount: retrieval.hits.length,
  dropReasons: retrieval.diagnostics?.dropReasons
}
```

Do not add hit content or raw vendor objects to the trace snapshot.

- [ ] **Step 5: Run backend projection test**

Run:

```bash
pnpm --dir apps/backend/agent-server exec vitest run test/knowledge-domain/knowledge-rag-sdk-trace-projection.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

Run:

```bash
git add apps/backend/agent-server/src/domains/knowledge/services/knowledge-trace.service.ts apps/backend/agent-server/src/domains/knowledge/rag/knowledge-rag-sdk.facade.ts apps/backend/agent-server/test/knowledge-domain/knowledge-rag-sdk-trace-projection.spec.ts
git commit -m "feat: project knowledge retrieval selection trace"
```

Expected: commit succeeds without `--no-verify`.

## Task 5: Ingestion Quality Gate Parity Review

**Files:**

- Modify: `apps/backend/agent-server/src/domains/knowledge/services/knowledge-ingestion.worker.ts`
- Test: `apps/backend/agent-server/test/knowledge-domain/knowledge-ingestion-sdk-pipeline.spec.ts`
- Modify: `docs/integration/knowledge-sdk-rag-rollout.md`

- [ ] **Step 1: Write failing quality gate test**

Add this test to `apps/backend/agent-server/test/knowledge-domain/knowledge-ingestion-sdk-pipeline.spec.ts`:

```ts
it('fails ingestion when vector upsert count does not match embedded chunks', async () => {
  const worker = createWorkerHarness({
    embeddingProvider: {
      async embedBatch(input) {
        return input.texts.map(() => [0.1, 0.2, 0.3]);
      }
    },
    vectorStore: {
      async upsert() {
        return { upsertedCount: 1 };
      }
    }
  });

  await expect(worker.runPendingJob('job-vector-mismatch')).rejects.toMatchObject({
    code: 'knowledge_ingestion_vector_upsert_unconfirmed'
  });

  expect(worker.repository.updateDocumentStatus).toHaveBeenCalledWith(
    expect.objectContaining({
      documentId: 'doc-vector-mismatch',
      status: 'failed',
      embeddedChunkCount: 0
    })
  );
});
```

- [ ] **Step 2: Run quality gate test to verify it fails**

Run:

```bash
pnpm --dir apps/backend/agent-server exec vitest run test/knowledge-domain/knowledge-ingestion-sdk-pipeline.spec.ts
```

Expected: FAIL if mismatched upsert count is not treated as a failed job with `embeddedChunkCount: 0`.

- [ ] **Step 3: Enforce vector upsert count**

Modify `apps/backend/agent-server/src/domains/knowledge/services/knowledge-ingestion.worker.ts`:

```ts
function assertVectorUpsertCount(input: { expectedCount: number; upsertedCount: number | undefined }): void {
  if (input.upsertedCount === undefined) {
    throw new KnowledgeServiceError('Vector upsert did not confirm written record count.', {
      code: 'knowledge_ingestion_vector_upsert_unconfirmed'
    });
  }

  if (input.upsertedCount !== input.expectedCount) {
    throw new KnowledgeServiceError(
      `Vector upsert wrote ${input.upsertedCount} records, expected ${input.expectedCount}.`,
      {
        code: 'knowledge_ingestion_vector_upsert_unconfirmed'
      }
    );
  }
}
```

Call it immediately after `runtime.vectorStore.upsert(...)` and before marking the document ready.

- [ ] **Step 4: Document the quality gate**

Update `docs/integration/knowledge-sdk-rag-rollout.md` ingestion section with:

```markdown
Vector upsert is a hard quality gate. If the vector store does not return a confirmed `upsertedCount`, or if that count differs from the number of embedded chunks, the job fails with `knowledge_ingestion_vector_upsert_unconfirmed`; the document remains non-ready and `embeddedChunkCount` reflects only confirmed searchable chunks.
```

- [ ] **Step 5: Run ingestion test**

Run:

```bash
pnpm --dir apps/backend/agent-server exec vitest run test/knowledge-domain/knowledge-ingestion-sdk-pipeline.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 5**

Run:

```bash
git add apps/backend/agent-server/src/domains/knowledge/services/knowledge-ingestion.worker.ts apps/backend/agent-server/test/knowledge-domain/knowledge-ingestion-sdk-pipeline.spec.ts docs/integration/knowledge-sdk-rag-rollout.md
git commit -m "fix: enforce knowledge vector upsert quality gate"
```

Expected: commit succeeds without `--no-verify`.

## Task 6: Final Documentation And Verification

**Files:**

- Modify: `docs/packages/knowledge/knowledge-retrieval-runtime.md`
- Modify: `docs/packages/knowledge/observability-eval-contracts.md`
- Modify: `docs/apps/backend/agent-server/knowledge.md`

- [ ] **Step 1: Document selection trace runtime behavior**

Add this section to `docs/packages/knowledge/knowledge-retrieval-runtime.md`:

```markdown
## Post-Retrieval Selection Trace

`runKnowledgeRetrieval()` emits `diagnostics.postRetrieval.selectionTrace` when post-retrieval stages run. Each entry records `chunkId`, `sourceId`, `selected`, `stage`, `reason`, optional `score`, and optional final `order`.

The trace explains why candidates were selected or dropped after retrieval. It is intended for Chat Lab debugging, backend trace projection, eval sampling and admin observability. It must not include raw provider responses, secret-bearing metadata or full vendor error objects.

The design is inspired by the course project `duyi-knowledge-bases`, but the implementation is owned by `@agent/knowledge` schemas and runtime stages.
```

- [ ] **Step 2: Document backend projection boundary**

Add this note to `docs/packages/knowledge/observability-eval-contracts.md`:

```markdown
Backend `KnowledgeTraceService` may project selection trace into aggregate counts such as `selectedCount`, `droppedCount` and `dropReasons`. Product-facing trace payloads should prefer these redacted aggregates unless the caller is an internal debugging tool with explicit permission to inspect chunk-level metadata.
```

- [ ] **Step 3: Run docs stale scan**

Run:

```bash
rg -n "duyi-knowledge-bases|selectionTrace|post-retrieval selection|@duyi/specs|@rag-sdk" docs AGENTS.md
```

Expected: hits either point to the new reference docs, current implementation docs, or historical specs clearly marked as current/historical. No hit should instruct future agents to copy `@duyi/specs` or course project source.

- [ ] **Step 4: Run focused verification**

Run:

```bash
pnpm --dir packages/knowledge exec vitest run test/contracts-boundary.test.ts test/post-retrieval-selection-trace.test.ts test/run-knowledge-retrieval.test.ts
pnpm --dir apps/backend/agent-server exec vitest run test/knowledge-domain/knowledge-rag-sdk-trace-projection.spec.ts test/knowledge-domain/knowledge-ingestion-sdk-pipeline.spec.ts
pnpm exec tsc -p packages/knowledge/tsconfig.json --noEmit
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm check:docs
```

Expected: all commands PASS. If a command fails because of unrelated pre-existing workspace changes, capture the failing test names or TypeScript files and rerun the narrow tests for files touched by this plan.

- [ ] **Step 5: Review git diff**

Run:

```bash
git diff -- docs/packages/knowledge/duyi-knowledge-bases-reference-gap-analysis.md docs/packages/knowledge/README.md docs/apps/backend/agent-server/knowledge.md packages/knowledge/src/contracts/schemas/knowledge-retrieval.schema.ts packages/knowledge/src/runtime/types/retrieval-runtime.types.ts packages/knowledge/src/runtime/defaults/post-retrieval-selection-trace.ts packages/knowledge/src/runtime/pipeline/run-knowledge-retrieval.ts apps/backend/agent-server/src/domains/knowledge/services/knowledge-trace.service.ts apps/backend/agent-server/src/domains/knowledge/rag/knowledge-rag-sdk.facade.ts apps/backend/agent-server/src/domains/knowledge/services/knowledge-ingestion.worker.ts
```

Expected: diff contains only this plan's docs, tests and knowledge/RAG implementation changes.

- [ ] **Step 6: Commit final docs if needed**

Run:

```bash
git add docs/packages/knowledge/knowledge-retrieval-runtime.md docs/packages/knowledge/observability-eval-contracts.md docs/apps/backend/agent-server/knowledge.md
git commit -m "docs: document knowledge reference trace boundaries"
```

Expected: commit succeeds if Task 6 produced doc-only changes. If there are no unstaged Task 6 changes, skip this commit.

## Self-Review

- Spec coverage: This plan maps the user-requested `duyi-knowledge-bases` reference project to current SDK/backend boundaries, covers RAG pipeline explainability, trace projection, ingestion quality gates, docs cleanup and verification.
- Placeholder scan: The plan contains no `TBD`, no incomplete file paths, and every implementation task has concrete test and code snippets.
- Type consistency: `selectionTrace`, `PostRetrievalSelectionTraceEntry`, `selectedCount`, `droppedCount` and `dropReasons` use the same names across schema, runtime, backend projection and docs.
- Scope check: This is one backend knowledge hardening slice. Frontend UI changes are intentionally excluded; frontend can consume the redacted trace projection in a later plan.
