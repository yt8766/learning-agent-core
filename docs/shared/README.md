# shared 文档目录

状态：current
适用范围：`docs/shared/`
最后核对：2026-04-14

本目录用于沉淀 `packages/shared` 相关文档。

包边界：

- 职责：
  - 稳定 DTO、Record、Enum、跨端展示 contract
- 允许：
  - 纯类型
  - 纯 normalize / label helper
- 禁止：
  - prompt、retry、LLM、service、graph、node、executor、repository、副作用逻辑
- 依赖方向：
  - 不依赖其他业务包
  - 被 apps、backend、agent-core、基础包共同消费

约定：

- `packages/shared` 的专项文档统一放在 `docs/shared/`
- 新增共享类型、公共协议、跨端契约或兼容约束后，需同步更新本目录文档
- 如果当前只有索引文件，后续可在本目录继续补充专题文档
