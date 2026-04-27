# data-report Agent 交接文档

状态：current
文档类型：guide
适用范围：`agents/data-report`
最后核对：2026-04-19

## 包定位

`agents/data-report` 是 data-report graph、preview/runtime facade、JSON/report flow 的真实宿主。

## 当前主要目录

- `src/graphs/`
- `src/flows/`
- `src/types/`
- `src/utils/`

## 修改前先读

- [docs/agents/data-report/README.md](/docs/agents/data-report/README.md)
- [docs/agents/data-report/package-structure-guidelines.md](/docs/agents/data-report/package-structure-guidelines.md)
- [docs/packages/report-kit/data-report-pipeline.md](/docs/packages/report-kit/data-report-pipeline.md)

## 改动边界

- graph 编排与 runtime facade 在这里，确定性 blueprint / scaffold / assembly 在 `packages/report-kit`。
- 稳定领域类型优先放 `packages/core` 或本包 `src/types/`，不要继续散落在 flow 文件里。
- backend service 只能调用 facade，不应自己拼 data-report 主流程。

## 验证

- `pnpm exec tsc -p agents/data-report/tsconfig.json --noEmit`
- `pnpm --dir agents/data-report test`
- `pnpm --dir agents/data-report test:integration`

## 交接提醒

- 这条链路跨 `core / report-kit / runtime / backend`，每次调整都要确认宿主边界没有回退。
