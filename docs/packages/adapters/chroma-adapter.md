# Chroma VectorStore Adapter 使用文档

状态：current
文档类型：guide
适用范围：历史入口；当前真实实现位于 `packages/knowledge/src/adapters/chroma/`

> 迁移说明：Chroma adapter 已迁入 `@agent/knowledge/adapters/chroma`。`@agent/adapters` 侧入口已删除，代码必须从 `@agent/knowledge` 或 `@agent/knowledge/adapters/chroma` 引入 Chroma。
> 最后核对：2026-04-28

## 概述

`ChromaVectorStoreAdapter` 实现 `@agent/knowledge` 的 `VectorStore` 接口，将 `Vector[]` upsert 到 Chroma 向量数据库。

## 基础用法

```ts
import { ChromaVectorStoreAdapter } from '@agent/knowledge/adapters/chroma';
import type { Vector } from '@agent/knowledge';

const store = new ChromaVectorStoreAdapter({
  collectionName: 'my-collection',
  clientOptions: { host: 'localhost', port: 8000 }
});

const vectors: Vector[] = [{ id: 'v1', values: [0.1, 0.2, 0.3], metadata: { source: 'doc.md', content: '...' } }];

await store.upsert(vectors);
```

## 配置选项

```ts
type ChromaVectorStoreAdapterOptions = {
  collectionName: string; // Chroma collection 名称
  collectionMetadata?: Record<string, unknown>; // collection 元数据
  clientOptions?: ChromaClientOptions; // Chroma 连接参数
  client?: ChromaClientLike; // 注入自定义 client（测试用）
};

type ChromaClientOptions = {
  ssl?: boolean;
  host?: string;
  port?: number;
  fetchOptions?: RequestInit;
};
```

## 行为说明

- **懒加载 collection**：collection 在第一次 `upsert()` 时才创建（`getOrCreateCollection`）
- **失败重试**：collection 初始化失败后，下次调用会重新尝试初始化（不缓存失败状态）
- **空 vectors 快速返回**：不发起网络请求
- **维度一致性校验**：upsert 前调用 `validateVectorDimensions`，所有 vector 维度必须一致
- **预计算向量模式**：adapter 使用 `embeddingFunction: null`，Chroma 不会自动计算 embedding
- **metadata 转换**：通过 `mapVectorMetadataToChromaMetadata()` 将 `JsonObject` 转为 Chroma 兼容的扁平格式（string / number / boolean）

## 注入自定义 client（测试用）

```ts
import type { ChromaClientLike } from '@agent/knowledge/adapters/chroma';

const mockClient: ChromaClientLike = {
  getOrCreateCollection: async () => ({
    upsert: async params => {
      /* mock */
    }
  })
};

const store = new ChromaVectorStoreAdapter({
  collectionName: 'test',
  client: mockClient
});
```

这样测试时不需要运行 Chroma 服务。

## metadata 转换规则

`mapVectorMetadataToChromaMetadata` 将 `JsonObject` 中的值转换为 Chroma 兼容类型：

| 输入类型  | 输出处理                    |
| --------- | --------------------------- |
| `string`  | 原样保留                    |
| `number`  | 原样保留                    |
| `boolean` | 原样保留                    |
| `null`    | 跳过（Chroma 不支持 null）  |
| `object`  | `JSON.stringify()` 转字符串 |
| `array`   | `JSON.stringify()` 转字符串 |

## CI / 无服务环境

无 Chroma 服务时 `upsert()` 会抛出 `AdapterError`（cause 为连接错误）。demo / smoke 测试应显式跳过：

```ts
try {
  await store.upsert(vectors);
} catch (err) {
  if (/* connection error */) {
    console.log('Chroma not running, skipping');
    return;
  }
  throw err;
}
```

参见 `packages/adapters/demo/chroma-upsert.ts` 获取可运行示例。

## 启动 Chroma（本地开发）

```bash
docker run -p 8000:8000 chromadb/chroma
```

或：

```bash
pip install chromadb && chroma run
```
