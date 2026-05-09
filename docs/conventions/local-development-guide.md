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
pnpm start:dev
RUNTIME_BACKGROUND_ENABLED=true pnpm --dir apps/backend/agent-server start:dev
pnpm --dir apps/frontend/agent-chat dev
pnpm --dir apps/frontend/agent-admin dev
```

`pnpm start:dev` 会先执行一次根级 `build:lib`，再通过 Turbo filter 启动 unified backend：

- `agent-server`：`http://127.0.0.1:3000/api`

`auth-server` 与 `knowledge-server` standalone 后端已经删除；本地联调不要再配置 `3010` 或 `3020`。

`apps/backend/agent-server` 是当前唯一官方后台消费入口；它通过 runtime bootstrap 启动内建 background runner，负责 queued task、learning job、lease reclaim、heartbeat 与 failure cleanup。

旧后台 worker 应用已退役，不再作为 workspace package、部署进程、验证入口或文档入口存在。不要新增旧 worker 包名依赖，也不要恢复旧 worker 应用目录。

## 2. Background Runner 模式

### 开发/单机模式

- backend：`RUNTIME_BACKGROUND_ENABLED=true`
- 后台消费：由 agent-server 内建 background runner 承担

推荐使用内建 background runner 验证：

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
- `ACTIVE_MODEL_PROVIDER`
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
- `MINIMAX_BASE_URL` 默认会回落到 `https://api.minimax.io/v1`；本地 `.env` 若仍写旧的 `https://api.minimaxi.com/v1`，MiniMax M2.x chat 可能返回 `invalid chat setting (2013)`
- 若只配置 `MINIMAX_API_KEY`，系统会自动注册 `minimax` provider，并默认带上：
  - `MiniMax-M2.7`
  - `MiniMax-M2.7-highspeed`
  - `MiniMax-M2.5`
  - `MiniMax-M2.5-highspeed`
  - `M2-her`
- `ACTIVE_MODEL_PROVIDER=zhipu|minimax` 可一键切换默认路由主模型：
  - `zhipu` 会把默认 `manager / research / executor / reviewer` 主路由指向 `zhipu/<roleModel>`
  - `minimax` 会把默认 `manager / research / executor / reviewer` 主路由指向 `minimax/<roleModel>`
  - runtime 的 `ModelRoutingPolicy` 会优先采用当前角色主路由，再回退到 worker registry 中的静态默认模型；因此 `ACTIVE_MODEL_PROVIDER=minimax` 生效后，supervisor / research / coder / reviewer 默认应分别走 MiniMax 的 manager / research / executor / reviewer 模型
  - 该开关只影响“未显式声明 `MODEL_ROUTE_*_PRIMARY` 时”的默认主路由
  - 若请求里显式传了 `modelId`，仍以本轮请求指定模型为准
  - 若某个 provider 未注册或没有对应 `roleModels`，系统会回退到默认 `zhipu/<roleModel>` 路由
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
- agent-server 内建 background runner 消费后推进到 `running`
- 成功时写为 `completed`
- 失败时写为 `failed`

## 5. 数据目录治理

运行时配置默认不再写仓库根级 `data/*`。`packages/config` 的内置默认值按 profile 显式落到
`profile-storage/<profile>/...`：

- `profile-storage/platform`
  - platform / cli 默认 profile 的 memory、runtime state、semantic cache、skills 与 knowledge
- `profile-storage/company`
  - company profile 的隔离存储
- `profile-storage/personal`
  - personal profile 的隔离存储

根级 `data/runtime`、`data/memory`、`data/knowledge`、`data/skills`、`data/browser-replays` 与
`data/generated` 只允许作为历史迁移输入或显式本地覆盖使用，不再作为生产/runtime 代码的新增默认写入目标。
如确需继续读取旧数据，应通过配置项、repository contract 或 provider 明确注入，不要把 root data 路径重新写回默认值。

建议：

- 不要把临时调试输出混写进 root `data/runtime`
- 清理 root `data/knowledge` 与 root `data/skills` 前，先确认是否仍有 legacy import / 本地覆盖在引用
- agent-server 内建 background runner 与 HTTP/API 侧共享同一份显式配置的 runtime state 路径，默认路径为 `profile-storage/<profile>/runtime/tasks-state.json`
- 修改运行时持久化路径后，执行 `pnpm check:no-root-data-runtime` 查看是否仍有生产/runtime root data 写入命中

## 6. 常见排查

### 会话一直 loading

优先检查：

- `/api/chat/stream` 是否正常建立
- `checkpoint` 是否已经进入终态
- backend 是否仍在写旧 detail snapshot 覆盖更新流式状态

### 后台任务不消费

优先检查：

- backend 是否启用了 `RUNTIME_BACKGROUND_ENABLED`
- agent-server runtime bootstrap 是否已启动内建 background runner
- `runnerIdPrefix` 是否符合预期
- 显式配置的 runtime state 路径是否被 agent-server API 与内建 background runner 共用

### learning job 一直 queued

优先检查：

- agent-server 内建 background runner 是否正在执行 `processQueuedLearningJobs`
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
pnpm exec vitest run apps/backend/agent-server/test/runtime/helpers/runtime-background-runner.test.ts apps/backend/agent-server/test/runtime/services/runtime-bootstrap.service.spec.ts
pnpm exec tsc -p apps/frontend/agent-chat/tsconfig.app.json --noEmit
pnpm exec tsc -p apps/frontend/agent-admin/tsconfig.app.json --noEmit
```
