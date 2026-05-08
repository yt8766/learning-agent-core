# agent-server 概览

状态：current
文档类型：overview
适用范围：`apps/backend/agent-server`
最后核对：2026-05-07

本主题主文档：

- 本文是 `agent-server` 的总体入口

本文只覆盖：

- 服务职责边界
- 启动方式
- chat 模块拆分约束

更细专题请继续看：

- runtime 边界：[runtime-module-notes.md](/docs/apps/backend/agent-server/runtime-module-notes.md)
- API 契约：[docs/contracts/api/README.md](/docs/contracts/api/README.md)
- 前后端集成链路：[docs/integration/frontend-backend-integration.md](/docs/integration/frontend-backend-integration.md)

`agent-server` 是当前唯一后端 API Host。它 owns:

- Identity and role/permission evaluation.
- Frontend-facing Knowledge API.
- Chat, Runtime and Platform Center BFF routes.
- Tool execution, Sandbox and Auto Review facades.
- Workflow BFF routes.

`agent-server` 是平台主 API 服务，负责：

- chat 会话与 `/api/chat/stream` SSE 推流
- `/api/chat` 直连大模型 SSE 推流
- `/api/agent-tools/*` 工具执行 facade、能力目录、审批恢复与健康检查最小闭环
- runtime / approvals / learning / evidence / connectors 治理接口
- `/api/health` 轻量健康检查，包含 backend host 的 `knowledgeSearchStatus` 装配态与可选 vector provider health
- 任务创建、审批、恢复、学习确认
- 可选的内建 background runner

当前 runtime 边界补充：

- `packages/runtime`
  - 继续作为 canonical runtime host
  - 承载 graph、flow、orchestration、session lifecycle、approval/recover、background semantics
  - `runtime-metrics` 与 `runtime-governance` 的稳定 store / analytics 主实现已收口到这里
- `apps/backend/agent-server/src/runtime`
  - 默认只承载 backend-specific host
  - 负责 Nest wiring、进程内 operational state、外部 adapter 装配，以及 admin/BFF 响应适配
- `apps/backend/agent-server/src/modules/runtime-metrics/*`、`src/modules/runtime-governance/*`
  - 已删除，不再保留 compat 双轨
- `agent-server` 仍保留少量 `runtime/domain/*` helper
  - 这些 helper 只承担 app-local context assembly、BFF 聚合或过渡态 facade 收口
  - 不再作为 `packages/runtime` 的替代 runtime 宿主
- `runtime center`、`company agents center`、`skill sources center`
  - 核心 projection 已迁到 `packages/runtime`
  - `agent-server/src/runtime/centers/*` 默认只保留 backend query/context 注入与薄 wrapper
  - Runtime Center 当前会透出 `RuntimeHost.getKnowledgeSearchStatus()`，用于展示知识检索 configured/effective mode、vector 配置、装配 diagnostics 与可选 vector provider health；health 结果有短 TTL cache、超时保护和 `consecutiveFailures` 计数，避免健康页高频直连 provider。它不是单次 query diagnostics。单次 query 的最近诊断快照由 runtime bridge 的 `RuntimeKnowledgeSearchService.getLastDiagnostics()` 保留，并以 `knowledgeSearchLastDiagnostics` 作为可选 projection 字段供后续 drilldown 或调试台读取
- `learning center`
  - `full / summary` projection 已迁到 `packages/runtime`
  - 原 backend-local learning pure helpers 已去重删除；queue priority、counselor experiment 与 capability trust profile 纯计算只保留在 `packages/platform-runtime/src/centers/runtime-learning-center.helpers.ts`
  - `evidence center` 暂时仍留在 backend，因为它还绑定 checkpoint ref / browser replay 这类 BFF 适配细节

当前 backend 瘦身边界补充：

