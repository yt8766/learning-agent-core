# Packages 目录说明

状态：current
文档类型：overview
适用范围：`packages/*`
最后核对：2026-04-20

`packages/` 放共享库和运行时基础能力，应用层应只通过 `@agent/*` 公开入口依赖这里的包。

补充：

- `agents/*` 现在作为 root 级 agent package 目录存在，与 `packages/*` 同级
- 本文仍一并记录这些 agent 包，因为它们同样通过 `@agent/agents-*` 作为工作区公开入口被消费

本主题主文档：

- 本文是 `packages/*` 与 `agents/*` 的总入口

本文只覆盖：

- 目录职责和宿主边界
- 当前迁移收敛结果
- 推荐继续阅读顺序

更细规则请继续看：

- 分层与依赖约定：[package-architecture-guidelines.md](/docs/package-architecture-guidelines.md)
- 全局 runtime 分层 ADR：[runtime-layering-adr.md](/docs/runtime-layering-adr.md)
- compat 收缩候选：[package-compat-sunset-candidates.md](/docs/package-compat-sunset-candidates.md)
- contract 边界：[core/README.md](/docs/core/README.md)
- 迁移历史：[archive/agent-core/README.md](/docs/archive/agent-core/README.md)

当前目录职责：

- `packages/core`
  - 稳定 contract facade、DTO、Record、Schema、错误模型、接口边界入口
  - 只负责跨包公共语言，不负责业务实现或外部 SDK；当前依赖保持为 `zod`
- `packages/runtime`
  - Runtime Kernel：graph 执行、session、checkpoint、approval/recovery、interrupt、observability 与抽象 registry contract 的真实实现入口
  - 当前 `bridges/*` 只保留 runtime 内部 contract wrapper，不再直接 re-export 官方 agents
  - backend runtime 适配层现在也开始围绕它按 `runtime/domain/*` 拆分纯规则：skills、connectors、metrics、observability 的纯投影/状态变更/helper 已逐步从 centers/services 下沉
- `packages/platform-runtime`
  - 官方平台装配层 / Composition Root
  - 负责官方 Agent/workflow 出口、默认 platform runtime facade、backend/worker 共享启动线、官方 agent registry
  - 当前 facade 固定暴露 `runtime + agentRegistry + agentDependencies + metadata`，app 层读取官方默认装配能力与只读 metadata 时应优先通过这层组合根
  - 当前已开始把 specialist route enrich 为官方 agent descriptor 线索，供 runtime 主链继续消费
  - 不负责 HTTP controller、worker loop、前端 view model 或 Agent graph 主实现
- `packages/agent-kit`
  - 编写 Agent 的轻量 SDK：BaseAgent、AgentDescriptor、能力声明与基础执行 helper
  - 不负责 session/checkpoint/platform center 投射
- `packages/adapters`
  - 模型 provider normalize、chat/embedding factory、LLM adapter 的真实实现入口
- `packages/knowledge`
  - RAG knowledge ingestion / retrieval / citation 的真实实现入口
- `agents/supervisor`
  - supervisor / workflow / subgraph 描述等主控入口与真实实现位置
  - 当前负责 workflow route、workflow preset、specialist routing、bootstrap registry 与礼/户/吏部相关 ministry 宿主
- `agents/data-report`
  - data-report graph / flow 的智能体公开入口与真实实现位置
  - 当前负责 sandpack preview、JSON graph、报表生成节点编排与本地域类型出口
- `agents/coder`
  - coder agent 的公开入口与真实实现位置，承载 `ExecutorAgent`、`GongbuCodeMinistry`、`BingbuOpsMinistry`
  - 当前负责代码执行链、只读批处理、审批门、执行 prompt / schema
- `agents/reviewer`
  - reviewer agent 的公开入口与真实实现位置，承载 `ReviewerAgent`、`XingbuReviewMinistry`
  - 当前负责 review decision prompt / schema 与 reviewer 审查链
- `docs/shared/*`
  - `packages/shared` 退场过程的历史台账与兼容边界归档
