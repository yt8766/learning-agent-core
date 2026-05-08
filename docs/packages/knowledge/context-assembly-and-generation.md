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
  - 默认把 hits 拼成 `[N] title\ncontent`，并在传入 `contextAssemblyOptions.budget` 时按近似 token 预算做确定性截断或丢弃。
- `packages/knowledge/src/rag/retrieval/rag-retrieval-runtime.ts`
  - 从 planner plan 构造 retrieval request，默认 `assembleContext: true`，并把 `plan.strategyHints.contextBudgetTokens` 传入 context assembly options。
- `packages/knowledge/src/rag/answer/rag-answer-runtime.ts`
  - 将 `retrieval.contextBundle`、citations、query 和 metadata 传给 answer provider，并做 no-answer / grounded citation 校验。
- `apps/backend/agent-server/src/domains/knowledge/rag/knowledge-rag-sdk.providers.ts`
  - 后端 Knowledge domain 把 SDK answer provider input 转成 chat messages，优先消费 `input.contextBundle`，空 bundle 时才 fallback 到 citations 拼接。

## 已收敛行为

### 1. `contextBudgetTokens` 已进入 context assembly

`KnowledgeRagPolicy.contextBudgetTokens` 会进入 planner 的 `strategyHints`，再由 `RagRetrievalRuntime` 合并到 `RetrievalPipelineConfig.contextAssemblyOptions.budget.maxContextTokens`。`runKnowledgeRetrieval()` 会把该 options 传给 `ContextAssembler`。

当前默认实现使用近似 token 估算：

- `DefaultContextAssembler` 以 `4 chars ~= 1 token` 粗略估算。
- 预算不足时优先截断当前 hit；剩余空间太小时丢弃当前和后续 hits。
- 该策略不会改写 `originalQuery` 或 `normalizedQuery`。

### 2. Top-K 与 prompt 长度已分层处理

`DefaultRetrievalPostProcessor` 仍负责 `score > minScore` 和 `slice(0, request.topK)`，只决定候选数量。最终 prompt 长度由 context assembly budget 继续约束。

这保留了两个独立语义：

- `retrievalTopK`：检索后最多保留多少 candidates。
- `contextBudgetTokens`：最终交给模型的 context bundle 预算。

### 3. `ContextAssembler` 已支持结构化结果

当前接口支持 options 与兼容旧 string 返回：

```ts
assemble(
  hits: RetrievalHit[],
  request: NormalizedRetrievalRequest,
  options?: ContextAssemblyOptions
): Promise<string | ContextAssemblyResult>;
```

`ContextAssemblyResult.diagnostics` 进入 `RetrievalDiagnostics.contextAssembly`，包含 `strategy`、`budgetTokens`、`estimatedTokens`、`selectedHitIds`、`droppedHitIds`、`truncatedHitIds` 与 `orderingStrategy`。

### 4. Generation 已优先消费 `contextBundle`

`RagAnswerRuntime` 会把 `retrieval.contextBundle` 传给 `KnowledgeAnswerProviderInput`。`apps/backend/agent-server/src/domains/knowledge/rag/knowledge-rag-sdk.providers.ts` 的 `buildSdkChatMessages()` 现在优先注入 `input.contextBundle.trim()`；只有 bundle 为空时，才 fallback 到 citations quote。

因此，自定义 `ContextAssembler` 能影响最终发给模型的 context。citations 继续用于 grounding、引用校验与 UI 展示，不再隐式替代 contextBundle。

### 5. 上下文组装诊断已可观测

`RetrievalDiagnostics` 现在包含：

- `contextAssembled`
- `contextAssembly.strategy`
- `contextAssembly.budgetTokens`
- `contextAssembly.estimatedTokens`
- `contextAssembly.selectedHitIds`
- `contextAssembly.droppedHitIds`
- `contextAssembly.truncatedHitIds`
- `contextAssembly.orderingStrategy`

后续 agent-admin / Chat Lab 可以基于这些字段解释“为什么没用某条资料”或“为什么回答依据不足”。

## 剩余风险

- 当前预算仍是近似 token 估算，不是 provider tokenizer 精确计数。
- 当前 `orderingStrategy` 仍是 `ranked`。长上下文模型头尾敏感位置重排还没有作为独立 `ContextOrderingStrategy` 暴露。
- `ContextAssemblyOptions.budget` 目前只接收总 context 预算和已知 reserved tokens；更完整的 system/query/history/output buffer 预算口径还需要由上层 runtime 或 model profile 继续补齐。

## 收敛建议

下一阶段建议：

1. **把 prompt ordering 独立成策略**：在 post-process / context assembly 之间增加 `ContextOrderingStrategy` 或扩展 assembler options，避免把“检索相关性排序”和“prompt 位置编排”混在一个 ranker 里。
2. **接入 provider tokenizer 或 model profile token estimator**：替代当前 `4 chars ~= 1 token` 的粗估。
3. **把 context assembly diagnostics 投影到 Chat Lab / Runtime Center**：让使用者看到 selected / dropped / truncated 与预算命中情况。
4. **补充 history/system/output buffer 预算来源**：让 context assembly 可以消费完整 prompt budget，而不是只使用 retrieval context 总预算。

## 后续改动约束

- `buildPromptContext` / `ContextAssembler` 属于 post-retrieval/context assembly，不应发起大模型生成。
- `generate` / `stream` 属于 generation，不应重新选择 candidates 或绕过 `contextBundle` 自己拼另一套上下文。
- citations 是 grounding 和 UI 展示 contract；contextBundle 是模型参考材料 contract。两者可以来源一致，但不能在 generation 端隐式替代彼此。
- 预算策略必须可观测；只做静默截断会让 Chat Lab 和 Runtime Center 无法解释回答质量。
