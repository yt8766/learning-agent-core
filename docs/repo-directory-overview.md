# 仓库目录概览

状态：current
适用范围：仓库顶层目录
最后核对：2026-04-15

本文件说明仓库当前主要目录“现在在做什么”，用于补足各目录 README 只讲规范、不讲现实职责的问题。

## 顶层目录

- `apps/`
  - 可运行应用。包括主 API、前线作战面、后台指挥面、独立 worker。
- `packages/`
  - 共享库与运行时基础能力。应用层统一通过 `@agent/*` 公开入口消费。
- `agents/`
  - root 级 agent package 目录，与 `packages/` 同级。
  - 当前承载 `supervisor / data-report / coder / reviewer` 四个智能体包。
- `data/`
  - 本地运行数据与缓存产物，不放源码。
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
- `apps/frontend/agent-chat`
  - OpenClaw 风格前线作战面。
  - 当前负责聊天、审批卡、ThoughtChain、Evidence、Learning suggestions、运行态面板。
- `apps/frontend/agent-admin`
  - 六大中心后台指挥面。
  - 当前负责 Runtime、Approvals、Learning、Skill Lab、Evidence、Connector & Policy 等治理中心。
- `apps/worker`
  - 独立 background worker。
  - 当前消费 queued background tasks，处理 lease、interrupt timeout、learning queue 和恢复相关作业。

## `packages/`

- `packages/core`
  - 稳定 contract 与接口边界入口。
  - 当前作为 `shared` 的迁移 facade，用于后续把 DTO / contract 收敛到新结构。
- `packages/runtime`
  - 运行时 facade。
  - 当前对外暴露 `AgentRuntime`、`SessionCoordinator`、worker registry 与 profile policy。
- `packages/adapters`
  - 适配器隔离层 facade。
  - 当前对外暴露模型/provider 与 LLM retry / structured output 能力入口。
- `agents/supervisor`
  - supervisor 相关公开入口。
  - 当前承载 workflow preset、subgraph descriptor、bootstrap skill 列表。
- `agents/data-report`
  - data-report 智能体公开入口。
  - 当前承载 data-report graph、preview、JSON graph 相关导出。
- `agents/coder`
  - coder agent 包入口占位。
- `agents/reviewer`
  - reviewer agent 包入口占位。
- `packages/agent-core`
  - 多 Agent 运行核心。
  - `src/graphs`
    - graph 入口、状态定义、边编排。
  - `src/flows`
    - 节点执行实现，按 chat、approval、delivery、learning、supervisor、ministries、data-report 等域拆分。
  - `src/runtime`
    - 运行时装配与主链 orchestration。
  - `src/session`
    - 聊天会话驱动与 task/session 桥接。
  - `src/shared`
    - graph/flow 共享 prompt、schema、contract。
  - `src/types`
    - 包级公共类型。
  - `src/workflows`
    - workflow 路由、preset、轻量契约。
- `packages/shared`
  - 跨端共享 DTO、Record、Enum 和纯 contract。
  - 当前仍作为迁移兼容实现保留。
- `packages/config`
  - settings schema、profile、路径和默认策略。
- `packages/model`
  - 模型 provider 适配、chat/embedding factory。
  - 当前仍作为迁移兼容实现保留。
- `packages/memory`
  - repositories、search、vector、embeddings、semantic cache。
- `packages/tools`
  - tool registry、approval、filesystem、sandbox、MCP、runtime governance。
- `packages/skills`
  - 运行时技能注册、manifest 解析、source sync。
- `packages/report-kit`
  - data-report 的确定性蓝图、骨架、组装和落盘能力。
- `packages/templates`
  - 前端模板资产；当前有 `react-ts`、`single-report-table`、`bonus-center-data` 等模板。
- `packages/evals`
  - prompt 回归和质量评测基建。

## `data/`

- `data/runtime`
  - 任务状态、briefings、schedules 和运行态缓存。
- `data/memory`
  - 本地 memory / rule 存储。
- `data/knowledge`
  - 受控知识源及其 ingestion、catalog、chunks、vectors 产物。
- `data/skills`
  - 运行时技能的 installed、stable、lab、receipts 数据。

## `docs/`

- `docs/ARCHITECTURE.md`
  - 长期架构方向与“皇帝-首辅-六部”主线。
- `docs/integration/frontend-backend-integration.md`
  - 前后端接口与联调约定。
- `docs/agent-core/`
  - `packages/agent-core` 专项实现文档。
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
- `docs/shared`、`docs/config`、`docs/model`、`docs/memory`、`docs/report-kit`、`docs/skills`、`docs/tools`、`docs/evals`、`docs/templates`
  - 对应各 `packages/*` 的模块文档目录。

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

1. [README](/Users/dev/Desktop/learning-agent-core/README.md)
2. [项目规范总览](/Users/dev/Desktop/learning-agent-core/docs/project-conventions.md)
3. [架构总览](/Users/dev/Desktop/learning-agent-core/docs/ARCHITECTURE.md)
4. [目录地图](/Users/dev/Desktop/learning-agent-core/docs/repo-directory-overview.md)
5. 对应目录自己的 README 或 `docs/<module>/README.md`
