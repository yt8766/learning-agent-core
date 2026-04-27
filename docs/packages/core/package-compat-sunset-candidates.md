# Compat 入口收缩候选

状态：current  
文档类型：convention  
适用范围：`packages/*`、`agents/*` compat / facade / legacy entry 收缩盘点  
最后核对：2026-04-18

本文档用于记录“哪些 compat 入口已经进入可收缩阶段，哪些还需要暂缓”。

这里的“收缩”包括三种动作：

- 删除纯 compat 文件
- 将 facade-only 路径从构建显式 include 中移除
- 将测试从 legacy 路径切到 canonical host 或包根入口

## 1. 判定口径

本轮盘点按四类引用来源判断：

- 生产代码引用
  - `packages/*`、`agents/*`、`apps/*` 的非测试源码
- 测试引用
  - `test/*`、`*.test.ts`、`*.int-spec.ts`
- 文档引用
  - `docs/*`
- 构建配置引用
  - `tsconfig*.json`

默认规则：

- 如果仍有生产代码直接引用 compat 路径，不进入删除候选
- 如果只剩测试与文档引用，进入“高优先级收缩候选”
- 如果没有生产代码引用，但仍被 `tsconfig` / 构建入口显式 include，进入“中优先级候选，需要先改构建配置”

## 2. 盘点结论

### 已完成删除

- `packages/evals/src/benchmarks.ts`
- `packages/evals/src/evaluators.ts`
- `packages/skill-runtime/src/skill-registry.ts`
- `packages/skill-runtime/src/agent-skill-loader.ts`
- `packages/report-kit/src/data-report-blueprint.ts`
- `packages/report-kit/src/data-report-blueprint-template.ts`
- `packages/report-kit/src/data-report-module-scaffold.ts`
- `packages/report-kit/src/data-report-scaffold.ts`
- `packages/report-kit/src/data-report-assembly.ts`
- `packages/report-kit/src/data-report-routes.ts`
- `packages/report-kit/src/data-report-ast-postprocess.ts`
- `packages/report-kit/src/data-report-write.ts`
- `packages/templates/src/template-registry.ts`
- `packages/templates/src/scaffold-template-registry.ts`
- `packages/config/src/settings/settings.defaults.ts`
- `packages/config/src/settings/settings.helpers.ts`
- `packages/config/src/settings/settings.loader.ts`
- `packages/config/src/settings/settings-paths.ts`
- `packages/config/src/settings/daily-tech-briefing.ts`
- `packages/config/src/settings/settings.types.ts`
- `packages/tools/src/scaffold/scaffold-executor.ts`
- `packages/tools/src/scheduling/scheduling-executor.ts`
- `packages/tools/src/runtime-governance/runtime-governance-executor.ts`
- `packages/tools/src/tool-registry.ts`
- `packages/tools/src/tool-risk-classifier.ts`
- `packages/adapters/src/chat/chat-model-factory.ts`
- `packages/adapters/src/llm/runtime-provider-factory.ts`
- `packages/runtime/src/contracts/llm-facade.ts`

说明：

- legacy 根文件已删除
- 测试已切到“包根入口 vs canonical host”校验
- 文档已同步更新为“包根直接导出 canonical host”

### 长期保留的稳定 facade

这些入口同样没有发现生产代码直接依赖，但当前被刻意保留为 contract-first 稳定 facade，不属于“下一轮继续删除”的候选。

- `packages/memory/src/contracts/memory-repository.ts`
- `packages/memory/src/contracts/memory-search-service.ts`
- `packages/tools/src/contracts/tool-registry.ts`
- `packages/tools/src/contracts/tool-risk-classifier.ts`
- `packages/adapters/src/contracts/llm-provider.ts`

说明：

- 这些路径当前不是“历史遗留 compat 根文件”，而是刻意保留的稳定 facade 路径
- 文档与测试都已明确它们承担 contract-first 导入职责
- 后续只有在决定“所有调用方统一改为包根入口，不再保留 contract 子路径”时才重新评估

### 长期保留的人工可读聚合入口

这些入口当前更像人工可读聚合入口，而不是待删除 compat。

- `packages/config/src/settings.ts`
- `packages/config/src/settings/index.ts`

说明：

- 它们虽然具备 compat 性质，但当前主要承担“人工可读聚合入口”职责
- 文档与测试都已将其标记为长期保留
- 当前不建议在没有统一替代导入策略前直接删除

## 3. 剩余过渡层地图

当前并不是“没有剩余 compat”，而是已经从“根文件清理阶段”进入“源目录内过渡层治理阶段”。

这些文件默认分三类处理。

### A. 可在下一轮优先清理的纯 compat 源文件

