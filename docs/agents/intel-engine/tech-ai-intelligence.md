# Tech & AI Intelligence

状态：current  
文档类型：reference  
适用范围：`agents/intel-engine`、`apps/backend/agent-server/src/runtime/intelligence`  
最后核对：2026-05-11

Tech & AI Intelligence 已替代旧 Daily Tech Briefing。旧 `agents/intel-engine/src/runtime/briefing/*`、
backend `RuntimeIntelBriefingFacade`、`/api/platform/briefings/*`、briefing feedback / run history / Bree worker
和 Runtime Center 的 `dailyTechBriefing` 投影均已下线；不要恢复旧 briefing service 或旧 API 双轨。

## 当前入口

- 稳定 contract：`packages/core/src/contracts/intelligence/*`
- 频道定义与搜索模板：`agents/intel-engine/src/runtime/intelligence/intelligence-channels.ts`
- 搜索结果归一化：`agents/intel-engine/src/runtime/intelligence/intelligence-search-normalizer.ts`
- 知识候选门控：`agents/intel-engine/src/runtime/intelligence/intelligence-knowledge-gate.ts`
- 后端 force-run runner：`apps/backend/agent-server/src/runtime/intelligence/intelligence-run.service.ts`
- 后端 repository contract：`apps/backend/agent-server/src/runtime/intelligence/intelligence.repository.ts`
- 后端 API controller：`apps/backend/agent-server/src/platform/platform-intelligence.controller.ts`

## 频道

当前 `IntelligenceChannel` 只包含：

- `frontend-tech`
- `frontend-security`
- `llm-releases`
- `skills-agent-tools`
- `ai-security`
- `ai-product-platform`

`AI Agent / RAG / Runtime 工程` 不作为抓取频道。相关工程资料应进入普通知识库、skill 或研发文档流程，不进入情报抓取队列。

## 运行链路

1. Admin 调用 `POST /api/platform/intelligence/:channel/force-run`。
2. `PlatformIntelligenceController` 用 `IntelligenceChannelSchema` 校验 path channel。
3. `RuntimeCentersService.forceIntelligenceRun()` 调用注入的 `RuntimeIntelligenceRunService`。
4. runner 按频道模板调用项目内稳定能力 `webSearchPrime`，不把 MiniMax 或其他 vendor 工具名扩散到业务层。
5. 搜索结果先归一化为 raw event，再写入 run / query / raw event / signal / source。
6. `decideIntelligenceKnowledgeCandidate()` 决定是否生成待审知识候选。
7. Admin 通过 `GET /api/platform/intelligence/overview` 查看最近 signal 与 pending candidate。

如果 `webSearchPrime` 不可用，force-run 会记录 skipped query 并返回 `status: "skipped"` 或 `partial`，不会回退到旧 briefing service。

## 存储边界

后端当前通过 `IntelligenceRepository` 写入情报运行数据。生产目标是 Postgres `intel_*` 表；本地或测试可以使用
`createIntelligenceMemoryRepository()`。新增持久化实现必须实现同一 repository contract，不允许让 controller、
Runtime Center 或前端直接耦合数据库表、vendor response 或旧 briefing 文件布局。

旧 `profile-storage/platform/intel-engine/briefing/*`、`data/runtime/briefings/*` 与
`data/runtime/schedules/*` 不再是生产写入目标。需要历史迁移时，应通过显式 migration/import 处理，不能在新 runner
里兼容读写旧文件。

## API

- `GET /api/platform/intelligence/overview`
  - 返回 `IntelligenceOverviewProjection`。
- `POST /api/platform/intelligence/:channel/force-run`
  - `channel` 必须符合 `IntelligenceChannelSchema`。
  - 返回 `{ ok, channel, status, acceptedAt, summary }`。
  - `summary` 包含 `queries`、`rawEvents`、`signals`、`candidates`、`failedQueries`、`skippedQueries`。

已删除接口：

- `GET /api/platform/briefings/runs`
- `POST /api/platform/briefings/:category/force-run`
- `POST /api/platform/briefings/feedback`

## 验证

修改本链路时优先覆盖：

- `apps/backend/agent-server/test/runtime/intelligence/intelligence-run.service.spec.ts`
- `apps/backend/agent-server/test/platform/intelligence.controller.spec.ts`
- `apps/frontend/agent-admin/test/api/admin-api-platform.test.ts`
- `packages/core` 中 intelligence schema/contract 相关测试

如果改动影响 Runtime Center 或 Admin 展示，还需要补对应 projection、component 和 API client 测试。
