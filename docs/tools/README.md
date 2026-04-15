# tools 文档目录

状态：current
适用范围：`docs/tools/`
最后核对：2026-04-14

本目录用于沉淀 `packages/tools` 相关文档。

包边界：

- 职责：
  - tool registry、executor、sandbox、approval preflight、MCP transport
- 允许：
  - tool definition
  - registry
  - executor
  - sandbox
  - governance preflight
- 禁止：
  - agent orchestration
  - ministry/graph 主逻辑
  - 长期混入垂直领域生成引擎
- 依赖方向：
  - 只依赖 `@agent/shared`、`@agent/config`、模板资产与必要第三方库
  - 不得反向依赖 `@agent/agent-core`
- 公开入口：
  - 根入口：`@agent/tools`
- 约定：
  - 所有消费侧统一只从 `@agent/tools` 根入口导入
  - `approval / connectors / data-report / filesystem / mcp / registry / runtime-governance / sandbox / scheduling / watchdog` 这些目录作为包内组织结构保留，但不再作为推荐导入入口
  - `packages/report-kit` 现在是 data-report 的真实实现承载层，`@agent/tools` 负责统一聚合导出

约定：

- `packages/tools` 的专项文档统一放在 `docs/tools/`
- 新增工具适配、执行协议、工具约束或安全规则后，需同步更新本目录文档
- 如果当前只有索引文件，后续可在本目录继续补充专题文档

当前文档：

- [runtime-governance-and-sandbox.md](/Users/dev/Desktop/learning-agent-core/docs/tools/runtime-governance-and-sandbox.md)
