# Runtime Module Notes

状态：current
文档类型：reference
适用范围：`apps/backend/agent-server/src/runtime`
最后核对：2026-05-01

本主题主文档：

- backend runtime 边界仍以本文为主
- `platform console` 的性能基线与验收口径见 [platform-console-performance-baseline.md](/docs/apps/backend/agent-server/platform-console-performance-baseline.md)

本文只覆盖：

- `apps/backend/agent-server/src/runtime` 的 provider 拆分
- runtime facade 与各窄接口的依赖原则
- backend runtime 相关测试与模块内约束

总体服务职责仍以 [agent-server-overview.md](/docs/apps/backend/agent-server/agent-server-overview.md) 为准

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
  - `runtime.service.ts` 内部使用的 skill resolver wiring 已拆到 `runtime/domain/skills/runtime-skill-resolvers.ts`
  - `runtime.service.helpers.ts` 仅保留兼容 re-export 与真正的 runtime helper
  - 远程安装路径规则与 skill artifact staging/promote 能力已上提到 `@agent/skill`；backend 当前只保留薄 compat 入口，不再作为这两类长期规则的真实宿主
- `runtime/domain/connectors/*`
  - 当前承载 connector/governance 侧的 app-local 聚合 helper
  - `groupConnectorDiscoveryHistory`、`groupGovernanceAuditByTarget`、`defaultConnectorSessionState` 已从 `runtime-derived-records.ts` 拆出；其真实宿主现已迁到 `@agent/runtime` 的 `runtime/runtime-connector-governance-records.ts`，backend 当前只保留 compat re-export，避免继续把 connectors 治理语义混进通用 records helper
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
  - task diagnosis follow-up 的 recent trace 摘要格式化真实宿主现已迁到 `@agent/runtime` 的 `runtime/runtime-task-trace-summary.ts`；backend 的 `runtime/domain/tasks/runtime-task-service-helpers.ts` 仅保留 `NotFoundException` 风格的 task action 空结果断言与 compat re-export。`RuntimeTaskService` 应更多保留 orchestrator facade、NotFound guard 与 audit/diagnosis 调用顺序，而不是继续内联这类 service-local 规则
- `runtime/core/runtime.host.ts`
  - 当前已经作为 backend 默认官方组合根宿主
  - 除 `runtime / orchestrator / sessionCoordinator` 外，也开始承接 `listWorkflowPresets()`、`listSubgraphDescriptors()`、`listWorkflowVersions()` 这类 metadata 读取，以及 chat 侧 data-report runtime facade 的本地接线入口
  - 当前还暴露 `knowledgeSearchService`，由 `runtime/core/runtime-knowledge-search-factory.ts` 装配 `@agent/knowledge` 的本地 artifact snapshot repositories；当 host options 提供 `keywordSearchService` / `knowledgeVectorSearchProvider`，或进程 env 配置了 `KNOWLEDGE_VECTOR_PROVIDER=chroma`、Chroma collection、embedding endpoint/model/secret 时，factory 可组装 explicit keyword-only 或 `HybridKnowledgeSearchService(keyword + vector)`，并通过 runtime bridge 进入 `AgentRuntime.knowledgeSearchService` 主链入口；bridge 会保留最近一次 query 的 `getLastDiagnostics()` 快照，未提供时保持 `DefaultKnowledgeSearchService` keyword-only 行为
  - `runtime/core/runtime-knowledge-provider-config.ts` 是 backend 读取生产配置/secret 并创建 adapter provider 的入口；当前只创建 `@agent/adapters` 的 Chroma vector provider，真实 SDK 仍由 adapter 管理。Chroma env 缺失时保持 fake-safe：只把 vector configured 写入 factory config，不创建 provider，最终由 factory diagnostic 标记 missing client 并降级 keyword-only
  - `RuntimeHost.getKnowledgeSearchStatus()` 的 vector health 由 `runtime/core/runtime-knowledge-provider-health.ts` 包裹短 TTL cache、超时和连续失败计数；默认 TTL 5s、超时 2s，可由 `KNOWLEDGE_PROVIDER_HEALTH_TTL_MS` / `KNOWLEDGE_PROVIDER_HEALTH_TIMEOUT_MS` 覆盖；`KNOWLEDGE_PROVIDER_HEALTH_DEGRADED_AFTER_FAILURES` 可控制连续失败达到多少次后才标记 degraded
  - runtime knowledge bridge 当前通过 `@agent/knowledge` 的 `runKnowledgeRetrieval({ includeDiagnostics: true })` 执行搜索，以便 Runtime Center 的 last diagnostics 能拿到 `diagnostics.postRetrieval.filtering / ranking / diversification`；bridge 会把底层 diagnostics 裁剪成项目自有字段：hybrid 摘要、可选 nested `hybrid`、schema-compatible `postRetrieval`，避免 provider error、SDK response 或 vendor-specific 对象穿透到 Runtime / Evidence Center
  - `runtime-knowledge-search-factory.ts` 只负责读取配置、注入 provider 与组合 facade；不要在 backend service/controller 内联 RRF、metadata filter、vector provider 调用细节或真实外部连接凭据
  - backend controller / service 如果只是需要官方默认装配信息，应优先经由 `RuntimeHost` 读取，而不是继续直接 import `@agent/platform-runtime`
  - 当前 package boundary 也已补红线：backend app 源码里允许直连 `@agent/platform-runtime` 的位置只保留 `runtime/core/*` 下明确白名单的 composition facade；普通业务 service/controller/query 默认应通过这些入口或更窄 backend facade 取用官方组合能力
