# runtime 包交接文档

状态：current
文档类型：guide
适用范围：`packages/runtime`
最后核对：2026-04-19

## 包定位

`packages/runtime` 是 runtime kernel 的真实宿主，负责 graph、session、checkpoint、approval/recovery、interrupt、observability 与 orchestration。

## 当前主要目录

- `src/graphs/`
- `src/flows/`
- `src/session/`
- `src/runtime/`
- `src/governance/`
- `src/capabilities/`
- `src/orchestration/`
- `src/runtime-observability/`

## 修改前先读

- [docs/packages/runtime/README.md](/docs/packages/runtime/README.md)
- [docs/packages/runtime/package-structure-guidelines.md](/docs/packages/runtime/package-structure-guidelines.md)
- [docs/packages/runtime/runtime-layering-adr.md](/docs/packages/runtime/runtime-layering-adr.md)
- [docs/packages/runtime/runtime-state-machine.md](/docs/packages/runtime/runtime-state-machine.md)

## 改动边界

- 这里是 runtime kernel，不负责 app view model、controller 或官方组合根。
- graph 入口应放在 `src/graphs/*`，复杂节点逻辑要继续下沉到 `src/flows/*`。
- backend service 不应重新拼这里已经存在的主链流程。

## 验证

- `pnpm exec tsc -p packages/runtime/tsconfig.json --noEmit`
- `pnpm --dir packages/runtime test`
- `pnpm --dir packages/runtime test:integration`

## 交接提醒

- 这是高耦合高影响包，任何主链改动都要带着 approval、recover、observe、cancel 语义一起看。
- 只要碰主链图或状态机，最好同时回看 integration 层验证是否足够。
