# Knowledge Context Assembly Budget Implementation Plan

状态：current
文档类型：plan
适用范围：`packages/knowledge`、`apps/backend/agent-server/src/domains/knowledge/rag`
最后核对：2026-05-08

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Knowledge RAG context assembly honor `contextBudgetTokens`, return observable diagnostics, and ensure generation consumes the assembled `contextBundle`.

**Architecture:** Keep retrieval ranking, prompt context assembly, and answer generation as separate stages. Extend `ContextAssembler` from string-only output to a structured result while preserving a thin compatibility path for existing custom assemblers. Feed context budget from RAG policy into retrieval runtime, and make backend answer provider messages prefer `input.contextBundle` over reassembling citations.

**Tech Stack:** TypeScript, zod contracts, `packages/knowledge` RAG runtime, `apps/backend/agent-server` knowledge domain, Vitest, pnpm.

---

## Implementation Status

2026-05-08：本计划已在 `feature/knowledge-context-assembly-budget` 分支实现并通过受影响范围验证，但尚未 commit。下方 checkbox 保留为计划执行清单格式，不代表 git 提交状态。

## Scope And Non-Goals

This plan only covers the Knowledge RAG chain:

- `packages/knowledge`
- `apps/backend/agent-server/src/domains/knowledge/rag`
- related docs and tests

This plan does not change `packages/runtime` reactive context retry, `agents/data-report`, frontend Chat Lab UI, or provider SDK behavior. Those can consume the new diagnostics later.

## File Structure

Modify these files:

- `packages/knowledge/src/runtime/stages/context-assembler.ts`
  - Own the context assembly contract.
  - Add budget input and structured result output.
- `packages/knowledge/src/runtime/defaults/default-context-assembler.ts`
  - Implement budget-aware assembly with deterministic truncation.
- `packages/knowledge/src/runtime/types/retrieval-runtime.types.ts`
  - Add context assembly diagnostics to retrieval diagnostics.
- `packages/knowledge/src/runtime/pipeline/run-knowledge-retrieval.ts`
  - Pass budget/options into assembler and expose diagnostics.
- `packages/knowledge/src/rag/retrieval/rag-retrieval-runtime.ts`
  - Map `KnowledgeRagPolicy.contextBudgetTokens` or plan hints into retrieval pipeline assembly options.
- `packages/knowledge/src/rag/runtime/run-knowledge-rag.ts`
  - Ensure policy budget reaches `RagRetrievalRuntime.retrieve()`.
- `packages/knowledge/src/rag/runtime/stream-knowledge-rag.ts`
  - Mirror the same budget wiring for streaming.
- `apps/backend/agent-server/src/domains/knowledge/rag/knowledge-rag-sdk.providers.ts`
  - Make `buildSdkChatMessages()` prefer `input.contextBundle`.
- `docs/packages/knowledge/context-assembly-and-generation.md`
  - Update “current gap” items after implementation.
- `docs/integration/context-assembly-and-generation.md`
  - Update cross-module current-state notes after implementation.

Modify these tests:

- `packages/knowledge/test/run-knowledge-retrieval.test.ts`
  - Budget truncation, diagnostics, custom assembler compatibility.
- `packages/knowledge/test/rag-retrieval-runtime.test.ts`
  - Policy budget wiring into context assembly.
- `packages/knowledge/test/run-knowledge-rag.test.ts`
  - End-to-end budget-aware `contextBundle`.
- `packages/knowledge/test/stream-knowledge-rag.test.ts`
  - Streaming path budget parity.
- `apps/backend/agent-server/test/knowledge-domain/knowledge-rag-sdk.providers.spec.ts`
  - Backend generation consumes `contextBundle`.

## Task 1: Extend Context Assembly Contract

**Files:**

- Modify: `packages/knowledge/src/runtime/stages/context-assembler.ts`
- Modify: `packages/knowledge/src/runtime/types/retrieval-runtime.types.ts`
- Test: `packages/knowledge/test/run-knowledge-retrieval.test.ts`

- [ ] **Step 1: Write the failing contract-level test**

Add a test in `packages/knowledge/test/run-knowledge-retrieval.test.ts` that injects a custom assembler returning structured diagnostics:

