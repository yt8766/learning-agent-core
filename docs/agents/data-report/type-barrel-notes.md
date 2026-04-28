# Data Report Type Barrel Notes

状态：current
文档类型：note
适用范围：`agents/data-report/src/types/*`
最后核对：2026-04-27

`agents/data-report` 的类型别名层必须显式暴露 `data-report`、`data-report-json`、`data-report-json-schema`、`data-report-json-bundle-schema`、`report-bundle`、`schemas/*` 与 `contracts/*` 入口，不要把这些文件收缩成 `@agent/core` 转发。

原因：

- graph、flow、node 代码大量按模块路径引用 `../../types/data-report` 和 `../../types/data-report-json`
- 这些路径承担稳定的本地域 schema-first 类型入口职责
- `ReportBundle`、`DataReportJsonBundle`、data-report graph state 与 json graph state 均由 `agents/data-report/src/types` 承接，不再从 `@agent/core` 获取
- 一旦退回 core 转发，整包 `tsc` 很容易出现“类型在 core 中存在，但本地模块路径丢失命名导出”的回归，也会重新制造 core/domain 双宿主

当前约定：

- `src/types/index.ts`
  - 统一汇总本地域类型、schema 与 contract 模块，不再额外透传 `@agent/core` 总入口
- `src/types/data-report.ts`
  - 显式导出 sandpack graph 相关类型
- `src/types/data-report-json.ts`
  - 显式导出 json graph 相关类型，并转发 schema 类型
- `src/types/data-report-json-schema.ts`
  - 显式导出 json schema / migration / structured-input 相关类型
- `src/types/schemas/*`
  - 承接 data-report 领域的 Zod schema 主定义，类型必须通过 `z.infer<>` 从这里推导
- `src/types/contracts/*`
  - 承接 data-report graph/flow 的输入、输出与 handler contract；允许继续引用 `@agent/core` 的 provider interface，不允许引用 core 中不存在的 data-report contract

最低验证：

```bash
pnpm exec tsc -p agents/data-report/tsconfig.json --noEmit
pnpm exec vitest run --config vitest.config.js agents/data-report/test/index-exports.test.ts agents/data-report/test/runtime-boundary.test.ts
```
