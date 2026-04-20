# 仓库目录概览

状态：current
文档类型：overview
适用范围：仓库顶层目录
最后核对：2026-04-20

本文件说明仓库当前主要目录“现在在做什么”，用于补足各目录 README 只讲规范、不讲现实职责的问题。

如果你是为了判断 `runtime / platform-runtime / apps` 三层谁该承载什么，先补读：

- [Runtime 分层 ADR](/docs/runtime-layering-adr.md)

本主题主文档：

- 本文是整个仓库目录结构的总入口

本文只覆盖：

- 顶层目录和主要子目录当前职责
- 目录之间的术语边界
- 继续阅读顺序

## 顶层目录

- `apps/`
  - 可运行应用。包括主 API、前线作战面、后台指挥面、独立 worker。
  - 应用层统一只通过 `@agent/*` 公共入口消费共享能力，不应直接依赖 `packages/*/src`、`agents/*/src` 或 `@agent/*` 子路径。
- `packages/`
  - 共享库与运行时基础能力。应用层统一通过 `@agent/*` 公开入口消费。
- `agents/`
  - root 级 agent package 目录，与 `packages/` 同级。
  - 当前承载 `supervisor / data-report / coder / reviewer` 四个智能体包。
- `data/`
  - 本地运行数据与缓存产物，不放源码。
- `artifacts/`
  - 仓库级可重建产物与共享临时目录。
  - 当前优先承载覆盖率与仓库级临时输出；应用专属日志可继续保留在各自应用目录。
- `docs/`
  - 架构、规范、模块说明、联调结论。
- `skills/`
  - 给 Codex / Claude Code 读取的仓库级代理技能。
- `scripts/`
  - 仓库级维护脚本与检查脚本。
- `mock/`
  - 本地联调或测试辅助资源。

## `apps/`

- `apps/backend/agent-server`
  - 平台主 API 服务。
  - 当前负责聊天会话、SSE 流式返回、runtime/approval/learning/evidence/connectors 治理接口，以及任务创建/审批/恢复入口。
  - `src/runtime/*` 是后台治理与运行态聚合的主要实现区。
  - 对共享能力的依赖统一经 `@agent/*` 根入口接入，不直接引用 workspace 内部源码路径。
- `apps/frontend/agent-chat`
  - OpenClaw 风格前线作战面。
  - 当前负责聊天、审批卡、ThoughtChain、Evidence、Learning suggestions、运行态面板。
  - 仅消费面向前端稳定暴露的 API contract、DTO 与应用本地适配层，不直接越过 `@agent/*` 公开边界。
- `apps/frontend/agent-admin`
  - 六大中心后台指挥面。
  - 当前负责 Runtime、Approvals、Learning、Skill Lab、Evidence、Connector & Policy 等治理中心。
  - 与 `agent-chat` 一样，只通过 `@agent/*` 包根入口消费共享契约与能力。
- `apps/worker`
  - 独立 background worker。
  - 当前消费 queued background tasks，处理 lease、interrupt timeout、learning queue 和恢复相关作业。
  - 与主 API 一样通过 `@agent/*` 根入口接入 runtime、tools、memory、skill-runtime 等共享宿主。

## `packages/`

- `packages/core`
  - 稳定 contract 与接口边界入口。
  - 当前作为 `shared` 的迁移 facade，用于后续把 DTO / contract 收敛到新结构。
  - `src/providers/*` 承载 provider 抽象接口，供 runtime 与 agents 依赖。
- `packages/runtime`
  - Runtime Kernel。
  - 当前对外暴露 `AgentRuntime`、`SessionCoordinator`、worker registry、profile policy、graph/session/checkpoint/approval/recovery 能力。
  - `src/bridges/*` 仍是官方 Agent 过渡出口，后续应通过 runtime 依赖注入 contract 迁出。
- `packages/platform-runtime`
  - 官方平台装配层 / Composition Root。
  - 当前对外暴露 backend/worker 共享的默认 runtime 创建线、官方 Agent/workflow 出口与可注入 registry contract。
- `packages/adapters`
  - 适配器隔离层 facade。
  - 当前对外暴露模型/provider 与 LLM retry / structured output 能力入口。
  - 具体 provider 实现应落在这里，并实现 `packages/core` 定义的接口。
- `agents/supervisor`
  - supervisor 相关公开入口。
  - 当前承载 workflow preset、subgraph descriptor、bootstrap skill 列表。
- `agents/data-report`
  - data-report 智能体公开入口。
  - 当前承载 data-report graph、preview、JSON graph 相关导出。
- `agents/coder`
  - coder 智能体公开入口。
  - 当前承载 coder graph、节点装配与根导出契约。
- `agents/reviewer`
  - reviewer 智能体公开入口。
  - 当前承载 reviewer graph、节点装配与根导出契约。
- `packages/agent-core`
  - 已删除。
  - 原多 Agent 主链已迁入 `packages/runtime`、`packages/adapters` 与 `agents/*`。
  - 相关历史说明统一保留在 `docs/archive/agent-core/`，不要把它当成当前代码宿主。
