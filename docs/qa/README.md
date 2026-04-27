# QA 与验证导航

状态：current
文档类型：index
适用范围：`docs/qa/`
最后核对：2026-04-26

本目录是仓库级 QA、验证与质量门槛的导航层。它用于说明进入验证体系时应先读什么、如何分流到全局规范或包级 evals 文档；不承载 `packages/evals` 的包结构、实现计划或专项运行细节。评测导航已拆到 [docs/evals](/docs/evals/README.md)。

当前文档：

- 当前目录索引就是 QA 与验证导航主文档。
- 包级 evals 文档入口：[docs/packages/evals/README.md](/docs/packages/evals/README.md)

首次接手建议按这个顺序阅读：

1. [验证体系规范](/docs/packages/evals/verification-system-guidelines.md)
2. [测试规范](/docs/conventions/test-conventions.md)
3. [evals 包文档目录](/docs/packages/evals/README.md)

## 职责边界

- 仓库级验证入口、交付门槛和跨模块质量约束：优先从本目录进入，再跳转到对应规范。
- `packages/evals` 的包级结构、prompt regression、demo / smoke / turbo 验证计划与 workspace test host：统一维护在 [docs/packages/evals/](/docs/packages/evals/README.md)。
- 测试命名、分层、fixture、mock 和前后端测试约定：统一维护在 [docs/conventions/test-conventions.md](/docs/conventions/test-conventions.md)。
- API 契约和跨模块联调说明：分别维护在 [docs/contracts/api/](/docs/contracts/api/README.md) 与 [docs/integration/](/docs/integration/README.md)。

## 常用入口

- [验证体系规范](/docs/packages/evals/verification-system-guidelines.md)
- [测试覆盖基线](/docs/packages/evals/testing-coverage-baseline.md)
- [Prompt regression 与阈值](/docs/packages/evals/prompt-regression-and-thresholds.md)
- [Promptfoo regression](/docs/packages/evals/promptfoo-regression.md)
- [Workspace Test Host Design](/docs/packages/evals/workspace-test-host-design.md)
