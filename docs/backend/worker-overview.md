# worker 概览

状态：current
文档类型：overview
适用范围：`apps/worker`
最后核对：2026-04-15

本主题主文档：

- 本文是 `apps/worker` 的总体入口

本文只覆盖：

- worker 职责边界
- 启动与本地运行方式
- worker 最低验证路径

`apps/worker` 是独立 background worker 进程，不再运行 preview graph，而是消费真实后台任务。

当前职责：

- queued background task 消费
- lease / heartbeat 维护
- interrupt timeout sweep
- learning queue 处理
- learning conflict scan

## 启动

```bash
pnpm build:lib
pnpm --dir apps/worker build
node apps/worker/dist/main.js
```

## 建议运行方式

如果要把后台消费从 `agent-server` 分离：

- backend：`RUNTIME_BACKGROUND_ENABLED=false`
- worker：默认启用即可

worker 默认使用 `platform` profile，这样会和 `agent-server` 共享同一套 `data/runtime/tasks-state.json`。

## 本地验证

```bash
pnpm exec tsc -p apps/worker/tsconfig.json --noEmit
pnpm --dir apps/worker test
```