- `agent-server` 的长期定位是 API Host + BFF + Composition Root。
- `agent-server` 可以装配 runtime、暴露 HTTP/SSE、适配 Nest 错误语义和聚合 admin BFF response，但不作为稳定领域规则、agent 主链或业务子系统的真实宿主。
- `packages/platform-runtime` 当前提供可注入的 workflow registry / execution contract，不直接依赖任何 `@agent/agents-*`；backend `runtime/core` 负责把官方 workflow executor 注入这层 contract，再对外暴露 HTTP/BFF。
- `RuntimeWorkflowExecutionFacade` 当前是 backend workflow composition facade，负责注册 `company-live` 与 `data-report-json` 两个现有 workflow executor；`RuntimeCompanyLiveFacade` 只保留为 company-live graph 的单一调用点。
- `RuntimeCompanyLiveFacade` 与 `RuntimeWorkflowExecutionFacade` 都是过渡 composition facade，不应承载业务规则、prompt、schema 或 node 编排；后续退出条件是官方 workflow registry 继续收敛为可复用的 platform runtime 装配能力。
- `company-live.service.ts` 与 `workflow-runs/workflow-dispatcher.ts` 不应直接 import 或执行 `@agent/agents-company-live` graph；新增 workflow 能力默认先进入对应 `agents/*` 宿主或官方 workflow facade，再由 backend 暴露 HTTP/BFF 入口。
- Daily Tech Intelligence Briefing 当前真实宿主是 `agents/intel-engine/src/runtime/briefing`；历史 backend 落点 `apps/backend/agent-server/src/runtime/briefings` 已删除。
- backend 只保留 `PlatformBriefingsController`、Nest provider wiring、force-run / feedback / runs 查询 API、权限审计、错误映射和 `RuntimeIntelBriefingFacade` 这类 BFF adapter。
- 新增 briefing 采集源、分类、排序、本地化、投递、存储、反馈策略时，默认修改 `agents/intel-engine`，不要在 `apps/backend/agent-server` 恢复 briefing 主逻辑或 compat 双轨。

当前工具执行 facade：

- `apps/backend/agent-server/src/agent-tools`
  - 作为 HTTP/BFF facade 暴露 `/api/agent-tools/*`
  - agent tool 的低风险/中高风险审批判定与 sandbox profile 选择这类纯治理规则已迁到 `@agent/tools`；backend facade 只负责调用这些规则并衔接 sandbox、auto-review、repository、事件投影
  - 当前使用 in-memory repository，适合作为前后端 contract 联调与测试入口；repository 已提供 contract snapshot export/restore 边界，便于后续替换为真实持久化
  - request 创建时已调用 `SandboxService.preflight`，并把 `sandboxRunId`、`sandboxDecision`、`sandboxProfile` 写入 execution request metadata；sandbox `require_approval` 会复用 agent-tools 审批入口
  - sandbox 允许且低风险可执行路径会调用 `AutoReviewService.createReview(kind = "tool_execution")`；`block` verdict 会进入 `pending_approval`，写入规范关联字段 `reviewId`，并保留 `autoReviewId` 作为兼容字段；审批恢复时优先 `reviewId`，缺失时 fallback 到 `autoReviewId`
  - 事件投影会把 sandbox / auto-review 白名单治理字段写入 `tool_called`、`execution_step_*`、`interrupt_*`、`/api/agent-tools/events` 与 `/api/agent-tools/projection.events`，但不会展开 `input`、`rawInput`、`rawOutput`、完整 `metadata`、vendor/provider 原始 payload 或第三方 response/error
  - 低风险和审批恢复执行当前通过同步 executor queue helper 写出 `queued -> running -> succeeded` 观测语义；这仍是最小 facade，不是异步真实 worker
  - 能力目录由 `@agent/tools` 默认 registry 投影为 `@agent/core` execution contracts
  - 真实落盘、异步 worker、真实 sandbox/reviewer runner 和 SSE 广播后续应继续接入 runtime / observability 宿主，不要把长期执行主链堆在 controller/service 里
- `apps/backend/agent-server/src/sandbox`
  - 作为 HTTP/BFF facade 暴露 `/api/sandbox/*`
  - 当前使用 in-memory repository 保存 `SandboxRunRecord`，覆盖 profile 列表、preflight、run 查询、cancel 与 approval resume 的最小状态流
  - repository snapshot 只暴露 `{ runs: SandboxRunRecord[] }`，restore 会先 parse 完整 snapshot 再替换内部状态
  - `host`、`danger-full-access`、`release-ops`、`high` / `critical` 风险进入审批；denied path / denied command 直接拒绝
  - 当前已被 `/api/agent-tools/requests` 最小接入；chat/runtime 内部旧工具链仍需后续迁移到同一 sandbox preflight 边界
  - 真实 runner、持久化、checkpoint / SSE 与前端投影仍应继续接入 runtime / observability 宿主
