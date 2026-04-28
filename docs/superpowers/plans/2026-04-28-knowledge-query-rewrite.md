# Knowledge Query Rewrite 实现计划

状态：snapshot
文档类型：plan
适用范围：`packages/knowledge`
最后核对：2026-04-28

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `packages/knowledge` 中新增 LLM 语义改写能力（`LlmQueryNormalizer`），并将 `RetrievalPipelineConfig.queryNormalizer` 升级为支持多个 normalizer 串联（数组配置），使调用方可以任意组合 SDK 默认实现与自定义实现。

**Architecture:** 在 `packages/knowledge/src/runtime/stages/` 新增 `QueryRewriteProvider` 极简注入接口，在 `runtime/defaults/` 新增 `LlmQueryNormalizer`（支持 LLM 失败静默降级）。`RetrievalPipelineConfig.queryNormalizer` 类型扩展为 `QueryNormalizer | QueryNormalizer[]`，`runKnowledgeRetrieval` 内部用 `resolveNormalizerChain` 将配置归一化为单一 normalizer 后执行。

**Tech Stack:** TypeScript、vitest、`packages/knowledge`（`@agent/knowledge`）

---

## 文件变更清单

| 操作 | 文件路径                                                             | 职责                                     |
| ---- | -------------------------------------------------------------------- | ---------------------------------------- |
| 新增 | `packages/knowledge/src/runtime/stages/query-rewrite-provider.ts`    | `QueryRewriteProvider` 注入接口          |
| 新增 | `packages/knowledge/src/runtime/defaults/llm-query-normalizer.ts`    | LLM 改写 normalizer，内置 fallback       |
| 新增 | `packages/knowledge/test/llm-query-normalizer.test.ts`               | `LlmQueryNormalizer` 单元测试            |
| 改造 | `packages/knowledge/src/contracts/knowledge-retrieval-runtime.ts`    | `queryNormalizer` 支持数组类型           |
| 改造 | `packages/knowledge/src/runtime/pipeline/run-knowledge-retrieval.ts` | 新增 `resolveNormalizerChain` + 串联逻辑 |
| 改造 | `packages/knowledge/test/run-knowledge-retrieval.test.ts`            | 补充串联 & 数组配置测试用例              |
| 改造 | `packages/knowledge/src/index.ts`                                    | 导出新接口和类                           |

---

## Task 1：新增 `QueryRewriteProvider` 接口

**Files:**

- Create: `packages/knowledge/src/runtime/stages/query-rewrite-provider.ts`

- [ ] **Step 1：创建接口文件**

```ts
// packages/knowledge/src/runtime/stages/query-rewrite-provider.ts

export interface QueryRewriteProvider {
  rewrite(query: string): Promise<string>;
}
```

- [ ] **Step 2：确认文件创建成功**

```bash
cat packages/knowledge/src/runtime/stages/query-rewrite-provider.ts
```

期望：输出完整接口内容。

- [ ] **Step 3：Commit**

```bash
cd /Users/dev/Desktop/learning-agent-core
git add packages/knowledge/src/runtime/stages/query-rewrite-provider.ts
git commit -m "feat(knowledge): add QueryRewriteProvider injection interface

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 2：新增 `LlmQueryNormalizer` + 单元测试（TDD）

**Files:**

- Create: `packages/knowledge/src/runtime/defaults/llm-query-normalizer.ts`
- Create: `packages/knowledge/test/llm-query-normalizer.test.ts`

- [ ] **Step 1：编写失败测试**

创建 `packages/knowledge/test/llm-query-normalizer.test.ts`：

```ts
import { describe, expect, it, vi } from 'vitest';

import type { RetrievalRequest } from '@agent/knowledge';

import type { QueryRewriteProvider } from '../src/runtime/stages/query-rewrite-provider';
import type { NormalizedRetrievalRequest } from '../src/runtime/types/retrieval-runtime.types';
import { LlmQueryNormalizer } from '../src/runtime/defaults/llm-query-normalizer';

function makeRewriteProvider(rewrittenQuery: string): QueryRewriteProvider {
  return { rewrite: vi.fn(async () => rewrittenQuery) };
}

function makeFailingProvider(): QueryRewriteProvider {
  return {
    rewrite: vi.fn(async () => {
      throw new Error('LLM unavailable');
    })
  };
}

