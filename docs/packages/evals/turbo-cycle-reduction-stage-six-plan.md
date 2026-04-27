# Turbo 循环依赖治理六阶段方案

状态：snapshot
文档类型：plan
适用范围：`packages/runtime`、`agents/*`、根级 Turbo 验证链路
最后核对：2026-04-16

本主题配套文档：

- [验证体系规范](/docs/packages/evals/verification-system-guidelines.md)
- [Turbo 验证二阶段迁移方案](/docs/packages/evals/turbo-verification-stage-two-plan.md)
- [Turbo Demo 三阶段迁移方案](/docs/packages/evals/turbo-demo-stage-three-plan.md)

本文只覆盖：

- `runtime <-> agents/*` 循环依赖的现状
- 为什么当前 Turbo 主链还不能直接回归 `^typecheck` / `^build`
- 下一阶段应该优先拆哪条边

## 1. 当前结论

截至 `2026-04-16`，阻碍更深 Turbo 化的核心不是 Demo，也不是受影响范围筛选，而是工作空间依赖图里仍存在一组强连通分量：

- `@agent/runtime`
- `@agent/agents-supervisor`
- `@agent/agents-coder`
- `@agent/agents-reviewer`
- `@agent/agents-data-report`

当前真实依赖关系可概括为：

- `@agent/runtime -> @agent/agents-supervisor`
- `@agent/runtime -> @agent/agents-coder`
- `@agent/runtime -> @agent/agents-reviewer`
- `@agent/runtime -> @agent/agents-data-report`
- `@agent/agents-supervisor -> @agent/runtime`
- `@agent/agents-supervisor -> @agent/agents-coder`
- `@agent/agents-supervisor -> @agent/agents-reviewer`
- `@agent/agents-coder -> @agent/runtime`
- `@agent/agents-reviewer -> @agent/runtime`
- `@agent/agents-data-report -> @agent/agents-supervisor`

因此当前最稳妥的事实判断是：

- Turbo 的 affected 验证已经可用
- Turbo 的 root governance 已经可用
- 但 Turbo 还不能安全恢复成依赖 package graph 的 `^typecheck` / `^build` 主编排

## 2. 当前为什么还能跑

当前仓库之所以已经能跑：

- `pnpm typecheck:affected`
- `pnpm test:unit:affected`
- `pnpm test:integration:affected`
- `pnpm verify:affected`

不是因为循环依赖被解决了，而是因为我们做了一个明确的阶段性取舍：

- `turbo:typecheck`
- `turbo:test:unit`
- `turbo:test:integration`

这些任务当前默认不依赖 `^typecheck`、`^test` 或 `^build`。

换句话说，当前策略是：

- 让 Turbo 负责筛选、并发、缓存
- 暂时不让 Turbo 负责这些验证层的 package graph 拓扑排序

这也是为什么：

- `pnpm exec turbo run turbo:typecheck --filter=@agent/runtime --dry-run=json`

当前能稳定输出单任务，而不会沿依赖图继续展开。

## 3. 为什么不直接“删依赖”

最危险也最容易误判的做法，是为了消除 Turbo warning，直接把几个 `package.json` 里的 workspace 依赖删除。

当前不推荐这样做，原因有三点：

### 3.1 这些依赖不是表面噪音

从当前 `package.json` 看，环不是单条误引：

- `runtime` 直接依赖多个 agent 宿主
- `supervisor` 反向依赖 `runtime`
- `coder` 与 `reviewer` 也直接依赖 `runtime`
- `data-report` 还依赖 `supervisor`

这更像真实架构耦合，而不是一个拼写错误。

### 3.2 贸然删依赖会把架构问题伪装成构建问题

如果只是在 `package.json` 层删边，但代码层仍然通过导入、动态装配、graph 注册或运行时约定耦合，结果通常是：

- Turbo warning 消失
- 但类型、构建或运行时在别处爆炸

这不是治理，是把问题后移。

### 3.3 我们需要拆的是“职责边界”，不是“依赖声明”

真正要拆的，是：