- `runtime/core/runtime-company-live-facade.ts`
  - 当前是临时 backend composition facade，只负责统一 `company-live` 独立 API 与 `workflow-runs` 的 company-live graph 调用点
  - 该 facade 可以直连 `@agent/agents-company-live`，但不得继续新增其他 workflow executor，也不得承载 company-live 业务规则、prompt、schema 或 node 编排
  - workspace smoke 会在干净 CI 环境中直接加载 backend `AppModule`；所有 `tsconfig.json` 中声明的 `@agent/agents-*` 源码入口都必须同步出现在根 `vitest.config.js` alias 中，不能依赖本地残留的 `agents/*/build` 产物解析。
  - `test/smoke/backend/backend-http-app.smoke.ts` 是真实 Nest `AppModule` 冷启动 smoke。GitHub runner 上首次 import、provider 初始化与 health request 可能超过 Vitest 默认 `10s` hook timeout，因此该 smoke 必须保留显式 `BACKEND_HTTP_APP_HOOK_TIMEOUT_MS`，不要退回默认 hook 预算。
  - workspace smoke 默认运行在 `NODE_ENV=test`，此时 `AppModule` 会通过 `createPersistenceImports()` 跳过 workflow-run 的 Postgres 持久化装配，避免干净 CI runner 因没有本地 `localhost:5432` 服务而让健康检查失败；需要在测试环境覆盖真实数据库链路时，必须显式设置 `AGENT_SERVER_ENABLE_DATABASE_IN_TEST=true` 并提供对应 `DB_*` 环境变量。
  - 退出条件是后续由更正式的官方 workflow 装配层承接 company-live executor 注册；迁移完成后 backend 应只保留 HTTP/BFF、trace/SSE adapter 与错误映射
- `runtime/core/runtime-workflow-execution-facade.ts`
  - 当前是 backend workflow composition facade，基于 `@agent/platform-runtime` 的可注入 workflow registry contract 注册 `company-live` 与 `data-report-json`
  - `packages/platform-runtime` 只提供 registry / execution contract，不直接依赖 `@agent/agents-*`；官方 executor 仍由 backend core 注入，避免 platform-runtime 重新变成 official agent 宿主
  - 不要在 `WorkflowDispatcher` 或普通 backend service 里新增 `workflowId -> executor` 分支；新增 workflow 应先进入对应 `agents/*` 宿主，再通过 runtime/core workflow facade 注册
- `RuntimeSessionService`
  - chat session、message、event、checkpoint、recover、subscribe
  - session message 的流式 assistant / 最终 assistant 去重规则现在已下沉到 `runtime/domain/session/runtime-session-message-dedupe.ts`；`RuntimeSessionService` 应更多保留 session existence guard、NotFound 映射与 coordinator facade，不再把消息去重细节继续内联在 service 文件底部
  - checkpoint ref 投影 helper 的真实宿主现已迁到 `@agent/runtime` 的 `runtime/runtime-checkpoint-ref.ts`；backend 的 `runtime/domain/session/runtime-checkpoint-ref.ts` 当前只保留 compat re-export，session/evidence center 不应再在 app 层重写这类纯 checkpoint 归一化逻辑
