# Runtime Module Notes

状态：current
文档类型：reference
适用范围：`apps/backend/agent-server/src/runtime`
最后核对：2026-04-19

本主题主文档：

- backend runtime 边界仍以本文为主
- `platform console` 的性能基线与验收口径见 [platform-console-performance-baseline.md](/docs/backend/platform-console-performance-baseline.md)

本文只覆盖：

- `apps/backend/agent-server/src/runtime` 的 provider 拆分
- runtime facade 与各窄接口的依赖原则
- backend runtime 相关测试与模块内约束

总体服务职责仍以 [agent-server-overview.md](/docs/backend/agent-server-overview.md) 为准

`runtime/` 现在不再承载单一“大而全” service，而是按长期稳定边界拆成多个 provider。

当前目录收口补充：

- `services/*`
  - 默认视为 backend facade
  - 只保留参数补位、`NotFoundException`、最小返回适配
  - task audit、connector center 读取、skill draft 生成这类较重逻辑已开始下沉到 `runtime/domain/*`
- `runtime/domain/skills/*`
  - 当前已开始承载 skill 侧 app-local context assembly 与派生 helper
  - `createSkillInstallContext`、`createSkillSourcesContext` 已拆到 `runtime/domain/skills/runtime-skill-contexts.ts`
  - skill install orchestration 相关 helper 已拆到 `runtime/domain/skills/runtime-skill-orchestration.ts`
  - 包括 pre-execution intervention、approval continuation、runtime-stage intervention，以及 install receipt/finalize 收口逻辑
  - `runtime.service.ts` 内部使用的 skill resolver wiring 已拆到 `runtime/domain/skills/runtime-skill-runtime-resolvers.ts`
  - `runtime.service.helpers.ts` 仅保留兼容 re-export 与真正的 runtime helper
- `runtime/domain/connectors/*`
  - 当前承载 connector/governance 侧的 app-local 聚合 helper
  - `groupConnectorDiscoveryHistory`、`groupGovernanceAuditByTarget`、`defaultConnectorSessionState` 已从 `runtime-derived-records.ts` 拆出，避免继续把 connectors 治理语义混进通用 records helper
- `runtime/centers/runtime-centers-governance-counselors.ts`
  - 当前已退化为 backend error-mapping wrapper
  - counselor selector config 的排序、写盘与 audit 主逻辑已迁到 `packages/runtime/src/governance/runtime-counselor-selector-store.ts`
  - backend 只保留 `NotFoundException` 语义，不再长期承载这类稳定治理 store 规则
- `runtime/centers/runtime-centers-governance-policy.ts`
  - approval scope policy 的 active list / revoke+audit facade 已迁到 `packages/runtime/src/governance/runtime-approval-scope-policy-store.ts`
  - backend 当前只保留 `NotFoundException` 与 learning conflict 这类 app-local 语义，不再继续承载 approval policy 的稳定治理落盘规则
- `centers/*`
  - 当前属于 backend BFF 与 runtime domain 聚合的过渡收口区
  - `QueryService` / `GovernanceService` 继续作为 app-facing facade
  - `platform console` cache / shell / export 适配仍以 backend 语义为主，不应反向把稳定 runtime 主逻辑继续堆回 app 层

当前主边界：

- `RuntimeTaskService`
  - task 创建、诊断、审批、audit、learning job
  - `runtime-task.service.ts` 当前默认对齐显式 orchestrator / runtime-state contract：task audit 里的 `governance / trace / approval / usage` 聚合记录应直接基于 `TaskRecord` 与 `RuntimeStateSnapshot` 推导，`fallback plan` 也要补齐 `ManagerPlan` 的完整字段，不要再靠 `any` 和宽松字面量拼返回
- `RuntimeSessionService`
  - chat session、message、event、checkpoint、recover、subscribe
- `RuntimeKnowledgeService`
  - memory / rule 查询与治理
  - `runtime-knowledge.service.ts` 当前应直接依赖 `RuntimeWenyuanFacade + RuleRepository + RuntimeStateSnapshot + MemoryRepository` 这组真实 contract；像 compare snapshot、scrubber、cross-check evidence 这类路径不要再回退到 `ruleRepository/orchestrator/runtimeStateRepository: any`
  - memory usage 聚合、memory version compare、cross-check evidence merge 现已下沉到：
    - `runtime/domain/knowledge/runtime-memory-usage-insights.ts`
    - `runtime/domain/knowledge/runtime-memory-version-compare.ts`
    - `runtime/domain/knowledge/runtime-cross-check-evidence.ts`
  - `RuntimeKnowledgeService` 只保留 facade 入口、调用顺序与 `NotFoundException` 语义，不再继续内联这类稳定领域规则
