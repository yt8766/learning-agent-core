# skills 文档目录

状态：current
适用范围：`docs/skills/`
最后核对：2026-04-14

本目录用于沉淀 `packages/skills` 相关文档。

包边界：

- 职责：
  - 运行时 skill registry、manifest loader、skill source sync 基础能力
- 允许：
  - 运行时 skill card / registry
  - manifest 解析
  - source sync 基础逻辑
- 禁止：
  - 仓库级 `skills/*` 代理技能文档
  - agent graph / flow
- 依赖方向：
  - 只依赖 `@agent/shared`、`@agent/config`
  - 被 backend、agent-core 消费

约定：

- `packages/skills` 的专项文档统一放在 `docs/skills/`
- 新增运行时技能模型、注册机制、技能卡结构或技能协议后，需同步更新本目录文档
- 如果当前只有索引文件，后续可在本目录继续补充专题文档

当前文档：

- [runtime-skills-vs-repo-skills.md](/Users/dev/Desktop/learning-agent-core/docs/skills/runtime-skills-vs-repo-skills.md)
