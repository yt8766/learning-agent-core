# Prompt Regression And Thresholds

状态：current
文档类型：evaluation
适用范围：`packages/evals`、`promptfoo`
最后核对：2026-04-15

## 1. 这篇文档说明什么

本文档说明 prompt 回归在当前仓库里的定位，以及哪些套件和门槛属于阻塞型质量检查。

## 2. 当前目标

prompt 回归的目的不是做“大而全”的评测平台，而是为关键链路提供最小可比较回归集。

当前重点覆盖：

- 首辅规划
- 专家发现
- 户部研究
- 刑部审查
- 礼部交付

## 3. 当前阻塞门槛

当前核心阻塞套件：

- `supervisor-plan`
- `specialist-finding`
- `hubu-research`
- `xingbu-review`
- `libu-delivery`

要求：

- 核心套件成功率 `> 90%`
- 低于门槛时应视为阻塞型回归

## 4. 当前入口

- 配置文件：
  - `packages/evals/promptfoo/ministry-prompts.promptfooconfig.yaml`
- 使用说明：
  - [promptfoo-regression.md](/docs/evals/promptfoo-regression.md)
- 命令：
  - `pnpm eval:prompts`
  - `pnpm eval:prompts:view`

## 5. 继续阅读

- [evals 文档目录](/docs/evals/README.md)
- [测试覆盖率基线](/docs/evals/testing-coverage-baseline.md)
- [Promptfoo 回归说明](/docs/evals/promptfoo-regression.md)