- `RuntimeSkillCatalogService`
  - skill 列表、提升、停用、恢复、退役
- `RuntimeCentersService`
  - Runtime / Evidence / Learning / Connectors / Skill Sources / Platform Console 这类中心视图
  - 当前内部继续拆成：
    - `RuntimeCentersQueryService`
    - `RuntimeCentersGovernanceService`
  - `runtime-centers-query.helpers.ts` 应作为 center 侧公共解析入口，像 executionMode / interactionKind / interrupt payload 这类兼容读取优先集中在这里做 controlled narrowing，不要在多个 query service 里重复写弱类型分支
  - `runtime-learning-evidence-center.*`、`runtime-company-agents-center.ts`、`runtime-skill-sources-center.ts`、`runtime-centers-governance-{counselors,connectors}.ts` 这类 helper 现在默认也要对齐显式输入 contract；读取 runtime state 时优先直接使用 `RuntimeStateSnapshot` / `CounselorSelectorConfig` / 本地汇总类型，不再回退成 `Promise<any>` 或 `Map<string, any>`
  - facade 只保留聚合与兼容出口
  - `platform console` 聚合 helper 当前带 `15s` 短 TTL 缓存与并发同 key 去重，用于缓解 admin dashboard 重复刷新导致的整包重算放大；如需更强实时性或主动刷新，应新增显式 refresh 语义，而不是移除这层保护
  - `platform console` 的 runtime/evals/evidence/diagnostics 聚合边界已开始显式收敛到 `runtime-platform-console.schemas.ts + runtime-platform-console.records.ts`；后续新增字段时，优先先补 schema/normalizer，再改 controller 或 export helper，不要把 `any` / `unknown` 重新穿透到后台边界
  - `platform console` 的 `skills / rules / tasks` 数组，以及 learning center 内的 local skill suggestions，也应优先对齐 `@agent/core` 里的稳定记录类型，而不是继续使用 `unknown[]` 作为过渡终态
  - `getApprovalsCenter()` 目前同时承担审批治理与运行时观测双重用途：核心字段仍对齐 `PlatformApprovalRecord`，但 `streamStatus`、`contextFilterState` 这类观测扩展字段需要继续保留，不能为了“纯 contract 化”直接删掉现有控制台可见信息
  - 当前还补充了轻量 `platform console shell` 路径：`GET /platform/console-shell`。这条路径会保留首页摘要级字段，并把 `runtime / learning / evals` 压成 summary 记录，同时把 `evidence / connectors / skillSources / companyAgents` 这类重量级中心裁成空占位，要求前端再按需请求各自 center 接口；dashboard 的 `refreshAll / refreshTask` 默认优先使用这条路径，并与当前页 center 并行拉取，而不是强依赖整包 `console`
  - `platform console` 返回体当前额外携带轻量 `diagnostics`，包含 `cacheStatus`、`generatedAt` 与按片段拆分的 `timingsMs`；这份诊断仅用于后台观测与排障，不应被前端当成强业务 contract 去驱动主功能
  - `RuntimeCentersQueryService.getPlatformConsole()` 当前会复用 `AppLoggerService` 记录控制台慢请求：`cache miss && total >= 300ms` 发出 `event=runtime.platform_console.fresh_aggregate` 的 `log`，`total >= 1000ms` 升级为 `event=runtime.platform_console.slow` 的 `warn`；日志会带 `days`、筛选参数、`cacheStatus`、分片 `timingsMs`、task/session 数量，供后端采样排障。这两类事件当前会落到 `logs/performance-YYYY-MM-DD.log`
  - 仓库当前提供离线统计脚本 `apps/backend/agent-server/scripts/analyze-platform-console-logs.ts`，可直接运行 `pnpm exec tsx apps/backend/agent-server/scripts/analyze-platform-console-logs.ts --dir apps/backend/agent-server/logs`；脚本会扫描 `performance-YYYY-MM-DD.log`，按 `runtime.platform_console.fresh_aggregate / runtime.platform_console.slow` 两类事件输出 count、`totalDurationMs` 的 `avg/p50/p95/max`，以及 `runtime/evals/...` 分片耗时的 `p50/p95/max`
  - 仓库当前还提供即时 HTTP 基线脚本 `apps/backend/agent-server/scripts/measure-platform-console.ts`，可直接对 `/api/platform/console?days=30` 做串行测量并输出 `request duration`、`diagnostics.timingsMs.total`、缓存状态分布与预算是否越界；如果传入 `--baseline-json`，还会附带输出与历史报告的对比结果，用于本地联调和 staging 验收
  - 当前还补充了 `GET /platform/console/log-analysis?days=7` 诊断接口，直接复用同一套日志统计口径返回 `sampleCount`、按事件分组的 `count / avg / p50 / p95 / max`、最近样本，以及统一的 `summary.status / summary.reasons / summary.budgetsMs`；当前默认预算为 `fresh aggregate p95 <= 600ms`、`slow p95 <= 1200ms`，供 `agent-admin` 控制面直接展示健康/预警状态，避免前端重复发明第二套阈值
  - `getConnectorsCenter()` 当前只读取已知 connector 状态与治理快照，不再在默认读路径里触发 `refreshAllServerDiscovery()`；需要主动探测时，继续使用现有的 connector refresh governance action
  - `platform console` 内部在拉取 `runtime / evals` 片段时，当前优先读取 persisted metrics snapshot（`metricsMode: snapshot-preferred`）；如果快照为空，则会回退一次 live 聚合补齐首屏数据。这样既减少 dashboard 读请求顺手写盘，也避免冷启动时整块历史为空；单独的 Runtime Center / Evals Center 查询仍保留 live 聚合语义
  - 当前已补充显式 `refreshMetricsSnapshots(days)` 治理入口，并通过 `POST /platform/console/refresh-metrics` 暴露；后台定时刷新与后续 admin 手动按钮都应复用这条入口，而不是重新把快照生产逻辑塞回查询链路
  - `RuntimeBootstrapService.initialize()` 当前会在主初始化完成后非阻塞预热一次 `metrics snapshot`，默认窗口为 `30d`；这层预热不阻塞服务启动，只用于提升首开控制台命中 persisted snapshot 的概率
  - `RuntimeScheduleService.initialize()` 当前还会在 runtime 进程内启动一条 `30` 分钟周期的 metrics snapshot 保温循环，默认刷新 `30d` 窗口；该循环只调用治理入口，不会重新耦合 dashboard 查询链路
