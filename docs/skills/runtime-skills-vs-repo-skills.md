# Runtime Skills vs Repo Skills

状态：current
文档类型：reference
适用范围：`packages/skill`、`.agents/skills/`
最后核对：2026-04-26

## 1. 这篇文档说明什么

本文档专门解释仓库里两种“skill”的区别，避免把运行时 skill 和给代码代理读的 repo skill 混在一起。

## 2. 两类 skill 的边界

### `packages/skill` / `@agent/skill`

这是运行时技能层，服务对象是系统运行时。

术语约定：

- 物理宿主当前位于 `packages/skill`
- 新代码语义统一使用 `@agent/skill`

当前职责：

- skill registry
- skill manifest loader
- skill source sync 基础能力
- 运行时 skill card / skill source 治理相关基础设施

不应该放：

- `SKILL.md`
- 仓库级代理说明
- Codex / Claude Code 的工作流技能文档

### `.agents/skills/`

这是仓库级代理技能层，服务对象是代码代理。

当前职责：

- 给 Codex / Claude Code 提供技能说明；本仓库以 `.agents/skills` 作为 Codex 技能发现入口
- 通过 `SKILL.md`、`references/`、`scripts/`、`assets/` 组织工作流知识
- 支撑代码审查、学习流审计、OpenClaw 工作区审计、发布检查等代理工作流

不应该放：

- 运行时 skill registry
- skill card 持久化模型
- 后端运行时 source sync 主逻辑

## 3. 当前目录结构

运行时 skill：

```text
packages/
└─ skill/
   ├─ src/
   ├─ test/
   └─ package.json
```

仓库级代理 skill：

```text
.agents/skills/
├─ README.md
├─ code-review/
├─ learning-flow-audit/
├─ openclaw-workspace-audit/
└─ release-check/
```

## 4. 容易犯错的地方

- 不要把代理 skill 的说明文档写进 `packages/skill`
- 不要把运行时 skill card / registry 写到 `.agents/skills/`
- 不要因为都叫 skill，就让前后端、后端运行时、代码代理共用一套目录语义

## 5. 当前状态

当前已经完成：

- `packages/runtime` 与 backend 上层代码已切到 `@agent/skill`
- 运行时数据默认目录已切到 `data/skills`
- 仓库级代理技能已迁入 `.agents/skills`，`workspace-skills` source 与 sandbox `find-skills` 均从该目录读取
- 旧的兼容包与 alias 已删除，仓库只保留 `@agent/skill`

## 6. 继续阅读

- [.agents/skills/README.md](/.agents/skills/README.md)
- [repo skills 文档目录](/docs/skills/README.md)
- [目录地图](/docs/maps/repo-directory-overview.md)
