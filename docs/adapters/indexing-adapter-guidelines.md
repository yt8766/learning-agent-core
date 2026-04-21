# adapters indexing adapter 规范

状态：current
文档类型：convention
适用范围：`packages/adapters/src/langchain/`、`packages/adapters/src/chroma/`
最后核对：2026-05-09

## 1. 定位

`packages/adapters` 的 LangChain / Chroma 模块是项目的**外部生态 indexing 转化层**。

职责：

- 接收第三方 SDK 的输出，转化为 `@agent/core` 定义的稳定契约类型（`Document` / `Chunk` / `Vector`）
- 把 `@agent/core` 类型转化为第三方 SDK 的输入

**不负责**：

- pipeline 编排（由 `@agent/knowledge` 的 `runKnowledgeIndexing` 负责）
- retrieval / search（由 `@agent/knowledge` 的检索层负责）
- agent graph / flow / prompt（由 `agents/*` 负责）

## 2. 目录结构

```text
packages/adapters/src/
├─ shared/                      # 跨生态通用转化能力
│  ├─ metadata/                 # metadata 标准化
│  │  ├─ normalize-metadata.ts  # Date/URL/bigint -> JSON safe
│  │  └─ merge-metadata.ts      # 多来源 metadata 合并
│  ├─ ids/                      # 稳定 ID 生成
│  │  └─ stable-id.ts           # SHA-256 deterministic ID
│  ├─ errors/                   # 统一错误类
│  │  └─ adapter-error.ts       # AdapterError with cause
│  └─ validation/               # 校验工具
│     └─ vector-dimensions.ts   # 维度一致性检查
│
├─ langchain/                   # LangChain 生态 adapter
│  ├─ shared/                   # LangChain 专属 mapper
│  │  ├─ langchain-document.mapper.ts
│  │  ├─ langchain-chunk.mapper.ts
│  │  └─ langchain-metadata.mapper.ts  (暂未使用，预留)
│  ├─ loaders/                  # Loader 角色
│  │  ├─ langchain-loader.adapter.ts
│  │  └─ markdown-directory-loader.ts
│  ├─ chunkers/                 # Chunker 角色
│  │  ├─ langchain-chunker.adapter.ts
│  │  └─ text-splitters.ts
│  └─ embedders/                # Embedder 角色
│     └─ langchain-embedder.adapter.ts
│
└─ chroma/                      # Chroma 生态 adapter
   ├─ shared/                   # Chroma 专属工具
   │  ├─ chroma-client.factory.ts   (通过 chroma-collection.ts 提供)
   │  ├─ chroma-collection.ts
   │  └─ chroma-metadata.mapper.ts
   └─ stores/                   # VectorStore 角色
      └─ chroma-vector-store.adapter.ts
```

## 3. 契约来源

所有 adapter 实现的契约定义在 `@agent/core/src/knowledge/indexing/contracts/`：

```ts
import type { Loader } from '@agent/core'; // Loader 接口
import type { Chunker } from '@agent/core'; // Chunker 接口
import type { Embedder } from '@agent/core'; // Embedder 接口
import type { VectorStore } from '@agent/core'; // VectorStore 接口
```

数据类型定义在 `@agent/core/src/knowledge/indexing/schemas/`：

```ts
import type { Document } from '@agent/core'; // { id, content, metadata }
import type { Chunk } from '@agent/core'; // { id, content, metadata, chunkIndex, sourceDocumentId }
import type { Vector } from '@agent/core'; // { id, values, metadata, sourceChunkId? }
```

## 4. 第三方类型隔离规则

- **所有 `@langchain/*` / `chromadb` 类型只能出现在 `packages/adapters/src/langchain/` 或 `packages/adapters/src/chroma/` 内**
- 严禁第三方类型泄露到：`@agent/core`、`@agent/knowledge`、`@agent/runtime`、`agents/*`、`apps/*`
- adapter 对外暴露的接口只使用 `@agent/core` 契约类型

## 5. 新增第三方生态的规范

添加新生态（如 Pinecone / pgvector / LlamaIndex）时：

1. 在 `src/<ecosystem>/` 下建立顶层目录（表达"适配哪个外部生态"）
2. 在 `src/<ecosystem>/stores/`、`src/<ecosystem>/loaders/` 等二级目录（表达"转化成项目内部什么角色"）
3. 在 `src/<ecosystem>/shared/` 放专属 mapper
4. 所有实现必须满足 `@agent/core` 定义的 `Loader` / `Chunker` / `Embedder` / `VectorStore` 接口
5. 从 `src/index.ts` 根入口暴露（遵循现有 barrel 结构）
6. 添加对应测试 `test/<ecosystem>/`
7. 添加 demo `demo/<ecosystem>-*.ts`