- runtime metrics / governance
  - backend 已不再保留 `modules/runtime-metrics`、`modules/runtime-governance` compat 层
  - usage analytics、eval history、provider audit、approval scope policy、connector discovery snapshot、governance audit 与 profile aggregation 均直接通过 `@agent/runtime` 根入口消费
  - `runtime-centers-governance-metrics.ts` 已退化为 thin re-export；`refreshMetricsSnapshots()` 的 persisted snapshot 刷新 facade 现在由 `packages/runtime/src/runtime/runtime-metrics-refresh.ts` 承载，backend 只继续负责 runtime host wiring 与调度入口
  - metrics snapshot refresh 当前按 `usage analytics -> eval history` 顺序持久化到同一份 `RuntimeStateSnapshot`，避免并发写 usage/eval 历史时出现落盘互相覆盖
- runtime center / catalog center
  - `runtime-runtime-center.ts` 当前已退化为 backend wrapper + dependency injection facade，核心 projection 由 `packages/runtime/src/runtime/runtime-center-projection*.ts` 承载
  - `runtime-company-agents-center.ts`、`runtime-connectors-center.ts` 与 `runtime-skill-sources-center.ts` 已退化为对 `@agent/runtime` 的 thin re-export
- learning center
  - `runtime-learning-evidence-center.learning.ts` 与 `runtime-learning-evidence-center.summary.ts` 当前已退化为 backend wrapper，核心 projection 由 `packages/runtime/src/runtime/runtime-learning-center*.ts` 承载
  - backend 当前只负责注入 `buildRuleCandidates` 等 app-local 派生依赖；`runtime-learning-evidence-center.evidence.ts` 已明确收敛为永久 backend-only BFF adapter，专门承载 checkpoint ref / replay / recoverable 聚合
  - 这层 backend-only adapter 的具体 helper 当前下沉到 `runtime-learning-evidence-center.evidence-adapter.ts`；后续如果继续演进，应保持“session checkpoint binding + replay extraction” 只在这一层聚合，不要再把它误判为待迁出的过渡逻辑
