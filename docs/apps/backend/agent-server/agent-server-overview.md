# agent-server 概览

状态：current
文档类型：overview
适用范围：`apps/backend/agent-server`
最后核对：2026-04-26

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

`agent-server` 是平台主 API 服务，负责：

- chat 会话与 `/api/chat/stream` SSE 推流
- `/api/chat` 直连大模型 SSE 推流
- `/api/agent-tools/*` 工具执行 facade、能力目录、审批恢复与健康检查最小闭环
- runtime / approvals / learning / evidence / connectors 治理接口
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
- `learning center`
  - `full / summary` projection 已迁到 `packages/runtime`
  - `evidence center` 暂时仍留在 backend，因为它还绑定 checkpoint ref / browser replay 这类 BFF 适配细节

当前工具执行 facade：

- `apps/backend/agent-server/src/agent-tools`
  - 作为 HTTP/BFF facade 暴露 `/api/agent-tools/*`
  - 当前使用 in-memory repository，适合作为前后端 contract 联调与测试入口；repository 已提供 contract snapshot export/restore 边界，便于后续替换为真实持久化
  - request 创建时已调用 `SandboxService.preflight`，并把 `sandboxRunId`、`sandboxDecision`、`sandboxProfile` 写入 execution request metadata；sandbox `require_approval` 会复用 agent-tools 审批入口
  - sandbox 允许且低风险可执行路径会调用 `AutoReviewService.createReview(kind = "tool_execution")`；`block` verdict 会进入 `pending_approval`，审批恢复时同步恢复关联 review
  - 事件投影会把 sandbox / auto-review 白名单治理字段写入 `tool_called`、`execution_step_started`、`execution_step_completed` 与 `execution_step_blocked`，但不会展开 raw input
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

## Chat 模块拆分约束

`apps/backend/agent-server/src/chat/chat.service.ts` 现在只保留会话委托、直连模式判断和 facade 级入口。

- 直连文本 / Sandpack 预览 / Sandpack 代码流转 helper 在 `apps/backend/agent-server/src/chat/chat-direct-response.helpers.ts`
- report-schema 直连链路和 artifact cache key helper 在 `apps/backend/agent-server/src/chat/chat-report-schema.helpers.ts`
- `chat.service` 相关测试按主题拆到 `apps/backend/agent-server/test/chat/chat.service.*.spec.ts`
- `apps/backend/agent-server/test/chat/chat.service.spec.ts` 只保留结构检查需要的标准入口，不再承载完整测试正文

后续如果继续扩展 chat 直连能力，优先往 helper 或同域新文件里拆，不要把大段流式生成和 schema 编排逻辑塞回 `chat.service.ts`。

## 启动

```bash
pnpm build:lib
pnpm --dir apps/backend/agent-server start:dev
```

生产构建：

```bash
pnpm build:lib
pnpm --dir apps/backend/agent-server build
pnpm --dir apps/backend/agent-server start:prod
```

构建约束：

- `apps/backend/agent-server/tsconfig.build.json` 必须覆盖开发态 `paths` 为 `{}`，让生产构建走 workspace 包解析，而不是继续命中 `packages/*/src`、`agents/*/src`
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
