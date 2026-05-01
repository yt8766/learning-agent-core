# Knowledge Indexing 契约规范

状态：current
文档类型：convention
适用范围：`packages/knowledge/src/contracts/indexing/`
最后核对：2026-04-30（writer fanout 闭环核对）

## 1. 定位

`@agent/knowledge` 的 `packages/knowledge/src/contracts/indexing/` 是 indexing pipeline 所有参与方的共享契约层。

- `@agent/adapters` 实现这些契约（LangChain / Chroma adapter）
- `@agent/knowledge` 承载契约并编排 pipeline
- `agents/*`、`apps/*` 间接使用

## 2. 数据模型

### Document（文档）

```ts
import type { Document } from '@agent/knowledge';
// {
//   id: string;
//   content: string;
//   metadata: JsonObject;
// }
```

来源：Loader 输出，通常是原始文档（markdown 文件、网页、数据库记录等）。

### Chunk（分块）

```ts
import type { Chunk } from '@agent/knowledge';
// {
//   id: string;
//   content: string;
//   metadata: JsonObject;
//   chunkIndex: number;
//   sourceDocumentId: string;
// }
```

来源：Chunker 对 Document 分块后的输出。

### Vector（向量）

```ts
import type { Vector } from '@agent/knowledge';
// {
//   id: string;
//   values: number[];
//   metadata: JsonObject;
//   sourceChunkId?: string;
// }
```

来源：Embedder 对 Chunk 生成 embedding 后的输出。

### JsonObject / JsonValue

```ts
import type { JsonObject, JsonValue } from '@agent/knowledge';
// JsonObject = Record<string, JsonValue>
// JsonValue = string | number | boolean | null | JsonObject | JsonValue[]
```

`metadata` 字段统一使用 `JsonObject` 类型，保证 JSON 序列化安全。

### Chunk metadata（检索与 Small-to-Big）

当前 `KnowledgeChunkMetadataSchema` 已显式承载检索过滤与 Small-to-Big 第一阶段需要的稳定字段：

```ts
type KnowledgeChunkMetadata = {
  docType?: string;
  status?: string;
  allowedRoles?: string[];
  parentId?: string;
  prevChunkId?: string;
  nextChunkId?: string;
  sectionId?: string;
  sectionTitle?: string;
};
```

字段语义：

- `docType` / `status` / `allowedRoles`：供 runtime metadata filtering 使用。
- `parentId`：Small-to-Big 回补父级 chunk 的候选 id。
- `prevChunkId` / `nextChunkId`：Small-to-Big 回补相邻 chunk 的候选 id。
- `sectionId` / `sectionTitle`：记录 chunk 所属章节，用于后续更稳定的章节级 context 组织。

`documentId` 与 `chunkIndex` 必须保持稳定。调用方不能依赖一次临时切分中的偶然顺序来表达长期关系；如果 chunk 重切，必须同步更新 neighbor metadata，避免 `prevChunkId` / `nextChunkId` 指向旧 chunk。metadata 必须保持 JSON-safe，不允许把 LangChain document、Chroma record、权限 SDK 对象、vendor response/error/event 等第三方对象直接写入 indexing contract。

当前 indexing / local store 还不会自动生成 `parentId`、`prevChunkId`、`nextChunkId`、`sectionId`、`sectionTitle`。Small-to-Big 第一阶段由调用方或测试夹具直接提供这些 metadata；后续如果要在 chunker、local ingestion 或 adapter 中自动生成 neighbor metadata，必须先更新本文档与 indexing contract，再同步补 schema、实现和回归测试。

## 3. 接口契约

底层 indexing contract 仍保留通用 loader / chunker / embedder / vector-store 抽象：

```ts
interface Loader {
  load(): Promise<Document[]>;
}

interface Chunker {
  chunk(document: Document): Promise<Chunk[]>;
}

interface Embedder {
  embed(chunks: Chunk[]): Promise<Vector[]>;
}

interface VectorStore {
  upsert(vectors: Vector[]): Promise<void>;
}
```