- `RuntimeService`
  - 兼容 facade
  - 仅用于需要聚合多个 runtime provider 的场景
  - `runtime.service.ts` 现在只保留 facade、resolver 注册与 provider 绑定
  - `RuntimeModule` 当前保留 `RuntimeService` 作为内部 provider 与初始化入口，但已不再默认 export 给外部模块；新模块默认应直接注入 `RuntimeTaskService`、`RuntimeSessionService`、`RuntimeKnowledgeService`、`RuntimeSkillCatalogService`、`RuntimeCentersService` 等窄接口
  - `runtime.service-contexts.ts` 承载 connector registry / skill source / centers / platform console / background runner 的 context 装配
  - skill install/source 两类 context builder 已不再内联在 `runtime.service.helpers.ts`，而是下沉到 `runtime/domain/skills/runtime-skill-contexts.ts`
  - `platform console`、`background runner`、`knowledge` 三类 context builder 已进一步拆到：
    - `runtime/domain/centers/runtime-platform-console-context.ts`
    - `runtime/domain/background/runtime-background-context.ts`
    - `runtime/domain/knowledge/runtime-knowledge-context.ts`
  - `getCentersContext()` 的对象装配已进一步拆到 `runtime/domain/centers/runtime-centers-context.ts`
  - `RuntimePlatformConsoleContext` 当前已显式补齐 `getToolsCenter()`；这让 provider factory、centers query 与 platform console context 的能力面重新对齐，但不会改变现有 `/platform/console` 与 `/platform/console-shell` 的外部返回结构
  - `RuntimePlatformConsoleContext` 现在优先直接依赖 `RuntimeCentersService` 的窄方法面来提供 runtime / approvals / learning / evals / connectors / skill sources / company agents 读取；`runtime.service-contexts.ts` 不再把这些 center getter 逐个回绑到 `RuntimeService` compat facade
  - `runtime.service.ts` 在构造 `RuntimeServiceContextFactory` 时也不再显式逐项透传 `getRuntimeCenter/getApprovalsCenter/getConnectorsCenter/...` 这类 compat getter；platform console 所需 center 能力统一从 `centersService` 注入，进一步把 `RuntimeService` 稳定在聚合 facade 位置
  - `runtime.service-contexts.ts` 继续保留外层 factory 类与 wiring 入口，不再承接这些子域 context 的真实组装实现
  - `RuntimeCentersContext` 当前应被视为 runtime center 的显式依赖表：connector registry、skill install/source、provider audit、platform console context 都应从这里取真类型，不再回退到 `any` 容器
  - `runtime.service.helpers.ts` 里的 skill install/source helper 当前也应直接复用 `RuntimeHost`、`RuntimeCentersService`、`SkillInstallReceipt`、`SkillSourceRecord` 等真实宿主 contract；不要再把这些 helper 维持成 `settings/centersService/receipt: any` 的弱类型中转层
- `RuntimeToolsService`
  - connector 草稿、启停、配置、tools center 读取当前应直接对齐 `RuntimeHost`、`ConfiguredConnectorRecord`、`TaskRecord` 与 connectors center 返回类型
  - `runtime-tools-center.ts` 的 task 侧输入已经是显式 `TaskRecord[]`，后续不要再把 tool usage / attachments 汇总回退为 `any[]`
  - connector draft 默认模板映射、已配置 connector 的 secret update payload 组装，现已下沉到 `runtime/domain/tools/runtime-connector-drafts.ts`
  - `RuntimeToolsService` 只保留 facade 调用、connector 缺失时的 `NotFoundException` 语义，以及治理 action 转发
- connector governance actions
  - `runtime-connector-governance-actions.ts` 当前默认以 `RuntimeStateSnapshot`、`ConfiguredConnectorRecord`、`McpClientManager` 和显式 connector/capability override 结构作为输入边界；治理 action 的 `load/save/get/set/refresh` 参数不要继续声明成裸 `any`
- connector registry
  - `runtime-connector-registry.ts` 当前默认对齐 `McpServerDefinition`、显式 capability record、`WorkerDefinition` 与 installed-skill model 配置；connector 注册、发现能力补录、installed skill worker 注册这几条路径不要再回退成 `register(server|capability|worker: any)`
