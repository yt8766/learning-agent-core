# Data Report Type Barrel Notes

状态：current
文档类型：note
适用范围：`agents/data-report/src/types/*`
最后核对：2026-04-16

`agents/data-report` 的类型别名层必须显式暴露 `data-report`、`data-report-json`、`data-report-json-schema` 三个入口，不要把这些文件收缩成只剩 `export * from '@agent/core'` 的空转发。

原因：

- graph、flow、node 代码大量按模块路径引用 `../../types/data-report` 和 `../../types/data-report-json`
- 这些路径不只承担“转发 core 总入口”的职责，还承担稳定的本地域类型入口职责
- 一旦只保留空转发，整包 `tsc` 很容易出现“类型在 core 中存在，但本地模块路径丢失命名导出”的回归

当前约定：

- `src/types/index.ts`
  - 统一汇总三个本地域类型模块，不再额外透传 `@agent/core` 总入口
- `src/types/data-report.ts`
  - 显式导出 sandpack graph 相关类型
- `src/types/data-report-json.ts`
  - 显式导出 json graph 相关类型，并转发 schema 类型
- `src/types/data-report-json-schema.ts`
  - 显式导出 json schema / migration / structured-input 相关类型

最低验证：

```bash
pnpm exec tsc -p agents/data-report/tsconfig.json --noEmit
pnpm exec tsc -p packages/runtime/tsconfig.json --noEmit
```
