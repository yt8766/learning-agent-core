# tools 文档目录

状态：current
文档类型：index
适用范围：`docs/tools/`
最后核对：2026-04-20

本目录用于沉淀 `packages/tools` 相关文档。

包边界：

- 职责：
  - tool registry、executor、sandbox、approval preflight、MCP transport、通用 scaffold 执行能力
- 允许：
  - tool definition
  - registry
  - executor
  - sandbox
  - governance preflight
  - scaffold preview / inspect / write
- 禁止：
  - agent orchestration
  - ministry/graph 主逻辑
  - 长期混入垂直领域生成引擎
- 依赖方向：
  - 只依赖 `@agent/core`、`@agent/config`、模板资产与必要第三方库
  - 不得反向依赖 `@agent/runtime` 或任意 `agents/*`
- 公开入口：
  - 根入口：`@agent/tools`
- 约定：
  - 所有消费侧统一只从 `@agent/tools` 根入口导入
  - `approval / connectors / data-report / filesystem / mcp / registry / runtime-governance / sandbox / scheduling / watchdog` 这些目录作为包内组织结构保留，但不再作为推荐导入入口
  - `registry/tool-registry.ts` 与 `registry/tool-risk-classifier.ts` 是 registry 语义的真实宿主
  - 包根 `tool-registry.ts` 与 `tool-risk-classifier.ts` 已删除
  - `executors/*` 是 filesystem / connectors / runtime-governance / scaffold / scheduling executor 的真实宿主
  - `runtime-governance/tools-center.ts` 是 tools center 纯投影逻辑的真实宿主；backend 只保留 app-facing compat 入口
  - `runtime-governance/connector-governance-state.ts` 是 connector governance snapshot mutation 与 template-id 映射规则的真实宿主；backend 只保留 compat 入口
  - `connectors/connector-draft-config.ts` 是 connector draft 默认模板映射、secret update payload 组装与 configured connector 查找规则的真实宿主；backend 只保留 compat 入口
  - `filesystem/filesystem-executor.ts` 与 `connectors/connectors-executor.ts` 已删除
  - `scaffold/scaffold-executor.ts`、`scheduling/scheduling-executor.ts`、`runtime-governance/runtime-governance-executor.ts` 已删除
  - 根入口优先使用显式命名导出维护稳定 API；不要回到整包 `export *` 把内部实现一次性透传出去
  - `packages/report-kit` 现在是 data-report 的真实实现承载层，`@agent/tools` 负责统一聚合导出

约定：

- `packages/tools` 的专项文档统一放在 `docs/tools/`
- 新增工具适配、执行协议、工具约束或安全规则后，需同步更新本目录文档
- 如果当前只有索引文件，后续可在本目录继续补充专题文档

当前文档：

- [package-structure-guidelines.md](/docs/tools/package-structure-guidelines.md)
- [runtime-governance-and-sandbox.md](/docs/tools/runtime-governance-and-sandbox.md)
- [scaffold-generation.md](/docs/tools/scaffold-generation.md)
- [minimax-mcp-provider-design.md](/docs/tools/minimax-mcp-provider-design.md)
