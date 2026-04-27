# worker 概览

状态：current
文档类型：overview
适用范围：`apps/worker`
最后核对：2026-04-20

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
- 通过 `RuntimeHost` 同构 facade 以外的最小 worker context 驱动后台循环

长期边界：

- worker 是后台驱动适配器，不是第二个 backend
- worker 只加载 settings/profile、消费后台 job、调用 runtime facade、写回状态/事件/checkpoint
- worker 通过 `@agent/platform-runtime` 的 `createDefaultPlatformRuntimeOptions(...) + createDefaultPlatformRuntime(...)` 选择官方 runtime 装配方案
- worker 默认通过 `runtime/worker-runtime.ts` 里的 `createWorkerRuntimeHost()` 持有 `PlatformRuntimeFacade`，再从中消费 `runtime + background runner context`；不要在 worker 内直接创建 `AgentRegistry`、`RuntimeAgentDependencies` 或重新拼官方 agent 组合
- worker 不直接依赖 `@agent/agents-*`，不自己拼官方 Agent graph
- worker 不暴露平台 controller、不内联 Agent prompt、不复制 backend runtime service
- worker 源码应保持为：
  - settings/profile 加载
  - platform runtime host 创建
  - background runner tick / worker slot / lease 协调
  - stop/shutdown 清理

当前已落地结构：

- `runtime/worker-runtime.ts`
  - `createWorkerRuntimeHost()`：worker 侧官方 runtime host
  - `startWorkerProcess()`：只负责启动/停止生命周期
  - worker 只补 `runtimeBackground` override，不再自己拼默认 `profile/workspaceRoot/llm provider`
- `runtime/background-runner.ts`
  - 负责后台 tick、queue/lease/heartbeat sweep 与 learning queue 消费
- worker 当前没有第二套 backend runtime service、没有单独的官方 registry wiring，也没有 Nest service/controller 形态的宿主逻辑

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

当前自动化边界：

- `apps/worker/test/worker-boundary.test.ts`
  - 阻止 worker 回退为 Nest service / controller 宿主
  - 阻止 worker 直接拼 `createOfficialRuntimeAgentDependencies()` 或 `createOfficialAgentRegistry()`
