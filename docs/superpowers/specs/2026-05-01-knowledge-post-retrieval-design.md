# Knowledge Post-Retrieval 主链设计

状态：snapshot
文档类型：plan
适用范围：`packages/knowledge`
最后核对：2026-05-01

> 2026-05-01 执行更新：第一阶段实现完成后，当前生效入口应以 `docs/packages/knowledge/knowledge-retrieval-runtime.md` 为准；本文件保留为设计快照。

## 1. 背景

当前 `packages/knowledge` 已经完成了检索前 query rewrite、metadata filtering、hybrid search 与 Small-to-Big context expansion 的第一阶段收敛。现有在线链路为：

```text
query normalization
-> filter resolution
-> retrieval
-> defensive filtering
-> merge
-> post-process
-> context expansion
-> context assembly
```

其中 `post-process` 目前主要承担低分过滤与 `topK` 截断。它还不足以覆盖 RAG 检索后的关键治理问题：

- 召回内容主题相关但不能支持回答。
- 多个 chunk 重复或近重复，占用上下文预算。
- 候选结果之间可能有版本、权威性或事实冲突。
- chunk 含有敏感信息、低价值页眉页脚、目录或版权声明。
- 排名前几条过度来自同一文档、同一父段落或同一主题角度。

Post-Retrieval 主链的目标是在候选结果进入 context expansion 与 context assembly 之前，形成一批更干净、顺序更合理、来源覆盖更稳的 evidence candidates。

## 2. 设计目标

第一阶段目标是把 `post-process` 从单一裁剪器升级为可组合的检索后操作链：

```text
retrieval
-> defensive metadata filtering
-> merge / fusion
-> result filtering
-> result ranking
-> result diversification
-> context expansion
-> context assembly
```

完成后应具备：

- 过滤：能解释候选为什么被丢弃或保留。
- 排序：能融合检索分数、权威性、新近性与上下文适配度。
- 多样化：能限制同源、同父段落、同章节候选过度占用上下文。
- 诊断：能在 `RetrievalDiagnostics` 中观测 post-retrieval 的数量变化、策略与主要原因。
- 扩展：后续可注入 reranker、cross-encoder、PII detector 或 LLM judge，但第一阶段不依赖这些重能力。

## 3. 非目标

第一阶段不实现：

- 真实 cross-encoder / reranker provider。
- LLM 冲突判断、信息增量判断或复杂排序。
- embedding MMR。
- PII / secret scanner 的生产级 provider 接入。
- 改变 `RetrievalRequest` 的稳定公共字段。
- 把第三方 provider response、vendor score object 或安全 SDK 结果穿透到公共 contract。
- 修改 generation 阶段的回答策略。

这些能力后续必须通过 provider / adapter / facade 注入，不能直接写进 `runKnowledgeRetrieval()` 或 app service。

## 4. 主链落点

Post-Retrieval 属于 `packages/knowledge` 的在线检索编排能力，不属于 `packages/runtime`。

推荐新增 stage contract：

```text
packages/knowledge/src/runtime/stages/
  post-retrieval-filter.ts
  post-retrieval-ranker.ts
  post-retrieval-diversifier.ts
```

推荐新增默认实现：

```text
packages/knowledge/src/runtime/defaults/
  default-post-retrieval-filter.ts
  default-post-retrieval-ranker.ts
  default-post-retrieval-diversifier.ts
```

`RetrievalPipelineConfig` 增加可选注入点：

```ts
interface RetrievalPipelineConfig {
  queryNormalizer?: QueryNormalizer | QueryNormalizer[];
  postRetrievalFilter?: PostRetrievalFilter;
  postRetrievalRanker?: PostRetrievalRanker;
  postRetrievalDiversifier?: PostRetrievalDiversifier;
  postProcessor?: RetrievalPostProcessor;
  contextExpander?: ContextExpander;
  contextExpansionPolicy?: ContextExpansionPolicy;
  contextAssembler?: ContextAssembler;
}
```

兼容策略：

- 旧 `postProcessor` 暂时保留，作为 `result diversification` 后的最终裁剪兼容层。
- 默认链路应保持旧行为的基本口径：低分结果不会进入最终 `hits`，`limit/topK` 仍控制输出规模。
- 新 stage 不应改变检索前 filters、hybrid retriever 或 context expansion 的职责边界。

## 5. Result Filtering

第一阶段过滤器只做确定性、低成本判断。默认过滤原因建议收敛为稳定枚举：

```ts
type PostRetrievalFilterReason =
  | 'low-score'
  | 'duplicate-chunk'
  | 'duplicate-parent'
  | 'low-context-value'
  | 'unsafe-content'
  | 'conflict-risk';
```

默认策略：

- `low-score`：复用现有 `DEFAULT_RETRIEVAL_MIN_SCORE`。
- `duplicate-chunk`：相同 `chunkId` 只保留分数最高的一条。
- `duplicate-parent`：相同 `metadata.parentId` 可限制保留数量，默认优先高分。
- `low-context-value`：过滤目录、页眉页脚、版权声明、过短无事实内容等 chunk。
- `unsafe-content`：第一阶段只做最小正则规则，例如疑似 password/token/API key；命中时默认整段丢弃或脱敏，具体策略由实现明确。
- `conflict-risk`：第一阶段不做复杂事实冲突判断，只基于 `status`、`updatedAt`、`trustClass`、`sourceType` 标记风险或降权。

