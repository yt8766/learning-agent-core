# evals 包结构规范

状态：current
文档类型：convention
适用范围：`packages/evals`
最后核对：2026-04-18

本文档说明 `packages/evals` 如何从“评测脚本与配置集合”继续收敛到“质量证明与评测 contract 宿主”。

## 1. 目标定位

`packages/evals` 负责：

- prompt regression
- benchmark
- quality gate runner
- eval result schema
- report formatter

它不负责运行时主链逻辑。

## 2. 推荐结构

```text
packages/evals/
├─ src/
│  ├─ contracts/
│  ├─ schemas/
│  ├─ regressions/
│  ├─ benchmarks/
│  ├─ quality-gates/
│  ├─ prompt-regression/
│  └─ index.ts
├─ promptfoo/
├─ test/
└─ package.json
```

各目录语义：

- `contracts/`
  - eval runner/result/quality gate contract
- `schemas/`
  - eval result、prompt regression、benchmark report schema
- `regressions/`
  - execution evaluator、prompt regression summary contract、回归结果归一化
- `benchmarks/`
  - suite、runner、reporter
- `quality-gates/`
  - skill promotion gate、verify gate、threshold checker、affected checker
- `prompt-regression/`
  - promptfoo 配置兼容入口或过渡态 facade，不再承载长期核心实现

补充：

- `promptfoo/` 继续保留为 promptfoo 配置与样例目录
- `src/` 负责承载统一评测 contract 与运行语义

## 3. 允许内容

- evaluator
- benchmark
- regression helper
- quality gate runner
- eval result schema

## 4. 禁止内容

- 运行时主链依赖逻辑
- app 层业务编排
- provider 适配实现

## 5. 当前收敛策略

本轮已先收敛最稳定的评测宿主：

- `src/contracts/evals-facade.ts`
- `src/regressions/execution-evaluator.ts`
- `src/quality-gates/skill-promotion-gate.ts`
- `src/benchmarks/benchmarks.ts`

补充：

- 包根 `src/index.ts` 当前先通过 `src/contracts/evals-facade.ts` 暴露稳定导出
- `contracts/` 负责对外稳定边界，`regressions/`、`quality-gates/` 与 `benchmarks/` 承载真实实现
- `src/prompt-regression/evaluators.ts` 已删除；评测根入口与 facade 直接导向 canonical host

`packages/evals` 仍继续以 promptfoo 配置、验证规范与质量门禁文档为重要组成部分。

后续源码收敛优先顺序：

1. 先补 `contracts/` 与 `schemas/`
2. 继续把 promptfoo 结果汇总与 gate runner 收敛到 `regressions/`、`quality-gates/`
3. 为 benchmark 报表补 `reporting/` 或更细的 formatter 宿主
4. 继续保持包根入口直接对 canonical host 导出，不重新引入 legacy 根文件

## 6. 继续阅读

- [evals 文档目录](/docs/packages/evals/README.md)
- [验证体系规范](/docs/packages/evals/verification-system-guidelines.md)
- [Promptfoo 回归说明](/docs/packages/evals/promptfoo-regression.md)