- `RuntimeKnowledgeService`
  - memory / rule 查询与治理
  - `runtime-knowledge.service.ts` 当前应直接依赖 `RuntimeWenyuanFacade + RuleRepository + RuntimeStateSnapshot + MemoryRepository` 这组真实 contract；像 compare snapshot、scrubber、cross-check evidence 这类路径不要再回退到 `ruleRepository/orchestrator/runtimeStateRepository: any`
  - memory usage 聚合、memory version compare、cross-check evidence merge 现已下沉到：
    - `@agent/memory` 的 `governance/memory-usage-insights.ts`
    - `@agent/memory` 的 `governance/memory-version-compare.ts`
    - `@agent/memory` 的 `governance/cross-check-evidence.ts`
  - backend 的：
    - `runtime/domain/knowledge/runtime-memory-usage-insights.ts`
    - `runtime/domain/knowledge/runtime-memory-version-compare.ts`
    - `runtime/domain/knowledge/runtime-cross-check-evidence.ts`
      当前只保留 compat re-export，不再作为这三类纯记忆治理规则的真实宿主
  - 本地知识 ingestion / overview / artifact snapshot facade 现已迁到 `@agent/knowledge` 的 `runtime/local-knowledge-store.ts`；backend 的 `runtime/knowledge/runtime-knowledge-store.ts` 当前只保留 compat re-export，不再作为本地知识落盘规则的真实宿主
  - 生产来源 payload 的本地 runtime store 写入入口是 `@agent/knowledge` 的 `ingestKnowledgeSourcePayloads()`；`RuntimeKnowledgeService.ingestKnowledgeSources()` 只负责从 `RuntimeHost` context 取 `settings` 与 `vectorIndexRepository` 后委托 package facade。controller、web curated job 不应绕过该 facade 自行写 source/chunk/receipt snapshot
  - `RuntimeKnowledgeService.ingestUserUploadSource()` 是当前 user upload 的最小 backend adapter：它只读取已落在 `settings.workspaceRoot` 内的文件，提取 filename / version / uploadedBy / allowedRoles / mimeType metadata，调用 `buildUserUploadKnowledgePayload()` 后再进入同一 ingestion facade；multipart 上传、对象存储下载、病毒扫描和租户鉴权仍属于上游 upload job，不在该 adapter 内实现
  - `RuntimeKnowledgeService.ingestCatalogSyncSources()` 是当前 catalog sync 的最小 backend adapter：它接受上游已同步、已清洗的 catalog entries，调用 `buildCatalogSyncKnowledgePayload()` 后进入同一 ingestion facade；外部 catalog 拉取、租户鉴权和 vendor raw response 清洗仍属于上游 catalog job
  - `RuntimeKnowledgeService.ingestWebCuratedSources()` 是当前 web curated 的最小 backend adapter：它接受人工策展或外部系统已整理、已清洗并完成 trustClass 策略判定的 URL entries，调用 `buildWebCuratedKnowledgePayload()` 后进入同一 ingestion facade；当前知识库不建设真实网页抓取、robots / 版权策略、cookie 会话或正文清洗链路
  - `runtime/domain/knowledge/runtime-web-curated-ingestion-job.ts` 已删除；当前产品决策是不接真实 HTTP/MCP 抓取器、robots / 版权策略、cookie 会话或抓取调度，web curated 只接收已整理 entries，不得把 vendor raw response 或凭据穿透到 ingestion payload
  - `RuntimeKnowledgeService.ingestConnectorSyncSources()` 是当前 connector sync 的最小 backend adapter：它接受上游 connector 同步产物，调用 `buildConnectorSyncKnowledgePayload()` 后以 `sourceType=connector-manifest`、`metadata.docType=connector-sync` 进入同一 ingestion facade；connector API 调用、凭据使用、分页同步和 vendor raw response 清洗仍属于上游 connector job
  - `platform/knowledge-ingestion.controller.ts` 暴露 `POST /api/platform/knowledge/sources/ingest`、`POST /api/platform/knowledge/sources/user-upload/ingest`、`POST /api/platform/knowledge/sources/catalog-sync/ingest`、`POST /api/platform/knowledge/sources/web-curated/ingest` 与 `POST /api/platform/knowledge/sources/connector-sync/ingest`；controller 只做 schema parse 与 service delegation，具体来源采集仍应落在各自 job / adapter
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
  - workspace draft install lifecycle 的 receipt 关联、install status / phase normalization 与 `nextAction` 推导已从 `RuntimeCentersQueryService` 拆到 `runtime/centers/runtime-centers-workspace-lifecycle.ts`；这是 backend-local BFF projection helper，不是 `packages/runtime` 稳定 contract，也不是 `packages/skill` install lifecycle 主实现
  - workspace reuse record 读取、按 workspace 过滤排序、`sessionId -> sourceTaskId` 查询辅助、workspace center status normalization，以及 workspace skill draft projection 的 source/status/sourceTask/sessionTask 过滤已从 `RuntimeCentersQueryService` 拆到 `runtime/centers/runtime-centers-workspace-query.ts`；这是 backend-local BFF/query projection helper，不是 `packages/runtime` 稳定 contract
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
  - `runtime-learning-evidence-center.learning-helpers.ts` 已删除；原重复的 queue priority、counselor experiment 与 capability trust profile 纯 helper 现在只保留在 `packages/platform-runtime/src/centers/runtime-learning-center.helpers.ts`，由 package-local 测试覆盖
  - backend 当前只负责注入 `buildRuleCandidates` 等 app-local 派生依赖；`runtime-learning-evidence-center.evidence.ts` 已明确收敛为永久 backend-only BFF adapter，专门承载 checkpoint ref / replay / recoverable 聚合
  - 这层 backend-only adapter 的具体 helper 当前下沉到 `runtime-learning-evidence-center.evidence-adapter.ts`；后续如果继续演进，应保持“session checkpoint binding + replay extraction” 只在这一层聚合，不要再把它误判为待迁出的过渡逻辑
  - Evidence Center 的 `cangjing:overview.detail.knowledgeRetrievalDiagnostics` 当前只承载最近一次 runtime knowledge query 的裁剪快照：`query / limit / hitCount / total / searchedAt / postRetrieval`。它复用 `RuntimeHost.runtime.knowledgeSearchService.getLastDiagnostics()`，但只透出 `diagnostics.postRetrieval`，不得把命中正文、被 drop/mask 的原文、provider error 或 vendor-specific response 写入 evidence detail
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
- `RuntimeCentersContext` 现在还显式带上 `runtimeHost`，用于 runtime center / architecture 侧读取 workflow/subgraph/version metadata；这些 metadata 也已经继续收口到 `PlatformRuntimeFacade.metadata`，避免 backend 宿主再一半走 facade、一半直接依赖 `@agent/platform-runtime`
- `runtime/domain/governance/` 现在开始承接可复用的治理状态动作；例如 `syncSkillSource`、skill source / company worker 的 enable/disable 状态切换已经先从 `RuntimeCentersGovernanceService` 下沉到 `runtime-governance-actions.ts`，service 只负责组合 context 与返回 admin 视图，后续 connector / skill governance 的更多通用状态变更也应优先沿这条边界继续收敛
- `runtime/domain/governance/` 当前也开始承接 company agents center 的共享 view loader；`runtime-company-agents-view.ts` 已统一收走 company agents center 构造与单 worker view 查找，`RuntimeCentersCatalogQueryService` 与 `RuntimeCentersGovernanceService` 不应再各自手写 `buildCompanyAgentsCenter(...) + find(...)` 组合
- `runtime/domain/skills/` 的 skill search 纯领域决策也已退化为 compat re-export；真实宿主现已迁到 `@agent/skill` 的 `sources/skill-search-resolution.ts`。`runtime-skill-sources.service.ts` 应继续往“装配 sources/manifests/search result，再委托 domain helper 判定”收敛，而不是把 capability gap 对应的 status、safety note 与 MCP recommendation 规则继续堆回 service
- `runtime/domain/skills/` 现在还开始承接 auto-install eligibility 规则；`runtime-skill-auto-install.ts` 已收走“哪些 suggestion 才算可安装 manifest”以及“什么 safety/trust 条件下允许 low-risk auto install”的纯判断，`runtime-skill-safety.ts` 保留 manifest safety 评估与兼容出口，不要再把这类 eligibility 分支继续塞回 safety/service 文件
- `runtime/domain/skills/` 也应继续承接 skill install 的纯路径/命名规则；`runtime-skill-install-paths.ts` 已收走 remote skill display name、optional skill name normalize、install path sanitize/build 等纯 helper，`runtime-skill-install.service.ts` 应更多保留 receipt 持久化、artifact promote、CLI 调用和失败回写，不要再把这类 deterministic helper 长期堆在 service 文件底部
- `runtime/domain/skills/` 现在还开始承接 skill card 列表清洗规则；`runtime-skill-card-listing.ts` 已收走 accidental prompt-like card 过滤、重复 skill 去重与 stable/lab 优先级排序，`RuntimeSkillCatalogService` 应更多保留 catalog facade、NotFound 映射与 draft 发布入口，而不是继续在 service 文件底部堆这类 listing 规则
- `runtime/domain/skills/` 当前也开始承接 skill install governance 的 app-local wiring；`runtime-skill-governance-context.ts` 已统一收走 `installSkill/installRemoteSkill/approveSkillInstall/rejectSkillInstall` 共用的 receipt 持久化、manifest/source 列举、finalize closure 与 install receipt 读取装配。`RuntimeCentersGovernanceService` 应更多保留治理入口分发，而不是继续手写这组 closure 链
- `runtime/domain/skills/` 现在还开始承接 skill sources center 的 catalog wiring；`runtime-skill-sources-center-loader.ts` 已统一收走 source/manifest/install receipt/skill card/tasks 的读取拼装，`RuntimeCentersCatalogQueryService` 应更多保留 center 入口与 evals/query 组合，而不是继续堆这类多源读取逻辑
- `runtime.service.helpers.ts` 里的 skill install/source helper 当前也应直接复用 `RuntimeHost`、`RuntimeCentersService`、`SkillInstallReceipt`、`SkillSourceRecord` 等真实宿主 contract；不要再把这些 helper 维持成 `settings/centersService/receipt: any` 的弱类型中转层
- `RuntimeToolsService`
  - connector 草稿、启停、配置、tools center 读取当前应直接对齐 `RuntimeHost`、`ConfiguredConnectorRecord`、`TaskRecord` 与 connectors center 返回类型
  - `buildToolsCenter(...)` 的纯投影逻辑已迁到 `@agent/tools`；backend 的 `runtime-tools-center.ts` 现在只保留 compat re-export，不再作为 tools center 聚合规则的真实宿主
  - connector draft 默认模板映射、已配置 connector 的 secret update payload 组装与 configured connector 查找，现已下沉到 `@agent/tools` 的 `connectors/connector-draft-config.ts`
  - backend 的 `runtime/domain/tools/runtime-connector-drafts.ts` 当前只保留 compat re-export，不再作为这组 connector draft helper 的真实宿主
  - `RuntimeToolsService` 只保留 facade 调用、connector 缺失时的 `NotFoundException` 语义，以及治理 action 转发
