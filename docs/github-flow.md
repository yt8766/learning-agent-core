# GitHub Flow 流程规范

本文档定义本项目的 GitHub Flow 协作方式。核心目标只有两个：

- `main` 始终保持可发布、可部署、可回滚
- `main` 保持线性提交历史，避免无意义的分叉和合并噪音

## 1. 分支模型

本项目采用单主干开发：

- `main`：唯一长期存在的稳定分支
- `feature/*`：功能开发分支
- `fix/*`：普通缺陷修复分支
- `hotfix/*`：线上或主干紧急修复分支
- `chore/*`：工程配置、脚手架、依赖、CI 文档等变更

约束：

- 禁止直接提交到 `main`
- 所有变更必须先进入分支，再通过 Pull Request 合入 `main`
- 分支应短生命周期，小步提交，尽快合并

建议命名：

- `feature/session-replay`
- `fix/tool-timeout`
- `hotfix/main-build-failure`
- `chore/ci-cache-tuning`

## 2. 为什么当前不设 develop 或“优化分支”

当前项目不额外设置 `develop`、`release`、“优化分支”这类长期分支，原因不是流程不够高级，而是现阶段没有这个必要。

这样做的好处：

- 分支模型简单，所有人都知道 `main` 是唯一主干
- 减少分支漂移、重复同步、反复合流带来的管理成本
- 降低“改动到底该进哪个长期分支”的沟通成本
- 更适合当前迭代速度快、需求仍在收敛期的项目阶段

如果现在就引入额外长期分支，通常会带来这些问题：

- 一份改动要在多个分支之间来回同步
- 修复和功能容易出现“主干有、开发分支没有”或反过来的不一致
- 团队成员开始依赖 merge 来同步长期分支，历史很快变乱
- PR 审查、回滚、排障时需要额外理解分支流向

因此，当前项目的默认策略是：

- 只保留 `main` 作为长期稳定主干
- 所有业务开发都走短生命周期分支
- 通过 `rebase` 而不是长期并行分支来吸收主干最新变更

这个策略更接近很多现代框架仓库的主流做法：默认单主干，只有当某一类变更真的需要独立节奏时，才新增长期分支。

## 3. 主流程

### 第一步：从最新 `main` 拉出分支

```bash
git checkout main
git pull origin main
git checkout -b feature/xxx
```

### 第二步：在功能分支开发并提交

提交原则：

- 一次提交只做一类变更
- 提交信息要能说明目的，而不是只描述动作
- 提交前至少完成本地必要校验

建议在提交前执行：

```bash
pnpm lint:eslint
pnpm lint:prettier
pnpm lint:tsc
pnpm test
```

### 第三步：推送分支并创建 PR

```bash
git push origin feature/xxx
```

PR 描述至少应包含：

- 变更目标
- 影响范围
- 验证方式
- 是否有风险点或回滚点

### 第四步：合并前必须 rebase 到最新 `main`

这是本项目最重要的约束。任何要进入 `main` 的分支，在合并前都必须先 rebase 到最新 `main`，确保 `main` 的历史是线性的。

```bash
git checkout main
git pull origin main
git checkout feature/xxx
git rebase main
```

如果远端 `main` 更新较快，也可以直接：

```bash
git fetch origin
git rebase origin/main
```

处理完冲突后继续：

```bash
git add <resolved-files>
git rebase --continue
```

rebase 完成后，因为提交历史被改写，需要强推当前分支：

```bash
git push --force-with-lease origin feature/xxx
```

要求：

- 使用 `--force-with-lease`，不要使用裸 `--force`
- 只有自己的功能分支允许这样推送
- 已进入多人共同维护阶段的共享分支，原则上不要随意改写历史

### 第五步：通过 PR 合入 `main`

合入 `main` 时，默认采用能保持线性历史的方式：

- 优先使用 `Rebase and merge`
- 如果仓库设置不支持，可在本地 rebase 后再 fast-forward 合入
- 不使用会在 `main` 生成 merge commit 的普通 `Create a merge commit`

结论：

- `main` 只接受线性历史
- 进入 `main` 前必须完成 rebase
- 不把“同步 main”这件事交给 merge commit

## 4. Rebase、Cherry-pick、Merge 的使用边界

### 4.1 什么时候用 rebase

`rebase` 是默认方案，用来解决“我的分支要进入 `main`”的问题。

适用场景：

- 功能分支准备合入 `main`
- 需要把最新 `main` 变更平滑接入当前分支
- 希望整理本地提交顺序，让 PR 更清晰

目标：

- 保持 `main` 线性历史
- 减少无意义 merge commit
- 让问题定位和回滚更直接

### 4.2 什么时候用 cherry-pick

`cherry-pick` 不是默认流程，只在“我只想拿走某几个提交”时使用。

适用场景：

- 从 `hotfix/*` 把紧急修复补回其他开发分支
- 从某个功能分支提取一两个独立提交到另一个分支
- 回补某次遗漏修复
- 做有选择的 backport

不适用场景：

