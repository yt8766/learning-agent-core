# Tech And AI Intelligence MiniMax CLI Design

状态：proposed  
文档类型：spec  
适用范围：`agents/intel-engine`、`apps/backend/agent-server`、`apps/frontend/agent-admin`、`packages/core`、`packages/knowledge`、Postgres/PostgREST 数据面  
最后核对：2026-05-10

## 背景

当前仓库已经有两条相关能力：

- `agents/intel-engine/src/runtime/briefing/*`：每日技术情报简报，已有 RSS/Atom、NVD/security page、MCP supplemental search、ranking、去重、Lark delivery、file repository。
- `config/intel/*.yaml` + `profile-storage/platform/intel/intel.db`：较早的 intel patrol/ingest/digest 链路，已有 SQLite `raw_events`、`signals`、`signal_sources`、`daily_digests`、`deliveries`。

用户希望把抓取方式收敛到本地已登录的 MiniMax CLI，并把抓取信息进入生产数据库。这里的生产数据库指 Postgres/PostgREST 背后的业务数据库，而不是只落本地 SQLite 或 file JSON。PostgREST 可作为查询网关，但业务写入和契约仍应经 backend repository / service 边界，不让 PostgREST response 结构穿透 intel 主链。

本设计把原“前端每日信息”升级为 **Tech & AI Intelligence**：前端仍是核心频道，同时补充 LLM 模型发布、Skills / Agent Tools、AI 安全与 AI 产品平台策略。明确不抓取 `AI Agent / RAG / Runtime 工程` 频道，避免把内部工程学习资料、RAG 架构文章和每日情报混在一起。

## 目标

1. 使用 MiniMax CLI 作为主要补充抓取方式，复用用户本地已登录状态或后续项目级 secret 配置。
2. 建立 Postgres-first 的 intel 持久化模型：抓取 run、query、raw event、signal、source、digest、knowledge candidate 与 ingestion receipt 都可审计。
3. 每日精选推送继续作为主消费体验；Postgres 保存全量事实，Knowledge 只保存精选后的长期价值内容。
4. 在 agent-admin 暴露运行状态、抓取方向、来源证据、入库/不入库原因、手动重跑和反馈调权。
5. 保持第三方能力边界：MiniMax CLI 原始输出只在 adapter/provider 层解析，业务层消费项目自定义 schema。

## 非目标

- 不纳入 `AI Agent / RAG / Runtime 工程` 抓取方向，例如 LangGraph、LangChain、LlamaIndex、Vercel AI SDK、RAG eval、observability、checkpoint、memory、tool calling 工程文章。
- 不自动安装 Skills、MCP server 或任何可执行能力。Skills / Agent Tools 只生成候选能力卡，必须进入 Admin 审批。
- 不把所有抓取结果写入 Knowledge。Knowledge 只保存精选事实卡片和 source refs。
- 不让前端或 intel 业务层直接调用 PostgREST raw API。
- 不恢复 backend 内的 briefing 主逻辑；新增采集、ranking、入库决策仍落在 `agents/intel-engine` 或 backend repository/facade 边界。

## 抓取频道

产品层保留 6 个频道。