- connector governance actions
  - `runtime-connector-governance-actions.ts` 当前默认以 `RuntimeStateSnapshot`、`ConfiguredConnectorRecord`、`McpClientManager` 和显式 connector/capability override 结构作为输入边界；治理 action 的 `load/save/get/set/refresh` 参数不要继续声明成裸 `any`
- connector registry
  - `runtime-connector-registry.ts` 当前默认对齐 `McpServerDefinition`、显式 capability record、`WorkerDefinition` 与 installed-skill model 配置；connector 注册、发现能力补录、installed skill worker 注册这几条路径不要再回退成 `register(server|capability|worker: any)`
- `runtime/domain/connectors/` 现在也开始承接 connector projection 读取；`runtime-connector-view-reader.ts` 已统一收口 query/tools/governance 三条链共用的 connector center/view 准备步骤（idle session sweep、按需 discovery refresh、snapshot/tasks/connectors 装配），避免 `runtime-centers-query-connectors.ts`、`runtime-centers-governance-connectors.ts`、`runtime/domain/tools/runtime-connectors-reader.ts` 各自复制准备逻辑
- `runtime/domain/connectors/runtime-connector-view-reader.ts` 当前也已退化为 compat re-export；真实宿主现已迁到 `@agent/runtime` 的 `runtime-connectors-center-loader.ts`，backend 不应再把 connectors center loader 规则重新长回 app 层
- `runtime/domain/connectors/` 现在还开始承接 connector governance 的 snapshot mutation 规则；`runtime-connector-governance-state.ts` 已收走 disabled connector、connector/capability override、configured connector upsert 这些纯状态变更，`runtime-connector-governance-actions.ts` 应继续聚焦在存在性校验、registry/client 调用、snapshot 持久化与 audit，而不是自己再内联拼 governance record
- `runtime/domain/connectors/runtime-connector-governance-state.ts` 当前也已退化为 compat re-export；真实宿主已迁到 `@agent/tools`，backend 不应再把这类 snapshot mutation 规则重新长回 app 层
- `runtime/domain/metrics/` 现在也开始承接 persisted snapshot preference 这类纯读取规则；`runtime-metrics-snapshot-preference.ts` 已收走 usage/eval 在 `snapshot-preferred` 模式下何时直接复用持久化结果的判断，`runtime-centers-query-metrics.ts` 应更多保留 read vs summarize 的编排，而不是继续把这类规则内联在 query 文件底部
- `runtime/domain/metrics/` 还应继续承接 runtime center 的 recent-runs 投影规则；`runtime-recent-runs.ts` 已收走按 status/executionMode/interactionKind 过滤并按 `updatedAt` 排序截断 recent runs 的纯逻辑，`runtime-centers-runtime.query-service.ts` 应更多聚焦在 runtime center 数据拼装，而不是继续内联 task filter/sort 细节
- `runtime/domain/metrics/` 当前这两类纯规则也已退化为 compat re-export；真实宿主现已迁到 `@agent/runtime` 的：
  - `runtime/runtime-metrics-snapshot-preference.ts`
  - `runtime/runtime-recent-runs.ts`
    backend 不应再把 persisted snapshot preference 或 recent-runs filter/sort 规则重新长回 app 层