describe('LlmQueryNormalizer', () => {
  it('calls rewrite provider with the rule-normalized query', async () => {
    const provider = makeRewriteProvider('iPhone 15 的电池续航表现如何？');
    const normalizer = new LlmQueryNormalizer(provider);

    await normalizer.normalize({ query: '苹果 15 续航咋样' });

    expect(provider.rewrite).toHaveBeenCalledOnce();
    // rewrite 收到的是规则清洗后的结果（口语词已归一化）
    expect(provider.rewrite).toHaveBeenCalledWith(expect.stringContaining('苹果'));
  });

  it('returns LLM-rewritten query with rewriteApplied: true when provider succeeds', async () => {
    const provider = makeRewriteProvider('iPhone 15 的电池续航表现如何？');
    const normalizer = new LlmQueryNormalizer(provider);

    const result = await normalizer.normalize({ query: '苹果 15 续航咋样' });

    expect(result.normalizedQuery).toBe('iPhone 15 的电池续航表现如何？');
    expect(result.rewriteApplied).toBe(true);
    expect(result.rewriteReason).toBe('llm-semantic-rewrite');
    expect(result.queryVariants).toContain('iPhone 15 的电池续航表现如何？');
  });

  it('silently falls back to rule-based result when provider throws', async () => {
    const normalizer = new LlmQueryNormalizer(makeFailingProvider());

    const result = await normalizer.normalize({ query: '苹果 15 续航咋样' });

    // 规则式 fallback 结果
    expect(result.normalizedQuery).toBeTruthy();
    expect(result.rewriteReason).not.toBe('llm-semantic-rewrite');
  });

  it('skips internal fallback when input already has normalizedQuery (chain scenario)', async () => {
    const provider = makeRewriteProvider('已改写的语义查询');
    const normalizer = new LlmQueryNormalizer(provider);

    // 模拟已经过前置 normalizer 处理的 request
    const alreadyNormalized: NormalizedRetrievalRequest = {
      query: '原始 query',
      originalQuery: '原始 query',
      normalizedQuery: '规则已处理的 query',
      topK: 5,
      rewriteApplied: false,
      queryVariants: ['规则已处理的 query']
    };

    const result = await normalizer.normalize(alreadyNormalized);

    // rewrite 应收到已归一化的 query，而不是原始 query
    expect(provider.rewrite).toHaveBeenCalledWith('规则已处理的 query');
    expect(result.normalizedQuery).toBe('已改写的语义查询');
  });

  it('accepts custom fallback normalizer', async () => {
    const customFallback = {
      normalize: vi.fn(
        async (req: RetrievalRequest): Promise<NormalizedRetrievalRequest> => ({
          ...req,
          originalQuery: req.query,
          normalizedQuery: 'custom-fallback-result',
          topK: 5,
          rewriteApplied: false
        })
      )
    };
    const normalizer = new LlmQueryNormalizer(makeFailingProvider(), customFallback);

    const result = await normalizer.normalize({ query: 'test query' });

    expect(customFallback.normalize).toHaveBeenCalledOnce();
    expect(result.normalizedQuery).toBe('custom-fallback-result');
  });
});
```

- [ ] **Step 2：运行测试，确认失败**

```bash
cd /Users/dev/Desktop/learning-agent-core
pnpm --dir packages/knowledge exec vitest run --config ../../vitest.config.js test/llm-query-normalizer.test.ts
```

期望：失败，提示 `Cannot find module '../src/runtime/defaults/llm-query-normalizer'`。

- [ ] **Step 3：实现 `LlmQueryNormalizer`**

创建 `packages/knowledge/src/runtime/defaults/llm-query-normalizer.ts`：

```ts
import type { RetrievalRequest } from '@agent/knowledge';

import type { QueryNormalizer } from '../stages/query-normalizer';
import type { QueryRewriteProvider } from '../stages/query-rewrite-provider';
import type { NormalizedRetrievalRequest } from '../types/retrieval-runtime.types';
import { buildQueryVariants } from './default-query-normalizer.helpers';
import { DefaultQueryNormalizer } from './default-query-normalizer';

function isAlreadyNormalized(request: RetrievalRequest): request is NormalizedRetrievalRequest {
  return 'normalizedQuery' in request && typeof (request as NormalizedRetrievalRequest).normalizedQuery === 'string';
}

