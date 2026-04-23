# config 包交接文档

状态：current
文档类型：guide
适用范围：`packages/config`
最后核对：2026-04-19

## 包定位

`packages/config` 负责 profile、settings schema、路径布局、默认策略与配置加载标准化。

## 当前主要目录

- `src/schemas/`
- `src/profiles/`
- `src/policies/`
- `src/loaders/`
- `src/runtime/`
- `src/contracts/`

## 修改前先读

- [docs/packages-overview.md](/docs/packages-overview.md)
- [docs/config/README.md](/docs/config/README.md)
- [docs/config/package-structure-guidelines.md](/docs/config/package-structure-guidelines.md)
- [docs/config/runtime-profiles.md](/docs/config/runtime-profiles.md)

## 改动边界

- 这里负责配置 contract 与加载，不负责 runtime orchestration 或 provider 实例创建。
- 所有稳定配置项优先 schema-first，不要只加 interface 而不补 schema。
- 如果新增策略影响 profile 或目录布局，要同步检查 backend、worker、runtime 与 skill-runtime。

## 验证

- `pnpm exec tsc -p packages/config/tsconfig.json --noEmit`
- `pnpm --dir packages/config test`
- `pnpm --dir packages/config test:integration`

## 交接提醒

- 改动路径或默认 profile 时，要特别小心兼容性。
- app、runtime、worker 共用的配置事实应继续收敛在这里，不要各自发明一套。
