# Frontend And AI Intel System Design

状态：current
文档类型：reference
适用范围：`agents/intel-engine`、`apps/backend/agent-server`、`config/intel`、`profile-storage/platform/intel`
最后核对：2026-05-10

> 2026-05-10 更新：本文记录的是 2026-04 第一版 Frontend/AI Intel 本地巡检与 Lark 分发链路，
> 其中 SQLite / `profile-storage/platform/intel/intel.db` 说明只代表既有实现。新的 Tech & AI Intelligence
> MiniMax CLI 抓取与知识候选治理以
> [Tech And AI Intelligence MiniMax CLI Design](/docs/superpowers/specs/2026-05-10-tech-ai-intelligence-minimax-cli-design.md)
> 为准，生产持久化目标是 Postgres `intel_*` 表，并显式排除 `AI Agent / RAG / Runtime 工程` 频道。

## 1. 背景

当前仓库缺少一套可持续运行的技术情报链路，用于自动获取并治理以下信息：

- 前端技术动态
- 前端安全事件
- AI 模型与产品发布
- AI 安全事件
- 开发平台与基础设施风险
- 政策与外部高信号动态

目标不是做一个“搜到新闻就推送”的脚本，而是做一套本地可运行、可审计、可扩展的情报专项 Agent，先把采集、归一化、判定、路由和 Lark 多群分发跑通，后续再接入 `agent-admin` 的 Evidence、Learning、Connector & Policy 治理面。

## 2. 设计结论

第一版采用以下组合：

- 调度：`Bree`
- 采集：Minimax `web_search` MCP
- 存储：`SQLite`
- 配置：`YAML`
- 运行缓存：`JSON`
- 分发：`Lark webhook`

第一版采用“双轨型”运行模式：

- 高风险事件走 `30 分钟` 巡检，触发即时告警
- 普通动态进入当日池，在固定时间生成日报

专项宿主统一落在 `agents/intel-engine`，而不是新增通用 `packages/*` 业务包。Intel 领域 schema 与类型由 `agents/intel-engine/src/types/` 承接，并通过 `@agent/agents-intel-engine` 公开。

## 2.1 当前落地状态

截至 `2026-04-27`，第一版已经落地的能力：

- `agents/intel-engine` 已具备可编译的 graph 入口
- `config/intel/*.yaml` 已接入 Zod 校验加载
- `profile-storage/platform/intel/intel.db` 已由 SQLite repository 承载
- `intel-patrol` / `intel-ingest` 已可通过 MCP 搜索能力跑通原始入库、归一化、同批去重归并、打分、路由命中与 delivery 入队；运行时优先使用稳定 `webSearchPrime`，缺失时回退到 MiniMax Token Plan `minimax:web_search` capability，并以官方 `web_search` toolName 按 `{ query }` 调用。patrol 会把 raw search result 按最终 merged signal id 写入 `signal_sources`，并支持重复 patrol 复用既有 `dedupe_key`
- `intel-digest` 已可收集同日 signals、分组排序、渲染 markdown 日报、落 `daily_digests` / `daily_digest_signals`，并按 digest 路由创建 digest deliveries；当前 digest markdown 会附带 highlight 级 evidence summary 与 source refs，便于从 `signal_sources` 追溯到最终日报内容
- `intel-delivery-retry` 已可读取 pending/failed deliveries、通过 Lark webhook 实际发送，并稳定回写 `sent` / `failed` / `closed`
- `apps/backend/agent-server` 已提供 `Bree` scheduler、worker 入口和 Nest 生命周期服务

当前仍未完成的部分：

- `signal_sources / alerts / daily_digests` 已完成第一版模型；`raw_events -> merged signal -> signal_sources -> digest markdown` 已形成确定性审计链。后续如需更强治理面，可继续把这些证据投影接入 `agent-admin` 的 Evidence、Learning、Connector & Policy 中心
- backend 侧 scheduler 默认通过环境变量显式开启，避免在现有测试与开发进程中无意启动后台巡检
- 本轮已消除本地 `better-sqlite3` Node ABI 阻断；Intel package unit / integration 与 backend Intel runner 测试已覆盖 source evidence merge、digest evidence summary 与 scheduled job 闭环。根级 `pnpm verify` 仍以实际交付时验证结果为准

当前启用开关：

- `INTEL_SCHEDULER_ENABLED=true`
  - backend 启动时注册并启动 intel `Bree` jobs
  - 未显式开启时，scheduler provider 保持 idle

## 3. 分类体系

第一版统一收敛为 6 类：

1. `frontend_tech`
2. `frontend_security`
3. `ai_release`
4. `ai_security`
5. `platform_infra`
6. `policy_external`

分发优先级统一为 3 档：

- `P0`：高危安全、数据泄露、在野利用、核心平台重大事故
- `P1`：重要模型发布、关键库漏洞修复、重大版本变更
- `P2`：普通技术更新、一般公告、普通社区动态

状态统一为：

- `pending`
- `confirmed`
- `closed`

