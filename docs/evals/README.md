# evals 文档目录

状态：current
适用范围：`docs/evals/`
最后核对：2026-04-14

本目录用于沉淀 `packages/evals` 相关文档。

包边界：

- 职责：
  - bench、prompt 回归、质量评测基建
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

- `packages/evals` 的专项文档统一放在 `docs/evals/`
- 新增评测链路、评测用例、评测协议或基线变化后，需同步更新本目录文档
- 如果当前只有索引文件，后续可在本目录继续补充专题文档

当前文档：

- [test-conventions.md](/Users/dev/Desktop/learning-agent-core/docs/test-conventions.md)
- [verification-system-guidelines.md](/Users/dev/Desktop/learning-agent-core/docs/evals/verification-system-guidelines.md)
- [testing-coverage-baseline.md](/Users/dev/Desktop/learning-agent-core/docs/evals/testing-coverage-baseline.md)
- [promptfoo-regression.md](/Users/dev/Desktop/learning-agent-core/docs/evals/promptfoo-regression.md)
- [prompt-regression-and-thresholds.md](/Users/dev/Desktop/learning-agent-core/docs/evals/prompt-regression-and-thresholds.md)