- 用它代替日常分支同步
- 用它批量搬运大量连续提交
- 本来应该直接 rebase 却为了省事到处摘提交

示例：

```bash
git checkout feature/another-branch
git cherry-pick <commit-sha>
```

### 4.3 什么时候用 merge

普通 `merge` 不是进入 `main` 的默认方案，只在确实需要“保留分支合流语义”时使用。

适用场景：

- 非 `main` 分支之间的临时集成
- 团队明确需要保留一次分支汇合关系
- 某些共享协作分支不适合频繁改写历史

不适用场景：

- 功能分支合入 `main`
- 只是为了同步最新 `main`
- 只想解决线性更新问题

明确规则：

- `main` 不接收普通 merge commit
- `main` 的同步动作一律优先 `rebase`
- `merge` 是例外手段，不是默认手段

## 5. 未来什么时候再引入长期开发分支

未来如果项目进入更复杂的协作阶段，可以再考虑增加一条类似 Vue `minor` 的长期分支，例如 `next` 或 `minor`。但前提必须明确，不建议为了“看起来更专业”而提前引入。

适合新增长期分支的信号：

- 稳定修复和大功能开发已经明显形成两种不同节奏
- 一批新能力需要持续几周以上开发，且不适合频繁进入 `main`
- 这些新能力会引入 API 变化、架构升级或较高回归风险
- 团队需要一条相对稳定的主干，同时还要并行推进下一阶段能力
- 已经开始出现“同一批实验性改动反复从主干拉出又撤回”的情况

这时可以升级为：

- `main`：稳定线，只接收 bugfix、chore、低风险改动
- `minor` 或 `next`：下一阶段功能线，承接新功能和较大改造

但即使进入这个阶段，也不意味着可以放弃主干纪律。仍然应该坚持：

- 每条长期分支都有明确职责
- 不让多个长期分支承担同一种工作
- `cherry-pick` 只做必要的补丁传播
- 是否允许 `minor/next -> main` 使用 merge，要单独约定，不能默认放开

如果未来真的引入 `minor/next`，建议采用类似下面的规则：

- 新 API、新架构、新能力先进入 `minor/next`
- 稳定修复优先进入 `main`
- 必要时把稳定修复 `cherry-pick` 到 `minor/next`
- 阶段成熟后，再按发布策略从 `minor/next` 收敛回 `main`

换句话说，是否新增长期分支，不取决于仓库大小，而取决于“是否已经出现两种必须隔离的交付节奏”。

## 6. 推荐的日常操作模板

### 场景 A：普通功能开发

```bash
git checkout main
git pull origin main
git checkout -b feature/xxx

# 开发中...

git add .
git commit -m "feat: add xxx"
git push origin feature/xxx
```

合并前：

```bash
git fetch origin
git rebase origin/main
git push --force-with-lease origin feature/xxx
```

然后在 GitHub 发起 PR，并使用 `Rebase and merge` 合入。

### 场景 B：PR 期间 `main` 又前进了

```bash
git fetch origin
git checkout feature/xxx
git rebase origin/main
git push --force-with-lease origin feature/xxx
```

结论：

- 先 rebase
- 再重新过 CI
- 再合并

### 场景 C：线上紧急修复

```bash
git checkout main
git pull origin main
git checkout -b hotfix/xxx
```

修复后走 PR，并优先进入 `main`。如果还有其他正在开发的分支需要这个修复，再按需对这些分支执行 `cherry-pick`。

### 场景 D：只把一个修复提交带到另一个分支

```bash
git checkout feature/target-branch
git cherry-pick <commit-sha>
```

这时不需要为了单个修复把整个分支历史都合过来。

## 7. PR 合并准入规则

PR 合入前至少满足：

- 已完成代码自检
- 已 rebase 到最新 `main`
- CI 通过
- 关键变更已完成 review
- 不存在未确认的冲突处理风险

仓库建议开启以下保护规则：

- 禁止直接推送到 `main`
- Require a pull request before merging
- Require status checks to pass before merging
- Require branches to be up to date before merging
- Require linear history
- 建议关闭 `merge commit` 合并方式
- 建议保留 `rebase merge`

如果仓库允许 `squash merge`，也要谨慎使用。它同样能保持线性历史，但会丢失原子提交边界。本项目默认优先保留原提交序列，因此优先 `rebase and merge`。

## 8. 冲突处理原则

遇到冲突时：

- 先理解 `main` 为什么变了
- 再确认当前分支的业务意图
- 最后做最小必要的冲突解决

不要：

- 为了尽快结束冲突，直接覆盖 `main` 上的新逻辑
- 不理解差异就盲目接受 `ours/theirs`
- 用一次 merge 掩盖本应认真解决的冲突

## 9. 一句话规则

可以把本项目的 GitHub Flow 记成一句话：

> 所有变更从 `main` 拉分支，合入 `main` 前必须 rebase 到最新主干，`main` 只保留线性历史；`cherry-pick` 用于选择性摘提交，`merge` 仅在例外场景使用。