```ts
it('returns structured context assembly diagnostics from a custom assembler', async () => {
  const result = await runKnowledgeRetrieval({
    request: { query: 'budgeted context', limit: 2 },
    searchService: createSearchService([
      createHit({ chunkId: 'chunk_a', title: 'A', content: 'alpha context', score: 0.9 }),
      createHit({ chunkId: 'chunk_b', title: 'B', content: 'beta context', score: 0.8 })
    ]),
    assembleContext: true,
    includeDiagnostics: true,
    pipeline: {
      contextAssembler: {
        async assemble(hits) {
          return {
            contextBundle: hits.map(hit => hit.content).join('\n'),
            diagnostics: {
              strategy: 'custom-test',
              budgetTokens: 42,
              estimatedTokens: 12,
              selectedHitIds: hits.map(hit => hit.chunkId),
              droppedHitIds: [],
              truncatedHitIds: [],
              orderingStrategy: 'ranked'
            }
          };
        }
      }
    }
  });

  expect(result.contextBundle).toBe('alpha context\nbeta context');
  expect(result.diagnostics?.contextAssembly).toMatchObject({
    strategy: 'custom-test',
    budgetTokens: 42,
    estimatedTokens: 12,
    selectedHitIds: ['chunk_a', 'chunk_b'],
    droppedHitIds: [],
    truncatedHitIds: [],
    orderingStrategy: 'ranked'
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
pnpm exec vitest run packages/knowledge/test/run-knowledge-retrieval.test.ts -t "structured context assembly diagnostics"
```

Expected: FAIL because `ContextAssembler.assemble()` only accepts the old string return type and `diagnostics.contextAssembly` does not exist.

- [ ] **Step 3: Add the new contract types**

Change `packages/knowledge/src/runtime/stages/context-assembler.ts` to define the structured result:

```ts
import type { RetrievalHit } from '../../index';

import type { NormalizedRetrievalRequest } from '../types/retrieval-runtime.types';

export interface PromptContextBudget {
  maxContextTokens: number;
  reservedOutputTokens?: number;
  systemTokens?: number;
  queryTokens?: number;
  historyTokens?: number;
}

export interface ContextAssemblyDiagnostics {
  strategy: string;
  budgetTokens?: number;
  estimatedTokens: number;
  selectedHitIds: string[];
  droppedHitIds: string[];
  truncatedHitIds: string[];
  orderingStrategy: string;
}

export interface ContextAssemblyOptions {
  budget?: PromptContextBudget;
}

export interface ContextAssemblyResult {
  contextBundle: string;
  diagnostics: ContextAssemblyDiagnostics;
}

export type ContextAssemblerOutput = string | ContextAssemblyResult;

export interface ContextAssembler {
  assemble(
    hits: RetrievalHit[],
    request: NormalizedRetrievalRequest,
    options?: ContextAssemblyOptions
  ): Promise<ContextAssemblerOutput>;
}
```

Then add `contextAssembly?: ContextAssemblyDiagnostics` to `RetrievalDiagnostics` in `packages/knowledge/src/runtime/types/retrieval-runtime.types.ts`.

- [ ] **Step 4: Normalize assembler output in the pipeline**

In `packages/knowledge/src/runtime/pipeline/run-knowledge-retrieval.ts`, replace the direct `await contextAssembler.assemble(...)` assignment with a small normalizer:

```ts
const contextAssemblyOutput = contextAssembler
  ? await contextAssembler.assemble(contextHits, effectiveNormalized, pipeline.contextAssemblyOptions)
  : undefined;
const contextBundle =
  typeof contextAssemblyOutput === 'string' ? contextAssemblyOutput : contextAssemblyOutput?.contextBundle;
const contextAssemblyDiagnostics =
  typeof contextAssemblyOutput === 'string' ? undefined : contextAssemblyOutput?.diagnostics;
```

Set diagnostics:

```ts
contextAssembled: Boolean(contextBundle),
contextAssembly: contextAssemblyDiagnostics,
```

- [ ] **Step 5: Run the test**

Run:

```bash
pnpm exec vitest run packages/knowledge/test/run-knowledge-retrieval.test.ts -t "structured context assembly diagnostics"
```

Expected: PASS.

## Task 2: Make DefaultContextAssembler Budget-Aware

**Files:**

- Modify: `packages/knowledge/src/runtime/defaults/default-context-assembler.ts`
- Test: `packages/knowledge/test/run-knowledge-retrieval.test.ts`

- [ ] **Step 1: Write failing budget tests**

Add two tests:

