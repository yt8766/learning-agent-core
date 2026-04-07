# 仓库级代理 Skills

本目录用于存放给代码代理读取的仓库级 skills，例如 Codex、Claude Code。

它和 `packages/skills` 不是一回事：

- `packages/skills`
  - 面向运行时
  - 存放 skill registry、skill card、实验区/稳定区的领域实现
- `skills/`
  - 面向代码代理
  - 存放工作流技能说明、脚本、参考资料、模板

## Deep Agents 兼容规范

仓库级代理 skill 默认按 LangChain Deep Agents 的 `SKILL.md` 规范组织：

- `SKILL.md` 顶部必须有 frontmatter
- 最少声明：
  - `name`
  - `description`
- 推荐声明：
  - `version`
  - `publisher`
  - `license`
  - `compatibility`
  - `metadata`
  - `triggers`
  - `recommended-ministries`
  - `recommended-specialists`
  - `allowed-tools`
  - `execution-hints`
  - `compression-hints`
  - `approval-policy`
  - `risk-level`

示例：

```md
---
name: code_review
description: Use this skill for repository code review and regression analysis.
version: '1.0.0'
publisher: workspace
license: Proprietary
compatibility: Requires repository access.
metadata:
  ministry: xingbu-review
triggers:
  - review
recommended-ministries:
  - xingbu-review
recommended-specialists:
  - risk-compliance
allowed-tools:
  - read_local_file
  - list_directory
execution-hints:
  - Focus on regression risk first.
compression-hints:
  - Prefer summarizing long diffs before review.
approval-policy: none
risk-level: low
---
```

后端本地 skill loader 会直接读取这些 frontmatter 字段，生成运行时 manifest 与本地安全评估结果。

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