| 频道                  | 范围                                                                                                   | 抓取频率  | 日报策略                                                  | Knowledge 策略                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------ | --------- | --------------------------------------------------------- | ----------------------------------------------------------------------- |
| Frontend Tech         | React、Next.js、Vue、Vite、TypeScript、Chrome/Web Platform、CSS                                        | 每天      | 展示重大 release、breaking change、稳定 Web API、迁移提醒 | 只入 major/minor release、breaking change、官方迁移指南、稳定兼容性资料 |
| Frontend Security     | npm/pnpm、axios、Vite plugin、source map、token leak、浏览器漏洞、供应链投毒                           | 每 4 小时 | 高风险即时告警，普通风险进日报                            | 官方 advisory、CVE、GHSA、可信修复方案优先入库                          |
| LLM Releases          | OpenAI、Anthropic、Gemini、DeepSeek、Qwen、Mistral、Meta、Moonshot、智谱、MiniMax                      | 每天      | 展示新模型、价格、上下文、工具调用、多模态、模型废弃      | 只入影响模型选型、成本、路由策略或迁移窗口的内容                        |
| Skills & Agent Tools  | Codex skills、Claude Code skills、MCP servers、agent templates、workflow recipes                       | 每天      | 展示可转化能力、适用场景、风险等级                        | 不直接入通用 Knowledge；生成候选能力卡和审批记录                        |
| AI Security           | Claude Code 源码泄露、MCP tool abuse、prompt injection、workspace trust、token/secret 泄露、模型供应链 | 每 4 小时 | 高风险即时告警，普通风险进日报                            | 官方事故、可信 PoC、缓解方案、修复状态可入库                            |
| AI Product & Platform | OpenAI / Anthropic / Gemini / MiniMax API 政策、限流、计费、企业能力、模型迁移窗口                     | 每天      | 展示会影响运营、成本或可用性的变化                        | 只入会影响系统配置、模型路由、成本或合规策略的内容                      |

社区高信号源只作为补充发现，不单独成频道，默认不入 Knowledge。

## MiniMax CLI Query 模板

每个频道至少包含三类 query：官方确认、趋势发现、安全专项。实现时应把 query 模板配置化，允许 Admin 后续调整。

### Frontend Tech

- `React Next.js Vue Vite TypeScript official release breaking changes latest`
- `Chrome Web Platform CSS baseline stable feature latest`
- `frontend framework migration guide compatibility latest`

### Frontend Security

- `npm pnpm package compromise frontend supply chain vulnerability latest`
- `axios Vite plugin source map token leak security advisory latest`
- `Chrome browser V8 WebAssembly frontend security vulnerability latest`

### LLM Releases

- `OpenAI Anthropic Google Gemini DeepSeek Qwen Mistral MiniMax new model release API latest`
- `LLM model pricing context window tool calling multimodal release latest`
- `GPT Claude Gemini Qwen DeepSeek model deprecation migration API changes`

### Skills & Agent Tools

- `Codex skills Claude Code skills MCP server agent workflow template latest`
- `best AI coding agent skills GitHub PR review browser automation documentation automation`
- `Model Context Protocol server release filesystem browser github slack notion`

### AI Security

- `Claude Code source code leak security incident latest`
- `MCP security prompt injection tool abuse workspace trust vulnerability`
- `AI coding agent credential leak source code leak supply chain vulnerability`

### AI Product & Platform

- `OpenAI Anthropic Gemini MiniMax API pricing rate limit enterprise update latest`
- `LLM API model retirement deprecation migration schedule latest`
- `AI platform policy data retention enterprise admin controls latest`

## 数据流

```text
Bree / manual force-run
  -> Intel scheduler
  -> MiniMaxCliSearchProvider
  -> normalize CLI stdout into IntelSearchResult
  -> write Postgres intel_search_runs / intel_search_queries
  -> write intel_raw_events
  -> dedupe into intel_signals
  -> attach intel_signal_sources
  -> rank and produce daily digest
  -> create knowledge candidates
  -> selected candidates enter Knowledge ingestion
  -> agent-admin reads Postgres projections
```

## Postgres 数据模型

新增或迁移到 Postgres 的 intel 表使用 `intel_` 前缀，避免和 Knowledge 业务表混淆。SQLite 只能作为本地 fallback 或迁移输入，不是目标生产存储。

### `intel_search_runs`

- `id text primary key`
- `workspace_id text not null`
- `run_kind text not null`：`scheduled`、`manual`、`forced`
- `status text not null`：`running`、`completed`、`failed`、`partial`
- `started_at timestamptz not null`
- `completed_at timestamptz`
- `triggered_by text`
- `summary jsonb not null default '{}'::jsonb`
- `error jsonb`