- `packages/config`
  - profile、settings schema、默认策略、路径布局与配置标准化 facade
- `packages/memory`
  - memory/rule/runtime-state repository、semantic cache、memory search
- `packages/tools`
  - tool registry、executor、sandbox、approval preflight、MCP transport
- `packages/skill-runtime`
  - 运行时 skill registry、manifest loader、source sync、install 与 lifecycle policy 的真实宿主
- `packages/report-kit`
  - data-report 的 blueprint、scaffold、assembly、write；作为报表领域确定性生成引擎
- `packages/templates`
  - 可被生成链路复用的页面模板、scaffold 模板、starter 模板资产与 registry
- `packages/evals`
  - bench、prompt 回归、质量评测基建与统一评测 contract 宿主

## 按包职责矩阵

下表用于回答四件事：

1. 这个包的核心职责是什么
2. 调用方应通过什么稳定出口消费
3. 哪些内容不应继续塞进这个包
4. 后续继续收敛时优先看哪里

| 包/目录                     | 核心职责                                                                          | 稳定出口                    | 不应承载                                                    | 后续优先收敛                                                                                                                    |
| --------------------------- | --------------------------------------------------------------------------------- | --------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core`             | 稳定公共 contract、schema、DTO、record、错误语义                                  | `@agent/core`               | graph、flow、provider、repository 主实现、业务包依赖        | 继续坚持 schema-first，并保持依赖只含 `zod`                                                                                     |
| `packages/agent-kit`        | Agent SDK、descriptor、capability 声明、基础执行 helper                           | `@agent/agent-kit`          | session/checkpoint/platform center 投射                     | 为 supervisor capability dispatch 与 planner strategy selector 提供稳定 Agent contract                                          |
| `packages/runtime`          | Runtime Kernel：graph/session/checkpoint/approval/recovery/observability kernel   | `@agent/runtime`            | 官方 Agent 默认组合、app view model、controller             | `bridges/*` 的官方 Agent re-export 后续迁到依赖注入 contract                                                                    |
| `packages/platform-runtime` | 官方平台装配层、默认生产装配、backend/worker 共享启动线                           | `@agent/platform-runtime`   | HTTP controller、worker loop、Agent graph 主实现            | 承接 official registry、capability/domain lookup、capability-first `agentDependencies`、只读 metadata 与 default runtime facade |
| `packages/adapters`         | LLM/embedding adapter、provider normalize、runtime factory、SDK provider 扩展入口 | `@agent/adapters`           | agent prompt、graph orchestration、业务 policy              | `factories/`、`providers/`、`prompts/`、`retry/`、`structured-output/` 的边界继续收紧                                           |
| `packages/knowledge`        | knowledge ingestion、retrieval、citation/context assembly                         | `@agent/knowledge`          | 最终回答生成、graph orchestration、provider 细节            | `indexing/`、`retrieval/`、`runtime/` 边界继续收敛                                                                              |
| `packages/config`           | settings/profile/policy 的稳定配置 facade 与加载标准化                            | `@agent/config`             | runtime orchestration、provider 实例、repository            | `schemas/`、`profiles/`、`policies/` 继续充实                                                                                   |
| `packages/memory`           | memory/rule/runtime-state repository、memory search、governance                   | `@agent/memory`             | agent 主链流程、knowledge retrieval、chat prompt            | `repositories/`、`normalization/`、`governance/` 继续拆清                                                                       |
| `packages/tools`            | tool definition、registry、executor、sandbox、approval preflight、MCP transport   | `@agent/tools`              | agent route、chat/research/review 主流程                    | `definitions/`、`transports/`、executor/policy 的落位继续分开                                                                   |
| `packages/skill-runtime`    | 运行时 skill catalog、install、policy、registry                                   | `@agent/skill-runtime`      | 仓库代理技能 `skills/*`、graph 主流程、tool 主编排          | `catalog/`、`install/`、`policies/` 继续补 schema/contract                                                                      |
| `packages/evals`            | benchmark、regression、quality gate、评测 contract                                | `@agent/evals`              | runtime 主链、provider 适配、app 编排                       | `schemas/`、`reporting/`、gate runner 继续沉淀                                                                                  |
| `packages/report-kit`       | data-report 确定性 blueprint/scaffold/assembly/write 引擎                         | `@agent/report-kit`         | graph 编排、tool registry、backend service 拼流程           | `contracts/`、`schemas/`、`shared/` 的领域封装继续补齐                                                                          |
| `packages/templates`        | starter/scaffold/report/page 模板资产与 registry                                  | `@agent/templates`          | preview/runtime/execute 逻辑、agent flow                    | 模板 manifest、registry contract、类型分层继续完善                                                                              |
| `agents/supervisor`         | supervisor 主控、workflow route、supervisor 自有 specialist/ministry 宿主         | `@agent/agents-supervisor`  | 通用共享 contract、app 层胶水、sibling specialist re-export | `flows/`、`graphs/`、`workflows/` 的边界继续收紧，保持不依赖 coder/reviewer/data-report                                         |
| `agents/data-report`        | data-report graph、preview/runtime facade、JSON/report flow 宿主                  | `@agent/agents-data-report` | blueprint/write pipeline 主实现                             | graph/runtime facade 与 report-kit 的边界继续收紧                                                                               |
| `agents/coder`              | 代码执行/工部与兵部链路宿主                                                       | `@agent/agents-coder`       | 通用 runtime 共享逻辑                                       | `flows/`、`schemas/`、执行节点边界继续收敛                                                                                      |
| `agents/reviewer`           | review/刑部审查链路宿主                                                           | `@agent/agents-reviewer`    | 通用 contract、runtime 共享编排                             | `flows/`、`schemas/`、decision/gate 边界继续收敛                                                                                |

补充判断：

- `packages/core` 是“稳定公共语言层”，不是其他包的目录模板
- 其他包应参考的是 `core` 的治理顺序：
  - 先定义边界
  - 再定义稳定出口
  - 再决定真实实现宿主
- 因此同样叫“收敛”，`runtime` 应优先长成 orchestration host，`tools` 应优先长成 definitions + executors + transports，`templates` 应优先长成资产仓，而不是都长成 `core` 的样子

## 目录聚合入口分级

当前仓库里还保留了不少 `index.ts`，但它们不再都意味着“过渡 compat”。

后续处理时，默认分三类看：

### A. 长期保留的稳定包根 / facade 聚合

这些入口承担稳定消费边界，本身就是设计目标，不进入默认删除队列。

典型例子：

- `packages/config/src/index.ts`
- `packages/evals/src/index.ts`
- `packages/skill-runtime/src/index.ts`
- `packages/report-kit/src/index.ts`
- `packages/runtime/src/index.ts`
- `packages/adapters/src/index.ts`
- `packages/tools/src/index.ts`
- `agents/supervisor/src/index.ts`
- `agents/data-report/src/index.ts`
- `agents/coder/src/index.ts`
- `agents/reviewer/src/index.ts`

处理原则：

- 可以继续压缩导出内容，但不应轻易删除
- 应优先保证“包根就是稳定出口”
- 如果根出口通过 `contracts/*-facade.ts` 再转一层，也默认视为稳定 facade 设计

### B. 长期保留的目录聚合入口

这些入口主要服务于包内分组语义和局部消费，通常不直接面向 app 层，但保留有明确价值。

典型例子：

- `packages/tools/src/approval/index.ts`
- `packages/tools/src/mcp/index.ts`
- `packages/tools/src/registry/index.ts`
- `packages/tools/src/sandbox/index.ts`
- `packages/tools/src/watchdog/index.ts`
- `packages/runtime/src/flows/approval/index.ts`
- `packages/runtime/src/flows/learning/index.ts`
- `packages/runtime/src/flows/ministries/index.ts`
- `packages/memory/src/repositories/index.ts`
- `packages/memory/src/search/index.ts`
- `packages/memory/src/vector/index.ts`
- `packages/memory/src/embeddings/index.ts`
- `agents/data-report/src/flows/data-report/index.ts`
- `agents/data-report/src/flows/data-report-json/index.ts`
- `agents/data-report/src/types/index.ts`

处理原则：

- 保留“目录名 = 聚合语义”
- 不应再把真实实现偷偷塞进同级旧文件后再由 `index.ts` 反向指过去
- 如果聚合目录下只有 `index.ts` 而长期没有实体实现，应继续评估是否需要物理收敛

### C. 仅作包内组织、后续可继续评估收缩的聚合层

这些入口通常是更细粒度的 `nodes/`、`prompts/`、`schemas/` 分组入口，当前保留是为了阅读和导入便利，但不是稳定公共 API。

典型例子：

- `agents/data-report/src/flows/data-report/nodes/index.ts`
- `agents/data-report/src/flows/data-report/prompts/index.ts`
- `agents/data-report/src/flows/data-report/schemas/index.ts`
- `agents/data-report/src/flows/data-report-json/nodes/index.ts`
- `agents/data-report/src/flows/data-report-json/prompts/index.ts`
- `agents/data-report/src/flows/data-report-json/schemas/index.ts`
- `agents/supervisor/src/flows/supervisor/index.ts`
- `agents/supervisor/src/flows/delivery/index.ts`
- `packages/core/src/tasking/schemas/index.ts`
- `packages/core/src/tasking/types/index.ts`

处理原则：

- 这类入口默认只服务于“同包/同域导入收口”
- 不建议让应用层或跨大包调用方依赖它们
- 若后续出现“只有 `index.ts`、没有继续承担分组价值”的情况，可以继续评估删减

补充判断：

- `index.ts` 不是天然的 compat，也不是天然该删
- 判断标准不是“它是不是转导出”，而是：
  1. 它是不是稳定消费边界
  2. 它是不是目录语义的必要聚合
  3. 它是否掩盖了真实宿主没有物理落位

默认只有第三类里的“掩盖真实宿主”的情况，才进入下一轮继续收缩候选

补充说明：

- `packages/core` 是稳定契约层范式，不是其他包必须复制的目录模板
- 其他包现在统一参考的是 `core` 的治理方式：
  - 先定义包边界
  - 再定义公开入口
  - 最后让真实实现落到最贴近本包主宿主的目录
- 也就是说，后续目录设计要优先回答“这个包最核心的真实宿主是什么”，而不是优先回答“要不要也做成 `schemas + types + contracts`”

迁移兼容说明：

- `packages/core` 已移除对 `@agent/report-kit` 的 manifest 依赖；后续不得让 contract 层重新依赖业务实现
- `packages/platform-runtime` 已作为 workspace 包落地，并承接 backend/worker 默认 runtime 创建线、应用侧官方 Agent 出口，以及 `RuntimeAgentDependencies` 官方装配
- `apps/backend` 与 `apps/worker` 已不再直接依赖 `@agent/agents-*` package manifest；官方装配统一通过 `@agent/platform-runtime`
- `packages/runtime` 已移除对官方 `@agent/agents-*` 的直接依赖，内部 bridge 仅保留 contract wrapper 兼容层
- `packages/runtime` 已承载 `runtime / session / governance` 的真实源码
- `packages/runtime` 现已继续承载 `chat.graph / recovery.graph / learning.graph / LearningFlow / approval-recovery` 的真实源码
- `packages/runtime` 现已继续承载 `graphs/main/*` 的真实源码
- `packages/runtime` 现已继续承载 `event-maps / llm-retry / context-compression / temporal-context / runtime-output-sanitizer` 这些主链共享 util 的真实源码
- `packages/runtime` 现已继续承载 `capability-pool`、直答/审批 interrupt 节点与 main graph 所需的 ministries stage orchestration 真实源码
- `packages/runtime/src/bridges/*` 现已只保留 runtime 内部 contract wrapper；runtime 对官方 `@agent/agents-*` 的直接依赖已经移除
- `packages/platform-runtime` 的 `createOfficialAgentRegistry()` 现已提供默认官方 agent descriptor、capability 与 specialist domain lookup；`createOfficialRuntimeAgentDependencies()` 也会优先按 capability contract 解析官方模块，并把 specialist route enrich 为官方 agent 匹配线索，后续 supervisor capability dispatch 应优先挂到这层 contract
- `apps/backend/agent-server/src/runtime/domain/*` 现已开始承接 backend runtime 的纯规则宿主：
  - `domain/skills/*`：skill search/status、auto-install eligibility、install path/naming
  - `domain/connectors/*`：connector projection reader、governance state mutation
  - `domain/metrics/*`：persisted snapshot preference、recent runs projection
  - `domain/observability/*`：approvals center、run observatory list 的纯投影规则
- `apps/worker` 当前已通过 `createWorkerRuntimeHost()` 持有 `PlatformRuntimeFacade`，worker 继续往“runtime facade + background runner context”的后台适配器模型收口
- supervisor dispatch 现在还会继续带出 `selectedAgentId`，把“偏好候选是谁”和“本次实际收敛给谁”分开，避免 checkpoint / admin / chat 继续按历史 role 名称猜官方 agent
- `packages/runtime` 与 `apps/backend` 的 runtime audit / fallback plan / dispatch objective 现在也优先消费 `selectedAgentId` 与 dispatch kind，再回退到历史 role / ministry 语义
- `packages/agent-kit` 现已承载通用 `AgentDescriptor` / `AgentProvider` / `AgentRegistry` contract；`packages/platform-runtime` 只保留官方 registry 实现与兼容 re-export
- runtime / admin 现在还能直接观察 `plannerStrategy` contract（`default` / `capability-gap` / `rich-candidates`），不再需要从 specialist route 与 dispatch 明细里手工反推当前规划态
- `packages/adapters` 已承载 `adapters/llm` 的真实源码
- `packages/adapters` 现已继续承载 prompt template、LLM retry、safe structured object、model fallback、reactive retry 与 JSON safety prompt 的真实源码
- `packages/adapters` 现已继续承载 chat model factory、embedding factory 与 provider base-url normalize 的真实源码
- `packages/model` 已删除；模型与 embedding 工厂能力统一收口到 `@agent/adapters`
- `agents/supervisor` 已承载 `bootstrap / subgraph-registry / main-route / workflows / flows/supervisor` 的真实源码
- `agents/data-report` 已承载 `data-report.graph / data-report-json.graph / flows/data-report / flows/data-report-json` 的真实源码
- `agents/coder` 已承载 `executor-node / gongbu-code-ministry / bingbu-ops-ministry / 执行 prompt / 执行 schema` 的真实源码
- `agents/reviewer` 已承载 `reviewer-node / xingbu-review-ministry / review prompt / review schema` 的真实源码
- `packages/agent-core` 已删除；剩余主链已完成迁入 `packages/runtime`、`packages/adapters` 与 `agents/*`
- 新消费侧优先改用 `@agent/agent-kit`、`@agent/runtime`、`@agent/adapters`、`@agent/agents-*`
- 当前扫描结果里，仓库代码层已无 `@agent/agent-core` 直接消费；`apps/backend/agent-server/tsconfig.json` 与根部 `tsconfig.json`、`tsconfig.node.json`、`vitest.config.js` 中的旧 alias 也已移除
- 本轮继续把 `workflow-route`、`chat-graph`、`data-report*` 类型、`specialist-finding` / `critique-result` schema、`PendingExecutionContext` 迁到了 `packages/core`
- 本轮继续把 prompt template、LLM retry、safe structured object、reactive retry 收口到 `@agent/adapters` 的稳定共享入口
- 本轮继续把 `supervisor` 的 `libu-router / hubu-search / libu-docs` 物理迁到了 `agents/supervisor/src/flows/ministries/*`
- 当前已不存在 `agents/* -> packages/runtime/src/*` 的直接桥接；agent 包统一通过 `@agent/agent-kit`、`@agent/runtime`、`@agent/adapters`、`@agent/core` 与 `@agent/agents-*` 的稳定入口协作
- `docs/archive/agent-core/*` 现在保留为迁移历史与专题说明目录，不再对应一个真实工作区包
- 第一阶段 compat 根文件收缩已完成：
  - `packages/evals`
  - `packages/skill-runtime`
  - `packages/report-kit`
  - `packages/templates`
  - `packages/config` 的纯 compat `settings.*`
- 已进一步补出 facade contract 的包：
  - `packages/config`：`contracts/settings-facade.ts`
  - `packages/skill-runtime`：`contracts/skill-runtime-facade.ts`
  - `packages/evals`：`contracts/evals-facade.ts`
- 当前仍保留的入口，默认分成两类：
  - `contracts/*` 这类 contract-first 稳定 facade
  - `packages/config/src/settings.ts` / `src/settings/index.ts` 这类人工可读聚合入口
- 继续删除前应先看
  - [Compat 入口收缩候选](/docs/package-compat-sunset-candidates.md)

补充说明：

- `skills/` 是给代码代理读取的仓库级技能目录，不属于这里的运行时包体系
- `docs/skill-runtime/*` 现在专门承载 `packages/skill-runtime` 文档；不要再与 `docs/skills/*` 混用
- `apps/*` 只允许依赖 `@agent/*` 包根入口；禁止直接依赖 `packages/*/src`、`agents/*/src`，也禁止把 `@agent/<pkg>/<subpath>` 当成应用层稳定接口

## 后续重构优先顺序

后续如果要继续对 `packages/*` 做职责与目录收敛，推荐按下面顺序推进，而不是全量同时平移：

1. `packages/runtime`
   - 这是当前最大的执行宿主，最容易继续吸入不该属于 runtime 的杂项
   - 优先继续拆 `session/`、`graphs/main/*`、`runtime/agent-bridges/*` 的边界
2. `packages/tools`
   - 当前同时承载 definition、executor、approval、transport
   - 优先把 definition / executor / transport 三类语义继续分开
3. `packages/templates`
   - 当前模板资产平铺最明显
   - 优先按 `starters / scaffolds / reports` 收敛，而不是继续以模板名平铺
4. `packages/memory`
   - 优先把 repository / governance / normalization 继续拆清
5. `packages/config`
   - 优先收紧 `runtime/` 目录语义，避免继续混入配置之外的运行态 helper
6. `packages/skill-runtime`
   - 优先补 `catalog/`、`install/`、`policies/`
7. `packages/evals`
   - 优先把 benchmark / regression / quality gate 拆成可扩展子域
8. `packages/report-kit`
   - 优先把 write 阶段收紧为 materialization 语义，并继续保持与 graph/runtime 分离
9. `packages/adapters`
   - 优先把 prompt / retry / fallback 从泛化 `shared`、`utils` 收敛成更明确的宿主

## 按包收敛时的固定判断

每个包开始重构前，默认先回答这四个问题：

1. 这个包最核心的主宿主是什么
2. 哪些目录只是稳定 facade，哪些目录才是真实实现宿主
3. 哪些文件只是 compat / 聚合入口，不应再承接新实现
4. 这次重构完成后，调用方应该通过哪个根入口消费，而不是依赖内部目录

建议优先阅读：

1. [agent-core 迁移历史目录](/docs/archive/agent-core/README.md)
2. [core 文档目录](/docs/core/README.md)
3. [Packages 分层与依赖约定](/docs/package-architecture-guidelines.md)
4. [目录地图](/docs/repo-directory-overview.md)
5. [runtime 文档目录](/docs/runtime/README.md)
6. [report-kit 包结构规范](/docs/report-kit/package-structure-guidelines.md)
7. [templates 包结构规范](/docs/templates/package-structure-guidelines.md)
8. [tools 包结构规范](/docs/tools/package-structure-guidelines.md)
