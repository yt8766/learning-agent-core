# coder Agent 交接文档

状态：current
文档类型：guide
适用范围：`agents/coder`
最后核对：2026-04-19

## 包定位

`agents/coder` 是代码执行链、工部与兵部能力宿主，承载执行 prompt / schema / runtime helper。

## 当前主要目录

- `src/flows/`
- `src/capabilities/`
- `src/runtime/`
- `src/utils/`

## 修改前先读

- [docs/agents/coder/README.md](/docs/agents/coder/README.md)
- [docs/agents/coder/package-structure-guidelines.md](/docs/agents/coder/package-structure-guidelines.md)
- [docs/project-conventions.md](/docs/project-conventions.md)

## 改动边界

- 这里负责代码执行链路，不负责通用 runtime kernel 或 reviewer 审查链。
- prompt、schema、执行节点应继续聚合在本包宿主，不要重新散进 backend service。
- 任何高风险执行能力都应保留审批门与可观察性语义。

## 验证

- `pnpm exec tsc -p agents/coder/tsconfig.json --noEmit`
- `pnpm --dir agents/coder test`
- `pnpm --dir agents/coder test:integration`

## 交接提醒

- 这类执行 agent 的回归不只体现在类型上，也体现在审批、恢复、sandbox 和输出结构的一致性上。
