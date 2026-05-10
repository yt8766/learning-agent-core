# Repo Agent Skills

状态：current
文档类型：index
适用范围：`.agents/skills/`
最后核对：2026-05-10

本目录承载给 Codex / Claude Code 等代码代理读取的仓库级代理技能，不承载运行时 skill registry、skill card 或后端技能持久化模型。

运行时技能边界在 `packages/skill`；两类 skill 的区别见 [Runtime Skills vs Repo Skills](/docs/skills/runtime-skills-vs-repo-skills.md)。

## 当前技能

- `auto-commit-push`
- `brainstorming`
- `clone-website`
- `dispatching-parallel-agents`
- `executing-plans`
- `finishing-a-development-branch`
- `frontend-design`
- `receiving-code-review`
- `requesting-code-review`
- `subagent-driven-development`
- `systematic-debugging`
- `test-driven-development`
- `ui-ux-pro-max`
- `use-x-chat`
- `using-git-worktrees`（已禁用：本仓库规范禁止使用 `git worktree`）
- `using-superpowers`
- `vercel-react-best-practices`
- `verification-before-completion`
- `writing-plans`
- `writing-skills`
- `x-card`
- `x-chat-provider`
- `x-components`
- `x-markdown`
- `x-request`

## 目录约束

- 每个技能目录必须有 `SKILL.md`。
- 需要附加材料时，优先使用 `references/`、`scripts/`、`assets/`。
- 不要把运行时 skill card、registry 或 source sync 实现写进本目录。
