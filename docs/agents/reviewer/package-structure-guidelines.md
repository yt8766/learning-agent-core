# reviewer 包结构规范

状态：current
文档类型：convention
适用范围：`agents/reviewer`
最后核对：2026-04-18

本文档说明 `agents/reviewer` 如何继续作为刑部审查智能体宿主收敛结构。

## 1. 目标定位

`agents/reviewer` 负责：

- `ReviewerAgent`
- `XingbuReviewMinistry`
- review decision prompt / schema
- critique result / specialist finding 的 reviewer 侧输出装配

它不负责：

- runtime orchestration
- tool executor / sandbox / approval service 实现
- coder 执行链或 supervisor workflow route

## 2. 推荐结构

```text
agents/reviewer/
├─ src/
│  ├─ flows/
│  │  ├─ chat/
│  │  └─ ministries/
│  ├─ runtime/
│  ├─ shared/
│  ├─ utils/
│  └─ index.ts
├─ test/
└─ package.json
```

各目录语义：

- `flows/chat/`
  - `ReviewerAgent` 与 chat 节点
- `flows/ministries/xingbu-review/`
  - review prompt、schema 与 ministry 细分实现
- `runtime/`
  - reviewer runtime context
- `shared/`
  - reviewer 域内复用的 schema helper，不替代 `@agent/core`

## 3. 当前收敛策略

当前已经明确：

- `review-prompts.ts` 与 `review-decision-schema.ts`
  - 是 reviewer 域内真实宿主
- 根入口
  - 只暴露稳定 reviewer 公共面
- `runtime` 依赖边界
  - 共享 agent foundation 仅允许通过 `@agent/runtime` 根入口消费
  - runtime facade 仅允许通过 `@agent/runtime` 根入口消费
  - 不允许直接依赖 `packages/runtime/src/*`，也不允许依赖 `runtime/agent-bridges/*` 这类 runtime 内部过渡层

后续继续收敛时：

1. 新的 review 节点优先放在 `flows/chat/` 或 `flows/ministries/xingbu-review/`
2. `shared/` 只留 reviewer 域内复用，不新增第二份 stable contract
3. 对外继续只通过 `@agent/agents-reviewer` 根入口消费
4. 已纳入 root export 测试的 agent、ministry、prompt、schema 继续保持“根入口稳定 + 真实宿主明确”
