# Packages 目录说明

状态：current
适用范围：`packages/*`
最后核对：2026-04-15

`packages/` 放共享库和运行时基础能力，应用层应只通过 `@agent/*` 公开入口依赖这里的包。

补充：

- `agents/*` 现在作为 root 级 agent package 目录存在，与 `packages/*` 同级
- 本文仍一并记录这些 agent 包，因为它们同样通过 `@agent/agents-*` 作为工作区公开入口被消费

当前目录职责：

- `packages/core`
  - 稳定 contract facade、DTO、Record、Schema、错误模型、接口边界入口
  - 只负责跨包公共语言，不负责业务实现或外部 SDK
- `packages/runtime`
  - runtime orchestration、session、worker registry、profile policy 的真实实现入口
- `packages/adapters`
  - 模型 provider normalize、chat/embedding factory、LLM adapter 的真实实现入口
- `agents/supervisor`
  - supervisor / workflow / subgraph 描述等主控入口与真实实现位置
- `agents/data-report`
  - data-report graph / flow 的智能体公开入口与真实实现位置
- `agents/coder`
  - coder agent 的公开入口与真实实现位置，承载 `ExecutorAgent`、`GongbuCodeMinistry`、`BingbuOpsMinistry`
- `agents/reviewer`
  - reviewer agent 的公开入口与真实实现位置，承载 `ReviewerAgent`、`XingbuReviewMinistry`
- `packages/shared`
  - DTO、Record、Enum、跨端展示 contract
- `packages/config`
  - profile、settings schema、默认策略与路径布局
- `packages/model`
  - 模型 provider normalize、chat/embedding factory
- `packages/memory`
  - memory/rule/runtime-state repository、vector index、semantic cache、search
- `packages/tools`
  - tool registry、executor、sandbox、approval preflight、MCP transport
- `packages/skills`
  - 运行时 skill registry、manifest loader、source sync
- `packages/report-kit`
  - data-report 的 blueprint、scaffold、assembly、write
- `packages/templates`
  - 可被生成链路复用的前端模板资产
- `packages/evals`
  - bench、prompt 回归、质量评测基建

迁移兼容说明：

- `packages/runtime` 已承载 `runtime / session / governance` 的真实源码
- `packages/runtime` 现已继续承载 `chat.graph / recovery.graph / learning.graph / LearningFlow / approval-recovery` 的真实源码
- `packages/runtime` 现已继续承载 `graphs/main/*` 的真实源码
- `packages/runtime` 现已继续承载 `event-maps / llm-retry / context-compression / temporal-context / runtime-output-sanitizer` 这些主链共享 util 的真实源码
- `packages/runtime` 现已继续承载 `capability-pool`、直答/审批 interrupt 节点与 main graph 所需的 ministries stage orchestration 真实源码
- `packages/adapters` 已承载 `adapters/llm` 的真实源码
- `packages/adapters` 现已继续承载 prompt template、LLM retry、safe structured object、model fallback、reactive retry 与 JSON safety prompt 的真实源码
- `agents/supervisor` 已承载 `bootstrap / subgraph-registry / main-route / workflows / flows/supervisor` 的真实源码
- `agents/data-report` 已承载 `data-report.graph / data-report-json.graph / flows/data-report / flows/data-report-json` 的真实源码
- `agents/coder` 已承载 `executor-node / gongbu-code-ministry / bingbu-ops-ministry / 执行 prompt / 执行 schema` 的真实源码
- `agents/reviewer` 已承载 `reviewer-node / xingbu-review-ministry / review prompt / review schema` 的真实源码
- `packages/agent-core` 已删除；剩余主链已完成迁入 `packages/runtime`、`packages/adapters` 与 `agents/*`
- 新消费侧优先改用 `@agent/runtime`、`@agent/adapters`、`@agent/agents-*`
- 当前扫描结果里，仓库代码层已无 `@agent/agent-core` 直接消费；`apps/backend/agent-server/tsconfig.json` 与根部 `tsconfig.json`、`tsconfig.node.json`、`vitest.config.js` 中的旧 alias 也已移除
- 本轮继续把 `workflow-route`、`chat-graph`、`data-report*` 类型、`specialist-finding` / `critique-result` schema、`PendingExecutionContext` 迁到了 `packages/core`
- 本轮继续把 prompt template、LLM retry、safe structured object、reactive retry 收口到 `@agent/adapters` 的稳定共享入口
- 本轮继续把 `supervisor` 的 `libu-router / hubu-search / libu-docs` 物理迁到了 `agents/supervisor/src/flows/ministries/*`
- 当前已不存在 `agents/* -> packages/runtime/src/*` 的直接桥接；agent 包统一通过 `@agent/runtime`、`@agent/adapters`、`@agent/core` 与 `@agent/agents-*` 的稳定入口协作
- `docs/agent-core/*` 现在保留为迁移历史与专题说明目录，不再对应一个真实工作区包

补充说明：

- `skills/` 是给代码代理读取的仓库级技能目录，不属于这里的运行时包体系
- `apps/*` 禁止直接依赖 `packages/*/src`

建议优先阅读：

1. [agent-core 迁移历史目录](/Users/dev/Desktop/learning-agent-core/docs/agent-core/README.md)
2. [core 文档目录](/Users/dev/Desktop/learning-agent-core/docs/core/README.md)
3. [Packages 分层与依赖约定](/Users/dev/Desktop/learning-agent-core/docs/package-architecture-guidelines.md)
4. [目录地图](/Users/dev/Desktop/learning-agent-core/docs/repo-directory-overview.md)
