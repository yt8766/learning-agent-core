# Packages 目录说明

状态：current
文档类型：overview
适用范围：`packages/*`
最后核对：2026-04-18

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
- compat 收缩候选：[package-compat-sunset-candidates.md](/docs/package-compat-sunset-candidates.md)
- contract 边界：[core/README.md](/docs/core/README.md)
- 迁移历史：[archive/agent-core/README.md](/docs/archive/agent-core/README.md)

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
  - memory/rule/runtime-state repository、vector index、semantic cache、search
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

| 包/目录                  | 核心职责                                                                        | 稳定出口                    | 不应承载                                           | 后续优先收敛                                                  |
| ------------------------ | ------------------------------------------------------------------------------- | --------------------------- | -------------------------------------------------- | ------------------------------------------------------------- |
| `packages/core`          | 稳定公共 contract、schema、DTO、record、错误语义                                | `@agent/core`               | graph、flow、provider、repository 主实现           | 继续坚持 schema-first，清理纯 type 主定义                     |
| `packages/runtime`       | runtime 主链 orchestration、session、graph、capability、主链治理                | `@agent/runtime`            | app view model、controller、provider 细节          | `graphs/main/*`、`session/*`、compat bridge 继续收边界        |
| `packages/adapters`      | LLM/embedding adapter、provider normalize、runtime factory                      | `@agent/adapters`           | agent prompt、graph orchestration、业务 policy     | `providers/`、`runtime/`、`utils/` 的细粒度职责继续收紧       |
| `packages/config`        | settings/profile/policy 的稳定配置 facade 与加载标准化                          | `@agent/config`             | runtime orchestration、provider 实例、repository   | `schemas/`、`profiles/`、`policies/` 继续充实                 |
| `packages/memory`        | memory/rule/runtime-state repository、index、search、governance                 | `@agent/memory`             | agent 主链流程、review/research/chat prompt        | `repositories/`、`normalization/`、`governance/` 继续拆清     |
| `packages/tools`         | tool definition、registry、executor、sandbox、approval preflight、MCP transport | `@agent/tools`              | agent route、chat/research/review 主流程           | `definitions/`、`transports/`、executor/policy 的落位继续分开 |
| `packages/skill-runtime` | 运行时 skill catalog、install、policy、registry                                 | `@agent/skill-runtime`      | 仓库代理技能 `skills/*`、graph 主流程、tool 主编排 | `catalog/`、`install/`、`policies/` 继续补 schema/contract    |
| `packages/evals`         | benchmark、regression、quality gate、评测 contract                              | `@agent/evals`              | runtime 主链、provider 适配、app 编排              | `schemas/`、`reporting/`、gate runner 继续沉淀                |
| `packages/report-kit`    | data-report 确定性 blueprint/scaffold/assembly/write 引擎                       | `@agent/report-kit`         | graph 编排、tool registry、backend service 拼流程  | `contracts/`、`schemas/`、`shared/` 的领域封装继续补齐        |
| `packages/templates`     | starter/scaffold/report/page 模板资产与 registry                                | `@agent/templates`          | preview/runtime/execute 逻辑、agent flow           | 模板 manifest、registry contract、类型分层继续完善            |
| `agents/supervisor`      | supervisor 主控、workflow route、specialist/ministry 宿主                       | `@agent/agents-supervisor`  | 通用共享 contract、app 层胶水                      | `flows/`、`graphs/`、`workflows/` 的边界继续收紧              |
| `agents/data-report`     | data-report graph、preview/runtime facade、JSON/report flow 宿主                | `@agent/agents-data-report` | blueprint/write pipeline 主实现                    | graph/runtime facade 与 report-kit 的边界继续收紧             |
| `agents/coder`           | 代码执行/工部与兵部链路宿主                                                     | `@agent/agents-coder`       | 通用 runtime 共享逻辑                              | `flows/`、`schemas/`、执行节点边界继续收敛                    |
| `agents/reviewer`        | review/刑部审查链路宿主                                                         | `@agent/agents-reviewer`    | 通用 contract、runtime 共享编排                    | `flows/`、`schemas/`、decision/gate 边界继续收敛              |

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

- `packages/runtime` 已承载 `runtime / session / governance` 的真实源码
- `packages/runtime` 现已继续承载 `chat.graph / recovery.graph / learning.graph / LearningFlow / approval-recovery` 的真实源码
- `packages/runtime` 现已继续承载 `graphs/main/*` 的真实源码
- `packages/runtime` 现已继续承载 `event-maps / llm-retry / context-compression / temporal-context / runtime-output-sanitizer` 这些主链共享 util 的真实源码
- `packages/runtime` 现已继续承载 `capability-pool`、直答/审批 interrupt 节点与 main graph 所需的 ministries stage orchestration 真实源码
- `packages/adapters` 已承载 `adapters/llm` 的真实源码
- `packages/adapters` 现已继续承载 prompt template、LLM retry、safe structured object、model fallback、reactive retry 与 JSON safety prompt 的真实源码
- `packages/adapters` 现已继续承载 chat model factory、embedding factory 与 provider base-url normalize 的真实源码
- `packages/model` 已删除；模型与 embedding 工厂能力统一收口到 `@agent/adapters`
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
