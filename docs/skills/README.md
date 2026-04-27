# repo skills 文档目录

状态：current
文档类型：index
适用范围：`docs/skills/`
最后核对：2026-04-18

本目录用于沉淀仓库级 `.agents/skills/*` 代理技能相关文档。

这里描述的是给 Codex / Claude Code 这类代码代理读取的仓库技能，不是 `packages/skill-runtime` 的运行时技能系统。

包边界：

- 职责：
  - 仓库级代理技能的目录规范、术语边界与使用约定
  - `.agents/skills/*` 与 `packages/skill-runtime` 的语义区分
- 允许：
  - 代理技能目录结构说明
  - `SKILL.md`、`references/`、`scripts/`、`assets/` 组织规则
  - 代理技能与运行时技能的边界说明
- 禁止：
  - 运行时 skill registry / manifest loader / source sync 主实现说明
  - `@agent/skill-runtime` 的包级实现规范
  - agent graph / flow 主链规则
- 依赖方向：
  - 作为仓库技能与目录规范说明被人类或代码代理阅读
  - 运行时技能系统请改看 [docs/packages/skill-runtime/README.md](/docs/packages/skill-runtime/README.md)

约定：

- `.agents/skills/*` 的专项说明统一放在 `docs/skills/`
- `packages/skill-runtime` 的包级实现与结构规范统一放在 `docs/packages/skill-runtime/`
- 新增仓库级代理技能、调整技能目录语法或更新技能边界后，需同步更新本目录文档
- 如果当前只有索引文件，后续可在本目录继续补充专题文档

当前文档：

- [runtime-skills-vs-repo-skills.md](/docs/skills/runtime-skills-vs-repo-skills.md)
