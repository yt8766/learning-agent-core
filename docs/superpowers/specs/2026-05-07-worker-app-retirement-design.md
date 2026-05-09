# apps/worker 退役迁移设计

状态：draft
文档类型：spec
适用范围：`apps/worker`、`apps/backend/agent-server`、runtime background runner、仓库治理脚本、CI 与相关文档
最后核对：2026-05-08

## 目标

退役 `apps/worker` 独立 workspace app，将后台队列消费统一收敛到 `apps/backend/agent-server` 的内建 background runner。

迁移完成后：

- 仓库不再包含 `@agent/worker` package。
- `apps/worker/**` 不再作为源码、测试、CI、文档或验证入口存在。
- 后台任务、学习队列、lease、heartbeat 与 recover/sweep 行为继续由 `agent-server` runtime background runner 承担。
- `runtimeBackground` 配置保留，但语义统一为控制 `agent-server` 内建 runner。
- 后续 AI 与开发者不再被“backend + 独立 worker app”双入口误导。

## 当前事实

`apps/worker` 当前主要包含：

- `src/main.ts`：启动 `startWorkerProcess()`，处理 SIGINT/SIGTERM。
- `src/runtime/worker-runtime.ts`：通过 `@agent/platform-runtime` 创建 worker runtime host，并启动 background runner loop。
- `src/runtime/background-runner.ts`：后台 tick、lease reclaim、queued task acquire、heartbeat、failure marking、release lease。
- `test/**`：worker runtime、background runner、边界测试。

`apps/backend/agent-server` 已有对应能力：

- `src/runtime/helpers/runtime-background-runner.ts`
- `src/runtime/domain/background/runtime-background-context.ts`
- `src/runtime/services/runtime-bootstrap.service.ts`
- `test/runtime/helpers/runtime-background-runner.test.ts`
- `test/runtime/services/runtime-bootstrap.service.spec.ts`

因此迁移不需要把 worker 主链挪进新包，也不应把 worker loop 上提到 `packages/platform-runtime`。background runner 是宿主启动与生命周期职责，应由 `agent-server` 承担。

## 非目标

- 不新增新的 workspace package。
- 不恢复 `@agent/shared` 或新增伪共享层。
- 不把 HTTP/SSE controller 搬入 runtime 包。
- 不在 `packages/platform-runtime` 承载 worker loop。
- 不在本轮修改 task queue schema、lease 协议、orchestrator 方法语义。

## 推荐方案

采用“彻底退役独立 worker app，保留 agent-server 内建 runner”的方案。

### 方案 A：直接退役 `apps/worker`，统一到 agent-server

优点：

- 删除重复 runtime host。
- 与当前 backend 已具备的 background runner 实现匹配。
- 减少 docs、CI、脚本、workspace package 的长期双入口维护成本。

代价：

- 失去 `node apps/worker/dist/main.js` 独立进程启动方式。
- 部署上需要接受 agent-server 同时承担 API 与后台消费。

这是推荐方案。

### 方案 B：把独立启动入口迁到 agent-server CLI

在 `apps/backend/agent-server` 内增加类似 `start:background` 的启动脚本，让同一个 package 支持仅启动 background runner。

只有当部署明确需要 API 与后台消费分进程时才采用；否则容易重新形成第二个 runtime host 入口。

### 方案 C：保留 `apps/worker` 但标记废弃

该方案短期风险小，但不能满足删除目录目标，也会继续制造文档和脚本分叉，不推荐。

## 迁移设计

### 1. 运行入口

删除 `apps/worker` package 后，后台消费唯一官方入口是 `apps/backend/agent-server` 的 runtime bootstrap。

`RuntimeBootstrapService` 在 `runtimeBackground.enabled` 为 true 时启动 `startBackgroundRunnerLoop()`，后台 runner 继续处理：

- interrupt timeout sweep
- learning conflict scan
- learning queue processing
- queued learning job processing
- expired background lease reclaim
- queued background task lease acquire
- background task execution
- heartbeat / failure / release

### 2. 配置语义

保留现有配置项：

- `RUNTIME_BACKGROUND_ENABLED`
- `RUNTIME_BACKGROUND_WORKER_POOL_SIZE`
- `RUNTIME_BACKGROUND_LEASE_TTL_MS`
- `RUNTIME_BACKGROUND_HEARTBEAT_MS`
- `RUNTIME_BACKGROUND_POLL_MS`
- `RUNTIME_BACKGROUND_RUNNER_ID_PREFIX`

迁移后文档统一说明这些配置控制 `agent-server` 内建 background runner。`RUNTIME_BACKGROUND_RUNNER_ID_PREFIX` 默认仍可为 `runtime`，不再要求独立 worker 使用 `worker` 前缀。

### 3. 测试迁移