export class LlmQueryNormalizer implements QueryNormalizer {
  constructor(
    private readonly rewriteProvider: QueryRewriteProvider,
    private readonly fallback: QueryNormalizer = new DefaultQueryNormalizer()
  ) {}

  async normalize(request: RetrievalRequest): Promise<NormalizedRetrievalRequest> {
    const base = isAlreadyNormalized(request) ? request : await this.fallback.normalize(request);

    try {
      const rewritten = await this.rewriteProvider.rewrite(base.normalizedQuery);
      return {
        ...base,
        normalizedQuery: rewritten,
        rewriteApplied: true,
        rewriteReason: 'llm-semantic-rewrite',
        queryVariants: buildQueryVariants(request.query, rewritten)
      };
    } catch {
      return base;
    }
  }
}
```

- [ ] **Step 4：运行测试，确认通过**

```bash
cd /Users/dev/Desktop/learning-agent-core
pnpm --dir packages/knowledge exec vitest run --config ../../vitest.config.js test/llm-query-normalizer.test.ts
```

期望：全部 5 个测试通过。

- [ ] **Step 5：Commit**

```bash
git add packages/knowledge/src/runtime/defaults/llm-query-normalizer.ts \
        packages/knowledge/test/llm-query-normalizer.test.ts
git commit -m "feat(knowledge): add LlmQueryNormalizer with silent fallback

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 3：扩展 `RetrievalPipelineConfig` 支持数组

**Files:**

- Modify: `packages/knowledge/src/contracts/knowledge-retrieval-runtime.ts`

- [ ] **Step 1：修改合约定义**

将 `packages/knowledge/src/contracts/knowledge-retrieval-runtime.ts` 从：

```ts
import type { RetrievalRequest } from '@agent/knowledge';

import type { ContextAssembler } from '../runtime/stages/context-assembler';
import type { QueryNormalizer } from '../runtime/stages/query-normalizer';
import type { RetrievalPostProcessor } from '../runtime/stages/post-processor';
import type { KnowledgeRetrievalResult } from '../runtime/types/retrieval-runtime.types';
import type { KnowledgeFacade } from './knowledge-facade';

export interface RetrievalPipelineConfig {
  queryNormalizer?: QueryNormalizer;
  postProcessor?: RetrievalPostProcessor;
  contextAssembler?: ContextAssembler;
}
```

改为：

```ts
import type { RetrievalRequest } from '@agent/knowledge';

import type { ContextAssembler } from '../runtime/stages/context-assembler';
import type { QueryNormalizer } from '../runtime/stages/query-normalizer';
import type { RetrievalPostProcessor } from '../runtime/stages/post-processor';
import type { KnowledgeRetrievalResult } from '../runtime/types/retrieval-runtime.types';
import type { KnowledgeFacade } from './knowledge-facade';

export interface RetrievalPipelineConfig {
  /**
   * 检索前 query 归一化处理器。
   * - 传入单个 QueryNormalizer：直接使用
   * - 传入数组：按顺序串联执行，每步输出作为下步输入
   * - 传入空数组或不传：使用默认规则式 DefaultQueryNormalizer
   * 调用方可传入 SDK 内置实现（DefaultQueryNormalizer、LlmQueryNormalizer）、
   * 自定义实现，或两者的任意组合。
   */
  queryNormalizer?: QueryNormalizer | QueryNormalizer[];
  postProcessor?: RetrievalPostProcessor;
  contextAssembler?: ContextAssembler;
}

export interface KnowledgeRetrievalRuntime extends KnowledgeFacade {
  retrieve(request: RetrievalRequest, pipeline?: RetrievalPipelineConfig): Promise<KnowledgeRetrievalResult>;
}
```

- [ ] **Step 2：类型检查**

```bash
cd /Users/dev/Desktop/learning-agent-core
pnpm exec tsc -p packages/knowledge/tsconfig.json --noEmit
```

期望：无错误。

- [ ] **Step 3：Commit**

