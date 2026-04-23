# reviewer Agent 交接文档

状态：current
文档类型：guide
适用范围：`agents/reviewer`
最后核对：2026-04-19

## 包定位

`agents/reviewer` 是 review / 刑部审查链路宿主，承载 review decision prompt、schema 与 gate 逻辑。

## 当前主要目录

- `src/flows/`
- `src/runtime/`
- `src/shared/`
- `src/utils/`

## 修改前先读

- [docs/agents/reviewer/README.md](/docs/agents/reviewer/README.md)
- [docs/agents/reviewer/package-structure-guidelines.md](/docs/agents/reviewer/package-structure-guidelines.md)
- [docs/evals/README.md](/docs/evals/README.md)

## 改动边界

- 这里负责 reviewer 审查链，不负责通用 contract 或 runtime 主链编排。
- review decision 的 prompt、schema 与解析规则应保持一致演进，不要只改其中一层。
- 若评审结果需要跨包共享，应优先抽到 `packages/core` 的稳定 contract。

## 验证

- `pnpm exec tsc -p agents/reviewer/tsconfig.json --noEmit`
- `pnpm --dir agents/reviewer test`
- `pnpm --dir agents/reviewer test:integration`

## 交接提醒

- reviewer 的风险通常不是“跑不起来”，而是“结果语义悄悄变了”，所以最好带着回归视角修改。