- `runtime-derived-records.ts`
  - 当前已退化为 compat re-export 层
  - learning candidate / installed skill tag 已拆到 `runtime/domain/learning/runtime-learning-derived-records.ts`
  - checkpoint ref 已拆到 `runtime/domain/session/runtime-checkpoint-ref.ts`
  - connector discovery / governance audit grouping 已拆到 `runtime/domain/connectors/runtime-connector-governance-records.ts`

`briefings/` 当前额外约束：

- `runtime-tech-briefing.service.ts`
  - 只保留 briefing orchestration facade、分类循环、抓取/投递编排
- `runtime-tech-briefing-schedule.ts`
  - 承载 category schedule、adaptive interval、lookback days、cron 计算
- `runtime-tech-briefing-category-processor.ts`
  - 承载同轮合并、跨轮去重、分类限流、audit record 与 category final status 决策
- `runtime-tech-briefing-category-collector.ts`
  - 承载 feed/security page/MCP supplemental search 的分类抓取、翻译前整理与偏好排序入口
- `runtime-tech-briefing-item-enrichment.ts`
  - 承载 action metadata、受影响版本/修复版本推断与偏好分数规则
- `runtime-tech-briefing-ranking.ts`
  - 只保留 source policy 过滤与最终排序
- `runtime-tech-briefing-ranking-finalize.ts`
  - 承载 ranking 前的 relevance enrichment、cross-verify、stable metadata 装配
- `runtime-tech-briefing-ranking-policy.ts`
  - 承载 priority score 与影响等级策略
- `runtime-tech-briefing-localize.ts`
  - 退化为 briefing 渲染 facade，只保留稳定导出面
- `runtime-tech-briefing-localize-copy.ts`
  - 承载标题/摘要本地化与文案替换规则
- `runtime-tech-briefing-localize-summary.ts`
  - 承载 markdown digest summary 渲染
- `runtime-tech-briefing-localize-card.ts`
  - 承载 interactive card 渲染
- `runtime-tech-briefing-localize-render-shared.ts`
  - 承载时间/标题/标签/摘要渲染共享 helper
- `runtime-tech-briefing-localize-render-content.ts`
  - 承载 impact/action/type/check-command 这类内容生成规则
- `runtime-tech-briefing-delivery.ts`
  - 承载 digest 投递、history 持久化、run record 组装
- `bree` 调度开关
  - `RuntimeScheduleService` 只在 `dailyTechBriefing.enabled === true` 时初始化 `bree`
  - 本地停用定时 briefing 的首选入口是项目根 `.env` 里的 `DAILY_TECH_BRIEFING_ENABLED=false`
  - 已落盘的 `data/runtime/schedules/*.json` 需要同步切到 `PAUSED`，避免控制台继续展示为活动态
- 后续继续拆分时，`category processor`、`collector`、`delivery`、`history/schedule persistence` 也应继续下沉到独立子模块
- 不要再把 adaptive interval、category config、cron 计算重新塞回 `runtime-tech-briefing.service.ts`
- 不要把 MCP supplemental search、偏好打分、动作元信息推断重新回填到 `runtime-tech-briefing.service.ts` 或单一 collector 大文件
- 不要把排序策略、偏好打分、抓取逻辑重新回填到 `runtime-tech-briefing-localize.ts`；新增渲染规则优先落在 `summary / card / render-content / render-shared` 对应模块

依赖原则：

- 新代码默认直接注入最窄 provider，不要回退到 `RuntimeService`
- `chat/` 优先依赖 `RuntimeSessionService`
- `tasks/`、`approvals/`、learning job 入口优先依赖 `RuntimeTaskService`
- `memory/`、`rules/` 优先依赖 `RuntimeKnowledgeService`
- `skills/` 优先依赖 `RuntimeSkillCatalogService`
- 控制台/中心视图优先依赖 `RuntimeCentersService`

测试原则：

- provider 自身逻辑优先写到各自 `*.spec.ts`
- `RuntimeService` 的 spec 只保留兼容 facade 与聚合行为
- Nest 注入链回归放在 `runtime.module.spec.ts`
- `packages/runtime/test/approval-recovery.int-spec.ts` 当前作为 runtime graph 侧的最小审批恢复 integration 样例
- `packages/runtime/test/session-inline-capability.int-spec.ts` 当前作为 runtime session/checkpoint 侧的最小闭环 integration 样例，已覆盖 inline capability 响应、recover-to-checkpoint 与 cancel fallback