```bash
git add packages/knowledge/src/contracts/knowledge-retrieval-runtime.ts
git commit -m "feat(knowledge): extend RetrievalPipelineConfig to support normalizer array

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 4：在 `runKnowledgeRetrieval` 中实现串联逻辑 + 补充测试

**Files:**

- Modify: `packages/knowledge/src/runtime/pipeline/run-knowledge-retrieval.ts`
- Modify: `packages/knowledge/test/run-knowledge-retrieval.test.ts`

- [ ] **Step 1：先写失败测试（追加到现有测试文件末尾的 describe 块内）**

在 `packages/knowledge/test/run-knowledge-retrieval.test.ts` 中，找到最外层 `describe('runKnowledgeRetrieval', () => {` 的最后一个 `});` 之前，追加以下 `describe` 块：

```ts
describe('normalizer chain (array config)', () => {
  it('executes normalizers in order when queryNormalizer is an array', async () => {
    const callOrder: string[] = [];

    const firstNormalizer: QueryNormalizer = {
      normalize: async (req: RetrievalRequest): Promise<NormalizedRetrievalRequest> => {
        callOrder.push('first');
        return makeNormalizedRequest(req, {
          normalizedQuery: 'first-normalized',
          queryVariants: ['first-normalized']
        });
      }
    };

    const secondNormalizer: QueryNormalizer = {
      normalize: async (req: RetrievalRequest): Promise<NormalizedRetrievalRequest> => {
        callOrder.push('second');
        // 第二步收到的 req 是 NormalizedRetrievalRequest，normalizedQuery 已由第一步填充
        const prev = (req as NormalizedRetrievalRequest).normalizedQuery ?? req.query;
        return makeNormalizedRequest(req, {
          normalizedQuery: `${prev}-then-second`,
          queryVariants: [`${prev}-then-second`]
        });
      }
    };

    const searchService = makeSearchService([]);
    const spy = vi.spyOn(searchService, 'search');

    await runKnowledgeRetrieval({
      request: { query: 'original' },
      searchService,
      pipeline: { queryNormalizer: [firstNormalizer, secondNormalizer] }
    });

    expect(callOrder).toEqual(['first', 'second']);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ query: 'first-normalized-then-second' }));
  });

  it('falls back to DefaultQueryNormalizer when queryNormalizer is an empty array', async () => {
    const searchService = makeSearchService([]);
    const spy = vi.spyOn(searchService, 'search');

    await runKnowledgeRetrieval({
      request: { query: '  some query  ' },
      searchService,
      pipeline: { queryNormalizer: [] }
    });

    // DefaultQueryNormalizer trims whitespace
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ query: 'some query' }));
  });

  it('uses single normalizer directly when array has one element', async () => {
    const searchService = makeSearchService([]);
    const spy = vi.spyOn(searchService, 'search');

    await runKnowledgeRetrieval({
      request: { query: 'test' },
      searchService,
      pipeline: { queryNormalizer: [makeSingleVariantNormalizer()] }
    });

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ query: 'test' }));
  });
});
```

- [ ] **Step 2：运行新增测试，确认失败**

```bash
cd /Users/dev/Desktop/learning-agent-core
pnpm --dir packages/knowledge exec vitest run --config ../../vitest.config.js test/run-knowledge-retrieval.test.ts
```

期望：`normalizer chain` 下的新测试失败（类型错误或运行时错误），已有测试依然通过。

- [ ] **Step 3：修改 `runKnowledgeRetrieval.ts` 实现串联**

将 `packages/knowledge/src/runtime/pipeline/run-knowledge-retrieval.ts` 完整替换为：

```ts
import type { RetrievalHit, RetrievalRequest } from '@agent/knowledge';

import type { KnowledgeSearchService } from '../../contracts/knowledge-facade';
import type { RetrievalPipelineConfig } from '../../contracts/knowledge-retrieval-runtime';
import type { QueryNormalizer } from '../stages/query-normalizer';
import type { KnowledgeRetrievalResult } from '../types/retrieval-runtime.types';
import { DefaultContextAssembler } from '../defaults/default-context-assembler';
import { DefaultQueryNormalizer } from '../defaults/default-query-normalizer';
import { DefaultRetrievalPostProcessor } from '../defaults/default-post-processor';

export interface KnowledgeRetrievalRunOptions {
  request: RetrievalRequest;
  searchService: KnowledgeSearchService;
  pipeline?: RetrievalPipelineConfig;
  assembleContext?: boolean;
  includeDiagnostics?: boolean;
}