- 哪些 contract 属于稳定接口
- 哪些 registry / descriptor / facade 应该下沉到 `core`、`shared`、`runtime` 或独立包
- 哪些 agent 宿主只应暴露稳定描述，不该被 runtime 直接强依赖实现包

## 4. 下一阶段最优先拆哪条边

当前最优先的不是先动 `coder` 或 `reviewer`，而是优先收敛：

- `@agent/runtime -> @agent/agents-supervisor`

原因：

### 4.1 `supervisor` 是环中的放大器

`supervisor` 当前既：

- 依赖 `runtime`
- 又继续依赖 `coder`
- 又继续依赖 `reviewer`

同时 `data-report` 还依赖 `supervisor`。

这意味着只要 `runtime` 直接依赖 `supervisor`，整组环就会持续被放大。

### 4.2 如果先把 `runtime -> supervisor` 改成稳定 contract，收益最大

理想收敛方向不是让 runtime 直接依赖 supervisor 实现包，而是让 runtime 只依赖其中一类稳定能力，例如：

- workflow descriptor contract
- subgraph descriptor contract
- bootstrap registry contract
- ministry capability descriptor

这些 contract 更适合落在：

- `packages/core`
- 历史迁移期的 compat 层
- 或一个更稳定、无反向依赖的 runtime-facing contract 包

### 4.3 `coder` / `reviewer` 之后更像第二层拆分

等 `runtime <-> supervisor` 关系收薄后，再看：

- `runtime -> coder`
- `runtime -> reviewer`

会更容易判断它们到底是：

- 真需要直接依赖
- 还是只需要抽成 executor / specialist descriptor contract

## 5. 推荐的六阶段路线

### 5.1 第一步：识别 runtime 实际消费了 supervisor 的什么

不要先删依赖，先回答：

- runtime 从 supervisor 真正拿了哪些导出
- 这些导出是实现细节，还是稳定 contract

输出物建议是一个清单：

- 导出符号
- 被谁使用
- 应迁移到哪里

阶段性状态：

- 本步骤已完成，产出见 [Runtime-Agent 循环依赖消费清单](/docs/packages/evals/runtime-agent-cycle-audit.md)

### 5.2 第二步：抽离稳定 contract

把 runtime 真正需要的 supervisor-facing 内容，迁到稳定边界：

- schema-first contract 优先放 `packages/core`
- 展示组合或兼容 re-export 才考虑 `packages/shared`

目标不是复制一份逻辑，而是让 runtime 不再直接握住 supervisor 的实现包。

当前状态：

- 当时已经按批次把 bootstrap、workflow preset、research planning、workflow route、specialist route、execution-step、router facade 与 supervisor ministry facade 这几组 runtime-facing contract 下沉到 `@agent/shared`
- runtime 的 research / execute / review / pipeline graph 参数位当时也已切到 shared contract
- `HubuSearchMinistry` / `LibuDocsMinistry` 具体类创建继续只保留在 orchestration 装配点
- `supervisor` 当时保留 compat re-export
- 后续仍需继续迁移实现级依赖

### 5.3 第三步：把 runtime 改成依赖 contract / registry，而不是依赖 agent 实现

这里的关键动作通常是：

- 用 descriptor / adapter / facade 替换直接实现依赖
- 让注册发生在更外层的装配点，而不是在 runtime 包内部硬连 agent 包

阶段性状态：

- `LibuRouterMinistry` 的 runtime-facing 参数位已基本完成 contract 化
- `HubuSearchMinistry` / `LibuDocsMinistry` 的 runtime-facing 参数位已完成第一轮 contract 化
- `XingbuReviewMinistry` 的 runtime-facing 参数位已完成第一轮 contract 化
- `GongbuCodeMinistry` / `BingbuOpsMinistry` 的 runtime-facing 参数位已完成第一轮 contract 化
- `ExecutorAgent` 的 recovery-only 消费面已缩到 `ApprovedExecutionAgentLike`
- `appendDataReportContext` / `buildDataReportContract` 当时已下沉到 `@agent/shared`
- runtime 对 `@agent/agents-supervisor` 的剩余直接引用，已明显收缩到装配点、本地 compat barrel 和少量 graph wiring
- runtime 对 `@agent/agents-reviewer` 的剩余直接引用，已收缩到装配点与本地 compat barrel
- runtime 对 `@agent/agents-coder` 的剩余直接引用，已收缩到装配点与本地 compat barrel
- runtime 对 `@agent/agents-data-report` 的直接引用已清零
- 但 `supervisor` 与 `coder` 的装配级依赖仍在，因此还不能宣称 Turbo SCC 已解除

