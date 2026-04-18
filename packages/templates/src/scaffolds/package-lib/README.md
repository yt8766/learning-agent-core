# **TITLE**

由 `@agent/tools` 的 scaffold 能力生成的通用 package 骨架。

目录约定：

- `test/` 与 `src/` 同级，用于 unit / integration 验证

## Validation

- Type: `pnpm typecheck`
- Spec: `pnpm test:spec` + `src/schemas/__NAME__.schema.ts`
- Unit Test: `pnpm test`
- Integration: `pnpm test:integration`
