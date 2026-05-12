# Tech & AI Intelligence Integration

状态：current  
文档类型：integration  
适用范围：Tech & AI Intelligence 前后端与运行时链路  
最后核对：2026-05-11

本链路已替代旧 Daily Tech Briefing。正确入口是
[Tech & AI Intelligence](/docs/agents/intel-engine/tech-ai-intelligence.md) 与
[Agent Admin API](/docs/contracts/api/agent-admin.md) 中的 `/api/platform/intelligence/*` 契约。

本主题主文档：

- 本文是 Tech & AI Intelligence 的跨模块集成入口。

本文只覆盖：

- intelligence contract、intel-engine、backend runner、Admin BFF 和前端 API 的当前分工。
- 旧 Daily Tech Briefing 下线后的禁止恢复边界。

本文不覆盖：

- 旧 briefing 分类、投递、feedback、run history 或文件存储方案。
- 具体数据库 migration；生产持久化以 `IntelligenceRepository` 与后续 Postgres adapter 为边界。

## 模块分工

- `packages/core`：定义 `IntelligenceChannelSchema`、`IntelligenceSignalSchema`、
  `IntelligenceKnowledgeCandidateSchema` 与 `IntelligenceOverviewProjectionSchema`。
- `agents/intel-engine`：维护频道、查询模板、搜索结果归一化和知识候选门控。
- `apps/backend/agent-server/src/runtime/intelligence`：装配 repository 与 force-run runner。
- `apps/backend/agent-server/src/platform/platform-intelligence.controller.ts`：暴露 Admin BFF API。
- `apps/frontend/agent-admin`：调用 `/platform/intelligence/overview` 与 `/platform/intelligence/:channel/force-run`。

## 不再保留的旧链路

- 不再有 `agents/intel-engine/src/runtime/briefing/*`。
- 不再有 backend `RuntimeIntelBriefingFacade`。
- 不再有 `/api/platform/briefings/*`。
- 不再有 `runtime-schedule-worker.mjs` 或 Daily Tech Briefing Bree worker。
- Runtime Center 不再投影 `dailyTechBriefing`。
- Admin 不再展示 Daily Tech Briefing audit card，也不再提交 briefing feedback。

后续新增抓取源、频道、知识候选策略或投递能力时，必须沿当前 intelligence contract / repository / runner
扩展，不允许恢复 briefing category、briefing storage 或 briefing feedback 双轨。
