# 本地联调指南

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
  - 记忆、规则、学习沉淀数据
- `data/runtime`
  - runtime state、task queue、learning jobs、pending executions
- `data/logs`
  - 运行日志、排错日志
- `data/sessions`
  - 聊天会话、消息、事件、checkpoint 快照
- `data/learning`
  - 学习产物、研究来源抓取副产物、候选沉淀材料

建议：

- 不要把临时调试输出混写进 `data/runtime`
- learning 与 memory 的人工清理前，优先先看 runtime center / learning center 是否仍引用
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
pnpm exec tsc -p packages/shared/tsconfig.json --noEmit
pnpm exec tsc -p packages/agent-core/tsconfig.json --noEmit
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm exec tsc -p apps/worker/tsconfig.json --noEmit
pnpm exec tsc -p apps/frontend/agent-chat/tsconfig.app.json --noEmit
pnpm exec tsc -p apps/frontend/agent-admin/tsconfig.app.json --noEmit
```
