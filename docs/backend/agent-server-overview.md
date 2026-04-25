# agent-server 概览

状态：current
文档类型：overview
适用范围：`apps/backend/agent-server`
最后核对：2026-04-19

本主题主文档：

- 本文是 `agent-server` 的总体入口

本文只覆盖：

- 服务职责边界
- 启动方式
- chat 模块拆分约束

更细专题请继续看：

- runtime 边界：[runtime-module-notes.md](/docs/backend/runtime-module-notes.md)
- API 契约：[docs/api/README.md](/docs/api/README.md)
- 前后端集成链路：[docs/integration/frontend-backend-integration.md](/docs/integration/frontend-backend-integration.md)

`agent-server` 是平台主 API 服务，负责：

- chat 会话与 `/api/chat/stream` SSE 推流
- `/api/chat` 直连大模型 SSE 推流
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
