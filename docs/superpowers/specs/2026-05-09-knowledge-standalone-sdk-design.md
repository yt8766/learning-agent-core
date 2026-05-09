# Knowledge Standalone SDK Design

状态：draft
文档类型：spec
适用范围：`packages/knowledge`
最后核对：2026-05-09

## 背景

`@agent/knowledge` 正在演进为可独立发布的 RAG SDK，但当前 package manifest 仍直接依赖 `@agent/config`、`@agent/core`、`@agent/memory`，源码中还存在对 `@agent/adapters` 的懒加载。这会让 SDK 无法脱离 monorepo 发布，也让知识检索边界继续反向绑定仓库内部 runtime、config、memory 与 adapter 实现。

本设计把 `@agent/knowledge` 的目标边界收紧为：整个包根入口和所有 public subpath 都不能依赖任何 `@agent/*` workspace 包。仓库内部仍可以使用 knowledge SDK，但必须在调用方或宿主 wiring 层完成适配。

## 目标

- `packages/knowledge/package.json` 不再声明任何 `@agent/*` 依赖。
- `packages/knowledge/src/**` 不再 import 或 dynamic import 任何 `@agent/*` 包。
- `@agent/knowledge`、`@agent/knowledge/core`、`@agent/knowledge/node`、`@agent/knowledge/adapters/*` 都能作为独立 SDK surface 理解。
- Knowledge indexing、retrieval、RAG、local ingestion 与 SDK provider contract 仍由 `@agent/knowledge` 承载。
- 仓库内部对 config、memory vector repository、runtime embedding provider 的连接下沉到 backend/runtime/platform 的 host adapter。

## 非目标

- 不重写 RAG retrieval pipeline。
- 不改变现有 Knowledge HTTP API。
- 不新增 `@agent/knowledge-host` workspace 包。
- 不新增新的 vector database 或 provider SDK。
- 不把完整 memory/evidence 领域迁入 knowledge，只迁入 knowledge SDK 所需的最小结构契约。
- 不把最终回答生成并入 `@agent/knowledge` 默认链路。

## 推荐方案

采用“彻底 SDK 化 `@agent/knowledge`，宿主适配外移”的方案。

`@agent/knowledge` 只拥有 SDK 自身的 schema、type、provider interface、indexing/retrieval runtime、local ingestion facade 与官方可选 adapter。所有 monorepo 内部依赖关系反转为：`@agent/memory`、backend 或 runtime 消费 `@agent/knowledge` 的 SDK contract，而不是 knowledge 消费这些内部包。

不采用“只清 manifest、源码保留 compat”的方案，因为它会留下隐性 monorepo 边界，后续依赖很容易长回去。不采用“新增 `@agent/knowledge-host` 包”的方案，因为当前 host glue 规模还不足以值得新增 workspace 包；先放在实际调用方宿主内更轻。

## 当前耦合点

当前需要清理的 `@agent/*` 耦合分为四类：

- `@agent/memory`
  - `KnowledgeVectorDocumentRecord`
  - `KnowledgeVectorIndexWriter`
  - `EvidenceRecord`
- `@agent/config`
  - `loadSettings()` 和由它推导的 runtime settings 类型
- `@agent/core`
  - `BudgetStateSchema`
  - `EvaluationResultSchema`
  - `LearningConflict*Schema`
  - `LearningEvaluation*Schema`
  - `SkillGovernanceRecommendationSchema`
- `@agent/adapters`
  - `local-knowledge-store.helpers.ts` 中懒加载 `createRuntimeEmbeddingProvider`

## Contract 设计

### Knowledge Vector Writer

`KnowledgeVectorDocumentRecord` 与 `KnowledgeVectorIndexWriter` 是 knowledge indexing pipeline 的输出 contract，应迁到 `packages/knowledge/src/contracts/indexing/`：

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

`runKnowledgeIndexing()` 继续要求调用方传入 `vectorIndex`，但该类型来自 `@agent/knowledge`。`@agent/memory` 的 vector repository 可实现这个接口。

### Knowledge Evidence Helper

