# evals 包交接文档

状态：current
文档类型：guide
适用范围：`packages/evals`
最后核对：2026-04-19

## 包定位

`packages/evals` 负责 benchmark、prompt 回归、quality gate 与统一评测 contract。

## 当前主要目录

- `src/contracts/`
- `src/benchmarks/`
- `src/prompt-regression/`
- `src/quality-gates/`
- `src/regressions/`

## 修改前先读

- [docs/evals/README.md](/Users/dev/Desktop/learning-agent-core/docs/evals/README.md)
- [docs/evals/verification-system-guidelines.md](/Users/dev/Desktop/learning-agent-core/docs/evals/verification-system-guidelines.md)
- [docs/evals/promptfoo-regression.md](/Users/dev/Desktop/learning-agent-core/docs/evals/promptfoo-regression.md)

## 改动边界

- 这里负责验证与评测基建，不负责 runtime 主链或 provider 适配。
- 新增 gate 或 regression 时，优先沉淀成可复用 contract，不要只写一次性脚本。
- 评测规则若影响提交流程，要同步更新文档与调用入口。

## 验证

- `pnpm exec tsc -p packages/evals/tsconfig.json --noEmit`
- `pnpm --dir packages/evals test`
- `pnpm --dir packages/evals test:integration`

## 交接提醒

- 如果你改了 prompt 回归、verify 或质量门槛，也要同步回看根级脚本与文档说明是否一致。