过滤器不负责生成最终排序，也不负责构造 prompt 字符串。

## 6. Result Ranking

默认 ranker 采用可解释的加权分数，不引入模型 provider。

推荐信号：

```text
finalRankScore =
  retrievalScore * 0.55
+ authorityScore * 0.15
+ recencyScore * 0.15
+ contextFitScore * 0.10
+ exactConstraintScore * 0.05
```

信号口径：

- `retrievalScore`：来自原始 `RetrievalHit.score`。
- `authorityScore`：按 `trustClass`、`sourceType`、`metadata.status` 计算。
- `recencyScore`：按 `updatedAt` 衰减；只有相关性接近时才应影响排序。
- `contextFitScore`：内容是否包含可回答事实、是否低噪声、长度是否适配上下文。
- `exactConstraintScore`：第一阶段仅用确定性文本匹配处理 query 中明确版本、年份或实体约束；后续可替换为 query analysis。

后续 reranker provider 的预留接口建议单独定义：

```ts
interface RetrievalRerankProvider {
  score(input: { query: string; hits: RetrievalHit[] }): Promise<Array<{ chunkId: string; alignmentScore: number }>>;
}
```

provider 只返回项目自定义 score，不返回第三方 SDK 原始对象。

## 7. Result Diversification

第一阶段 diversification 以 coverage 策略为主，不依赖 embedding。

默认策略：

- `maxPerSource`：同一 `sourceId` 最多进入最终候选的数量，默认 2。
- `maxPerParent`：同一 `metadata.parentId` 最多进入最终候选的数量，默认 1 或 2。
- `section coverage`：优先保留不同 `metadata.sectionId` / `metadata.sectionTitle` 的结果。
- `source coverage`：在分数差距较小时，允许不同来源的候选进入上下文。

执行原则：

- 多样化不能压过相关性。低分、低价值或不满足 filters 的内容不能为了覆盖率进入结果。
- 多样化只选择最终 `hits` 的组成，不负责 Small-to-Big expansion。
- Near-duplicate removal 第一阶段只按 chunk、parent、section/source coverage 处理；不做 embedding 相似度或 LLM 信息增量判断。

## 8. Diagnostics

扩展 `RetrievalDiagnostics`，新增 `postRetrieval`：

```ts
interface PostRetrievalDiagnostics {
  filtering: {
    enabled: boolean;
    beforeCount: number;
    afterCount: number;
    droppedCount: number;
    reasons: Partial<Record<PostRetrievalFilterReason, number>>;
  };
  ranking: {
    enabled: boolean;
    strategy: 'deterministic-signals';
    scoredCount: number;
    signals: string[];
  };
  diversification: {
    enabled: boolean;
    strategy: 'source-parent-section-coverage';
    beforeCount: number;
    afterCount: number;
    maxPerSource: number;
    maxPerParent: number;
  };
}
```

诊断信息只暴露数量、策略与原因汇总。第一阶段不暴露完整被丢弃内容，避免在 admin / logs 中二次泄露敏感文本。

## 9. 与六部语义的关系

- 户部：拥有 post-retrieval 主链，负责过滤、排序、多样化和 context assembly 输入。
- 刑部：后续提供 safety、policy、conflict-risk provider，但不直接拼接检索 pipeline。
- 吏部：根据 runtime profile、预算和任务风险决定是否启用 reranker / LLM judge。
- 礼部：消费最终 evidence、citation 与 diagnostics，组织交付说明。

`apps/backend/*/service` 只能通过 `@agent/knowledge` facade 或 runtime host 装配 post-retrieval 能力，不允许在 service 内手写过滤、排序和上下文拼接。

## 10. 第一阶段实现顺序

推荐按 TDD 推进：

1. Contract：补 stage interfaces、diagnostics 类型与 root export。
2. Red：新增 `run-knowledge-retrieval` 测试，证明 post-retrieval 链路在 context expansion 前执行。
3. Filter：实现默认过滤器，覆盖低分、chunk 去重、parent 去重、低价值内容。
4. Ranker：实现确定性 signals 排序，覆盖 trustClass、updatedAt、contextFit。
5. Diversifier：实现 source / parent / section coverage。
6. Pipeline：把三段 stage 接入 `runKnowledgeRetrieval()`，保留旧 `postProcessor` 兼容层。
7. Docs：更新 `docs/packages/knowledge/knowledge-retrieval-runtime.md`。

## 11. 验证入口

第一阶段至少补齐：

- `packages/knowledge/test/post-retrieval-filter.test.ts`
- `packages/knowledge/test/post-retrieval-ranker.test.ts`
- `packages/knowledge/test/post-retrieval-diversifier.test.ts`
- `packages/knowledge/test/run-knowledge-retrieval.test.ts`
- `packages/knowledge/test/root-exports.test.ts`

受影响范围验证：

```bash
pnpm --dir packages/knowledge exec vitest run test/post-retrieval-filter.test.ts test/post-retrieval-ranker.test.ts test/post-retrieval-diversifier.test.ts test/run-knowledge-retrieval.test.ts
pnpm exec tsc -p packages/knowledge/tsconfig.json --noEmit
pnpm check:docs
```

如果实现改动同时触达 workspace package export、root scripts 或跨包 contract，再按验证体系规范追加 affected spec / demo / integration。