Knowledge 侧 helper 不需要完整 memory evidence contract。新增最小结构类型：

```ts
export interface KnowledgeEvidenceRecord {
  sourceType: string;
  sourceUrl?: string;
  trustClass: string;
  summary: string;
}
```

`mergeEvidence()`、`inferTrustClass()`、`isCitationEvidenceSource()` 改用 `KnowledgeEvidenceRecord` 或 `Pick<KnowledgeEvidenceRecord, ...>`。`@agent/memory` 的完整 `EvidenceRecord` 仍可结构兼容传入，但 knowledge 不依赖 memory。

### Local Knowledge Settings

`local-knowledge-store` 不再接受 `ReturnType<typeof loadSettings>`。定义 SDK 自有最小 settings：

```ts
export interface LocalKnowledgeStoreSettings {
  workspaceRoot: string;
  knowledgeRoot: string;
  tasksStateFilePath?: string;
  embeddings?: {
    provider: string;
    model: string;
    apiKey?: string;
  };
}
```

`tasksStateFilePath` 仅用于默认 `wenyuanRoot` 推断；缺省时可由 SDK 使用稳定 fallback，例如 `${workspaceRoot}/data/tasks`. 宿主如果要保持旧路径，必须显式传入。

### Local Embedding Provider

删除 knowledge 内部对 `@agent/adapters` 的懒加载。新增可注入 provider：

```ts
export interface LocalKnowledgeEmbeddingProvider {
  provider: string;
  model: string;
  embedQuery(content: string): Promise<number[]>;
}
```

`embedChunk()` 使用传入 provider 生成 ready embedding。未传入 provider 时，写入 failed embedding receipt，`failureReason` 为 `missing_embedding_provider`。如果保留 `embeddings.apiKey` 字段，只用于宿主 adapter 自己判断，不由 SDK 内部创建 provider。

### Learning / Eval / Budget Re-export

`@agent/knowledge` 不再 re-export `@agent/core` 的 learning/eval/budget schema 或 type。知识 SDK 只保留知识领域 contract。仍需要这些 contract 的仓库内部调用方，应直接从其真实宿主导入。

## Host Adapter 设计

仓库内部调用方负责把 monorepo runtime 能力适配为 SDK contract。推荐先放在当前 backend knowledge runtime 宿主：

```text
apps/backend/agent-server/src/runtime/knowledge/
  knowledge-settings.adapter.ts
  knowledge-vector-writer.adapter.ts
  knowledge-embedding-provider.adapter.ts
```

职责：

- `knowledge-settings.adapter.ts`
  - 从 `@agent/config` settings 映射为 `LocalKnowledgeStoreSettings`
- `knowledge-vector-writer.adapter.ts`
  - 用 `@agent/memory` 的 vector repository 实现 `KnowledgeVectorIndexWriter`
- `knowledge-embedding-provider.adapter.ts`
  - 用当前 runtime embedding provider 或 `@agent/adapters` factory 适配为 `LocalKnowledgeEmbeddingProvider`

如果后续 runtime/platform 也需要复用同一 host adapter，再评估是否抽成真实宿主包；本轮不新增包。

## 数据流

### Indexing

```text
Loader
  -> Chunker
  -> runKnowledgeIndexing()
  -> KnowledgeSourceIndexWriter optional
  -> KnowledgeFulltextIndexWriter optional
  -> KnowledgeVectorIndexWriter from @agent/knowledge contract
  -> host implementation, such as @agent/memory vector repository
```

### Local Ingestion

```text
Host settings
  -> backend adapter maps to LocalKnowledgeStoreSettings
  -> ingestLocalKnowledge()
  -> local source/chunk/receipt snapshot
  -> optional LocalKnowledgeEmbeddingProvider
  -> embedding record ready or failed
```

### Runtime / Backend

```text
backend/runtime/platform
  -> owns config, credentials, memory repositories, provider factories
  -> injects SDK-owned interfaces into @agent/knowledge
  -> exposes existing HTTP facade unchanged
```

## Compatibility Strategy

