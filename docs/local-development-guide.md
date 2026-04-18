# 本地联调指南

状态：current
文档类型：guide
适用范围：本地开发与联调
最后核对：2026-04-16

## 1. 推荐启动顺序

先构建共享包：

```bash
pnpm build:lib
```

再按以下顺序启动：

```bash
pnpm --dir apps/backend/agent-server start:dev
pnpm --dir apps/worker build && node apps/worker/dist/main.js
pnpm --dir apps/frontend/agent-chat dev
pnpm --dir apps/frontend/agent-admin dev
```

如果只想单机验证，不单独启动 worker，也可以让 backend 使用内建 background runner。

## 2. Background Runner 模式

### 开发/单机模式

- backend：`RUNTIME_BACKGROUND_ENABLED=true`
- worker：可不启动

### 独立 worker 模式

- backend：`RUNTIME_BACKGROUND_ENABLED=false`
- worker：正常启动

推荐独立 worker 模式用于验证：

- queued background tasks
- learning jobs
- interrupt timeout sweep
- learning queue / conflict scan

## 3. 关键环境变量

- `ZHIPU_API_KEY`
- `ZHIPU_API_BASE_URL`
- `MINIMAX_API_KEY`
- `MINIMAX_BASE_URL`
- `MINIMAX_MANAGER_MODEL`
- `MINIMAX_RESEARCH_MODEL`
- `MINIMAX_EXECUTOR_MODEL`
- `MINIMAX_REVIEWER_MODEL`
- `MINIMAX_DIALOG_MODEL`
- `KNOWLEDGE_EMBEDDING_ENDPOINT`
- `MCP_BIGMODEL_WEB_SEARCH_ENDPOINT`
- `MCP_BIGMODEL_WEB_READER_ENDPOINT`
- `MCP_BIGMODEL_ZREAD_ENDPOINT`
- `PORT`
- `RUNTIME_BACKGROUND_ENABLED`
- `RUNTIME_BACKGROUND_WORKER_POOL_SIZE`
- `RUNTIME_BACKGROUND_LEASE_TTL_MS`
- `RUNTIME_BACKGROUND_HEARTBEAT_MS`
- `RUNTIME_BACKGROUND_POLL_MS`
- `RUNTIME_BACKGROUND_RUNNER_ID_PREFIX`
- `MCP_RESEARCH_HTTP_ENDPOINT`
- `MCP_RESEARCH_HTTP_API_KEY`

最小建议：

- 未配置模型 key 时，direct-reply 与研究能力会退化
- `ZHIPU_API_BASE_URL` 不再有代码默认值，本地联调必须通过 `.env` 或显式 overrides 提供
- `MINIMAX_BASE_URL` 默认会回落到 `https://api.minimaxi.com/v1`
- 若只配置 `MINIMAX_API_KEY`，系统会自动注册 `minimax` provider，并默认带上：
  - `MiniMax-M2.7`
  - `MiniMax-M2.7-highspeed`
  - `MiniMax-M2.5`
  - `MiniMax-M2.5-highspeed`
  - `M2-her`
- `minimax` 现在会通过独立的 `MiniMaxProvider` 适配器注册，再由路由层按 `minimax/<modelId>` 选择具体模型；provider 内部直接调用 `@agent/adapters` 的 `createMiniMaxChatModel(...)`
- embedding 与 BigModel MCP endpoints 也不再有代码默认值，需要通过 `.env` 显式提供
- 未配置 research MCP endpoint 时，研究来源会退回本地或 sandbox 能力

## 4. 任务与学习状态机

### TaskRecord

统一按以下主状态理解：

- `queued`
- `running`
- `waiting_approval`
- `failed`
- `completed`

兼容状态如 `cancelled`、`blocked` 仍存在，但新的后台执行与治理解释应优先围绕上述主状态机收口。

### LearningJob

学习任务统一按异步状态机理解：

- `queued`
- `running`
- `completed`
- `failed`

当前约定：

- 创建 document/research learning job 时先进入 `queued`
- background runner 或独立 worker 消费后推进到 `running`
- 成功时写为 `completed`
- 失败时写为 `failed`

## 5. 数据目录治理

仓库下 `data/*` 目录默认按以下边界理解：

- `data/memory`
  - 记忆、规则和运行时可复用沉淀
- `data/runtime`
  - runtime state、任务状态、briefings、schedules 等运行态数据
- `data/knowledge`
  - 受控知识源、catalog、chunks、ingestion、vectors 产物
- `data/skill-runtime`
  - 运行时技能安装区、稳定区、实验区和安装回执

建议：

- 不要把临时调试输出混写进 `data/runtime`
- 清理 `data/knowledge` 与 `data/skill-runtime` 前，先确认 runtime / learning / skill lab 是否仍在引用
- 当切换 runner 模式时，backend 与 worker 应共享同一份 `data/runtime/tasks-state.json`

## 6. 常见排查

### 会话一直 loading

优先检查：

- `/api/chat/stream` 是否正常建立
- `checkpoint` 是否已经进入终态
- backend 是否仍在写旧 detail snapshot 覆盖更新流式状态

### 后台任务不消费

优先检查：

- backend 是否关闭了 `RUNTIME_BACKGROUND_ENABLED`
- worker 是否已启动
- `runnerIdPrefix` 是否符合预期
- `data/runtime/tasks-state.json` 是否被 backend 和 worker 共用

### learning job 一直 queued

优先检查：

- background runner / worker 是否正在执行 `processQueuedLearningJobs`
- MCP/provider 是否可用
- runtime state 持久化是否成功

## 7. 最低验证

```bash
pnpm check:terminology
pnpm test
pnpm test:integration
pnpm exec tsc -p packages/config/tsconfig.json --noEmit
pnpm exec tsc -p packages/runtime/tsconfig.json --noEmit
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm exec tsc -p apps/worker/tsconfig.json --noEmit
pnpm exec tsc -p apps/frontend/agent-chat/tsconfig.app.json --noEmit
pnpm exec tsc -p apps/frontend/agent-admin/tsconfig.app.json --noEmit
```