- `runtime/domain/observability/` 当前大部分纯投影/过滤 helper 已退化为 compat re-export；真实宿主已迁到 `@agent/runtime` 的：
  - `runtime-observability/runtime-approvals-center.ts`
  - `runtime-observability/runtime-run-observatory.ts`
  - `runtime-observability/runtime-briefing-runs.ts`
  - `runtime-observability/runtime-observability-filters.ts`
  - `runtime-observability/runtime-observability-task-filters.ts`
    backend 的同名文件不应再承接长期主逻辑
- `runtime/domain/observability/` 的 approvals center 规则已迁到 `@agent/runtime`；`runtime-approvals-center.ts` 当前只保留 compat re-export。`runtime-centers-observability.query-service.ts` 应更多保留 observability 入口编排，而不是继续内联 pending approvals 的 filter、字段映射、planDraft/interrupt payload 归一化与 policyMatch 补全
- `runtime/domain/observability/` 的 run observatory 规则已迁到 `@agent/runtime`；`runtime-run-observatory.ts` 当前只保留 compat re-export。`runtime-centers-observability.query-service.ts` 现在应更多聚焦在 `buildRunBundle(...)` 结果过滤、detail not-found 与 platform console / briefing 入口，而不是继续内联 status/model/pricing/executionMode/interactionKind/q 过滤与 limit 解析
- `runtime/domain/observability/` 的 briefing run lookback/category projection 已迁到 `@agent/runtime`；`runtime-briefing-runs.ts` 当前只保留 compat re-export。`runtime-centers-observability.query-service.ts` 应继续保留入口编排而不是回填这类 map/filter 逻辑
- `runtime/domain/observability/` 的共享 observability/filter helper 已迁到 `@agent/runtime`；`runtime-observability-filters.ts` 当前只保留 compat re-export。`approvals center`、`run observatory`、`recent runs`、`learning query` 与 `platform console export` 应优先复用这套 helper，而不是继续在 `centers/*` 或 export helper 里各写一份兼容分支
- `runtime/domain/observability/` 的 task-level observability filter 已迁到 `@agent/runtime`；`runtime-observability-task-filters.ts` 当前只保留 compat re-export。`runtime-platform-console-log-analysis.ts` 仍保留 backend 宿主，因为它承载平台日志路径/窗口参数装配这类 app-local diagnostics 语义
- 当前 backend runtime 的 `runtime/domain/*` 已形成第一批稳定落点：
  - `domain/skills/*`
  - `domain/connectors/*`
  - `domain/metrics/*`
  - `domain/observability/*`
  - `domain/learning/*`
  - `domain/session/*`
  - 后续如果新增逻辑主要表现为“读取 context/task/snapshot -> 返回派生结果、过滤结果、normalized view 或新 snapshot”，默认先评估是否直接进入这些 domain 子域，而不是继续堆到 `RuntimeCenters*QueryService` / `RuntimeCenters*Service`
