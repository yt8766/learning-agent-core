# Runtime Module Notes

状态：current
文档类型：reference
适用范围：`apps/backend/agent-server/src/runtime`
最后核对：2026-04-16

本主题主文档：

- backend runtime 边界仍以本文为主

本文只覆盖：

- `apps/backend/agent-server/src/runtime` 的 provider 拆分
- runtime facade 与各窄接口的依赖原则
- backend runtime 相关测试与模块内约束

总体服务职责仍以 [agent-server-overview.md](/docs/backend/agent-server-overview.md) 为准

`runtime/` 现在不再承载单一“大而全” service，而是按长期稳定边界拆成多个 provider。

当前主边界：

- `RuntimeTaskService`
  - task 创建、诊断、审批、audit、learning job
- `RuntimeSessionService`
  - chat session、message、event、checkpoint、recover、subscribe
- `RuntimeKnowledgeService`
  - memory / rule 查询与治理
- `RuntimeSkillCatalogService`
  - skill 列表、提升、停用、恢复、退役
- `RuntimeCentersService`
  - Runtime / Evidence / Learning / Connectors / Skill Sources / Platform Console 这类中心视图
  - 当前内部继续拆成：
    - `RuntimeCentersQueryService`
    - `RuntimeCentersGovernanceService`
  - facade 只保留聚合与兼容出口
- `modules/runtime-metrics`
  - usage analytics、eval history、runtime metrics 持久化与聚合
  - `provider-audit` 相关 helper 当前通过 `src/modules/runtime-metrics/services/provider-audit.ts` 做模块内 re-export
  - `runtime-metrics` 内部依赖优先走这个局部入口，避免 helper 迁移后再次打断批量测试链
- `RuntimeService`
  - 兼容 facade
  - 仅用于需要聚合多个 runtime provider 的场景
  - `runtime.service.ts` 现在只保留 facade、resolver 注册与 provider 绑定
  - `runtime.service-contexts.ts` 承载 connector registry / skill source / centers / platform console / background runner 的 context 装配

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