删除或合并以下 worker 测试：

- `apps/worker/test/background-runner.test.ts`
- `apps/worker/test/worker-runtime.test.ts`
- `apps/worker/test/worker-boundary.test.ts`
- `apps/worker/test/app-dependency-boundary.test.ts`

迁移后的测试落点：

- background runner 行为：`apps/backend/agent-server/test/runtime/helpers/runtime-background-runner.test.ts`
- bootstrap 启停行为：`apps/backend/agent-server/test/runtime/services/runtime-bootstrap.service.spec.ts`
- 应用依赖边界：保留在 runtime/package boundary 脚本测试或迁到 backend 架构测试，不再以 `apps/worker/test` 为治理入口。

### 4. 治理脚本清理

必须删除或改写所有 `apps/worker` 硬编码：

- `eslint.config.js`
- `scripts/typecheck.js`
- `scripts/check-staged.js`
- `scripts/check-package-boundaries.js`
- `scripts/check-backend-structure.js`
- `scripts/check-docs.js`
- `packages/runtime/test/turbo-typecheck-manifests.test.ts`
- `packages/runtime/test/package-boundaries-script.test.ts`

### 5. Workspace 与 lockfile

删除：

- `apps/worker/package.json`
- `apps/worker/tsconfig.json`
- `apps/worker/src/**`
- `apps/worker/test/**`

随后执行 `pnpm install`，让 `pnpm-lock.yaml` 移除 `apps/worker` importer。workspace package 删除与 lockfile 更新必须同轮收口。

### 6. CI 清理

更新 `.github/workflows/pr-check.yml`：

- 移除 `apps/worker/**` 路径过滤。
- 如需要保留后台 runner 触发面，改为监听 `apps/backend/agent-server/src/runtime/**` 与相关 test/doc 路径。

### 7. 文档清理

删除或改写过时文档入口：

- `README.md`
- `docs/apps/backend/README.md`
- `docs/apps/backend/worker/**`
- `docs/README.md`
- `docs/architecture/ARCHITECTURE.md`
- `docs/conventions/project-conventions.md`
- `docs/conventions/backend-conventions.md`
- `docs/conventions/local-development-guide.md`
- `docs/conventions/langgraph-app-structure-guidelines.md`
- `docs/conventions/package-architecture-guidelines.md`
- `docs/packages/runtime/runtime-state-machine.md`
- `docs/packages/runtime/runtime-layering-adr.md`
- `docs/packages/platform-runtime/README.md`
- `docs/packages/platform-runtime/official-composition-root-adr.md`
- `docs/packages/config/runtime-profiles.md`
- `docs/packages/evals/verification-system-guidelines.md`
- `docs/context/platform-runtime-package-handoff.md`
- `docs/context/ai-handoff.md`

正确的新阅读入口应是：

- `docs/apps/backend/agent-server/agent-server-overview.md`
- `docs/apps/backend/agent-server/runtime-module-notes.md`
- `docs/packages/runtime/runtime-state-machine.md`
- `docs/packages/evals/verification-system-guidelines.md`

## 验证策略

迁移完成后至少执行：

```bash
pnpm install
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm --dir apps/backend/agent-server test
pnpm check:docs
```

如果同步触达 `packages/*`、runtime contract 或 root governance 脚本，再补：

```bash
pnpm build:lib
pnpm --dir apps/backend/agent-server build
```

如果修改 package boundary 脚本或 staged check 逻辑，应补对应脚本测试：

```bash
pnpm exec vitest run packages/runtime/test/package-boundaries-script.test.ts packages/runtime/test/turbo-typecheck-manifests.test.ts
```

## 风险与处理

- 部署仍依赖独立 worker 进程：迁移前确认部署脚本、PM2/systemd/docker/k8s 入口是否调用 `apps/worker/dist/main.js`；如确需分进程，改走方案 B。
- 后台队列消费停止：用 bootstrap 测试验证 `runtimeBackground.enabled=true` 时会启动 loop；用 helper 测试覆盖 queued task acquire、lease heartbeat、failure marking 和 release。
- 文档继续指向旧入口：围绕 `apps/worker`、`@agent/worker`、`独立 worker`、`backend/worker`、`worker-overview` 做 docs 与 README 扫描。
- 治理脚本漏改：迁移后必须跑 `pnpm check:docs`、相关 vitest 脚本测试和 backend typecheck。

## 完成条件

- `apps/worker` 目录已删除。
- `pnpm-lock.yaml` 不再包含 `apps/worker` importer。
- 根 README、docs、CI、governance scripts 不再把 `apps/worker` 当作当前入口。
- agent-server background runner 测试覆盖原 worker loop 核心行为。
- 受影响验证通过，或明确记录与本轮无关的 blocker。