- `docs/shared/`
  - `packages/shared` 退场过程的历史迁移文档归档。
- `packages/config`
  - settings schema、profile、路径和默认策略。
  - 包根稳定导出当前先通过 `contracts/settings-facade.ts` 收口。
- `packages/memory`
  - repositories、search、vector、embeddings、semantic cache。
- `packages/tools`
  - tool registry、approval、filesystem、sandbox、MCP、runtime governance。
- `packages/skill-runtime`
  - 运行时技能注册、manifest 解析、source sync 的真实宿主。
  - 新代码统一通过 `@agent/skill-runtime` 消费。
  - 包根稳定导出当前先通过 `contracts/skill-runtime-facade.ts` 收口。
- `packages/report-kit`
  - data-report 的确定性蓝图、骨架、组装和落盘能力。
- `packages/templates`
  - 前端模板资产与通用 scaffold 模板资产；当前有 `react-ts`、`single-report-table`、`bonus-center-data`、`scaffold/package-lib`、`scaffold/agent-basic`。
- `packages/evals`
  - prompt 回归和质量评测基建。
  - 包根稳定导出当前先通过 `contracts/evals-facade.ts` 收口。
- 补充：
  - `packages/evals`、`packages/skill-runtime`、`packages/report-kit`、`packages/templates` 的 legacy 根文件已删除
  - `packages/config` 已删除纯 compat `settings.*` 文件，当前只保留 `src/settings.ts` 与 `src/settings/index.ts` 作为人工可读聚合入口
  - `packages/config`、`packages/skill-runtime`、`packages/evals` 已补出 facade contract，再由包根入口导出

## `data/`

- `data/runtime`
  - 任务状态、briefings、schedules 和运行态缓存。
- `data/memory`
  - 本地 memory / rule 存储。
- `data/knowledge`
  - 受控知识源及其 ingestion、catalog、chunks、vectors 产物。
- `data/skills`
  - 运行时技能的 installed、stable、lab、receipts 数据。
  - 新默认路径已统一为 `data/skills`。

## 目录与术语补充约束

- `artifacts/*`
  - 默认承载仓库级覆盖率、共享调试输出和部分可重建临时产物，默认不提交 Git。
- `apps/*`
  - 只通过 `@agent/*` 公共入口依赖共享包与 agent 包；不应直接引用 `packages/*/src`、`agents/*/src`，也不应把 `@agent/<pkg>/<subpath>` 当成应用层稳定接口。
- `skills/*`
  - 只表示仓库级代理技能。
- `packages/skill-runtime`
  - 表示运行时 skill 基础能力；代码语义统一使用 `@agent/skill-runtime`，不要与 `skills/*` 混用。
- `packages/runtime`
  - 承载 graph、flow、session、governance 等运行时内核能力。
- `apps/backend/agent-server/src/runtime`
  - 只应承载 HTTP/SSE/鉴权/聚合装配，不应继续沉淀 graph、prompt、schema 主逻辑。
- `apps/backend/agent-server/data`
  - 仅保留为待清理历史遗留目录，不再承载 canonical runtime 数据。

## `docs/`

- `docs/ARCHITECTURE.md`
  - 长期架构方向与“皇帝-首辅-六部”主线。
- `docs/integration/frontend-backend-integration.md`
  - 前后端接口与联调约定。
- `docs/archive/agent-core/`
  - `packages/agent-core` 专项实现文档。
- `docs/adapters/`
  - `packages/adapters` 专项文档。
- `docs/agents/`
  - root 级 `agents/*` 专项文档。
- `docs/config/`
  - `packages/config` 专项文档。
- `docs/core/`
  - `packages/core` 稳定 contract facade 文档。
- `docs/backend/`
  - `apps/backend/*` 专项文档。
- `docs/frontend/agent-chat/`
  - `agent-chat` 专项文档。
- `docs/frontend/agent-admin/`
  - `agent-admin` 专项文档。
- `docs/integration/`
  - 跨模块链路说明。
- `docs/memory/`、`docs/report-kit/`、`docs/runtime/`、`docs/skill-runtime/`、`docs/tools/`、`docs/evals/`、`docs/templates/`
  - 对应各 `packages/*` 的模块文档目录。
- `docs/shared/`
  - 已删除 `packages/shared` 的历史归档目录。
- `docs/skills/`
  - 仓库级 `skills/*` 代理技能文档目录；不对应 `packages/skill-runtime`。

## `skills/`

- `skills/code-review`
  - 面向代码审查与回归风险检查的代理技能。
- `skills/learning-flow-audit`
  - 面向学习链路审查的代理技能。
- `skills/openclaw-workspace-audit`
  - 面向 OpenClaw 工作区实现检查的代理技能。
- `skills/release-check`
  - 面向发布前检查的代理技能。

## 建议阅读顺序

1. [README](/README.md)
2. [项目规范总览](/docs/project-conventions.md)
3. [架构总览](/docs/ARCHITECTURE.md)
4. [目录地图](/docs/repo-directory-overview.md)
5. 对应目录自己的 README 或 `docs/<module>/README.md`