- `apps/backend/agent-server/src/auto-review`
  - 作为 HTTP/BFF facade 暴露 `/api/auto-review/*`
  - 当前使用 in-memory repository 保存 `AutoReviewRecord`，并用 `@agent/core` `AutoReviewResultSchema` 校验输出
  - repository snapshot 只暴露 `{ reviews: AutoReviewRecord[] }`，restore 会先 parse 完整 snapshot 再替换内部状态
  - 最小规则审查支持 `BLOCKER` / `SECRET` / `DANGEROUS` 阻断、`WARNING` / `TODO` 警告、list filter、rerun 与 approval resume
  - 当前已被 `/api/agent-tools/requests` 的低风险工具执行路径最小接入；其他 code change / release / runtime 主链场景仍需后续迁移
  - 真实 reviewer agent、持久化、checkpoint / SSE 与前端投影仍需后续接线

Nest provider 约束：

- 新增 provider 依赖另一个本地 provider 时，应优先显式注入稳定 token，例如 `@Inject(AgentToolsRepository)`、`@Inject(RuntimeHost)`。
- 不要用构造函数默认参数伪装依赖注入；这会让单元测试看似可用，但真实 `AppModule` 启动时 Nest 无法解析 provider token。
- `backend-http-app.smoke.ts` 使用 `abortOnError: false`，保证启动失败时暴露可诊断异常，而不是在 Vitest worker 中触发 `process.abort()`。

Platform governance 权限：

- `PlatformModule` 注册 `PermissionGuard` 作为平台控制器的权限门。
- connector center 与 skill sources center 的 `POST` 写接口必须标注 `RequirePermission('governance:write')`。
- 新增治理写接口时，先在 [agent-admin.md](/docs/contracts/api/agent-admin.md) 写明权限语义，再补 `platform-permission-guards.spec.ts` 防回退测试。

## Chat 模块拆分约束

`apps/backend/agent-server/src/chat/chat.service.ts` 现在只保留会话委托、直连模式判断和 facade 级入口。

- 直连文本 / Sandpack 预览 / Sandpack 代码流转 helper 在 `apps/backend/agent-server/src/chat/chat-direct-response.helpers.ts`
- report-schema 直连链路和 artifact cache key helper 在 `apps/backend/agent-server/src/chat/chat-report-schema.helpers.ts`
- `chat.service` 相关测试按主题拆到 `apps/backend/agent-server/test/chat/chat.service.*.spec.ts`
- `apps/backend/agent-server/test/chat/chat.service.spec.ts` 只保留结构检查需要的标准入口，不再承载完整测试正文

Chat response steps 通过 `chat-response-steps.adapter.ts` 投影为 `node_progress` payload。该投影保持 `/api/chat/stream` 的 `ChatEventRecord` framing 不变，同时让 `agent-chat` 呈现运行中 quick steps 和完成后 step detail。`ChatService.subscribe()` 会先用历史事件 seed projection state，避免历史回放后 realtime sequence 或 message ownership 断开。

后续如果继续扩展 chat 直连能力，优先往 helper 或同域新文件里拆，不要把大段流式生成和 schema 编排逻辑塞回 `chat.service.ts`。

`/api/chat` direct-reply 会通过 `RuntimeHost.modelInvocationFacade` 进入统一模型调用链。当前直连对话默认显式关闭 thinking，防止 GLM 4.6 / GLM 5 只产出 reasoning tokens 而没有最终 `content`；adapter 层负责把该语义转换为各供应商自己的稳定参数。MiniMax 本地联调应按 key 所属区域配置 base URL：国际站通常使用 `https://api.minimax.io/v1`，国内站使用 `https://api.minimaxi.com/v1`。进入 provider 前必须保持单条 `system` message；profile system、用户 system prompt 与 direct-reply 历史上下文由 runtime 合并，避免 MiniMax 国内 OpenAI-compatible 返回 `400 invalid chat setting (2013)`。

