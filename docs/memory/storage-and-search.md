# Storage And Search

状态：current
适用范围：`packages/memory`、`data/memory`、`data/knowledge`
最后核对：2026-04-14

## 1. 这篇文档说明什么

本文档说明 `@agent/memory` 当前在仓库里的职责边界，以及 repository、search、vector、embeddings 与本地数据目录之间的关系。

## 2. 当前目录结构

`packages/memory/src` 当前主要分为：

- `src/repositories`
  - memory / rule / runtime-state 等持久化仓储
- `src/search`
  - 统一搜索 contract 与查询入口
- `src/vector`
  - 向量索引相关基础能力
- `src/embeddings`
  - embedding 相关适配

## 3. 当前职责边界

`packages/memory` 负责：

- memory / rule / runtime-state repository
- vector index
- semantic cache
- 统一搜索 contract

不负责：

- agent 主链编排
- delivery / review / research 流程控制
- app 层 controller / 页面状态

这些能力应继续留在 `packages/agent-core` 或 `apps/*`。

## 4. `data/memory` 与 `data/knowledge`

- `data/memory`
  - 面向可复用沉淀，例如 memory / rule / 相关本地存储
- `data/knowledge`
  - 面向知识检索副产物，例如 catalog、sources、chunks、vectors、ingestion

简单理解：

- `memory` 更偏“沉淀后的复用知识”
- `knowledge` 更偏“检索与索引过程中的原料和索引产物”

## 5. 搜索链路约束

当前检索层应继续围绕统一抽象收敛：

- `MemorySearchService`
  - 面向 runtime / session / ministries 提供统一 memory / rule 检索入口
- `VectorIndexRepository`
  - 作为向量库接入点
- `LocalVectorIndexRepository`
  - 当前默认本地实现

约束：

- 上层应优先调用统一搜索入口，不要在 app 层或 graph 外围各自直读底层仓储
- semantic cache 只是第一层，不替代后续向量检索

## 6. 继续阅读

- [memory 文档目录](/Users/dev/Desktop/learning-agent-core/docs/memory/README.md)
- [目录地图](/Users/dev/Desktop/learning-agent-core/docs/repo-directory-overview.md)
- [Runtime State Machine](/Users/dev/Desktop/learning-agent-core/docs/runtime-state-machine.md)
