# `agent-server`

`agent-server` 是平台主 API 服务，负责：

- chat 会话与 `/api/chat/stream` SSE 推流
- runtime / approvals / learning / evidence / connectors 治理接口
- 任务创建、审批、恢复、学习确认
- 可选的内建 background runner

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

## 关键环境变量

- `PORT`
- `ZHIPU_API_KEY`
- `MCP_RESEARCH_HTTP_ENDPOINT`
- `MCP_RESEARCH_HTTP_API_KEY`
- 其他 provider 变量按实际接入启用

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
