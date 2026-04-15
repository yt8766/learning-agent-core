# Runtime Module Notes

状态：current
适用范围：`apps/backend/agent-server/src/runtime`
最后核对：2026-04-14

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
- `RuntimeService`
  - 兼容 facade
  - 仅用于需要聚合多个 runtime provider 的场景

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