```ts
it('truncates default context assembly to the provided context budget', async () => {
  const result = await runKnowledgeRetrieval({
    request: { query: 'budget', limit: 3 },
    searchService: createSearchService([
      createHit({ chunkId: 'a', title: 'A', content: 'a '.repeat(160), score: 0.95 }),
      createHit({ chunkId: 'b', title: 'B', content: 'b '.repeat(160), score: 0.9 }),
      createHit({ chunkId: 'c', title: 'C', content: 'c '.repeat(160), score: 0.85 })
    ]),
    assembleContext: true,
    includeDiagnostics: true,
    pipeline: {
      contextAssemblyOptions: {
        budget: { maxContextTokens: 80, reservedOutputTokens: 20, queryTokens: 5, systemTokens: 5 }
      }
    }
  });

  expect(result.contextBundle?.length).toBeLessThan(420);
  expect(result.diagnostics?.contextAssembly).toMatchObject({
    strategy: 'default-budgeted-concat',
    budgetTokens: 50,
    orderingStrategy: 'ranked'
  });
  expect(result.diagnostics?.contextAssembly?.selectedHitIds.length).toBeGreaterThan(0);
  expect(
    [
      ...(result.diagnostics?.contextAssembly?.droppedHitIds ?? []),
      ...(result.diagnostics?.contextAssembly?.truncatedHitIds ?? [])
    ].length
  ).toBeGreaterThan(0);
});

it('does not rewrite the original query when context budget is small', async () => {
  const result = await runKnowledgeRetrieval({
    request: { query: '原始问题必须保留', limit: 1 },
    searchService: createSearchService([
      createHit({ chunkId: 'a', title: 'A', content: 'context '.repeat(200), score: 0.95 })
    ]),
    assembleContext: true,
    includeDiagnostics: true,
    pipeline: {
      contextAssemblyOptions: {
        budget: { maxContextTokens: 32, queryTokens: 16 }
      }
    }
  });

  expect(result.diagnostics?.originalQuery).toBe('原始问题必须保留');
  expect(result.diagnostics?.normalizedQuery).toBe('原始问题必须保留');
});
```

- [ ] **Step 2: Run the failing tests**

Run:

```bash
pnpm exec vitest run packages/knowledge/test/run-knowledge-retrieval.test.ts -t "context budget|original query"
```

Expected: FAIL because the default assembler ignores budget and returns no diagnostics.

- [ ] **Step 3: Implement deterministic budget estimation**

Update `packages/knowledge/src/runtime/defaults/default-context-assembler.ts`:

```ts
import type { RetrievalHit } from '../../index';

import type { ContextAssembler, ContextAssemblyOptions, ContextAssemblyResult } from '../stages/context-assembler';
import type { NormalizedRetrievalRequest } from '../types/retrieval-runtime.types';
import { DEFAULT_CONTEXT_SEPARATOR } from './retrieval-runtime-defaults';

const APPROX_CHARS_PER_TOKEN = 4;

export class DefaultContextAssembler implements ContextAssembler {
  async assemble(
    hits: RetrievalHit[],
    _request: NormalizedRetrievalRequest,
    options: ContextAssemblyOptions = {}
  ): Promise<ContextAssemblyResult> {
    const budgetTokens = resolveBudgetTokens(options);
    const budgetChars = budgetTokens === undefined ? undefined : Math.max(0, budgetTokens * APPROX_CHARS_PER_TOKEN);
    const selectedHitIds: string[] = [];
    const droppedHitIds: string[] = [];
    const truncatedHitIds: string[] = [];
    const parts: string[] = [];
    let usedChars = 0;

    for (const [index, hit] of hits.entries()) {
      const fullPart = `[${index + 1}] ${hit.title}\n${hit.content}`;
      const separator = parts.length > 0 ? DEFAULT_CONTEXT_SEPARATOR : '';
      const nextLength = separator.length + fullPart.length;

      if (budgetChars === undefined || usedChars + nextLength <= budgetChars) {
        parts.push(fullPart);
        usedChars += nextLength;
        selectedHitIds.push(hit.chunkId);
        continue;
      }

      const remainingChars = budgetChars - usedChars - separator.length;
      if (remainingChars > 24) {
        parts.push(truncateText(fullPart, remainingChars));
        usedChars = budgetChars;
        selectedHitIds.push(hit.chunkId);
        truncatedHitIds.push(hit.chunkId);
      } else {
        droppedHitIds.push(hit.chunkId);
      }

      for (const dropped of hits.slice(index + 1)) {
        droppedHitIds.push(dropped.chunkId);
      }
      break;
    }

    const contextBundle = parts.join(DEFAULT_CONTEXT_SEPARATOR);

    return {
      contextBundle,
      diagnostics: {
        strategy: budgetTokens === undefined ? 'default-concat' : 'default-budgeted-concat',
        budgetTokens,
        estimatedTokens: estimateTokens(contextBundle),
        selectedHitIds,
        droppedHitIds,
        truncatedHitIds,
        orderingStrategy: 'ranked'
      }
    };
  }
}

function resolveBudgetTokens(options: ContextAssemblyOptions): number | undefined {
  const budget = options.budget;
  if (!budget) return undefined;

  const reserved =
    (budget.reservedOutputTokens ?? 0) +
    (budget.systemTokens ?? 0) +
    (budget.queryTokens ?? 0) +
    (budget.historyTokens ?? 0);
  return Math.max(0, budget.maxContextTokens - reserved);
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / APPROX_CHARS_PER_TOKEN);
}

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  if (maxChars <= 1) return '';
  return `${text.slice(0, maxChars - 1).trimEnd()}…`;
}
```