- 本轮清理后，以下文件当前应明确保留在 backend 宿主，不建议为了“包化”而继续硬迁：
  - `runtime/domain/tasks/runtime-task-context.ts`
  - `runtime/domain/metrics/runtime-provider-audit-context.ts`
  - `runtime/domain/governance/runtime-company-agents-view.ts`
  - `runtime/domain/skills/runtime-skill-contexts.ts`
  - `runtime/domain/skills/runtime-skill-catalog-context.ts`
  - `runtime/domain/skills/runtime-skill-sources-center-loader.ts`
    这些文件的主要职责是 `RuntimeHost` / Nest / app-local service/context 装配，不属于稳定共享 contract 或纯投影 helper
- `runtime/domain/learning/` 当前也开始承接 learning center 的输入归一化；`runtime-learning-center-normalization.ts` 的真实宿主现已迁到 `@agent/runtime`，backend 当前只保留 compat re-export。`runtime-centers-learning.query-service.ts` 应更多保留 orchestrator/wenyuan/state 的调用编排而不是继续内联 normalize helper
- `runtime/domain/learning/` 现在还开始承接 memory governance 的纯投影规则；`runtime-learning-memory-stats.ts` 的真实宿主现已迁到 `@agent/runtime`，backend 当前只保留 compat re-export。`runtime-centers-learning.query-service.ts` 应继续保留 promise 组合与 full/summary 分支编排，而不是继续回填这类 memory stats 派生逻辑
- `runtime/domain/learning/` 的 invalidated rule 计数规则也已迁到 `@agent/runtime`；`runtime-learning-rule-stats.ts` 当前只保留 compat re-export。`runtime-centers-learning.query-service.ts` 应继续保留 query orchestration，而不是继续在 backend domain 持有这类纯统计 helper
- `chat/*`
  - chat 侧 data-report 相关执行 helper 现在优先通过 `runtime/core/runtime-data-report-facade.ts` 收口，而不是在聊天模块里直接从 `@agent/platform-runtime` import sandpack / report-schema 执行能力
  - `chat.service.ts` 现在也不再直接从 `@agent/platform-runtime` 读取 data-report 类型；backend app 层应优先经由 `RuntimeHost` 或 backend 本地 facade 触达 platform runtime，避免业务 service 继续形成对官方组合层的零散直连
- `runtime-derived-records.ts`
  - 当前已退化为 compat re-export 层
  - learning candidate / installed skill tag 已拆到 `runtime/domain/learning/runtime-learning-derived-records.ts`
  - checkpoint ref 已拆到 `runtime/domain/session/runtime-checkpoint-ref.ts`
  - connector discovery / governance audit grouping 已拆到 `runtime/domain/connectors/runtime-connector-governance-records.ts`

Daily Tech Briefing 边界：

- Daily Tech Intelligence Briefing 当前真实宿主是 `agents/intel-engine/src/runtime/briefing`。
- `apps/backend/agent-server/src/runtime/briefings` 已删除，不再保留 backend compat re-export 双轨。
- backend 只允许保留调用 `@agent/agents-intel-engine` 的 `RuntimeIntelBriefingFacade`、schedule trigger、controller delegation、error mapping 和 API smoke。
- 不要在 backend 新增 briefing 采集、去重、排序、本地化、投递、存储或反馈应用主逻辑；新增 briefing 领域能力应落在 `agents/intel-engine`。

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
