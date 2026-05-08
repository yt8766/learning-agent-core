# 上下文组装与生成链路

状态：current
文档类型：architecture
适用范围：packages/runtime, packages/knowledge, agents/data-report, apps/backend/agent-server
最后核对：2026-05-08（参考《02. 上下文组装与生成.pptx》）

## 1. 这篇文档解决什么问题

这篇文档把“上下文组装”和“生成”拆开，作为后续 RAG、Agent 主链、报表生成和后台观测的共同边界。

参考材料的核心结论是：

- **Context Window Management** 是每轮 query 都要执行的预算动作，而不是模型报错后的补救动作。
- **Post-Retrieval / Context Assembly** 负责把已经选出的 candidates 变成 prompt-ready context，包括 token 预算、Top-K、长内容裁剪或压缩、长上下文重排。
- **Generation** 负责真正调用大模型，不应该重新选择 candidates，也不应该绕过上游已经组装好的 context。
- 原始用户 query 优先级最高；超预算时应先压缩历史会话、检索资料或其他可替代内容，不到万不得已不改写用户原始 query。
- citations 和 contextBundle 不是同一个 contract：citations 面向 grounding / UI 展示，contextBundle 面向模型参考材料。二者可以同源，但不能在 generation 端互相隐式替代。

## 2. 当前真实实现

当前仓库里存在三条相关链路：

### 2.1 Knowledge RAG 链路

主入口在 `packages/knowledge`：

```text
pre-retrieval planner
  -> runKnowledgeRetrieval()
  -> post-retrieval filter / rank / diversify
  -> RetrievalPostProcessor
  -> optional ContextExpander
  -> ContextAssembler
  -> RagAnswerRuntime / streamKnowledgeRag generation
```

关键文件：

- `packages/knowledge/src/runtime/pipeline/run-knowledge-retrieval.ts`
  - 负责 query normalization、query variants、search、merge、post-retrieval、context expansion 和可选 context assembly。
- `packages/knowledge/src/runtime/stages/context-assembler.ts`
  - 接口支持 `assemble(hits, request, options)`，可返回旧 string 或结构化 `{ contextBundle, diagnostics }`。
- `packages/knowledge/src/runtime/defaults/default-context-assembler.ts`
  - 默认把 hits 拼为 `[N] title\ncontent`，并在 budget 存在时按近似 token 预算截断或丢弃。
- `packages/knowledge/src/rag/retrieval/rag-retrieval-runtime.ts`
  - 从 planner plan 构造 retrieval request，默认 `assembleContext: true`，并把 `strategyHints.contextBudgetTokens` 传入 context assembly。
- `packages/knowledge/src/rag/answer/rag-answer-runtime.ts`
  - 把 `retrieval.contextBundle`、citations 和 query 传给 answer provider。
- `apps/backend/agent-server/src/domains/knowledge/rag/knowledge-rag-sdk.providers.ts`
  - `buildSdkChatMessages()` 优先消费 `input.contextBundle`，空 bundle 时才 fallback 到 citations。

更细的 package 审计见 [knowledge 上下文组装与生成审计](/docs/packages/knowledge/context-assembly-and-generation.md)。

### 2.2 Runtime / Agent 主链上下文兜底

`packages/runtime` 和 agent runtime 已经有“模型上下文过大后压缩重试”的应急能力，例如：

- `packages/runtime/src/graphs/main/tasking/context/main-graph-task-context.ts`
- `packages/adapters/src/resilience/reactive-context-retry.ts`
- `agents/coder/src/utils/reactive-context-retry.ts`
- `agents/reviewer/src/utils/reactive-context-retry.ts`

这些能力更接近 **post-failure reactive compression**，不是完整的每轮预算分配器。后续不要把它们误当作 Context Assembly 的主 contract；它们应作为防线之一，不能替代检索后的预算执行和可观测诊断。

### 2.3 Data Report 生成链路

`agents/data-report` 主要处理报告 JSON / report bundle 的生成：

- `agents/data-report/src/flows/report-bundle/generate/runtime.ts`
- `agents/data-report/src/flows/data-report-json/runtime*.ts`
- `agents/data-report/src/flows/data-report-json/prompts/*`

这条链路的“上下文”更多来自 report schema、runtime lane、page spec、patch lane 和 sandbox preview。它不是 Knowledge RAG 的 retrieval context，但同样应遵守两个边界：

