# tools 文档目录

状态：current
文档类型：index
适用范围：`docs/packages/tools/`
最后核对：2026-05-08

本目录用于沉淀 `packages/tools` 相关文档。

包边界：

- 职责：
  - tool registry、executor、sandbox、approval preflight、MCP transport、通用 scaffold 执行能力
  - Agent Tool Surface：把 `read/list/search/write/edit/delete/command` 解析成稳定 tool definition、execution capability、risk 和 approval mode policy
- 允许：
  - tool definition
  - registry
  - executor
  - sandbox
  - governance preflight
  - agent-facing alias resolver
  - scaffold preview / inspect / write
- 禁止：
  - agent orchestration
  - ministry/graph 主逻辑
  - 长期混入垂直领域生成引擎
- 依赖方向：
  - 只依赖 `@agent/core`、`@agent/runtime`、模板资产与必要第三方库
  - 不得依赖任意 `agents/*`
- 公开入口：
  - 根入口：`@agent/tools`
- 约定：
  - 所有消费侧统一只从 `@agent/tools` 根入口导入
  - `approval / connectors / data-report / filesystem / mcp / registry / runtime-governance / sandbox / scheduling` 这些目录作为包内组织结构保留，但不再作为推荐导入入口
  - `registry/tool-registry.ts` 与 `registry/tool-risk-classifier.ts` 是 registry 语义的真实宿主
  - 包根 `tool-registry.ts` 与 `tool-risk-classifier.ts` 已删除
  - `executors/*` 是 filesystem / connectors / runtime-governance / scaffold / scheduling executor 的真实宿主
  - `runtime-governance/tools-center.ts` 是 tools center 纯投影逻辑的真实宿主；backend 只保留 app-facing compat 入口
  - `runtime-governance/connector-governance-state.ts` 是 connector governance snapshot mutation 与 template-id 映射规则的真实宿主；backend 只保留 compat 入口
  - `connectors/connector-draft-config.ts` 是 connector draft 默认模板映射、secret update payload 组装与 configured connector 查找规则的真实宿主；backend 只保留 compat 入口
  - `scheduling/schedule-repository.ts` 是 schedule record repository contract 与默认内存 repository 的真实宿主
  - `runtime-governance/runtime-governance-repository.ts` 是 archive / recovery / cancellation repository contract 与默认内存 repository 的真实宿主
  - `executors/connectors/connectors-executor.ts` 只通过显式 `ConnectorDraftStorage` 读写 connector draft；未注入 storage 时使用包内内存默认实现
  - `executors/scheduling/scheduling-executor.ts` 与 `executors/runtime-governance/runtime-governance-executor.ts` 只通过 repository 读写 runtime 记录；未注入 repository 时使用包内内存默认实现
  - 这些 executor 不得直接创建或写入 workspace 根目录下的 `data/runtime/*`
  - `watchdog/index.ts` 已删除；`ExecutionWatchdog` 的真实宿主是 `@agent/runtime`，`@agent/tools` 根入口只保留显式稳定转发
  - 根入口优先使用显式命名导出维护稳定 API；不要回到整包 `export *` 把内部实现一次性透传出去
  - `packages/report-kit` 现在是 data-report 的真实实现承载层，`@agent/tools` 负责统一聚合导出

约定：

- `packages/tools` 的专项文档统一放在 `docs/packages/tools/`
- 新增工具适配、执行协议、工具约束或安全规则后，需同步更新本目录文档
- 如果当前只有索引文件，后续可在本目录继续补充专题文档

当前文档：

- [package-structure-guidelines.md](/docs/packages/tools/package-structure-guidelines.md)
- [runtime-governance-and-sandbox.md](/docs/packages/tools/runtime-governance-and-sandbox.md)
- [scaffold-generation.md](/docs/packages/tools/scaffold-generation.md)
- [minimax-mcp-provider-design.md](/docs/packages/tools/minimax-mcp-provider-design.md)