## 启动

```bash
pnpm start:dev:agent
```

本地联调后端时默认只启动统一 `agent-server`。

生产构建：

```bash
pnpm build:lib
pnpm --dir apps/backend/agent-server build
pnpm --dir apps/backend/agent-server start:prod
```

构建约束：

- `apps/backend/agent-server/tsconfig.build.json` 必须覆盖开发态 `paths` 为 `{}`，让生产构建走 workspace 包解析，而不是继续命中 `packages/*/src`、`agents/*/src`
- 新增 Nest backend 不应恢复 standalone auth/knowledge host；如确需新增独立服务，必须先定义 workspace package 边界、API contract 与构建入口，不要从 app tsconfig 把 `@agent/*` 指回源码路径。
- `agent-server` 的 `start` / `start:dev` 必须先执行根级 `build:lib`，确保被 workspace 包 manifest 引用的 `build/types`、`build/cjs` 与 `build/esm` 已存在
- `apps/backend/agent-server/tsconfig.build.json` 的生产构建应关闭 `incremental`，避免 `tsconfig.build.tsbuildinfo` 仍在但 `dist/` 已被清理时出现“`tsc` 成功、却没有任何发射产物”的假成功
- 上游 workspace 包与专项 agent 的声明产物必须固定到各自 `build/types`，运行时代码产物固定到 `build/cjs` 与 `build/esm`；`package.json` 中 `types` / `exports.types` 也必须同步指向这些真实存在的构建产物，不要把 `.d.ts/.js/.js.map` 回写到 `packages/*/src`、`agents/*/src`
- 生产构建输出应只落在 `apps/backend/agent-server/dist`
- workspace 共享包与专项 agent 通过各自已构建的包产物消费，不应由 `agent-server` 的 `tsc` 二次编译源码

## 关键环境变量

- `PORT`
- `ZHIPU_API_KEY`
- `MCP_RESEARCH_HTTP_ENDPOINT`
- `MCP_RESEARCH_HTTP_API_KEY`
- 其他 provider 变量按实际接入启用

## 日志落盘

`AppLoggerService` 会固定把日志写入 `apps/backend/agent-server/logs`。

- 不再跟随启动命令所在的 `cwd` 漂移到仓库根或其他目录
- 控制台继续输出全部实时日志，`logs/` 仅保留高价值留痕
- `error-YYYY-MM-DD.log`
  - 所有 `error`，包括启动失败、未处理异常、`request.failed`
- `warn-YYYY-MM-DD.log`
  - 仅保留需要排障的 `warn`，如 5xx、后台任务异常、schedule/briefing 异常
- `audit-YYYY-MM-DD.log`
  - 审批、connector policy、skill install、learning conflict 等治理动作
- `performance-YYYY-MM-DD.log`
  - `runtime.platform_console.*` 这类慢聚合与性能样本
- 默认不落盘普通 `request.completed`、启动期框架日志、`request.response`、一般性 `log/debug/verbose`
- 如果目录里仍看到旧的 `app-YYYY-MM-DD.log`，那是旧策略遗留产物；切到当前 logger 实现并重启后，不应再继续新增这类文件，可通过 `pnpm --dir apps/backend/agent-server cleanup:artifacts` 清理

## Runtime Background

服务默认会启动内建 background runner，用于：

- 消费 queued background tasks
- reclaim 过期 lease
- sweep interrupt timeouts
- process learning queue / scan learning conflicts

可通过以下变量切换：

- `RUNTIME_BACKGROUND_ENABLED`
- `RUNTIME_BACKGROUND_WORKER_POOL_SIZE`
- `RUNTIME_BACKGROUND_LEASE_TTL_MS`
- `RUNTIME_BACKGROUND_HEARTBEAT_MS`
- `RUNTIME_BACKGROUND_POLL_MS`
- `RUNTIME_BACKGROUND_RUNNER_ID_PREFIX`

如果使用独立 worker 模式，建议：

- backend 设置 `RUNTIME_BACKGROUND_ENABLED=false`
- `apps/worker` 保持默认启用

## 本地验证

```bash
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm --dir apps/backend/agent-server test:runtime
```
