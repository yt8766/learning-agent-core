# Knowledge Indexing 契约规范

状态：current
文档类型：convention
适用范围：`packages/knowledge/src/contracts/indexing/`
最后核对：2026-05-09

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

## 3. 接口契约

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