### 5.4 第四步：重新评估 `supervisor -> coder/reviewer`

等 `runtime <-> supervisor` 收敛之后，再审：

- `supervisor -> coder`
- `supervisor -> reviewer`

看是否还能进一步下沉成 specialist contract。

### 5.5 第五步：重新跑 Turbo graph

只有在上面几步完成后，才值得重新尝试：

```bash
pnpm exec turbo run typecheck --filter=@agent/runtime --dry-run=json
pnpm exec turbo run build --filter=@agent/runtime --dry-run=json
```

目标是确认：

- package graph 中的强连通分量是否真正缩小
- 是否具备恢复 `^typecheck` / `^build` 的条件

### 5.6 第六步：决定是否把 Turbo-only 通道收回主任务

如果环被收敛到足够程度，再评估是否：

- 让 `turbo:typecheck` 重新并入 `typecheck`
- 让 `turbo:test:unit` / `turbo:test:integration` 进一步靠近正式主链

在这之前，不要为了“名字更统一”而过早合并。

## 6. 当前阶段的完成定义

截至 `2026-04-16` 本轮进展：

- 已完成：
  - workflow / helper / route contract 下沉到 `@agent/shared`
  - router / ministry / execution facade 的第一轮 contract 化
  - data-report runtime-facing contract helper 下沉到 `@agent/shared`
  - runtime 对 supervisor 三个主要 Ministry 的参数位 contract 化
  - runtime 对 reviewer/coder 主要 Ministry 参数位的第一轮 contract 化
- 仍未完成：
  - supervisor / coder / reviewer 的装配级依赖是否还能继续外提或降级为更薄 registry
  - Turbo `^typecheck` / `^build` 的试验性恢复

当前这份六阶段方案输出后，可以认为本轮已经完成的是：

- 已确认真实循环依赖簇
- 已明确最优先拆分目标是 `runtime -> supervisor`
- 已明确当前 Turbo-only 通道为什么成立
- 已明确下一阶段不是“删依赖”，而是“抽 contract、薄装配、再收 graph”
- 已完成两批纯 contract 下沉：
  - `listBootstrapSkills`
  - workflow preset registry / plan contract
- 已完成第三批研究来源规划与时效性 helper contract 下沉
- 已完成第四批 workflow route contract 下沉
- 已完成第五批 specialist routing contract 下沉
- 已完成第六批 execution-step contract 下沉
- 已完成第七批 router interface 收敛

## 7. 还没有做的事

这份方案完成后，仍然还有明确未做项：

- 已完成 `runtime` 实际消费 `supervisor` 的导出清单审计
- 已完成第一批小切口 `listBootstrapSkills` 的 contract 下沉
- 已完成第二批 workflow preset contract 下沉
- 已完成第三批研究来源规划 contract 下沉
- 已完成第四批 workflow route contract 下沉
- 已完成第五批 specialist routing contract 下沉
- 已完成第六批 execution-step contract 下沉
- 已完成第七批 router interface 收敛
- 还没有减少任何 workspace 边
- 还没有恢复 `^typecheck` / `^build`
- 还没有处理更重的 specialist / ministry / executor 实现依赖：
  - `LibuRouterMinistry`
  - `HubuSearchMinistry`
  - `LibuDocsMinistry`
  - 各类 Ministry / Executor 实现类

这些都属于下一轮实施工作，而不是本轮文档收敛的一部分。