- 保持 `runKnowledgeIndexing()`、`ingestLocalKnowledge()`、`readKnowledgeOverview()`、`listKnowledgeArtifacts()`、`buildKnowledgeDescriptor()` 的函数名。
- 参数类型从仓库 settings 类型切换为 SDK settings interface；调用方通过 adapter 映射。
- `KnowledgeVectorDocumentRecord` 字段保持与当前 memory 版本结构一致，避免 vector repository 实现大改。
- 删除 `@agent/core` learning/eval/budget re-export，不在 knowledge 内保留 compat 转发。
- 文档明确 `@agent/memory` 可以实现 knowledge SDK writer，但 writer contract 主定义归 `@agent/knowledge`。

## Testing and Verification

新增或调整验证：

- `packages/knowledge/test/package-boundary.test.ts`
  - 读取 `packages/knowledge/package.json`，断言 dependencies / devDependencies / peerDependencies / optionalDependencies 中没有 `@agent/*`。
  - 扫描 `packages/knowledge/src/**/*.ts`，断言没有 `from '@agent/`、`from "@agent/` 或 `import('@agent/`。
- 更新 indexing/local ingestion 相关单测，改为从 `@agent/knowledge` 导入 `KnowledgeVectorDocumentRecord` / `KnowledgeVectorIndexWriter`。
- 更新 backend/runtime adapter 单测或 typecheck，证明 host adapter 能继续连接 config、memory 与 embedding provider。

交付前验证命令按受影响范围选择：

```bash
pnpm --filter @agent/knowledge typecheck
pnpm --filter @agent/knowledge test
pnpm --filter @agent/knowledge build:lib
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

如修改了 workspace 依赖图或 lockfile，还需确认 `pnpm-lock.yaml` 已同步，并检查 `@agent/knowledge` importer 不再包含任何 `@agent/*` workspace dependency。

## Documentation Impact

需要同步更新：

- `docs/packages/knowledge/README.md`
- `docs/packages/knowledge/sdk-architecture.md`
- `docs/packages/knowledge/indexing-package-guidelines.md`
- `docs/packages/knowledge/indexing-contract-guidelines.md`
- `packages/knowledge/src/contracts/README.md`
- `docs/architecture/ARCHITECTURE.md` 中关于 knowledge/core/memory indexing 关系的旧描述

更新方向：

- 删除“knowledge runtime/host-integration 过渡态允许依赖 `@agent/config`、`@agent/adapters`、`@agent/memory`”这类旧边界。
- 改为“`@agent/knowledge` owns publishable SDK contracts；host packages implement those contracts when integrating config, memory, adapters, or runtime providers”。
- 清理仍要求先改 `@agent/memory` 再改 knowledge indexing contract 的旧规则。

## Cleanup Impact

- 删除 `packages/knowledge` manifest 中的 `@agent/core`、`@agent/config`、`@agent/memory`。
- 删除 knowledge 源码中所有 `@agent/*` import 和 dynamic import。
- 删除 knowledge 内部对 learning/eval/budget core schema 的 compat re-export。
- 清理测试中从 `@agent/config`、`@agent/memory`、`@agent/adapters` 直接导入的写法。
- 清理文档中过时依赖方向，避免后续 AI 继续按旧架构执行。

## Success Criteria

- `rg "@agent/" packages/knowledge/src packages/knowledge/test packages/knowledge/demo packages/knowledge/package.json` 不再命中 workspace 依赖；测试文件如果为了验证边界读取字符串，应避免误报或使用专门 allowlist。
- `@agent/knowledge` 的 manifest 可作为独立 npm package 理解。
- 现有 backend/runtime knowledge 功能通过 host adapter 继续编译。
- Knowledge indexing、local ingestion、retrieval 相关单测通过。
- 文档中不再出现 knowledge 依赖 memory/config/adapters/core 的当前态说法。

## 后续评估点

本设计已固定不新增 `@agent/knowledge-host` 包。若实现中发现 backend、runtime、platform-runtime 三处以上都需要同一批 host adapter，后续可单独设计 host integration package，但不能阻塞本轮 SDK 边界清理。