## 4. 信源策略

### 4.1 信源分层

情报信源分两层：

- `A 类高信任信源`
  - 官方博客
  - 官方 Release / Changelog
  - 官方 Security Advisory
  - GitHub Security / Releases
  - CVE / NVD / 漏洞库
  - 厂商状态页
- `B 类补充信号源`
  - 稀土掘金
  - InfoQ
  - V2EX
  - FreeBuf
  - 安全客
  - 先知社区
  - GitHub Issues / Discussions
  - Hacker News
  - Reddit
  - X

### 4.2 判定原则

- 官方源优先做日报主干
- 社区源优先做发现线索
- 社区单源高危事件默认进入 `pending`
- 官方确认或多高可信来源交叉验证后，升级为 `confirmed`
- `P0 + pending + confidence >= medium` 允许发送待确认预警
- `P0 + confirmed` 发送正式告警

## 5. 宿主边界与目录落位

### 5.1 `agents/intel-engine`

第一版情报专项 Agent 宿主落在：

- `agents/intel-engine/src/graphs/intel/intel.graph.ts`
- `agents/intel-engine/src/flows/intel/nodes/*`
- `agents/intel-engine/src/flows/intel/prompts/*`
- `agents/intel-engine/src/flows/intel/schemas/*`
- `agents/intel-engine/src/runtime/*`
- `agents/intel-engine/src/services/*`
- `agents/intel-engine/src/types/*`

约束：

- `graphs/` 只放 graph state 与 wiring
- `flows/intel/nodes/` 放具体节点实现
- `runtime/` 放调度、存储、路由、分发等运行时能力
- `services/` 只做 job facade，不复制 graph 内部业务

### 5.2 `agents/intel-engine/src/types`

只放 Intel 领域 contract，例如：

- `IntelSignalSchema`
- `IntelAlertSchema`
- `IntelDeliverySchema`
- `IntelDigestSchema`
- `IntelRouteRuleSchema`

### 5.3 `apps/backend/agent-server`

只负责：

- `Bree` 调度装配
- 配置加载
- 手动触发入口
- HTTP / SSE / 生命周期集成

### 5.4 配置与数据

- `config/intel/sources.yaml`
- `config/intel/channels.yaml`
- `config/intel/routes.yaml`
- `profile-storage/platform/intel/intel.db`

## 6. 调度设计

第一版由 `Bree` 注册 4 个作业：

1. `intel-patrol`
   - 周期：每 `30` 分钟
   - 用途：高优先级巡检
2. `intel-ingest`
   - 周期：每 `3` 小时
   - 用途：普通增量采集
3. `intel-digest`
   - 周期：每天 `21:00`
   - 用途：生成日报
4. `intel-delivery-retry`
   - 周期：每 `15` 分钟
   - 用途：重试失败分发

当前实现状态：

- `intel-patrol`：已接 `intel-worker.mjs` -> `runIntelScheduledJob()` -> `executePatrolIntelRun()`
- `intel-ingest`：已复用 collection pipeline，按 `sources.yaml` 中 `mode=ingest` 的 topic 执行
- `intel-digest`：已接 `executeDigestIntelRun()`，不再返回 `skipped`
- `intel-delivery-retry`：已接 `retryIntelDeliveries()`，并在 runner 层回写 delivery 状态到 SQLite

原则：

- `Bree` 只负责触发，不负责任务状态
- 幂等、去重、状态流转统一由 `SQLite` 承担

## 7. Graph 设计

第一版保持 3 条 graph 主链，并统一收口到 `createIntelGraph()` 的模式入口：

### 7.1 Patrol Graph

用于 `patrol` 与 `ingest` 两种模式，共用一条图，不同模式只影响输入 topic。

核心节点：

1. `load-source-config`
2. `build-search-tasks`
3. `run-web-search`
4. `persist-raw-events`
5. `normalize-signals`
6. `dedupe-and-merge`
7. `score-signal`
8. `attach-sources`
9. `decide-alerts`
10. `match-routes`
11. `enqueue-deliveries`

### 7.2 Digest Graph

核心节点：

1. `collect-digest-signals`
2. `group-digest-signals`
3. `rank-digest-highlights`
4. `render-digest-content`
5. `persist-digests`
6. `match-digest-routes`
7. `enqueue-digest-deliveries`

### 7.3 Delivery Retry Graph

核心节点：

1. `load-pending-deliveries`
2. `filter-retryable-deliveries`
3. `send-to-lark`
4. `update-delivery-status`
5. `close-expired-deliveries`

## 8. State 设计

### 8.1 Patrol Graph State

建议包含：

- `mode`
- `jobId`
- `startedAt`
- `topics`
- `searchTasks`
- `rawResults`
- `persistedRawEventIds`
- `normalizedSignals`
- `mergedSignals`
- `generatedAlerts`
- `matchedRoutes`
- `queuedDeliveries`
- `stats`
- `errors`

### 8.2 Digest Graph State

当前已落地：

