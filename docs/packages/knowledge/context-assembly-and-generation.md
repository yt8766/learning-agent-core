# knowledge 上下文组装与生成审计

状态：current
文档类型：architecture
适用范围：`packages/knowledge`、`apps/backend/agent-server/src/domains/knowledge`
最后核对：2026-05-08（参考《02. 上下文组装与生成.pptx》）

## 参考结论

参考材料把 RAG 在线链路拆成两个容易混淆但必须分开的阶段：

- **Post-Retrieval / Context Assembly**：拿到已选好的 candidates 后，决定最终交给模型参考的资料长什么样。这里负责 token 预算执行、Top-K、长内容裁剪或压缩、长上下文重排，以及把片段拼成 prompt-ready context。
- **Generation**：真正调用大模型，输入用户问题、上下文材料、输出格式要求和生成参数，并返回 answer / usage / provider metadata。

上下文窗口管理至少要显式处理这些问题：

- token 预算怎么分：system、query、history、output buffer、retrieval context 各占多少。
- candidates 选多少条：Top-K 不能只按检索命中数，还要受上下文预算约束。
- 太长内容怎么处理：优先压缩或裁剪历史、检索资料等可替代部分；不到万不得已不改写用户原始 query。
- 排列顺序怎么定：长上下文模型不保证对所有位置同等敏感，高分资料可以按策略放在头尾等更敏感位置，而不是机械按 score 直排。

## 当前真实实现

`packages/knowledge` 已经有分层雏形：

```text
pre-retrieval planner
  -> runKnowledgeRetrieval()
  -> post-retrieval filter / rank / diversify
  -> RetrievalPostProcessor
  -> ContextExpander
  -> ContextAssembler
  -> RagAnswerRuntime / streamKnowledgeRag generation
```

关键入口：

- `packages/knowledge/src/runtime/pipeline/run-knowledge-retrieval.ts`
  - 负责 query normalization、检索、merge、post-retrieval、post-process、context expansion 和可选 context assembly。
- `packages/knowledge/src/runtime/defaults/default-context-assembler.ts`
  - 当前默认只把 hits 拼成 `[N] title\ncontent`，没有 token budget、裁剪、压缩或重排。
- `packages/knowledge/src/rag/retrieval/rag-retrieval-runtime.ts`
  - 从 planner plan 构造 retrieval request，并默认 `assembleContext: true`。
- `packages/knowledge/src/rag/answer/rag-answer-runtime.ts`
  - 将 `retrieval.contextBundle`、citations、query 和 metadata 传给 answer provider，并做 no-answer / grounded citation 校验。
- `apps/backend/agent-server/src/domains/knowledge/rag/knowledge-rag-sdk.providers.ts`
  - 后端 Knowledge domain 把 SDK answer provider input 转成 chat messages，实际发起大模型回答。

## 不合理处

### 1. `contextBudgetTokens` 目前没有真正生效

`KnowledgeRagPolicy.contextBudgetTokens` 在默认策略里设置为 `4000`，但当前 retrieval pipeline 没有把它传入 `ContextAssembler` 或 post-processor；`DefaultContextAssembler` 也不接收预算。结果是：即使 policy 声明了上下文预算，实际 contextBundle 仍可能随 chunk 内容膨胀。

风险：

- 长文档或 Small-to-Big expansion 后容易把 prompt 撑爆。
- 上层只能看到 `contextChunkCount`，看不到 context token / char 是否接近模型窗口。

### 2. Top-K 与 prompt 长度脱节

`DefaultRetrievalPostProcessor` 当前只执行 `score > minScore` 和 `slice(0, request.topK)`。这符合“选多少条 candidates”的最小语义，但没有结合每条 chunk 长度或总预算。

风险：

- 5 条很长 chunk 比 20 条短 chunk 更容易超预算，但当前策略无法区分。
- 业务上调整 `retrievalTopK` 时，可能误以为已经控制了上下文长度。

### 3. `ContextAssembler` 接口太薄

当前接口是：

