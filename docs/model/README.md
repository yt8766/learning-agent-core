# model 文档目录

状态：current
文档类型：index
适用范围：`docs/model/`
最后核对：2026-04-15

本目录用于沉淀 `packages/model` 相关文档。

包边界：

- 职责：
  - provider normalize、chat/embedding factory、模型装配基础能力
- 允许：
  - provider config normalize
  - chat / embedding model factory
  - fallback candidate 基础逻辑
- 禁止：
  - prompt、graph、flow、业务 heuristic
- 依赖方向：
  - 只依赖 `@agent/config` 和第三方模型 SDK
  - 被 backend、agent-core、memory 消费
- 公开入口：
  - 根入口：`@agent/model`
- 约定：
  - 统一只从 `@agent/model` 根入口导入
  - `chat/*`、`embeddings/*`、`providers/*` 作为包内组织目录保留，但不作为消费侧导入入口

约定：

- `packages/model` 的专项文档统一放在 `docs/model/`
- 新增模型路由、模型策略、提供商适配或成本约束后，需同步更新本目录文档
- 如果当前只有索引文件，后续可在本目录继续补充专题文档

当前文档：

- [provider-and-fallback.md](/Users/dev/Desktop/learning-agent-core/docs/model/provider-and-fallback.md)
