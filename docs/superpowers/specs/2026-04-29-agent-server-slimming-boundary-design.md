# Agent Server 瘦身边界设计

状态：snapshot  
文档类型：plan  
适用范围：`apps/backend/agent-server`、`agents/intel-engine`、`packages/runtime`、`packages/skill`、`packages/tools`  
最后核对：2026-04-29

## 1. 背景

`apps/backend/agent-server` 当前已经明显超过“后端服务包”的职责边界。它既承担 Nest HTTP / SSE / BFF，又承载了 runtime center projection、skill install/search、connector governance、tools facade、sandbox、review、daily tech briefing 等大量领域逻辑。

这导致几个问题：

- 后续 AI 和开发者容易误判 `agent-server` 是业务能力真实宿主。
- 稳定领域规则散落在 app 层，难以被 worker、agent、测试和其他宿主复用。
- 已迁到 `@agent/runtime`、`@agent/skill`、`@agent/tools` 的能力仍有 backend compat/re-export 残留，形成双入口。
- `runtime/briefings` 已经是一套完整情报子系统，却仍放在 backend runtime 目录中。

本设计目标是先锁定长期边界，再分阶段瘦身，而不是先做机械搬文件。

## 2. 目标

- 将 `agent-server` 收敛为 **API Host + BFF + Composition Root**。
- 明确哪些逻辑必须迁出 backend app 层，迁到哪个真实宿主。
- 将 Daily Tech Intelligence Briefing 明确定义为 `agents/intel-engine` 的默认能力。
- 保持现有 HTTP API 和 admin/chat 集成兼容。
- 为后续实施计划提供可验证、可分批推进的边界。

## 3. 非目标

- 本设计不直接实施代码迁移。
- 不改变现有外部 API 路径。
- 不删除 chat、approval、learning、evidence、connector、tool、briefing 等产品能力。
- 不新建 `packages/shared` 或恢复 `@agent/shared`。
- 不把 `packages/runtime` 重新变成官方 agent 或 briefing 业务宿主。

## 4. Agent Server 长期职责

`agent-server` 后续定位为：

> `agent-server` 可以编排已有能力、适配 HTTP 语义、装配运行时，但不能成为稳定领域规则、agent 主链或业务子系统的真实宿主。

允许保留在 `agent-server` 的职责：

- Nest controller、module、provider wiring。
- HTTP、SSE、Webhook、CORS、日志、鉴权、错误映射。
- DTO / query pipe / interceptor / filter 等 app 边界适配。
- `RuntimeHost` 这类 backend composition root，负责选择 profile、装配 platform runtime、注入 provider、连接官方 agent。
- Admin BFF facade：分页、导出格式、query 参数适配、`NotFoundException` 映射。
- backend-only adapter，例如 evidence replay 绑定 checkpoint、日志文件分析、HTTP 测量、启动健康检查。
- 对真实宿主 facade 的调用顺序编排。

不允许长期保留在 `agent-server` 的职责：

- 稳定 DTO、event、SSE payload、tool result schema。
- runtime center / approvals / observability / learning 的纯 projection。
- skill install/search/safety/path/listing 规则。
- connector governance state mutation、tools center 投影、sandbox policy 主规则、review rule engine。
- Daily Tech Intelligence Briefing 的采集、去重、排序、本地化、投递、存储、反馈应用。
- agent graph、flow、prompt、模型输出解析和重试策略。

## 5. 迁出分层

### 5.1 Stable Contract -> `packages/core`

迁入条件：

- 前端、backend、runtime、worker、agent 或测试多方消费。
- 字段需要兼容演进。
- 能以 schema-first 方式表达。

典型内容：

- API DTO / response schema。
- SSE event / tool result / execution record。
- approval、task、briefing、center record 中需要跨宿主消费的稳定字段。

### 5.2 Runtime Projection / Governance -> `packages/runtime`

迁入条件：

- 输入主要是 `TaskRecord`、`RuntimeStateSnapshot`、session、checkpoint、approval、runtime metadata。
- 输出是 runtime/admin 视图、治理状态、observability 过滤结果、metrics snapshot。
- 不依赖 Nest、HTTP、controller query DTO、backend 日志路径。

典型内容：

- runtime center projection。
- approvals center / run observatory / recent runs。
- learning center 纯统计与归一化。
- metrics snapshot preference。
- approval scope policy 与 runtime governance store。

### 5.3 Skill Domain -> `packages/skill`

迁入条件：

- 围绕 skill source、manifest、install、artifact、catalog、safety、search status、draft。
- 可被 backend、runtime、admin、worker 或其他 agent 复用。

典型内容：

- skill source profile policy 的领域判断。
- skill search status / safety note / MCP recommendation。
- install path sanitize、remote display name、artifact staging/promote。
- skill listing sanitize、draft manifest 规则、auto-install eligibility。

### 5.4 Tools / Sandbox / Review -> `packages/tools`

迁入条件：

- 围绕 tool registry、execution request/result、connector draft、sandbox policy、review gate。
- 不依赖 Nest controller 或 backend-only repository。

典型内容：

- tools center projection。
- connector draft config 和 secret update payload。
- execution request/result helper。
- sandbox policy 主规则。
- review rule engine 与 risk classification。

`agent-server/src/tools`、`src/sandbox`、`src/review` 可以保留 BFF facade，但不能继续长成真实执行主链。

### 5.5 Daily Tech Intelligence Briefing -> `agents/intel-engine`

Daily Tech Intelligence Briefing 是 `agents/intel-engine` 的默认能力，不再是 `agent-server` 的 runtime 子模块。

迁入 `agents/intel-engine` 的职责：

