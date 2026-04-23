# LangChain Adapter 使用文档

状态：current
文档类型：guide
适用范围：`packages/adapters/src/langchain/`
最后核对：2026-05-09

## 概述

`packages/adapters` 提供三种 LangChain adapter，将 LangChain 生态的 loader / splitter / embedder 适配为 `@agent/core` 定义的稳定契约接口。

## 1. Loader — `LangChainLoaderAdapter`

包装任意 LangChain `BaseDocumentLoader`，输出 `Document[]`（core 类型）。

```ts
import { LangChainLoaderAdapter, createMarkdownDirectoryLoader } from '@agent/adapters';

const inner = createMarkdownDirectoryLoader('./docs');
const loader = new LangChainLoaderAdapter(inner);
const documents = await loader.load();
// documents: Document[] — { id, content, metadata }
```

**行为**：

- LangChain 文档的 `metadata.id` / `metadata.source` 优先作为文档 ID
- 无 ID 时 fallback 到 `documentId(source)` SHA-256 stable ID
- metadata 自动 normalize（Date→ISO, URL→string, bigint→string 等）

**`createMarkdownDirectoryLoader(dirPath, extensions?)`**：

- 递归扫描目录中的 `.md` / `.mdx` 文件（默认，可覆盖）
- 基于 Node.js `fs.readdirSync` 实现，不依赖外部服务
- 文件内容作为 `content`，`source` 记录绝对路径

## 2. Chunker — `LangChainChunkerAdapter`

包装任意 LangChain `BaseDocumentTransformer`（text splitter），输出 `Chunk[]`。

```ts
import { LangChainChunkerAdapter, createRecursiveTextSplitterChunker } from '@agent/adapters';

const splitter = await createRecursiveTextSplitterChunker({ chunkSize: 500, chunkOverlap: 100 });
const chunker = new LangChainChunkerAdapter(splitter);

for (const doc of documents) {
  const chunks = await chunker.chunk(doc);
  // chunks: Chunk[] — { id, content, chunkIndex, sourceDocumentId, metadata }
}
```

**行为**：

- 空白内容的 chunk 自动跳过
- `chunkIndex` 从 0 开始，按顺序递增
- `sourceDocumentId` 自动填充为输入文档的 `id`
- chunk ID 使用 `chunkId(documentId, index)` stable ID

**工厂函数**：

- `createRecursiveTextSplitterChunker(opts)` — `RecursiveCharacterTextSplitter`
- `createMarkdownTextSplitterChunker(opts)` — `MarkdownTextSplitter`
- `createTokenTextSplitterChunker(opts)` — `TokenTextSplitter`

## 3. Embedder — `LangChainEmbedderAdapter`

包装任意 LangChain `Embeddings`，输出 `Vector[]`。

```ts
import { LangChainEmbedderAdapter } from '@agent/adapters';
import { OpenAIEmbeddings } from '@langchain/openai';

const inner = new OpenAIEmbeddings({ model: 'text-embedding-3-small' });
const embedder = new LangChainEmbedderAdapter(inner);

const vectors = await embedder.embed(chunks);
// vectors: Vector[] — { id, values, metadata, sourceChunkId }
```

**行为**：

- 空输入直接返回 `[]`
- `Vector.id = Chunk.id`，`sourceChunkId = Chunk.id`
- metadata 继承自 chunk metadata
- 返回数量与输入不一致时抛出 `AdapterError`
- vector values 必须是 `number[]`，否则抛出 `AdapterError`

## 4. 完整 load → chunk → embed 流程示例

```ts
import {
  LangChainLoaderAdapter,
  LangChainChunkerAdapter,
  LangChainEmbedderAdapter,
  createMarkdownDirectoryLoader,
  createRecursiveTextSplitterChunker
} from '@agent/adapters';

const documents = await new LangChainLoaderAdapter(createMarkdownDirectoryLoader('./docs')).load();

const splitter = await createRecursiveTextSplitterChunker({ chunkSize: 500, chunkOverlap: 100 });
const chunker = new LangChainChunkerAdapter(splitter);

// 使用项目内部 embedder（如 createRuntimeEmbeddingProvider）
const embedder = new LangChainEmbedderAdapter(yourLangchainEmbeddings);

let vectors = [];
for (const doc of documents) {
  const chunks = await chunker.chunk(doc);
  const vecs = await embedder.embed(chunks);
  vectors.push(...vecs);
}
// vectors 可传给 ChromaVectorStoreAdapter.upsert()
```

参见 `packages/adapters/demo/langchain-default-chain.ts` 获取可运行示例。
