# AI 总交接文档

状态：current
文档类型：guide
适用范围：仓库全局、`packages/*`、`agents/*`
最后核对：2026-04-19

## 目的

本文档用于帮助后续接手本仓库的 AI 或开发者快速理解当前仓库状态、主宿主边界、阅读入口与默认推进方式。

## 当前仓库定位

这是一个面向“开发自治”的多 Agent 系统，不是普通聊天应用。整体按 “Human / Supervisor / 六部” 方向演进：

- `apps/frontend/agent-chat`
  - OpenClaw 风格前线作战面，负责执行与操作
- `apps/frontend/agent-admin`
  - 六大中心后台指挥面，负责治理与运营
- `packages/runtime`
  - runtime kernel 与主图宿主
- `packages/platform-runtime`
  - 官方平台装配层 / composition root
- `agents/*`
  - 专项 agent 的真实 graph / flow 宿主

## 接手时先建立的三个事实

1. 共享稳定 contract 默认收敛到 `packages/core`，不要重新引入第二个 shared 层。
2. 主链 runtime、graph、session、approval/recovery 的真实宿主是 `packages/runtime`，不要把长流程回塞到 app service。
3. 专项 agent 不应只是 helper；如果它是稳定子 Agent，就应在 `packages/runtime/src/graphs/*` 或 `agents/*/src/graphs/*` 有清晰入口。

## 当前目录阅读顺序

1. 仓库入口：[README.md](/README.md)
2. docs 目录规范：[docs/README.md](/docs/README.md)
3. 项目规范总览：[docs/conventions/project-conventions.md](/docs/conventions/project-conventions.md)
4. 架构总览：[docs/architecture/ARCHITECTURE.md](/docs/architecture/ARCHITECTURE.md)
5. 包总览：[docs/maps/packages-overview.md](/docs/maps/packages-overview.md)
6. API 契约：[docs/contracts/api/README.md](/docs/contracts/api/README.md)
7. 前后端集成链路：[docs/integration/frontend-backend-integration.md](/docs/integration/frontend-backend-integration.md)
8. 验证体系：[docs/packages/evals/verification-system-guidelines.md](/docs/packages/evals/verification-system-guidelines.md)
9. 目标包交接文档：[docs/context/README.md](/docs/context/README.md)

## 代码与文档的默认落位

- 稳定公共 schema / DTO / event / payload contract：
  - 优先落到 `packages/core`
- runtime kernel / graph orchestration / session / interrupt / approval：
  - 优先落到 `packages/runtime`
- 官方默认组合、registry、平台侧 metadata、backend/worker 共用 runtime host：
  - 优先落到 `packages/platform-runtime`
- provider / model / embedding / structured output / retry：
  - 优先落到 `packages/adapters`
- knowledge ingestion / retrieval / citation / context assembly：
  - 优先落到 `packages/knowledge`
- memory / rules / runtime state / semantic cache：
  - 优先落到 `packages/memory`
- tool registry / executor / sandbox / MCP transport：
  - 优先落到 `packages/tools`
- skill catalog / install / source / registry：
  - 优先落到 `packages/skill`
- data-report 的确定性 blueprints / scaffold / assembly：
  - 优先落到 `packages/report-kit`
- 专项 agent graph / flow / prompt / schema：
  - 优先落到 `agents/*`

## 接手时的默认做法

- 先找真实宿主，不要直接在 controller / service / workflow 胶水层堆逻辑。
- 先补最小失败测试，再写最小实现，再重构收敛。
- 只要碰代码、配置、模板、脚手架或测试文件，就按验证体系补五层验证；纯文档改动至少跑 `pnpm check:docs`。
- 完成功能后同步更新文档，不要只改代码不沉淀。
- 如果发现旧文档明显过时，要顺手更新或标注过时，避免知识分叉。

## 当前 workspace 包阅读映射

- `packages/*`：
  - 见 [docs/context/README.md](/docs/context/README.md) 中的 packages 交接文档列表
- `agents/*`：
  - 同样收录在 [docs/context/README.md](/docs/context/README.md) 中的 agents 交接文档列表

## 高风险误区

- 不要把 `agent-chat` 和 `agent-admin` 做成重复产品。
- 不要在 app 层直连 `packages/*/src` 或 `agents/*/src`。
- 不要把长期公共 contract 又塞回 app、service 或临时 helper。
- 不要把稳定子 Agent 主链继续写成 `workflows/*` 里的提示词胶水。
- 不要让目录分组名和真实实现长期分离；如果已有 `nodes/`、`schemas/`、`prompts/` 等目录，就要继续物理收敛。

## 修改前优先看的专项文档

- runtime / graph / session：
  - [docs/packages/runtime/README.md](/docs/packages/runtime/README.md)
- backend：
  - [docs/apps/backend/README.md](/docs/apps/backend/README.md)
- frontend：
  - [docs/apps/frontend/README.md](/docs/apps/frontend/README.md)
- supervisor / workflow：
  - [docs/agents/supervisor/README.md](/docs/agents/supervisor/README.md)
- data-report：
  - [docs/agents/data-report/README.md](/docs/agents/data-report/README.md)
- coder：
  - [docs/agents/coder/README.md](/docs/agents/coder/README.md)
- reviewer：
  - [docs/agents/reviewer/README.md](/docs/agents/reviewer/README.md)

## 交接提醒

- 如果你要开始某个包的改动，先读该包对应的 handoff，再读它的正式模块文档。
- 如果你改了某个包的边界、入口或验证方式，必须同步更新 `docs/context/ai-handoff.md` 和该包 handoff。
- 如果你不确定某段逻辑该放哪，优先按“稳定 contract 在 core、真实宿主在业务包、装配在 platform/runtime、app 只做适配”来判断。
