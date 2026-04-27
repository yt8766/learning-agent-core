# core 包交接文档

状态：current
文档类型：guide
适用范围：`packages/core`
最后核对：2026-04-19

## 包定位

`packages/core` 是稳定公共 contract 层，负责 schema、DTO、record、错误语义与跨包共享语言。

## 当前主要目录

- `src/contracts/`
- `src/tasking/`
- `src/workflow-route/`
- `src/governance/`
- `src/knowledge/`
- `src/memory/`
- `src/review/`
- `src/data-report/`

## 修改前先读

- [docs/packages/core/README.md](/docs/packages/core/README.md)
- [docs/packages/core/current-core-package-guidelines.md](/docs/packages/core/current-core-package-guidelines.md)
- [docs/packages/core/core-contract-guidelines.md](/docs/packages/core/core-contract-guidelines.md)

## 改动边界

- 默认 schema-first：长期稳定 JSON / DTO / payload contract 必须先定义 schema。
- 这里只放稳定公共语言，不放 graph、repository、provider、controller 或 prompt 主实现。
- 如果某段类型明显依赖宿主运行时细节，应优先下沉到真实宿主，避免把 compat 再堆回 core。

## 验证

- `pnpm exec tsc -p packages/core/tsconfig.json --noEmit`
- `pnpm --dir packages/core test`
- `pnpm --dir packages/core test:integration`

## 交接提醒

- 破坏式修改 contract 前，先评估调用方与存量数据兼容性。
- 如果本轮只是搬运和收敛，也要证明行为不变，而不是只改导出层次。
