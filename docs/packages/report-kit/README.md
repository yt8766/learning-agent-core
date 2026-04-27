# report-kit 文档目录

状态：current
文档类型：index
适用范围：`docs/packages/report-kit/`
最后核对：2026-04-18

本目录用于沉淀 `packages/report-kit` 相关文档。

包边界：

- 职责：
  - 承载 data-report 生成链路的 blueprint、scaffold、routes、assembly、write 等领域能力
  - 作为报表领域的确定性生成引擎
  - 承载 `data-report-json.v1` bundle 到前端文件计划的确定性 renderer
- 允许：
  - report blueprint / scaffold / assembly
  - JSON bundle renderer
  - sandpack post-process
  - report file materialization
- 禁止：
  - tool registry
  - sandbox executor
  - MCP transport
  - agent orchestration
- 依赖方向：
  - 可依赖 `@agent/core` 的稳定 data-report contract 与模板资产
  - 由 `@agent/tools` 作为工具平台 facade 暴露给上层
  - 长期继续与 `agents/data-report`、`packages/runtime` 的编排层分离

当前真实源码入口：

- 正式宿主目录：
  - `src/blueprints/`
  - `src/scaffold/`
  - `src/assembly/`
  - `src/json-renderer/`
  - `src/writers/`
- 稳定 facade：
  - `src/contracts/data-report-facade.ts`
- 根导出：
  - `src/index.ts` 当前通过 `src/contracts/data-report-facade.ts` 暴露稳定出口
  - legacy 根文件 `src/data-report-*.ts` 已删除

约定：

- `packages/report-kit` 的专项文档统一放在 `docs/packages/report-kit/`
- 新增报表蓝图、骨架、确定性组装能力或 DSL 规则后，需同步更新本目录文档
- 如果当前只有索引文件，后续可在本目录继续补充专题文档

当前文档：

- [package-structure-guidelines.md](/docs/packages/report-kit/package-structure-guidelines.md)
- [data-report-pipeline.md](/docs/packages/report-kit/data-report-pipeline.md)
- [data-report-json-bundle.md](/docs/packages/report-kit/data-report-json-bundle.md)