- `jobId`
- `startedAt`
- `digestDate`
- `windowStart`
- `windowEnd`
- `collectedSignals`
- `groupedSignals`
- `highlights`
- `renderedDigest`
- `persistedDigest`
- `matchedRoutes`
- `queuedDeliveries`
- `stats`
- `errors`

### 8.3 Delivery Retry Graph State

建议包含：

- `jobId`
- `startedAt`
- `pendingDeliveries`
- `retryableDeliveries`
- `sentDeliveries`
- `failedDeliveries`
- `closedDeliveries`
- `stats`
- `errors`

## 9. 数据模型

第一版最小主表：

- `raw_events`
- `signals`
- `signal_sources`
- `alerts`
- `deliveries`
- `daily_digests`
- `daily_digest_signals`

关系：

- 一个 `signal` 可以关联多个 `raw_events`
- 一个 `signal` 可以关联多个 `signal_sources`
- 一个 `signal` 可以产生多个 `alerts`
- 一个 `alert` 可以对应多个 `deliveries`
- 一个 `daily_digest` 可以聚合多个 `signals`

### 9.1 状态机

`signal.status`：

- `pending`
- `confirmed`
- `closed`

`alert.status`：

- `ready`
- `sent`
- `upgraded`
- `closed`

### 9.2 去重原则

建议使用：

- `raw_events`：`content_hash` 或 `url + normalized_title`
- `signals`：`dedupe_key`
- `deliveries`：`signal_id + channel_target + delivery_kind + status_version`

其中 `status_version` 用于支持：

- `pending` 已发送一次
- `confirmed` 升级后允许再次发送
- 同一状态版本不重复发送

## 10. 路由与 Lark 分发

### 10.1 配置文件

第一版路由配置拆成三份：

- `sources.yaml`：抓什么
- `channels.yaml`：有哪些群
- `routes.yaml`：什么条件发到哪些群

### 10.2 路由能力

必须支持：

- 一条规则发多个群
- 一条事件命中多条规则
- 最终目标群自动去重
- 同一事件可同时发送到：
  - `AI 情报群 + 安全告警群`
  - `前端情报群 + 管理汇总群`
  - 其他任意组合

### 10.3 消息类型

第一版统一为：

- `formal alert`
- `pending warning`
- `digest`

默认约束：

- 同一群 `24` 小时内不重复发送同类型消息
- 但状态升级或优先级升级允许补发

## 11. YAML 配置语义

### 11.1 `sources.yaml`

定义：

- topic
- mode
- queries
- preferred sources
- default priority
- product hints

### 11.2 `channels.yaml`

定义：

- channel key
- `name`
- `type`
- `webhook_env`
- `enabled`

### 11.3 `routes.yaml`

建议支持条件：

- `category_in`
- `priority_in`
- `status_in`
- `confidence_in`
- `products_in`
- `keywords_in`
- `source_types_in`
- `delivery_kind_in`

## 12. 节点职责边界

第一版需明确防止“大节点包办一切”：

- `load-source-config` 只读配置
- `build-search-tasks` 只展开任务
- `run-web-search` 只调搜索
- `persist-raw-events` 只持久化原始数据
- `normalize-signals` 只做归一化与标签提取
- `dedupe-and-merge` 只做事件聚合
- `score-signal` 只做优先级、置信度、状态判定
- `decide-alerts` 只做告警生成与升级判断
- `match-routes` 只做路由匹配
- `enqueue-deliveries` 只做发送任务创建
- `send-to-lark` 只做真正发送

不允许：

- 在 `apps/backend` 内内联整条业务链
- 在 `delivery` 阶段重新做业务评分
- 在 `repository` 内塞大段业务判定

## 13. 分期实施

### 13.1 Phase 1：骨架与配置

- 新建 `agents/intel-engine`
- 新建 graph 入口与 flows/runtime/services 基础目录
- 建立 `Bree` 调度装配
- 落 `sources.yaml`、`channels.yaml`、`routes.yaml`
- 建立 SQLite 连接与基础表

### 13.2 Phase 2：采集与判定

- 接 MCP 搜索能力，优先 `webSearchPrime`，缺失时回退 MiniMax Token Plan `web_search`
- 跑通原始入库
- 跑通归一化、分类、去重、评分、状态流转
- 产出 `signal / alert / delivery`

### 13.3 Phase 3：分发与日报

- 接 Lark webhook
- 路由命中多群组合发送
- 生成日报
- 失败重试
- `pending -> confirmed` 升级补发

## 14. 风险与后续演进

第一版主要风险：

- 社区信号噪音高，容易引入误报
- 去重与升级规则如果设计不稳，容易重复发群
- `Bree` 只负责调度，幂等必须依赖数据库实现

第二版建议演进：

- 增加 LLM 摘要与风险解释
- 增加人工确认与关闭入口
- 在 `agent-admin` 中增加 Evidence / Alert / Delivery 视图
- 增加趋势统计、产品 watchlist 和规则治理界面
