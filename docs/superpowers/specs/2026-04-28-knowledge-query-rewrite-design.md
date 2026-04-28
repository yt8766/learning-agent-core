# Knowledge Query Rewrite 设计文档

状态：snapshot
文档类型：plan
适用范围：`packages/knowledge`
最后核对：2026-04-28

**日期**：2026-04-28  
**范围**：`packages/knowledge` 检索前处理增强 — LLM 语义改写 + 多 normalizer 串联  
**不在此范围**：多变体检索执行、结果合并、后处理（retrieval 阶段单独设计）

---

## 背景

当前 `packages/knowledge` 的检索前处理（`DefaultQueryNormalizer`）采用纯规则式实现：

- 口语词正则替换（`咋` → `怎么` 等）
- 英文问题前缀剥除（`how do I`、`what is` 等）
- 规则式多变体生成（原始/归一化/关键词拼接）

这属于轻量 Query Rewrite，但无法处理语义层面的改写需求（如：`苹果 15 续航咋样` → `iPhone 15 的电池续航表现如何？`）。

目标是引入 LLM 语义改写能力，同时将 `RetrievalPipelineConfig` 的 `queryNormalizer` 升级为支持多个 normalizer 串联（数组配置）。

---

## 约束

- `packages/knowledge` 已依赖 `@agent/adapters`，而 `@agent/adapters` 也依赖 `@agent/knowledge`，存在循环依赖。因此 LLM 调用能力**不能**从 `@agent/adapters` 内直接引入，必须通过接口注入。
- LLM 调用失败（超时、限流等）时，静默降级到规则式 `DefaultQueryNormalizer` 结果，不中断检索流程。
- 现有 `QueryNormalizer` 接口签名不变（`normalize(request: RetrievalRequest): Promise<NormalizedRetrievalRequest>`），`NormalizedRetrievalRequest extends RetrievalRequest` 保证串联兼容性。

---

## 新增 & 改造内容

### 1. `QueryRewriteProvider` 接口（新增）

**位置**：`packages/knowledge/src/runtime/stages/query-rewrite-provider.ts`

```ts
export interface QueryRewriteProvider {
  rewrite(query: string): Promise<string>;
}
```

极简注入接口，调用方（`apps/backend` 或 `packages/runtime`）用项目 LLM 基础设施实现并注入。`packages/knowledge` 本身不引入任何 LLM 实现。

---

### 2. `LlmQueryNormalizer` 类（新增）

**位置**：`packages/knowledge/src/runtime/defaults/llm-query-normalizer.ts`

执行顺序：

1. 若传入 request 已有 `normalizedQuery`（即已被前置 normalizer 处理过），直接用该值作为改写输入；否则先调用 `fallback`（默认 `DefaultQueryNormalizer`）做规则清洗，得到 `normalizedQuery`
2. 对 `normalizedQuery` 调用 `rewriteProvider.rewrite()`
3. LLM 改写成功：覆盖 `normalizedQuery`，重建 `queryVariants`，设 `rewriteApplied: true`
4. LLM 改写失败（任意异常）：静默捕获，返回第 1 步的结果

```ts
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

`buildQueryVariants` 复用 `default-query-normalizer.helpers.ts` 中的已有实现。

---

### 3. `RetrievalPipelineConfig` 改造（已有接口）

**位置**：`packages/knowledge/src/contracts/knowledge-retrieval-runtime.ts`

```ts
// 改造前
queryNormalizer?: QueryNormalizer;