function resolveNormalizerChain(config: QueryNormalizer | QueryNormalizer[] | undefined): QueryNormalizer {
  if (!config) return new DefaultQueryNormalizer();
  if (!Array.isArray(config)) return config;
  if (config.length === 0) return new DefaultQueryNormalizer();
  if (config.length === 1) return config[0]!;
  return {
    normalize: async request => {
      let result = await config[0]!.normalize(request);
      for (const normalizer of config.slice(1)) {
        result = await normalizer.normalize(result);
      }
      return result;
    }
  };
}

function dedupeQueries(queries: string[]): string[] {
  const deduped: string[] = [];
  const seen = new Set<string>();

  for (const query of queries) {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
      continue;
    }

    const fingerprint = normalizedQuery.toLowerCase();
    if (seen.has(fingerprint)) {
      continue;
    }

    seen.add(fingerprint);
    deduped.push(normalizedQuery);
  }

  return deduped;
}

type SearchHits = Awaited<ReturnType<KnowledgeSearchService['search']>>['hits'];

function mergeHitsByChunkId(hitGroups: SearchHits[]): RetrievalHit[] {
  const hitsByChunkId = new Map<string, RetrievalHit>();

  for (const hits of hitGroups) {
    for (const hit of hits) {
      const existingHit = hitsByChunkId.get(hit.chunkId);
      if (!existingHit || hit.score > existingHit.score) {
        hitsByChunkId.set(hit.chunkId, hit);
      }
    }
  }

  return Array.from(hitsByChunkId.values()).sort((left, right) => right.score - left.score);
}

export async function runKnowledgeRetrieval(options: KnowledgeRetrievalRunOptions): Promise<KnowledgeRetrievalResult> {
  const { request, searchService, pipeline = {}, assembleContext = false, includeDiagnostics = false } = options;

  const queryNormalizer = resolveNormalizerChain(pipeline.queryNormalizer);
  const postProcessor = pipeline.postProcessor ?? new DefaultRetrievalPostProcessor();
  const contextAssembler = assembleContext ? (pipeline.contextAssembler ?? new DefaultContextAssembler()) : null;

  const startedAt = new Date().toISOString();
  const startMs = Date.now();

  const normalized = await queryNormalizer.normalize(request);
  const queryVariants = dedupeQueries(
    normalized.queryVariants?.length ? normalized.queryVariants : [normalized.normalizedQuery]
  );
  const effectiveNormalized = {
    ...normalized,
    originalQuery: normalized.originalQuery ?? request.query,
    normalizedQuery: normalized.normalizedQuery,
    topK: normalized.topK,
    rewriteApplied: normalized.rewriteApplied ?? false,
    rewriteReason: normalized.rewriteReason,
    queryVariants
  };
  const executedQueries: string[] = [];
  const searchResults: SearchHits[] = [];

  for (const query of queryVariants) {
    executedQueries.push(query);
    const result = await searchService.search({
      ...request,
      query,
      limit: normalized.topK
    });
    searchResults.push(result.hits);
  }

  const mergedHits = mergeHitsByChunkId(searchResults);
  const preHitCount = mergedHits.length;
  const processedHits = await postProcessor.process(mergedHits, effectiveNormalized);
  const postHitCount = processedHits.length;

  const contextBundle = contextAssembler
    ? await contextAssembler.assemble(processedHits, effectiveNormalized)
    : undefined;

  return {
    hits: processedHits,
    total: postHitCount,
    contextBundle,
    diagnostics: includeDiagnostics
      ? {
          runId: `knowledge-retrieval-${Date.now()}`,
          startedAt,
          durationMs: Date.now() - startMs,
          originalQuery: effectiveNormalized.originalQuery,
          normalizedQuery: effectiveNormalized.normalizedQuery,
          rewriteApplied: effectiveNormalized.rewriteApplied,
          rewriteReason: effectiveNormalized.rewriteReason,
          queryVariants,
          executedQueries,
          preHitCount,
          postHitCount,
          contextAssembled: Boolean(contextBundle)
        }
      : undefined
  };
}
```

- [ ] **Step 4：运行全部 retrieval 测试，确认通过**

```bash
cd /Users/dev/Desktop/learning-agent-core
pnpm --dir packages/knowledge exec vitest run --config ../../vitest.config.js test/run-knowledge-retrieval.test.ts
```

期望：所有测试（含新增 3 个）全部通过。

- [ ] **Step 5：运行 knowledge 包全部测试，确认无回归**

```bash
pnpm --dir packages/knowledge exec vitest run --config ../../vitest.config.js packages/knowledge/test
```

期望：所有测试通过。

- [ ] **Step 6：Commit**

```bash
git add packages/knowledge/src/runtime/pipeline/run-knowledge-retrieval.ts \
        packages/knowledge/test/run-knowledge-retrieval.test.ts