- prompt 上下文组装应落在 flow/runtime 的确定性拼装层，不要散落在 backend service。
- generation 节点只消费已经组装好的 prompt/context/schema，不再自行重建另一套资料筛选逻辑。

## 3. 边界与约束

### 3.1 Context Assembly 不调用模型生成

Context Assembly 可以做确定性排序、裁剪、压缩摘要选择、引用格式化和 prompt-ready 拼装。除非明确新增独立的 compression provider contract，否则默认不在 assembler 内直接调用回答模型。

### 3.2 Generation 不绕过 contextBundle

Generation provider 应优先消费上游传入的 contextBundle。citations 用于 grounding、引用投影和 UI 展示；当前 backend knowledge generation 已按该边界执行。

### 3.3 Top-K 不等于 token 预算

Top-K 只控制候选数量。长 chunk、small-to-big expansion 和多来源引用会让相同 K 值产生完全不同的 prompt 长度。当前 Knowledge RAG 已把 `contextBudgetTokens` 传入 context assembly，并在 diagnostics 暴露 selected / dropped / truncated。

### 3.4 排序要拆成两个概念

Retrieval ranking 决定候选优先级；prompt ordering 决定候选进入长上下文窗口后的位置。长上下文模型对不同位置的敏感度不一定相同，后续应该把 prompt ordering 作为独立策略或 assembler option，而不是继续塞进 ranker。

### 3.5 原始 query 是高优先级输入

预算不足时，优先压缩历史、检索资料、工具观测摘要等可替代上下文。只有在明确的 query normalization / rewrite 阶段，才能产生 rewritten query；不要在预算兜底里静默改写原始用户问题。

## 4. 验证与回归风险

当前实现已经覆盖这些回归点：

- 长 chunk 或 small-to-big expansion 后，`contextBudgetTokens` 能限制最终 contextBundle。
- Top-K 命中数量相同但 chunk 长度不同时，diagnostics 能解释 selected / dropped / truncated。
- Generation provider 的 chat messages 优先包含 `input.contextBundle`，而不是重新只按 citations 拼装。
- 无可用上下文时，no-answer policy 仍稳定返回“依据不足”，且 citations 不被模型输出伪造。
- Chat Lab / Runtime Center / Observability 能看到 context assembly 的预算、估算 token、截断和 ordering 策略。

文档 stale scan 至少检索：

```bash
rg -n "contextBudgetTokens.*没有真正生效|没有稳定消费 `contextBundle`|重新用 `input.citations`|assembler 插槽失去实际影响|DefaultContextAssembler.*没有预算|ContextAssembler.*string-only|prompt ordering|长上下文重排" docs packages/knowledge apps/backend/agent-server
```

允许保留的命中只能是历史计划，或“剩余风险：prompt ordering 仍是 ranked，长上下文头尾重排仍是后续增强”。

纯文档更新执行 `pnpm check:docs`；涉及 `packages/knowledge` 代码时按 [验证体系规范](/docs/packages/evals/verification-system-guidelines.md) 追加受影响测试，优先包含：

- `pnpm exec vitest run packages/knowledge/test/run-knowledge-retrieval.test.ts`
- `pnpm exec vitest run packages/knowledge/test/rag-retrieval-runtime.test.ts`
- `pnpm exec vitest run packages/knowledge/test/run-knowledge-rag.test.ts`
- `pnpm exec vitest run packages/knowledge/test/stream-knowledge-rag.test.ts`
- `pnpm exec vitest run apps/backend/agent-server/test/knowledge-domain/knowledge-rag-sdk.providers.spec.ts`
- `pnpm exec tsc -p packages/knowledge/tsconfig.json --noEmit`

## 5. 继续阅读

- [knowledge 上下文组装与生成审计](/docs/packages/knowledge/context-assembly-and-generation.md)
- [Knowledge Retrieval Runtime](/docs/packages/knowledge/knowledge-retrieval-runtime.md)
- [Knowledge SDK RAG Rollout](/docs/integration/knowledge-sdk-rag-rollout.md)
- [Runtime Interrupts](/docs/packages/runtime/runtime-interrupts.md)
- [Data Report package structure guidelines](/docs/agents/data-report/package-structure-guidelines.md)