- briefing category config。
- 情报采集与 source policy。
- MCP / web search 补充发现。
- URL、标题、发布时间和来源归一化。
- 同轮去重、跨轮 history 去重、重复窗口判断。
- ranking、relevance、confidence、impact、priority 决策。
- localize / render digest。
- Lark delivery。
- run / history / feedback / schedule storage。
- feedback 应用。
- 后续 graph / flow 化入口。

`agent-server` 只保留：

- `PlatformBriefingsController`。
- request DTO / query pipe。
- Nest provider wiring。
- `force-run` / `feedback` / `runs` API。
- HTTP error mapping。
- 权限、审计、日志入口。
- 对 `agents/intel-engine` facade 的调用。

禁止继续在 `apps/backend/agent-server/src/runtime/briefings` 扩展 briefing 主逻辑。新增 briefing 采集源、分类、排序、本地化、投递、存储、反馈策略，默认落到 `agents/intel-engine`。

## 6. 目标目录形态

瘦身后的 `agent-server` 应更接近：

```text
apps/backend/agent-server/src/
  app/
  common/
  cors/
  logger/
  chat/
  platform/
  runtime/
    core/        # RuntimeHost / backend composition root
    services/    # thin app-facing services
    adapters/    # backend-only response/error/log adapters
  tools/         # BFF facade only
  sandbox/       # BFF facade only
  review/        # BFF facade only
```

`agents/intel-engine` 应成为 briefing 的真实宿主：

```text
agents/intel-engine/src/
  graphs/
  runtime/
    briefing/
      collection/
      delivery/
      feedback/
      ranking/
      rendering/
      scheduling/
      storage/
    execution/
    routing/
  types/
```

具体目录可按现有 `agents/intel-engine/src/runtime/*` 风格微调，但 briefing 主逻辑不能继续留在 backend。

## 7. 分阶段实施建议

### 阶段 1：边界锁定

- 更新 `docs/apps/backend/agent-server/agent-server-overview.md`。
- 更新 `docs/apps/backend/agent-server/runtime-module-notes.md`。
- 明确 backend 允许保留、必须迁出、暂缓迁出的清单。
- 在文档中标记 `runtime/briefings` 为待迁出到 `agents/intel-engine` 的历史落点。

### 阶段 2：低风险 compat 清理

- 处理只做 `compat re-export` / `thin re-export` 的 backend 文件。
- 调用方改为直接依赖真实宿主包。
- 删除无实际 adapter 职责的 backend 中转层。
- 将测试迁到真实宿主包，backend 只保留 facade/API 测试。

### 阶段 3：Briefings 迁入 `agents/intel-engine`

- 在 `agents/intel-engine` 建立 briefing facade。
- 将现有 `runtime/briefings/*` 逻辑迁入 intel engine。
- `agent-server` controller/service 改为调用 intel facade。
- 保持现有 API 路径和 response 兼容。
- 迁完后删除 `apps/backend/agent-server/src/runtime/briefings`，不保留长期 compat。

### 阶段 4：Centers / Skills / Tools 深水区收敛

- 将纯 projection、纯策略和纯规则继续迁入 `packages/runtime`、`packages/skill`、`packages/tools`。
- backend services 保留调用顺序、异常映射和 BFF response adaptation。
- 对仍需 backend-only 的 adapter 显式标注原因。

### 阶段 5：防回流

- 在项目规范中补充 backend app 层职责红线。
- 后续新增领域逻辑时，默认先选择真实宿主包或 agent 包。
- 对新增 backend helper 要求说明其 backend-only 理由。
- 可后续补 `check:package-boundaries` 或类似静态检查，阻止 graph/flow/prompt/schema parser 主实现进入 `agent-server`。

## 8. 验证策略

每批迁移必须证明行为不变：

- 纯函数迁出：在目标 package / agent 宿主补 unit/spec。
- contract 迁出：补 zod parse 回归，确保 schema-first。
- backend facade 保留：跑相关 controller/service 测试。
- briefing 迁移：补 `agents/intel-engine` briefing run/storage/ranking/delivery 测试，backend 保留 API smoke。
- 涉及 `packages/*`：优先执行 `pnpm build:lib` 和 `pnpm --dir apps/backend/agent-server build`。
- 涉及代码、配置或测试文件：按验证体系补齐 Type / Spec / Unit / Demo / Integration；如根级 `pnpm verify` 被既有红灯阻断，记录 blocker 并补受影响范围验证。

纯文档阶段至少执行：

```bash
pnpm check:docs
```

## 9. 风险与回滚

主要风险：

- API response 形状在迁移中发生隐式变化。
- backend 测试迁到真实宿主后，BFF 行为缺少 smoke 覆盖。
- briefing 本地存储路径变化导致历史去重失效。
- `agents/intel-engine` 与 backend 同时保留 briefing 逻辑，形成双轨。

控制方式：

- 先定义 facade，再迁移实现。
- 迁移前后保留相同输入输出 fixture。
- briefing storage path 默认保持 `data/runtime/briefings/*`，除非另有迁移文档和兼容读取。
- 一旦 `agent-server` 调用切到 intel facade，应删除 backend briefing 主逻辑，避免长期 compat。
- 每阶段保留小提交，必要时可按阶段回滚。

## 10. 待用户确认

已确认的设计选择：

- 采用“边界优先重构”方向。
- `agent-server` 定位为 API Host + BFF + Composition Root。
- Daily Tech Intelligence Briefing 直接迁入 `agents/intel-engine`，作为该 agent 包的默认能力。

后续 implementation plan 需要进一步细化：

- 第一批 compat/re-export 清理名单。
- `agents/intel-engine` briefing facade 的具体公开接口。
- briefing 类型是否先进入 `packages/core`，还是先保留在 `agents/intel-engine/src/types`。
- backend BFF API smoke 的最小覆盖集。
