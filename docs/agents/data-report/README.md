# data-report 文档目录

状态：current
文档类型：index
适用范围：`docs/agents/data-report/`
最后核对：2026-04-23

本目录用于沉淀 `agents/data-report` 的专项文档。

首次接手建议按这个顺序阅读：

1. [package-structure-guidelines.md](/docs/agents/data-report/package-structure-guidelines.md)
2. [type-barrel-notes.md](/docs/agents/data-report/type-barrel-notes.md)
3. [model-selection-guidelines.md](/docs/agents/data-report/model-selection-guidelines.md)
4. [report-kit 文档目录](/docs/packages/report-kit/README.md)
5. [data-report-pipeline.md](/docs/packages/report-kit/data-report-pipeline.md)
6. [data-report-json-bundle.md](/docs/packages/report-kit/data-report-json-bundle.md)

改 `agents/data-report` 前，优先确认：

- 类型入口是否仍保持稳定模块路径
- graph / flow / report-kit 边界是否被破坏
- runtime 依赖是否仍只通过 `@agent/runtime` 根入口接入
- backend service 是否只通过 facade 使用该能力

本目录主文档：

- `agents/data-report` 包结构规范：[package-structure-guidelines.md](/docs/agents/data-report/package-structure-guidelines.md)
- `agents/data-report` 类型入口约束：[type-barrel-notes.md](/docs/agents/data-report/type-barrel-notes.md)
- `agents/data-report` 语义化选模规则：[model-selection-guidelines.md](/docs/agents/data-report/model-selection-guidelines.md)

当前职责：

- data-report 智能体公开入口
- `data-report.graph.ts`、`data-report-json.graph.ts`
- sandpack preview / JSON generation flow
- `data-report-json.v1` bundle 的 LLM 编排入口与 schema 回归
- data-report prompt、schema、runtime facade
- `packages/report-kit` 之上的报表智能体编排层
- 根入口导出的 graph、schema parser 与 runtime facade 已有专门 root export 测试锁定

当前文档：

- [package-structure-guidelines.md](/docs/agents/data-report/package-structure-guidelines.md)
- [type-barrel-notes.md](/docs/agents/data-report/type-barrel-notes.md)
- [model-selection-guidelines.md](/docs/agents/data-report/model-selection-guidelines.md)
- [data-report-json-bundle.md](/docs/packages/report-kit/data-report-json-bundle.md)