### `intel_search_queries`

- `id text primary key`
- `run_id text not null references intel_search_runs(id) on delete cascade`
- `channel text not null`
- `direction text not null`
- `query text not null`
- `provider text not null default 'minimax-cli'`
- `status text not null`：`completed`、`failed`、`parse_failed`、`skipped`
- `started_at timestamptz not null`
- `completed_at timestamptz`
- `result_count integer not null default 0`
- `error jsonb`

### `intel_raw_events`

- `id text primary key`
- `query_id text not null references intel_search_queries(id) on delete cascade`
- `content_hash text not null`
- `title text not null`
- `url text not null`
- `snippet text not null`
- `published_at timestamptz`
- `fetched_at timestamptz not null`
- `source_name text not null`
- `source_url text`
- `source_group text not null`：`official`、`authority`、`community`、`unknown`
- `raw_payload jsonb not null default '{}'::jsonb`
- unique `(query_id, content_hash)`

### `intel_signals`

- `id text primary key`
- `workspace_id text not null`
- `stable_topic_key text not null`
- `channel text not null`
- `title text not null`
- `summary text not null`
- `priority text not null`：`P0`、`P1`、`P2`
- `confidence text not null`：`low`、`medium`、`high`
- `status text not null`：`pending`、`confirmed`、`closed`
- `first_seen_at timestamptz not null`
- `last_seen_at timestamptz not null`
- `metadata jsonb not null default '{}'::jsonb`
- unique `(workspace_id, stable_topic_key)`

### `intel_signal_sources`

- `id text primary key`
- `signal_id text not null references intel_signals(id) on delete cascade`
- `raw_event_id text references intel_raw_events(id) on delete set null`
- `source_name text not null`
- `source_url text`
- `url text not null`
- `source_group text not null`
- `snippet text not null`
- `published_at timestamptz`
- `captured_at timestamptz not null`
- `metadata jsonb not null default '{}'::jsonb`

### `intel_daily_digests`

- `id text primary key`
- `workspace_id text not null`
- `digest_date date not null`
- `channel text not null`
- `title text not null`
- `summary text not null`
- `content_markdown text not null`
- `signal_count integer not null default 0`
- `highlight_count integer not null default 0`
- `created_at timestamptz not null`
- `metadata jsonb not null default '{}'::jsonb`

### `intel_knowledge_candidates`

- `id text primary key`
- `signal_id text not null references intel_signals(id) on delete cascade`
- `candidate_type text not null`：`knowledge`、`skill_card`、`evidence_only`
- `decision text not null`：`candidate`、`rejected`、`needs_review`
- `decision_reason text not null`
- `ttl_days integer`
- `created_at timestamptz not null`
- `review_status text not null default 'pending'`
- `metadata jsonb not null default '{}'::jsonb`

### `intel_knowledge_ingestions`

- `id text primary key`
- `candidate_id text not null references intel_knowledge_candidates(id) on delete cascade`
- `status text not null`：`queued`、`succeeded`、`failed`、`skipped`
- `knowledge_base_id text`
- `document_id text`
- `chunk_ids jsonb not null default '[]'::jsonb`
- `attempted_at timestamptz not null`
- `error jsonb`

## Knowledge 入库策略

Postgres intel 表保存全量抓取事实；Knowledge 只保存精选事实卡片。入库内容必须是归一化摘要，不保存 MiniMax CLI raw payload。

允许入 Knowledge：

- 官方重大版本、breaking change、迁移指南。
- 官方安全 advisory、CVE、GHSA、可信 PoC 与修复方案。
- LLM 新旗舰模型、价格/上下文/工具调用变化、模型废弃迁移。
- AI 产品平台的计费、限流、数据保留、企业权限或合规策略变化。
- 经过用户反馈提升为高价值的能力信息。

默认不入 Knowledge：

