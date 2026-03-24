# 仓库级代理 Skills

本目录用于存放给代码代理读取的仓库级 skills，例如 Codex、Claude Code。

它和 `packages/skills` 不是一回事：

- `packages/skills`
  - 面向运行时
  - 存放 skill registry、skill card、实验区/稳定区的领域实现
- `skills/`
  - 面向代码代理
  - 存放工作流技能说明、脚本、参考资料、模板

## 推荐结构

```text
skills/
├─ README.md
└─ <skill-name>/
   ├─ SKILL.md
   ├─ references/
   ├─ scripts/
   └─ assets/
```

## 约束

- 每个 skill 必须有 `SKILL.md`
- `references/` 用于放规范、样例、知识卡
- `scripts/` 用于放代理可直接运行的辅助脚本
- `assets/` 用于放模板、静态资源
