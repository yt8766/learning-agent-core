# report-kit 文档目录

状态：current
文档类型：index
适用范围：`docs/report-kit/`
最后核对：2026-04-15

本目录用于沉淀 `packages/report-kit` 相关文档。

包边界：

- 职责：
  - 承载 data-report 生成链路的 blueprint、scaffold、routes、assembly、write 等领域能力
- 允许：
  - report blueprint / scaffold / assembly
  - sandpack post-process
  - report file materialization
- 禁止：
  - tool registry
  - sandbox executor
  - MCP transport
  - agent orchestration
- 依赖方向：
  - 只依赖模板资产与必要第三方库
  - 由 `@agent/tools` 作为工具平台 facade 暴露给上层

约定：

- `packages/report-kit` 的专项文档统一放在 `docs/report-kit/`
- 新增报表蓝图、骨架、确定性组装能力或 DSL 规则后，需同步更新本目录文档
- 如果当前只有索引文件，后续可在本目录继续补充专题文档

当前文档：

- [data-report-pipeline.md](/Users/dev/Desktop/learning-agent-core/docs/report-kit/data-report-pipeline.md)
