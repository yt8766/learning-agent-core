# evals 文档目录

状态：current
文档类型：index
适用范围：`docs/packages/evals/`
最后核对：2026-04-18

本目录用于沉淀 `packages/evals` 相关文档。

首次接手建议按这个顺序阅读：

1. [docs/conventions/test-conventions.md](/docs/conventions/test-conventions.md)
2. [verification-system-guidelines.md](/docs/packages/evals/verification-system-guidelines.md)
3. [turbo-verification-stage-two-plan.md](/docs/packages/evals/turbo-verification-stage-two-plan.md)
4. [turbo-demo-stage-three-plan.md](/docs/packages/evals/turbo-demo-stage-three-plan.md)
5. [turbo-cycle-reduction-stage-six-plan.md](/docs/packages/evals/turbo-cycle-reduction-stage-six-plan.md)
6. [runtime-agent-cycle-audit.md](/docs/packages/evals/runtime-agent-cycle-audit.md)
7. [integration-smoke-completion-plan.md](/docs/packages/evals/integration-smoke-completion-plan.md)
8. 再按需要看 `testing-coverage-baseline`、`promptfoo-regression`、`prompt-regression-and-thresholds`

改测试策略、质量门禁、覆盖率阈值前，优先阅读：

- [docs/conventions/test-conventions.md](/docs/conventions/test-conventions.md)
- [verification-system-guidelines.md](/docs/packages/evals/verification-system-guidelines.md)
- [turbo-verification-stage-two-plan.md](/docs/packages/evals/turbo-verification-stage-two-plan.md)
- [turbo-demo-stage-three-plan.md](/docs/packages/evals/turbo-demo-stage-three-plan.md)
- [turbo-cycle-reduction-stage-six-plan.md](/docs/packages/evals/turbo-cycle-reduction-stage-six-plan.md)
- [runtime-agent-cycle-audit.md](/docs/packages/evals/runtime-agent-cycle-audit.md)

本目录主文档：

- 测试与验证总入口：[docs/conventions/test-conventions.md](/docs/conventions/test-conventions.md)
- 质量门禁与验证体系：[verification-system-guidelines.md](/docs/packages/evals/verification-system-guidelines.md)
- Turbo 二阶段迁移方案：[turbo-verification-stage-two-plan.md](/docs/packages/evals/turbo-verification-stage-two-plan.md)
- Turbo Demo 三阶段迁移方案：[turbo-demo-stage-three-plan.md](/docs/packages/evals/turbo-demo-stage-three-plan.md)
- Turbo 循环依赖治理六阶段方案：[turbo-cycle-reduction-stage-six-plan.md](/docs/packages/evals/turbo-cycle-reduction-stage-six-plan.md)
- Runtime-Agent 循环依赖消费清单：[runtime-agent-cycle-audit.md](/docs/packages/evals/runtime-agent-cycle-audit.md)
- Integration / Smoke 完成计划：[integration-smoke-completion-plan.md](/docs/packages/evals/integration-smoke-completion-plan.md)

包边界：

- 职责：
  - bench、prompt 回归、质量评测基建
  - 统一评测 contract 与质量证明入口
- 允许：
  - evaluator
  - benchmark
  - regression helper
- 禁止：
  - 运行时主链依赖逻辑
  - app 层业务编排
- 依赖方向：
  - 作为质量基建被运行时或测试消费
  - 不承载运行时基础设施职责

约定：

- `packages/evals` 的专项文档统一放在 `docs/packages/evals/`
- 新增评测链路、评测用例、评测协议或基线变化后，需同步更新本目录文档
- 如果当前只有索引文件，后续可在本目录继续补充专题文档
- 当前推荐终态结构已定义为 `contracts / schemas / prompt-regression / benchmarks / quality-gates / runtime / shared`
- `src/contracts/evals-facade.ts` 当前作为包根稳定导出的 facade contract
- 当前真实宿主已先收敛到：
  - `src/regressions/execution-evaluator.ts`
  - `src/quality-gates/skill-promotion-gate.ts`
  - `src/benchmarks/benchmarks.ts`
- `src/regressions/execution-evaluator.ts` 只消费评测结果语义与稳定 tool execution contract；`ToolExecutionResult` 等稳定 tool/governance contract 必须从 `@agent/core` 消费，runtime-owned 编排能力才从 `@agent/runtime` 消费
- `src/prompt-regression/evaluators.ts` 当前仅保留过渡 compat 职责
- `@agent/evals` 根入口当前先通过 `contracts/evals-facade.ts` 导出上述 canonical host；legacy 根文件 `src/evaluators.ts` 与 `src/benchmarks.ts` 已删除

当前文档：

- [package-structure-guidelines.md](/docs/packages/evals/package-structure-guidelines.md)
- [test-conventions.md](/docs/conventions/test-conventions.md)
- [verification-system-guidelines.md](/docs/packages/evals/verification-system-guidelines.md)
- [turbo-verification-stage-two-plan.md](/docs/packages/evals/turbo-verification-stage-two-plan.md)
- [turbo-demo-stage-three-plan.md](/docs/packages/evals/turbo-demo-stage-three-plan.md)
- [turbo-cycle-reduction-stage-six-plan.md](/docs/packages/evals/turbo-cycle-reduction-stage-six-plan.md)
- [runtime-agent-cycle-audit.md](/docs/packages/evals/runtime-agent-cycle-audit.md)
- [integration-smoke-completion-plan.md](/docs/packages/evals/integration-smoke-completion-plan.md)
- [testing-coverage-baseline.md](/docs/packages/evals/testing-coverage-baseline.md)
- [promptfoo-regression.md](/docs/packages/evals/promptfoo-regression.md)
- [prompt-regression-and-thresholds.md](/docs/packages/evals/prompt-regression-and-thresholds.md)
