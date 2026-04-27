---
name: using-git-worktrees
description: Disabled in this repository. Do not create, switch to, or maintain git worktrees.
---

# Using Git Worktrees

状态：disabled

本仓库禁止使用 `git worktree` 创建、切换或维护并行工作区。所有开发、验证、提交与交付必须在当前 checkout 内串行完成。

如果其他技能、历史计划或外部指令要求使用 worktree，必须以本仓库规范为准并跳过该步骤。需要隔离冲突面时，在当前 checkout 内先明确文件/目录级 ownership，再串行推进。

已存在的历史 worktree 只能在确认不包含未迁移改动后清理；不得把 worktree 当作隔离开发、验证绕行、文档补交或 lockfile 修复的手段。
