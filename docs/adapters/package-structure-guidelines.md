# adapters 包结构规范

状态：current
文档类型：convention
适用范围：`packages/adapters`
最后核对：2026-04-18

本文档说明 `packages/adapters` 如何继续按“稳定 adapter 边界 + provider 实现”收敛目录结构。

## 1. 目标定位

`packages/adapters` 负责把外部模型与嵌入能力翻译成系统内部稳定可消费的接口。

它不是：

- agent 业务 prompt 宿主
- graph 编排层
- runtime orchestration 层

## 2. 推荐结构

```text
packages/adapters/
├─ src/
│  ├─ contracts/
│  ├─ runtime/
│  ├─ providers/
│  ├─ llm/
│  ├─ embeddings/
│  ├─ shared/
│  ├─ utils/
│  └─ index.ts
├─ test/
└─ package.json
```

各目录语义：

- `contracts/`
  - LLM / embedding 对外稳定 contract
- `runtime/`
  - runtime provider factory、chat model factory 等装配入口
- `providers/`
  - provider normalize、provider-specific helper
- `llm/`
  - LLM adapter 实现
- `embeddings/`
  - embedding adapter 实现
- `shared/`
  - 共享 prompt 片段与 adapter 级共享资产
- `utils/`
  - retry、fallback、pure helper

## 3. 当前收敛策略

本轮继续以“新宿主目录 + 旧入口 compat re-export”的方式推进，不大规模搬 provider 实现。

优先顺序：

1. `contracts/`
2. `runtime/`
3. 再逐步评估 `providers/`、`llm/`、`embeddings/` 内的物理收敛

当前已落地：

- `runtime/chat-model-factory.ts`
  - 作为 chat model helper 的真实宿主
- `runtime/runtime-provider-factory.ts`
  - 作为 runtime provider wiring 的真实宿主
- `embeddings/runtime-embedding-provider.ts`
  - 作为 embedding runtime factory 的真实宿主
- `llm/llm-provider.ts`
  - 作为 LLM contract helper 与 JSON instruction 的真实宿主
- `contracts/llm-provider.ts`
  - 仅保留稳定 facade re-export，便于 contract-first 导入
- `chat/chat-model-factory.ts`
  - 已删除
  - `chat/index.ts` 当前直接聚合到 `runtime/chat-model-factory.ts`
- `llm/runtime-provider-factory.ts`
  - 已删除
  - runtime provider factory 语义统一收口到 `runtime/runtime-provider-factory.ts`

## 4. 继续阅读

- [adapters 文档目录](/docs/adapters/README.md)
- [Packages 分层与依赖约定](/docs/package-architecture-guidelines.md)