// 改造后
queryNormalizer?: QueryNormalizer | QueryNormalizer[];
```

---

### 4. 串联执行机制（`runKnowledgeRetrieval` 改造）

**位置**：`packages/knowledge/src/runtime/pipeline/run-knowledge-retrieval.ts`

新增 `resolveNormalizerChain` 工具函数，将配置归一化为单一 `QueryNormalizer`：

```ts
function resolveNormalizerChain(config: QueryNormalizer | QueryNormalizer[] | undefined): QueryNormalizer {
  if (!config) return new DefaultQueryNormalizer();
  if (!Array.isArray(config)) return config;
  if (config.length === 0) return new DefaultQueryNormalizer(); // 空数组防御
  if (config.length === 1) return config[0];
  return {
    normalize: async request => {
      let result = await config[0].normalize(request);
      for (const normalizer of config.slice(1)) {
        result = await normalizer.normalize(result);
      }
      return result;
    }
  };
}
```

原有 `pipeline.queryNormalizer ?? new DefaultQueryNormalizer()` 替换为 `resolveNormalizerChain(pipeline.queryNormalizer)`。

---

### 5. 根 `index.ts` 导出（已有文件）

新增导出：

- `QueryRewriteProvider`（接口）
- `LlmQueryNormalizer`（类）

---

## 可组合性原则

`queryNormalizer` 是完全开放的扩展点：

- SDK 提供默认实现（`DefaultQueryNormalizer`、`LlmQueryNormalizer`），开箱可用
- 使用者可以实现自己的 `QueryNormalizer`，完全替换默认实现
- 使用者可以将自己的实现与 SDK 默认实现**任意组合**，通过数组配置串联
- 传入空数组 `[]` 时，回退到 `DefaultQueryNormalizer`（防御性处理）
- 链中每一步都符合同一接口（`QueryNormalizer`），顺序由使用者控制

---

## 典型使用方式

### 场景 A：仅使用规则式（不变，兼容）

```ts
const pipeline = {}; // 无配置，默认 DefaultQueryNormalizer
```

### 场景 B：单独使用 LLM 改写（内置 fallback 到规则）

```ts
const pipeline = {
  queryNormalizer: new LlmQueryNormalizer(new MyRewriteProvider())
};
```

### 场景 C：显式串联规则 + LLM（避免重复运行）

```ts
// LlmQueryNormalizer 检测到传入 request 已有 normalizedQuery，
// 跳过内置 fallback，直接对上一步结果做 LLM 改写
const pipeline = {
  queryNormalizer: [new DefaultQueryNormalizer(), new LlmQueryNormalizer(new MyRewriteProvider())]
};
```

### 场景 D：用户自定义实现，替换全部默认

```ts
class MyCustomNormalizer implements QueryNormalizer {
  async normalize(request: RetrievalRequest): Promise<NormalizedRetrievalRequest> {
    // 完全自定义逻辑
    return { ...request, normalizedQuery: myLogic(request.query), topK: 5, rewriteApplied: false };
  }
}

const pipeline = { queryNormalizer: new MyCustomNormalizer() };
```

### 场景 E：用户自定义 + SDK 默认混合串联

```ts
// 先走用户自己的领域专属改写，再走 LLM 语义改写
const pipeline = {
  queryNormalizer: [
    new MyDomainNormalizer(), // 用户自己实现
    new LlmQueryNormalizer(new MyRewriteProvider()) // SDK 默认实现
  ]
};
```

```ts
class BackendQueryRewriteProvider implements QueryRewriteProvider {
  constructor(private readonly llm: SomeLlmClient) {}

  async rewrite(query: string): Promise<string> {
    const result = await this.llm.generateText(
      `将以下用户问题改写为更适合知识库检索的标准表达，保持核心意图不变，只输出改写结果：\n${query}`
    );
    return result.text.trim();
  }
}
```

---

## 诊断字段

`RetrievalDiagnostics` 现有字段无需修改：

- `rewriteApplied: boolean` — 链中最后一步是否发生了改写
- `rewriteReason?: string` — 最后一步的改写原因（`'llm-semantic-rewrite'` 或规则名）
- `normalizedQuery: string` — 最终改写后的 query

链条中间步骤的诊断信息不单独保留（YAGNI），如后续需要可在 `RetrievalDiagnostics` 增加 `normalizerChain` 字段。

---

## 文件变更清单

| 操作 | 文件路径                                                             |
| ---- | -------------------------------------------------------------------- |
| 新增 | `packages/knowledge/src/runtime/stages/query-rewrite-provider.ts`    |
| 新增 | `packages/knowledge/src/runtime/defaults/llm-query-normalizer.ts`    |
| 改造 | `packages/knowledge/src/contracts/knowledge-retrieval-runtime.ts`    |
| 改造 | `packages/knowledge/src/runtime/pipeline/run-knowledge-retrieval.ts` |
| 改造 | `packages/knowledge/src/index.ts`                                    |

---

## 测试要求

- `LlmQueryNormalizer`：单元测试覆盖正常改写、LLM 失败 fallback、空 query 边界
- `resolveNormalizerChain`：单元测试覆盖 undefined/单个/数组三种配置
- `RetrievalPipelineConfig` schema parse 回归（如有 Zod schema 的地方）
- 现有 `default-query-normalizer.test.ts` 和 `run-knowledge-retrieval.test.ts` 不应破坏

---

_EOF_
