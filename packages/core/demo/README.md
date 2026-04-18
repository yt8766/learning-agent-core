# core demo

本目录用于放置 `@agent/core` 的最小验证案例。

可用脚本：

- `pnpm --filter @agent/core demo:schema-parse`
- `pnpm --filter @agent/core demo:tasking-planning`
- `pnpm --filter @agent/core demo:tasking-runtime-state`
- `pnpm --filter @agent/core demo:tasking-checkpoint`

约束：

- demo 文件只能放在 `demo/`，不要放进 `src/`。
- demo 直接通过 `tsx` 加载 `src/index.ts`，用于验证源码级 schema-first contract 的最小闭环。
- demo 的目标是验证最小可用路径，不替代单元测试。
- demo 文件统一使用 `.ts`，并只从 `src/index.ts` 进入，不在 `demo/` 里引入更深层内部路径。
- demo 统一使用 `tsx demo/*.ts` 运行。

当前示例围绕本项目实际契约组织：

- `schema-parse.ts`
  - 验证 session / skill / workflow / approval 这类基础 schema 可直接消费。
- `tasking-planning.ts`
  - 验证 planning 相关 contract。
- `tasking-runtime-state.ts`
  - 验证 runtime-state 相关 contract。
- `tasking-checkpoint.ts`
  - 验证 checkpoint / task-record 相关 contract。