git commit -m "feat(knowledge): support normalizer chain in runKnowledgeRetrieval

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 5：更新 `index.ts` 导出

**Files:**

- Modify: `packages/knowledge/src/index.ts`

- [ ] **Step 1：新增导出**

在 `packages/knowledge/src/index.ts` 中，在现有 `QueryNormalizer` 导出行下方追加：

```ts
export type { QueryRewriteProvider } from './runtime/stages/query-rewrite-provider';
export { LlmQueryNormalizer } from './runtime/defaults/llm-query-normalizer';
```

完整修改后相关区域如下（其他行不变）：

```ts
export type { ContextAssembler } from './runtime/stages/context-assembler';
export type { QueryNormalizer } from './runtime/stages/query-normalizer';
export type { QueryRewriteProvider } from './runtime/stages/query-rewrite-provider';
export type { RetrievalPostProcessor } from './runtime/stages/post-processor';
// ...
export { DefaultContextAssembler } from './runtime/defaults/default-context-assembler';
export { DefaultQueryNormalizer } from './runtime/defaults/default-query-normalizer';
export { LlmQueryNormalizer } from './runtime/defaults/llm-query-normalizer';
export { DefaultRetrievalPostProcessor } from './runtime/defaults/default-post-processor';
```

- [ ] **Step 2：运行 root-exports 回归测试，确认无破坏**

```bash
cd /Users/dev/Desktop/learning-agent-core
pnpm --dir packages/knowledge exec vitest run --config ../../vitest.config.js test/root-exports.test.ts
```

期望：所有测试通过（该文件不需要修改，`LlmQueryNormalizer` 是新增导出，不影响已有检测）。

- [ ] **Step 3：类型检查**

```bash
pnpm exec tsc -p packages/knowledge/tsconfig.json --noEmit
```

期望：无错误。

- [ ] **Step 4：Commit**

```bash
git add packages/knowledge/src/index.ts
git commit -m "feat(knowledge): export QueryRewriteProvider and LlmQueryNormalizer

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Task 6：最终验证

- [ ] **Step 1：运行 knowledge 包完整验证**

```bash
cd /Users/dev/Desktop/learning-agent-core
pnpm --dir packages/knowledge test
```

期望：所有测试通过。

- [ ] **Step 2：构建 knowledge 包**

```bash
pnpm --dir packages/knowledge build:lib
```

期望：`build/cjs`、`build/esm`、`build/types` 均生成成功，无错误。

- [ ] **Step 3：验证下游包不受影响**

```bash
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

期望：无新增类型错误（现有错误与本次改动无关）。

- [ ] **Step 4：最终 Commit（如有未提交内容）**

```bash
git status
# 若有未提交内容：
git add -A
git commit -m "chore(knowledge): finalize query rewrite feature exports and verification

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## 附：调用方接入示例（不在本计划实现范围内）

实现完成后，调用方在 `apps/backend/agent-server` 或 `packages/runtime` 中的装配代码示例：

```ts
import { LlmQueryNormalizer, type QueryRewriteProvider } from '@agent/knowledge';

class BackendQueryRewriteProvider implements QueryRewriteProvider {
  constructor(private readonly llm: { generateText(prompt: string): Promise<{ text: string }> }) {}

  async rewrite(query: string): Promise<string> {
    const result = await this.llm.generateText(
      `将以下用户问题改写为更适合知识库检索的标准表达，保持核心意图不变，只输出改写结果：\n${query}`
    );
    return result.text.trim();
  }
}

// 使用方式 A：仅 LLM 改写（内置规则 fallback）
const pipeline = {
  queryNormalizer: new LlmQueryNormalizer(new BackendQueryRewriteProvider(llm))
};

// 使用方式 B：显式串联（规则 → LLM）
const pipeline = {
  queryNormalizer: [new DefaultQueryNormalizer(), new LlmQueryNormalizer(new BackendQueryRewriteProvider(llm))]
};
```
