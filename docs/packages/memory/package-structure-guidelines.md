# memory 包结构规范

状态：current
文档类型：convention
适用范围：`packages/memory`
最后核对：2026-04-18

本文档说明 `packages/memory` 如何继续围绕 repository / search / vector 三个核心能力收敛。

## 1. 目标定位

`packages/memory` 负责：

- memory / rule / runtime-state repository
- search facade
- vector index
- semantic cache

它不负责 agent 主链编排。

## 2. 推荐结构

```text
packages/memory/
├─ src/
│  ├─ contracts/
│  ├─ repositories/
│  ├─ search/
│  ├─ vector/
│  ├─ embeddings/
│  ├─ governance/
│  ├─ normalization/
│  ├─ shared/
│  ├─ utils/
│  └─ index.ts
├─ test/
└─ package.json
```

补充：

- `repositories/`、`search/`、`vector/` 当前已经是主要宿主
- 后续重点不是强行改目录名，而是把仍在包根平铺的 helper 继续下沉到对应领域

## 3. 当前收敛策略

本轮优先补清 contract 宿主，不大规模搬已有 repository/search/vector 实现。

后续收敛优先顺序：

1. 先补 `contracts/`
2. 再把平铺 helper 收敛到 `shared/` 或对应领域目录
3. 最后再评估是否需要额外 `runtime/` facade

当前已落地：

- `normalization/memory-record-helpers.ts`
  - 已作为 memory normalization / structured search helper 的真实宿主
- `governance/memory-repository-governance.ts`
  - 已作为 repository governance helper 的真实宿主
- `repositories/memory-repository.ts`、`search/memory-search-service.ts`
  - 作为 repository / search 的真实宿主
- `contracts/memory-repository.ts`、`contracts/memory-search-service.ts`
  - 仅保留稳定 facade re-export，便于 contract-first 导入
- 旧的包根 `memory-record-helpers.ts`、`memory-repository-governance.ts`
  - 已删除
- `shared/memory-record-helpers.ts`、`repositories/memory-repository-governance.ts`
  - 已删除

补充：

- `shared/` 不再作为 normalization 主宿主
- `repositories/` 不再作为治理 helper 主宿主

## 4. 继续阅读

- [memory 文档目录](/docs/packages/memory/README.md)
- [storage-and-search.md](/docs/packages/memory/storage-and-search.md)
- [Packages 分层与依赖约定](/docs/conventions/package-architecture-guidelines.md)
