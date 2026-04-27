# config 文档目录

状态：current
文档类型：index
适用范围：`docs/packages/config/`
最后核对：2026-04-18

本目录用于沉淀 `packages/config` 相关文档。

包边界：

- 职责：
  - 运行时 profile、settings schema、默认策略与路径布局
  - 配置加载与标准化 facade
- 允许：
  - settings loader
  - profile / policy / storage 相关 contract
  - env resolver、normalizer
- 禁止：
  - graph、flow、agent 业务编排、工具执行逻辑
- 依赖方向：
  - 不依赖 `@agent/runtime` 或任意 `agents/*`
  - 允许被所有基础包与 app 层消费
- 公开入口：
  - 根入口：`@agent/config`
- 约定：
  - 统一只从 `@agent/config` 根入口导入
  - 当前真实宿主已先收敛到：
    - `src/schemas/settings.types.ts`
    - `src/profiles/runtime-profile-overrides.ts`
    - `src/policies/runtime-policy-defaults.ts`
    - `src/briefings/daily-tech-briefing.ts`
    - `src/loaders/settings-loader.ts`
    - `src/loaders/settings-paths.ts`
    - `src/shared/settings-defaults.ts`
    - `src/utils/settings-helpers.ts`
  - `src/contracts/settings-facade.ts` 当前作为包根稳定导出的 contract facade
  - `src/settings.ts` 与 `src/settings/index.ts` 当前保留为人工可读聚合入口
  - `src/runtime/*` 仅保留过渡期 compat wrapper，不再视为真实宿主
  - `src/settings/settings.*` 这类纯 compat re-export 已删除
  - 长期仍继续向 `schemas / profiles / policies / loaders / shared / utils` 收敛
  - 根入口优先维护显式命名导出，不继续用整段 `export *` 透传整个 `settings/*`

约定：

- `packages/config` 的专项文档统一放在 `docs/packages/config/`
- 新增功能、配置结构调整、加载规则变化后，需同步更新本目录文档
- 如果当前只有索引文件，后续可在本目录继续补充专题文档

当前文档：

- [package-structure-guidelines.md](/docs/packages/config/package-structure-guidelines.md)
- [runtime-profiles.md](/docs/packages/config/runtime-profiles.md)
- [package-installation-strategy.md](/docs/packages/config/package-installation-strategy.md)
