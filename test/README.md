# test/

Workspace-level test host for the `learning-agent-core` monorepo.

设计文档：[docs/evals/workspace-test-host-design.md](/docs/evals/workspace-test-host-design.md)

## 职责

本目录是仓库级（workspace-level）测试宿主，只承载两类内容：

| 目录           | 职责                                     |
| -------------- | ---------------------------------------- |
| `integration/` | 跨包、跨宿主、跨链路的 integration 测试  |
| `smoke/`       | 仓库级最小可运行闭环（workspace smoke）  |
| `shared/`      | 仅限测试的共享 fixture、builder、matcher |

## 命名约定

- integration 测试文件：`*.int-spec.ts`
- smoke 测试文件：`*.smoke.ts`
- acceptance 测试文件（待引入）：`*.acc-spec.ts`

## 禁止事项

- ❌ 不放纯单包单函数 unit 测试 → 放到 `packages/*/test`
- ❌ 不放纯 schema parse 回归 → 放到宿主内 `test/`
- ❌ 不放仅验证单一宿主的 integration → 放到该宿主 `test/`
- ❌ 不复制生产逻辑到 shared/helpers → helpers 只做测试装配
- ❌ 不依赖高脆弱外部服务，必须依赖时加显式 skip/guard

## 与宿主内 `test/` 的区别

```
packages/*/test     宿主内 unit / spec / integration
agents/*/test       宿主内 unit / spec / integration
apps/*/test         应用内 unit / integration
test/integration    仓库级跨包跨宿主 integration  ← 本目录
test/smoke          仓库级最小可运行闭环           ← 本目录
```

## 当前矩阵

Workspace integration 当前覆盖：

- `test/integration/backend/chat-sse-controller.int-spec.ts`：backend chat SSE controller、历史事件过滤与 live token 交付
- `test/integration/frontend-backend/sse-payload-contract.int-spec.ts`：前后端 SSE payload canonical schema
- `test/integration/frontend-backend/chat-session-stream-merge.int-spec.ts`：前端流式消息合并、停流与 checkpoint 状态
- `test/integration/packages/core-to-runtime-contract.int-spec.ts`：core contract 到 runtime consumer
- `test/integration/packages/platform-runtime-agent-assembly.int-spec.ts`：platform-runtime 官方 agent 装配
- `test/integration/runtime/runtime-main-chain.int-spec.ts`：runtime 主链 contract 与出口一致性
- `test/integration/runtime/runtime-graph-execution.int-spec.ts`：runtime graph 最小执行闭环
- `test/integration/runtime/approval-recover-contract.int-spec.ts`：approval / recover contract
- `test/integration/runtime/approval-recover-state-machine.int-spec.ts`：approval recover 状态迁移
- `test/integration/runtime/learning-confirmation.int-spec.ts`：learning confirmation、memory、evidence 协同 contract

Workspace smoke 当前覆盖：

- `test/smoke/backend/backend-startup.smoke.ts`：backend health 与 SSE header contract
- `test/smoke/backend/backend-module.smoke.ts`：backend Nest module 元数据与 runtime export surface
- `test/smoke/apps/agent-chat-workspace.smoke.ts`：agent-chat OpenClaw workspace support helpers
- `test/smoke/apps/agent-admin-dashboard.smoke.ts`：agent-admin 六大治理中心入口
- `test/smoke/packages/package-public-entrypoints.smoke.ts`：关键 package 根出口与 package demo coverage