这些文件当前只剩文档或测试提及，没有发现生产源码依赖；删除前主要需要先修文档、补边界测试。

当前无。

说明：

- 已确认的高优先级纯 compat 源文件，本轮都已完成删除
- 如果后续再出现新的候选，应继续按“只剩文档/测试提及、无生产源码依赖”的口径补回本节

本轮已完成删除：

- `packages/config/src/runtime/daily-tech-briefing.ts`
- `packages/config/src/runtime/settings-loader.ts`
- `packages/config/src/runtime/settings-paths.ts`
- `packages/evals/src/prompt-regression/evaluators.ts`
- `packages/tools/src/filesystem/filesystem-tool-definitions.ts`
- `packages/tools/src/connectors/connector-tool-definitions.ts`
- `packages/tools/src/runtime-governance/runtime-governance-tool-definitions.ts`
- `packages/tools/src/scheduling/scheduling-tool-definitions.ts`
- `packages/tools/src/mcp/mcp-http-transport.ts`
- `packages/tools/src/mcp/mcp-local-adapter-transport.ts`
- `packages/tools/src/mcp/mcp-stdio-transport.ts`
- `packages/tools/src/mcp/mcp-transport-handlers.ts`
- `packages/runtime/src/runtime/agent-bridges/coder-runtime-bridge.ts`
- `packages/runtime/src/runtime/agent-bridges/data-report-runtime-bridge.ts`
- `packages/runtime/src/runtime/agent-bridges/reviewer-runtime-bridge.ts`
- `packages/runtime/src/runtime/agent-bridges/supervisor-runtime-bridge.ts`
- `packages/runtime/src/graphs/main/main.graph.ts`
- `packages/runtime/src/graphs/main/main-graph-runtime-modules.ts`
- `packages/tools/src/filesystem/filesystem-executor.ts`
- `packages/tools/src/connectors/connectors-executor.ts`
- `packages/memory/src/shared/memory-record-helpers.ts`
- `packages/memory/src/repositories/memory-repository-governance.ts`

### B. 暂不删除的内部过渡层

这些文件虽然已经不是 canonical host，但当前仍被包内生产源码引用，删除前需要先做内部依赖切换。

当前无。

说明：

- `packages/memory` 的内部过渡层已完成切换并删除
- 当前剩余的非根入口 wrapper 主要集中在“纯 compat 源文件”清单，而不是包内仍被生产源码依赖的薄层

### C. 长期保留的稳定 facade / 聚合层

这些文件本质上不是“迁移尾项”，而是刻意保留的稳定边界或人工可读聚合层。

- `packages/memory/src/contracts/memory-repository.ts`
- `packages/memory/src/contracts/memory-search-service.ts`
- `packages/tools/src/contracts/tool-registry.ts`
- `packages/tools/src/contracts/tool-risk-classifier.ts`
- `packages/adapters/src/contracts/llm-provider.ts`
- `packages/skill-runtime/src/contracts/skill-runtime-facade.ts`
- `packages/evals/src/contracts/evals-facade.ts`
- `packages/report-kit/src/contracts/data-report-facade.ts`
- `packages/config/src/contracts/settings-facade.ts`
- `packages/config/src/settings.ts`
- `packages/config/src/settings/index.ts`

说明：

- `contracts/*` 默认属于 contract-first 稳定出口
- `settings.ts` / `settings/index.ts` 当前属于人工可读聚合入口
- 除非仓库统一调整导入策略，否则它们不进入“默认删除队列”

## 4. 当前结论

当前真正需要继续治理的，不再是 legacy 根文件，而是“稳定 facade / 目录聚合 / 真实宿主”三者的边界表达。

优先顺序建议如下：

1. 继续识别新出现的纯 compat 源文件，并按同样口径删除
2. 保留 `contracts/*` 与人工可读聚合入口，除非导入策略整体调整

说明：

- 第一阶段要收缩的纯 compat 根文件已经完成删除
- 第二阶段的重点是让“canonical host / stable facade / directory aggregator”三类文件在文档里不再混淆
- 后续盘点应继续围绕“是否仍有生产源码依赖”而不是“文件名看起来像不像 compat”来判断

## 5. 执行约束

开始删除 compat 文件前，默认要同时完成：

1. 更新 root export / host boundary 测试
2. 更新包 README 与结构规范
3. 更新 `tsconfig` / 构建入口
4. 重新执行对应包的 `test` / `verify`
5. 执行 `pnpm check:docs`

## 6. 继续阅读

- [Packages 分层与依赖约定](/docs/conventions/package-architecture-guidelines.md)
- [Packages 目录说明](/docs/maps/packages-overview.md)
- [Apps 目录说明](/docs/maps/apps-overview.md)