- [ ] **Step 4: Run the budget tests**

Run:

```bash
pnpm exec vitest run packages/knowledge/test/run-knowledge-retrieval.test.ts -t "context budget|original query"
```

Expected: PASS.

## Task 3: Wire RAG Policy Budget Into Retrieval Runtime

**Files:**

- Modify: `packages/knowledge/src/contracts/knowledge-retrieval-runtime.ts`
- Modify: `packages/knowledge/src/rag/retrieval/rag-retrieval-runtime.ts`
- Modify: `packages/knowledge/src/rag/runtime/run-knowledge-rag.ts`
- Modify: `packages/knowledge/src/rag/runtime/stream-knowledge-rag.ts`
- Test: `packages/knowledge/test/rag-retrieval-runtime.test.ts`
- Test: `packages/knowledge/test/run-knowledge-rag.test.ts`
- Test: `packages/knowledge/test/stream-knowledge-rag.test.ts`

- [ ] **Step 1: Write failing policy wiring test**

Add to `packages/knowledge/test/rag-retrieval-runtime.test.ts`:

```ts
it('passes context budget into context assembly options', async () => {
  const seenBudgets: number[] = [];
  const runtime = new RagRetrievalRuntime({
    searchService: createSearchService([
      createHit({ chunkId: 'budgeted', title: 'Budgeted', content: 'content '.repeat(200), score: 0.95 })
    ]),
    pipeline: {
      contextAssembler: {
        async assemble(_hits, _request, options) {
          seenBudgets.push(options?.budget?.maxContextTokens ?? 0);
          return {
            contextBundle: 'assembled',
            diagnostics: {
              strategy: 'budget-probe',
              budgetTokens: options?.budget?.maxContextTokens,
              estimatedTokens: 1,
              selectedHitIds: ['budgeted'],
              droppedHitIds: [],
              truncatedHitIds: [],
              orderingStrategy: 'ranked'
            }
          };
        }
      }
    }
  });

  await runtime.retrieve(createPlan({ strategyHints: { topK: 1, contextBudgetTokens: 1234 } }));

  expect(seenBudgets).toEqual([1234]);
});
```

- [ ] **Step 2: Run the failing policy wiring test**

Run:

```bash
pnpm exec vitest run packages/knowledge/test/rag-retrieval-runtime.test.ts -t "passes context budget"
```

Expected: FAIL because retrieve options do not pass context budget into the pipeline.

- [ ] **Step 3: Add context assembly options to pipeline config**

In `packages/knowledge/src/contracts/knowledge-retrieval-runtime.ts`, add:

```ts
import type { ContextAssemblyOptions } from '../runtime/stages/context-assembler';

export interface RetrievalPipelineConfig {
  // existing fields...
  contextAssemblyOptions?: ContextAssemblyOptions;
}
```

- [ ] **Step 4: Pass budget from plan strategy hints**

In `packages/knowledge/src/rag/retrieval/rag-retrieval-runtime.ts`, merge context assembly options:

```ts
const contextAssemblyOptions = {
  ...this.pipeline?.contextAssemblyOptions,
  ...options.pipeline?.contextAssemblyOptions,
  ...(plan.strategyHints?.contextBudgetTokens
    ? { budget: { maxContextTokens: plan.strategyHints.contextBudgetTokens } }
    : {})
};
```

