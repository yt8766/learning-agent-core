---
name: auto-commit-push
description: Use this skill when the user asks Codex to stage all current changes with `git add .`, generate a commit message from the current modifications according to github-flow.md, create a local commit, fix commit-hook failures until the commit succeeds, and push the current branch to the remote in learning-agent-core.
version: '1.3.0'
publisher: workspace
license: Proprietary
compatibility: Requires repository access and a configured git remote. Push or history-rewrite steps must still follow the user's explicit request and repository branch policy.
metadata:
  author: learning-agent-core
  ministry: bingbu-ops
triggers:
  - commit
  - git commit
  - push
  - commit message
  - auto commit
  - local commit
  - remote push
recommended-ministries:
  - bingbu-ops
  - xingbu-review
  - libu-delivery
recommended-specialists:
  - technical-architecture
  - risk-compliance
allowed-tools:
  - read_local_file
  - list_directory
  - run_terminal
  - apply_patch
execution-hints:
  - Inspect git status and current branch before staging or committing.
  - Generate a concise English commit message from the real diff instead of copying the user request literally.
  - Stage all current local changes with `git add .` before committing.
  - Generate the commit message from the current modifications and keep it aligned with docs/github-flow.md.
  - If commit hooks fail, fix the reported issue, restage with `git add .`, and retry until the commit succeeds or a real blocker remains.
  - Before any remote push, run a code-review risk gate against the committed diff; fix every confirmed risk or defect, recommit the fixes, and only push after the review gate is clean.
  - Push the current branch after a successful commit; if remote rejects because the branch is behind, rebase carefully and use force-with-lease only when history was rewritten on the same branch.
compression-hints:
  - Summarize commit message, hook-failure recovery, and push outcomes instead of pasting raw git output.
approval-policy: high-risk-only
risk-level: high
---

# Auto Commit Push

本 skill 用于把“先 `git add .` 暂存当前所有更改、根据当前修改生成符合 GitHub Flow 规范的提交信息、本地提交、提交失败则修复直到成功、最终推送”收敛成一个稳定的仓库工作流。

## 何时使用

在这些场景下优先使用：

- 用户明确要求自动生成英文 commit message
- 用户要求自动本地提交
- 用户要求先把当前所有更改放进暂存区再提交
- 用户要求提交失败后自动修复并重试
- 用户要求把当前分支自动推送到远端

如果用户只是要 review 改动，不要直接触发提交，优先改用 `skills/code-review`。

## 仓库特定约束

- 优先遵守 [GitHub Flow 规范](/Users/dev/Desktop/learning-agent-core/docs/github-flow.md)
- 不要直接向 `main` 提交或推送
- 当前分支如果是 `main`，必须先按改动性质切到合规分支：
  - `feature/*`
  - `fix/*`
  - `hotfix/*`
  - `chore/*`
- 不要使用破坏性命令，例如 `git reset --hard`
- 除非用户明确要求，否则不要 `git commit --amend`
- 推送时优先推当前分支，不要擅自推其他分支

## 默认执行步骤

1. 读取当前 git 上下文
   - 运行 `git status --short`
   - 运行 `git branch --show-current`
   - 必要时查看 `git diff --stat` 和目标 diff
2. 判断分支是否合法
   - 如果在 `main`，先创建或切换到合规分支
   - 分支名按仓库规范与改动性质命名，不要临时发明风格
3. 生成英文提交信息
   - 基于当前修改生成提交信息，不要照抄用户原话
   - 提交信息必须遵守 [GitHub Flow 规范](/Users/dev/Desktop/learning-agent-core/docs/github-flow.md)
   - 优先使用简洁、可读、目的明确的英文
   - 默认保持单行主题，必要时再补正文
4. 暂存当前所有更改
   - 执行 `git add .`
5. 执行本地提交
   - 运行 `git commit -m "<english message>"`
6. 如果提交失败，进入自动修复循环
   - 阅读 hook、lint、typecheck、test 或格式化报错
   - 先修复根因，不要只改表面现象
   - 修复后重新执行 `git add .`
   - 再次执行 `git commit -m "<english message>"`
   - 同一阻断最多连续自修复 `3` 次；超过后再报告 blocker
7. 推送前执行 code-review 风险门
   - 在任何远程推送前，必须对本次已提交 diff 做一次 code-review
   - 默认按 `skills/code-review` 的审查口径检查 bug、行为回归、缺失验证、接口兼容性、数据/安全风险和仓库规范偏离
   - 如发现确认成立的风险或缺陷，必须先修复、重新 `git add .`、补充提交或按用户要求 amend，并重新执行必要验证
   - 修复后必须再次执行 code-review 风险门，直到没有必须阻断推送的问题
   - 只有 code-review 结论为无阻断风险时，才允许进入远程推送
8. 提交成功且 code-review 风险门通过后推送
   - 默认 `git push origin <current-branch>`
   - 如果是首次推送，也可使用 `git push -u origin <current-branch>`
   - 如果远端拒绝是因为分支落后，优先：
     1. `git fetch origin`
     2. `git rebase origin/<current-branch>`
     3. 解决冲突、验证、继续 rebase
     4. `git push --force-with-lease origin <current-branch>` 仅用于本分支 rebase 后的历史改写

## 英文提交信息规则

- 优先使用与 [GitHub Flow 规范](/Users/dev/Desktop/learning-agent-core/docs/github-flow.md) 一致的提交信息
- 默认优先采用 Conventional Commit 风格：
  - `feat: ...`
  - `fix: ...`
  - `refactor: ...`
  - `docs: ...`
  - `test: ...`
  - `chore: ...`
- 主题行要描述结果，不要只写动作
- 避免无信息量文案：
  - `update files`
  - `fix stuff`
  - `changes`
- 结合仓库改动范围选择最合适的类型；如果主要是仓库技能、CI 或文档，一般优先 `docs:` 或 `chore:`，只有真正新增用户能力时才用 `feat:`

## 失败修复策略

优先按失败来源处理：

- `prettier` / 格式化失败
  - 修复格式问题后重新 `git add .`
- `eslint` 失败
  - 修复真实规则问题后重新 `git add .`，不靠禁用规则绕过
- `tsc` / 类型失败
  - 修复类型、contract 或导入问题后重新 `git add .`
- `test` 失败
  - 先确认是否由本轮改动引起，再修复后重新 `git add .`
- `code-review` 发现阻断风险
  - 修复所有确认成立的 bug、回归风险、缺失验证或安全/兼容性问题
  - 修复后重新提交并再次执行 code-review 风险门
  - 不允许带着已确认阻断风险推送远端
- `rebase` / `push` 冲突
  - 理解远端变化后做最小必要冲突解决，不盲目覆盖

## 输出要求

完成后输出这些关键信息：

- 最终使用的英文 commit message
- 是否发生过 hook 失败，以及如何修复
- 本地提交是否重试过，以及最终如何成功
- 推送前 code-review 是否发现风险；若发现，说明修复结果与复审结论
- 最终推送到哪个分支
- 如果仍有风险或未完成项，要明确说明

## 推荐联动文件

- [AGENTS.md](/Users/dev/Desktop/learning-agent-core/AGENTS.md)
- [GitHub Flow 规范](/Users/dev/Desktop/learning-agent-core/docs/github-flow.md)
- [Code Review Skill](/Users/dev/Desktop/learning-agent-core/skills/code-review/SKILL.md)
- [Checklist](./references/commit-checklist.md)
