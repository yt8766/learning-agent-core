# Run Observatory

状态：current
文档类型：reference
适用范围：`apps/backend/agent-server/src/runtime/centers`
最后核对：2026-04-19

本文记录当前 `Execution Observatory` 在 backend 的真实落位。

## 1. 宿主

当前 run observability 没有新建 workspace 包，仍沿现有宿主收敛：

- stable contract：`packages/core`
- projection helper：`packages/runtime/src/runtime-observability`
- backend query facade：`apps/backend/agent-server/src/runtime/centers/runtime-centers-query.service.ts`
- HTTP 入口：`apps/backend/agent-server/src/platform/runtime-center.controller.ts`

## 2. 当前接口

- `GET /platform/run-observatory`
- `GET /platform/run-observatory/:taskId`

list 接口当前支持：

- `status`
- `model`
- `pricingSource`
- `executionMode`
- `interactionKind`
- `q`
- `hasInterrupt`
- `hasFallback`
- `hasRecoverableCheckpoint`

当前 query facade 会：

1. 从 `orchestrator.listTasks()` 定位 task
2. 如果 task 绑定了 `sessionId`，则读取 latest checkpoint
3. 调用 `@agent/runtime` 的 `buildRunBundle(...)`
4. 返回统一的 `RunBundleRecord`

detail projection 当前还会补一层轻量关联语义：

- interrupt 关联最近的 checkpoint / trace span
- recoverable failure 诊断关联 latest recoverable checkpoint
- evidence 关联最近的 checkpoint / trace span

## 3. 当前边界

第一阶段刻意不把 projection 写进 controller，也不在 backend 重写第二套 trace 归一逻辑。

当前边界固定为：

- `packages/runtime`
  - 负责 canonical stage 归一
  - 负责 trace / checkpoint / diagnostics projection
- backend centers facade
  - 只负责 query、查找 task、接 checkpoint、暴露 HTTP

## 4. 当前限制

- 目前只实现基础 run list + detail，没有 compare / export 等二阶能力
- checkpoint 当前只投影 latest summary
- diagnostics 当前以后端 projection 为主，不做额外的 persisted diagnosis cache

## 5. 相关文件

- [runtime-centers-query.service.ts](/Users/dev/Desktop/learning-agent-core/apps/backend/agent-server/src/runtime/centers/runtime-centers-query.service.ts:1)
- [runtime-center.controller.ts](/Users/dev/Desktop/learning-agent-core/apps/backend/agent-server/src/platform/runtime-center.controller.ts:1)
- [packages/runtime/src/runtime-observability/index.ts](/Users/dev/Desktop/learning-agent-core/packages/runtime/src/runtime-observability/index.ts:1)
