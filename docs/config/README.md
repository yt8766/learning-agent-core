# config 文档目录

状态：current
文档类型：index
适用范围：`docs/config/`
最后核对：2026-04-16

本目录用于沉淀 `packages/config` 相关文档。

包边界：

- 职责：
  - 运行时 profile、settings schema、默认策略与路径布局
- 允许：
  - settings loader
  - profile / policy / storage 相关 contract
- 禁止：
  - graph、flow、agent 业务编排、工具执行逻辑
- 依赖方向：
  - 不依赖 `@agent/runtime` 或任意 `agents/*`
  - 允许被所有基础包与 app 层消费
- 公开入口：
  - 根入口：`@agent/config`
- 约定：
  - 统一只从 `@agent/config` 根入口导入
  - `settings/*` 作为包内组织目录保留，但不作为消费侧导入入口
  - 根入口优先维护显式命名导出，不继续用整段 `export *` 透传整个 `settings/*`

约定：

- `packages/config` 的专项文档统一放在 `docs/config/`
- 新增功能、配置结构调整、加载规则变化后，需同步更新本目录文档
- 如果当前只有索引文件，后续可在本目录继续补充专题文档

当前文档：

- [runtime-profiles.md](/Users/dev/Desktop/learning-agent-core/docs/config/runtime-profiles.md)
- [package-installation-strategy.md](/Users/dev/Desktop/learning-agent-core/docs/config/package-installation-strategy.md)