这四个接口定义在 `packages/knowledge/src/contracts/indexing/contracts/`，从 `@agent/knowledge` 根入口导出。

当前 `packages/knowledge/src/indexing/pipeline/run-knowledge-indexing.ts` 使用的 writer 边界更具体：

```ts
import type { KnowledgeChunk, KnowledgeSource } from '@agent/knowledge';
import type { KnowledgeVectorIndexWriter } from '@agent/memory';

interface KnowledgeSourceIndexWriter {
  upsertKnowledgeSource(source: KnowledgeSource): Promise<void>;
}

interface KnowledgeFulltextIndexWriter {
  upsertKnowledgeChunk(chunk: KnowledgeChunk): Promise<void>;
}

interface KnowledgeIndexingRunOptions {
  loader: Loader;
  vectorIndex: KnowledgeVectorIndexWriter;
  sourceIndex?: KnowledgeSourceIndexWriter;
  fulltextIndex?: KnowledgeFulltextIndexWriter;
}
```

语义约束：

- `vectorIndex` 必填，负责接收 `KnowledgeVectorDocumentRecord`；embedding 与 vector persistence 在 `@agent/memory` 边界内完成。
- `sourceIndex` 可选，负责接收 `KnowledgeSource`；生产 user upload、catalog sync、web curated、connector content loader 接入时应优先提供它，避免 chunk 可检索但来源不可观测。
- `fulltextIndex` 可选，负责接收 `KnowledgeChunk`；通常由 `KnowledgeChunkRepository` 或同等 fulltext/chunk index writer 实现。
- 同一个 indexed chunk 必须使用同一份 source/document/chunk metadata fanout 到 vector 与 fulltext 两侧，避免检索结果和文本回补引用不同 chunk。
- skipped document 不会写入任何 writer，包括 source writer。

## 4. Schema 验证

每个数据模型都有对应的 Zod schema，用于运行时验证：

```ts
import { DocumentSchema, ChunkSchema, VectorSchema } from '@agent/knowledge';

const doc = DocumentSchema.parse(rawData); // 验证 Document
const chunk = ChunkSchema.parse(rawChunk); // 验证 Chunk
const vector = VectorSchema.parse(rawVector); // 验证 Vector
```

## 5. 设计原则

- **schema-first**：先定义 Zod schema，类型通过 `z.infer` 派生
- **第三方隔离**：`@agent/knowledge` 的 contract 不泄露 `@langchain/*`、`chromadb` 等第三方类型
- **稳定契约**：接口定义不随第三方 SDK 版本变化

## 6. 消费关系

```
@agent/knowledge (定义契约)
    ↓
@agent/adapters (实现 — LangChain/Chroma adapter)
    ↓
@agent/knowledge (编排 — runKnowledgeIndexing pipeline)
    ↓
apps/* / agents/* (使用)
```

## 7. 扩展规范

如需新增 metadata 字段或调整数据模型：

1. 在对应 `schemas/` 下修改 Zod schema（保持向下兼容）
2. 在 `types/` 下更新类型导出（通过 `z.infer` 自动同步）
3. 同步更新所有实现方（adapters、knowledge）
4. 更新本文档

Runtime metadata filtering 第一阶段依赖 chunk metadata 中的 `docType`、`status`、`allowedRoles`。新增这些字段时必须保持 JSON-safe，不允许把第三方对象、权限 SDK 类型或 vendor response 直接写进 metadata。后续扩展 `departments`、`productLines`、`knowledgeBases`、`tags`、`timeRange` 前，必须先确认 indexing pipeline 能稳定产出对应字段。

Small-to-Big 第一阶段依赖 chunk metadata 中的 `parentId`、`prevChunkId`、`nextChunkId`、`sectionId`、`sectionTitle`。其中 parent / neighbor 字段只是 context expansion 的候选关系，不改变基础 retrieval hit 排序，也不允许绕过 runtime resolved filters。