- 社区单源观点。
- 周刊合集。
- 普通 patch release。
- 搜索摘要本身。
- 标题党或二次传播。
- 没有稳定 URL 或发布时间的结果。
- `AI Agent / RAG / Runtime 工程` 内容。

Skills & Agent Tools 的特殊规则：

- 不写入通用 Knowledge 文档库。
- 生成 `candidate_type=skill_card` 的候选能力卡。
- Admin 展示用途、来源、风险、所需权限、可替代方案和审批状态。
- 只有人工审批后，才允许进入后续 skill install / skill authoring 流程。

## Backend 边界

- `agents/intel-engine` 负责抓取方向、query 模板、CLI 输出归一化、信号去重、ranking、candidate 决策。
- `apps/backend/agent-server` 负责 Postgres repository、schema bootstrap、HTTP/Admin projection、manual force-run、权限审计和错误映射。
- `packages/core` 如需跨端暴露 admin DTO，必须 schema-first 定义稳定 projection。
- `packages/knowledge` 继续负责 Knowledge ingestion 和 retrieval contract，不直接知道 MiniMax CLI。
- PostgREST 只作为数据库 HTTP 访问面或外部管理面；主业务写入默认走 backend repository，避免绕开审计、权限和 schema 校验。

## Admin 展示

agent-admin 应新增或扩展 Intelligence / Briefing 治理视图：

- 抓取频道状态：最近 run、query 数、成功率、parse failure、平均候选数。
- 每条 signal 的来源证据、source group、confidence、priority、入库决策。
- Knowledge candidate 队列：候选、拒绝、待审、已入库、入库失败。
- Skills 候选卡：能力名称、来源、用途、风险等级、建议动作、审批入口。
- 手动 force-run：按频道触发，记录 triggeredBy。
- 反馈调权：helpful / notHelpful / too-noisy / irrelevant / useful-actionable。

## 错误与兼容

- MiniMax CLI 不可用：query 写 `skipped` 或 run 写 `failed`，Admin 显示安装/登录指引。
- CLI 非 JSON 输出：query 写 `parse_failed`，raw stdout/stderr 只保存裁剪摘要，不进入 raw event。
- Postgres 不可用：生产直接 fail fast；本地可配置 memory/SQLite fallback，但必须在 Admin 标记为 non-production persistence。
- Knowledge ingestion 失败：不影响 daily digest；写 `intel_knowledge_ingestions.status=failed` 和 error 摘要，允许重试。
- 重复抓取：`stable_topic_key` 和 source URL/content hash 去重，避免同一事件多次入库。

## 验证策略

最小实现计划应覆盖：

- MiniMax CLI adapter 单测：成功 JSON、非 JSON、非零退出码、超时、缺失 CLI。
- Query 模板与频道 schema 测试：确保没有 `AI Agent / RAG / Runtime 工程` 频道。
- Postgres repository mapper 测试：run/query/raw/signal/source/candidate/ingestion 写入与查询。
- Knowledge candidate 决策测试：官方 release、安全 advisory、社区线索、skill card、普通 patch release。
- Backend controller/projection 测试：Admin 查询和 force-run 不泄漏 raw provider object。
- 文档检查：`pnpm check:docs`。

如果触达代码、schema 或 package exports，还需按 [验证体系规范](/docs/packages/evals/verification-system-guidelines.md) 追加受影响 Type、Spec、Unit、Demo 或 Integration 检查。

## 成功标准

1. MiniMax CLI 可以按频道抓取前端、LLM、Skills/Agent Tools、AI 安全和 AI 平台策略信息。
2. 全量抓取事实进入 Postgres `intel_*` 表，可按 run/query/signal/source 追溯。
3. 每日简报可读且噪音受控。
4. Knowledge 只保存精选事实卡片，不被社区线索和普通新闻污染。
5. Skills 候选必须走 Admin 审批，不自动安装。
6. Admin 能解释每条信息为什么展示、为什么入库或为什么拒绝入库。
7. 设计明确排除 `AI Agent / RAG / Runtime 工程` 频道。