```ts
assemble(hits: RetrievalHit[], request: NormalizedRetrievalRequest): Promise<string>;
```

它缺少预算、模型窗口、预留输出空间、query/history/system 占用、截断诊断等输入输出。参考材料里的 `buildPromptContext` 插槽应当是“可自定义最终上下文拼接方式”，但 SDK 默认实现仍要负责预算执行和诊断。

建议后续扩展为项目自有 contract，例如：

```ts
interface PromptContextBudget {
  maxContextTokens: number;
  reservedOutputTokens: number;
  systemTokens?: number;
  queryTokens?: number;
  historyTokens?: number;
}

interface ContextAssemblyResult {
  contextBundle: string;
  selectedHitIds: string[];
  droppedHitIds: string[];
  truncatedHitIds: string[];
  diagnostics: {
    budgetTokens: number;
    estimatedTokens: number;
    strategy: string;
  };
}
```

### 4. Generation 端没有稳定消费 `contextBundle`

`RagAnswerRuntime` 会把 `retrieval.contextBundle` 传给 `KnowledgeAnswerProviderInput`，但 backend 的 `buildSdkChatMessages()` 当前重新用 `input.citations` 拼 `Context citations`，没有消费 `input.contextBundle`。

这会让 retrieval runtime 的 `ContextAssembler` 插槽失去实际影响：即使调用方注入自定义 contextBundle，当前后端生成消息也仍按 citation quote 重新拼接。

### 5. 缺少上下文组装诊断

现有 diagnostics 有 `contextAssembled`、`contextExpansion`、post-retrieval filtering/ranking/diversification，但没有：

- context budget
- estimated context tokens / chars
- selected / dropped / truncated hit ids
- hit ordering strategy
- query/history/system/output buffer 的预算口径

这会影响 agent-admin / Chat Lab 对 “为什么没用某条资料” 或 “为什么回答依据不足” 的排障。

### 6. 长上下文重排还没有作为独立策略暴露

当前 `DefaultPostRetrievalRanker` 和 `DefaultPostRetrievalDiversifier` 已能排序与多样化，但缺少“prompt position ordering”阶段。参考材料里提到的把重要资料放在长上下文敏感位置，应该与 retrieval rank 分开：rank 决定候选优先级，prompt ordering 决定进入上下文后的排列位置。

## 收敛建议

优先级建议如下：

1. **先让 `contextBudgetTokens` 进入 context assembly contract**：从 RAG policy 传到 `RagRetrievalRuntime` / `runKnowledgeRetrieval`，默认 assembler 至少按字符或估算 token 做硬上限裁剪，并返回 diagnostics。
2. **让 backend generation 消费 `input.contextBundle`**：`buildSdkChatMessages()` 应优先使用 `contextBundle`，citations 用作 grounding 与展示引用，不再重复绕过 assembler。
3. **把 `ContextAssembler` 从 string-only 升级为 result object**：保留 thin compat 时要标注过渡态，并让 diagnostics 进入 `KnowledgeRagRetrievalResult.diagnostics`。
4. **把 prompt ordering 独立成策略**：在 post-process / context assembly 之间增加 `ContextOrderingStrategy` 或扩展 assembler options，避免把“检索相关性排序”和“prompt 位置编排”混在一个 ranker 里。
5. **补最小回归测试**：覆盖长 chunk 被裁剪、预算不足时保留原始 query、contextBundle 被 generation 消费、诊断字段可见。

## 后续改动约束

- `buildPromptContext` / `ContextAssembler` 属于 post-retrieval/context assembly，不应发起大模型生成。
- `generate` / `stream` 属于 generation，不应重新选择 candidates 或绕过 `contextBundle` 自己拼另一套上下文。
- citations 是 grounding 和 UI 展示 contract；contextBundle 是模型参考材料 contract。两者可以来源一致，但不能在 generation 端隐式替代彼此。
- 预算策略必须可观测；只做静默截断会让 Chat Lab 和 Runtime Center 无法解释回答质量。