Then include it in the pipeline passed to `runKnowledgeRetrieval()`:

```ts
pipeline: {
  ...(this.pipeline ?? {}),
  ...(options.pipeline ?? {}),
  contextAssemblyOptions,
  queryNormalizer: {
    normalize: async (): Promise<NormalizedRetrievalRequest> => ({
      ...request,
      originalQuery: plan.originalQuery,
      normalizedQuery: primaryQuery,
      topK: plan.strategyHints?.topK ?? request.limit ?? 5,
      rewriteApplied: plan.diagnostics.rewriteApplied,
      queryVariants
    })
  }
}
```

- [ ] **Step 5: Ensure planner strategy hints include policy budget**

In `packages/knowledge/src/rag/planning/default-pre-retrieval-planner.ts`, when provider result omits `strategyHints.contextBudgetTokens`, set it from policy:

```ts
strategyHints: {
  ...(result.strategyHints ?? {}),
  topK: result.strategyHints?.topK ?? input.policy.retrievalTopK,
  contextBudgetTokens: result.strategyHints?.contextBudgetTokens ?? input.policy.contextBudgetTokens
},
```

Apply the same default in fallback plans:

```ts
strategyHints: {
  topK: input.policy.retrievalTopK,
  contextBudgetTokens: input.policy.contextBudgetTokens
},
```

- [ ] **Step 6: Run policy and end-to-end tests**

Run:

```bash
pnpm exec vitest run packages/knowledge/test/rag-retrieval-runtime.test.ts -t "passes context budget"
pnpm exec vitest run packages/knowledge/test/run-knowledge-rag.test.ts -t "contextBundle"
pnpm exec vitest run packages/knowledge/test/stream-knowledge-rag.test.ts -t "contextBundle"
```

Expected: PASS.

## Task 4: Make Backend Generation Consume contextBundle

**Files:**

- Modify: `apps/backend/agent-server/src/domains/knowledge/rag/knowledge-rag-sdk.providers.ts`
- Test: `apps/backend/agent-server/test/knowledge-domain/knowledge-rag-sdk.providers.spec.ts`

- [ ] **Step 1: Write failing backend provider test**

Add a test to `apps/backend/agent-server/test/knowledge-domain/knowledge-rag-sdk.providers.spec.ts` that captures messages sent to the chat provider:

```ts
it('uses assembled contextBundle when generating SDK RAG answers', async () => {
  const capturedMessages: Array<{ role: string; content: string; name?: string }> = [];
  const provider = createKnowledgeRagAnswerProvider({
    enabled: true,
    runtime: {
      chatProvider: {
        async generate(input) {
          capturedMessages.push(...input.messages);
          return { text: 'answer from assembled context', providerId: 'test', model: 'test-model' };
        }
      }
    }
  });

  await provider.generate({
    originalQuery: 'question',
    rewrittenQuery: 'question',
    contextBundle: '[1] Assembled\nThis text only exists in contextBundle.',
    citations: [
      {
        sourceId: 'source',
        chunkId: 'chunk',
        title: 'Citation title',
        quote: 'citation quote should not replace bundle'
      }
    ],
    selectedKnowledgeBaseIds: ['kb'],
    metadata: {}
  });

  const developerMessage = capturedMessages.find(message => message.name === 'developer');
  expect(developerMessage?.content).toContain('This text only exists in contextBundle.');
  expect(developerMessage?.content).not.toContain('Context citations:');
});
```

- [ ] **Step 2: Run the failing backend provider test**

Run:

```bash
pnpm exec vitest run apps/backend/agent-server/test/knowledge-domain/knowledge-rag-sdk.providers.spec.ts -t "assembled contextBundle"
```

Expected: FAIL because `buildSdkChatMessages()` currently rebuilds context from citations.

- [ ] **Step 3: Prefer contextBundle in buildSdkChatMessages**

In `apps/backend/agent-server/src/domains/knowledge/rag/knowledge-rag-sdk.providers.ts`, update `buildSdkChatMessages()`:

