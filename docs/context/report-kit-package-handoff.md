# report-kit 包交接文档

状态：current
文档类型：guide
适用范围：`packages/report-kit`
最后核对：2026-04-19

## 包定位

`packages/report-kit` 是 data-report 的确定性 blueprints、scaffold、assembly 与 writer 引擎宿主。

## 当前主要目录

- `src/blueprints/`
- `src/scaffold/`
- `src/assembly/`
- `src/writers/`
- `src/contracts/`

## 修改前先读

- [docs/report-kit/README.md](/docs/report-kit/README.md)
- [docs/report-kit/package-structure-guidelines.md](/docs/report-kit/package-structure-guidelines.md)
- [docs/report-kit/data-report-pipeline.md](/docs/report-kit/data-report-pipeline.md)

## 改动边界

- 这里负责报表领域的确定性骨架与写入，不负责 graph 编排、preview/runtime facade 或 backend service 胶水。
- 如果某段能力依赖 LLM 节点编排，应优先放回 `agents/data-report` 或 `packages/runtime`。
- data-report 的稳定 contract 若需要跨包复用，应回收到 `packages/core` 或 agent 自有 `types/`。

## 验证

- `pnpm exec tsc -p packages/report-kit/tsconfig.json --noEmit`
- `pnpm --dir packages/report-kit test`
- `pnpm --dir packages/report-kit test:integration`

## 交接提醒

- blueprint / scaffold 变更很容易影响生成结果结构，最好同步检查 data-report agent 的上下游兼容性。
