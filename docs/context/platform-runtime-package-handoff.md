# platform-runtime 包交接文档

状态：current
文档类型：guide
适用范围：`packages/platform-runtime`
最后核对：2026-04-19

## 包定位

`packages/platform-runtime` 是官方平台装配层 / composition root，负责官方 agent registry、默认 runtime facade、backend/worker 共用启动线与只读 metadata。

## 当前主要目录

- `src/runtime/`
- `src/registries/`
- `src/contracts/`
- `src/adapters/`

## 修改前先读

- [docs/platform-runtime/README.md](/Users/dev/Desktop/learning-agent-core/docs/platform-runtime/README.md)
- [docs/platform-runtime/official-composition-root-adr.md](/Users/dev/Desktop/learning-agent-core/docs/platform-runtime/official-composition-root-adr.md)
- [docs/packages-overview.md](/Users/dev/Desktop/learning-agent-core/docs/packages-overview.md)

## 改动边界

- 这里负责装配，不负责 HTTP controller、worker loop、前端 view model 或 agent graph 主实现。
- 如果某段逻辑已经是“真实业务实现”，应继续下沉到 runtime、agent 或 backend domain 宿主。
- 对外暴露的 runtime facade、registry contract 与 metadata 应保持清晰稳定。

## 验证

- `pnpm exec tsc -p packages/platform-runtime/tsconfig.json --noEmit`
- `pnpm --dir packages/platform-runtime test`
- `pnpm --dir packages/platform-runtime test:integration`

## 交接提醒

- 改 composition root 时，要小心 backend、worker 与默认 agent registry 的联动影响。