```ts
function buildSdkChatMessages(input: KnowledgeAnswerProviderInput) {
  const context = input.contextBundle.trim() || buildCitationContext(input.citations);

  return [
    {
      role: 'system' as const,
      content: '你是知识库问答助手。必须只基于提供的 citations/context 回答；依据不足时明确说明依据不足。'
    },
    {
      role: 'system' as const,
      name: 'developer',
      content: `Context:\n${context}`
    },
    {
      role: 'user' as const,
      content: input.rewrittenQuery || input.originalQuery
    }
  ];
}

function buildCitationContext(citations: Citation[]): string {
  return citations.length > 0
    ? citations.map((citation, index) => `[${index + 1}] ${formatCitation(citation)}`).join('\n\n')
    : '未检索到可引用片段。';
}
```

- [ ] **Step 4: Run the backend provider test**

Run:

```bash
pnpm exec vitest run apps/backend/agent-server/test/knowledge-domain/knowledge-rag-sdk.providers.spec.ts -t "assembled contextBundle"
```

Expected: PASS.

## Task 5: Update Docs And Verification

**Files:**

- Modify: `docs/packages/knowledge/context-assembly-and-generation.md`
- Modify: `docs/integration/context-assembly-and-generation.md`
- Modify: `docs/packages/knowledge/knowledge-retrieval-runtime.md`
- Modify: `docs/integration/README.md`
- Modify: `docs/packages/knowledge/README.md`

- [ ] **Step 1: Update current-state docs**

Edit the docs so they state:

- `contextBudgetTokens` now reaches context assembly.
- `DefaultContextAssembler` performs approximate-token budget truncation.
- `RetrievalDiagnostics.contextAssembly` exposes selected, dropped, truncated, estimated tokens, and ordering strategy.
- backend knowledge generation now prefers `input.contextBundle`; citations remain grounding and UI projection.
- prompt ordering is still `ranked`; a dedicated long-context ordering strategy remains a future enhancement.

- [ ] **Step 2: Scan docs for stale statements**

Run:

```bash
rg -n "contextBudgetTokens.*没有真正生效|没有稳定消费 `contextBundle`|重新用 `input.citations`|assembler 插槽失去实际影响|DefaultContextAssembler.*没有预算|ContextAssembler.*string-only|待补充" docs packages/knowledge apps/backend/agent-server
```

Expected after implementation: no current docs claim the fixed gaps still exist. Historical plans may mention older state only if clearly historical. `prompt ordering` / `长上下文重排` hits are expected only when they say ordering is still `ranked` and head-tail long-context reordering remains future work.

- [ ] **Step 3: Run affected tests**

Run:

```bash
pnpm exec vitest run packages/knowledge/test/run-knowledge-retrieval.test.ts
pnpm exec vitest run packages/knowledge/test/rag-retrieval-runtime.test.ts
pnpm exec vitest run packages/knowledge/test/run-knowledge-rag.test.ts
pnpm exec vitest run packages/knowledge/test/stream-knowledge-rag.test.ts
pnpm exec vitest run apps/backend/agent-server/test/knowledge-domain/knowledge-rag-sdk.providers.spec.ts
```

Expected: all pass.

- [ ] **Step 4: Run type checks**

Run:

```bash
pnpm exec tsc -p packages/knowledge/tsconfig.json --noEmit
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

Expected: both pass.

- [ ] **Step 5: Run docs check**

Run:

```bash
pnpm check:docs
```

Expected: docs check passes.

Worker C pre-merge docs-only check:

```bash
pnpm check:docs
```

Expected before code is complete: docs links and metadata pass. Do not mark Task 5 complete until code-side verification in Steps 3 and 4 also passes.

- [ ] **Step 6: Commit after review**

Before committing, review the diff for unintended scope expansion:

```bash
git diff -- packages/knowledge apps/backend/agent-server docs/packages/knowledge docs/integration
```

Then commit without bypassing hooks:

```bash
git add packages/knowledge apps/backend/agent-server docs/packages/knowledge docs/integration
git commit -m "feat: enforce knowledge context assembly budget"
```

Expected: local hooks pass and commit succeeds.

## Self-Review

- Spec coverage: The plan covers budget propagation, assembler diagnostics, backend generation consumption of `contextBundle`, docs updates, and verification.
- Placeholder scan: The plan contains no `TBD`, unfinished placeholders, or “write tests later” steps.
- Type consistency: `ContextAssemblyOptions`, `ContextAssemblyResult`, and `ContextAssemblyDiagnostics` are introduced before later tasks consume them.
- Scope check: Runtime reactive compression, data-report generation, frontend observability UI, and prompt ordering strategy implementation are intentionally out of scope for this first implementation slice.
