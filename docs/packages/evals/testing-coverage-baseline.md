# 测试覆盖率基线

状态：snapshot
文档类型：baseline
适用范围：`packages/*`、`apps/backend/agent-server`、`apps/frontend/*`
最后核对：2026-04-15

说明：这是 `2026-04-02` 的覆盖率快照，用于回看当时的门槛与缺口，不代表当前实时覆盖率。

生成时间：`2026-04-02 18:52:56 CST`
命令：`pnpm test:coverage`

说明：

- 本次 coverage 数据已成功生成并写入 `coverage/vitest/coverage-summary.json`
- `pnpm test:coverage` 最终返回非零，原因有两类：
  - 全仓与项目级 threshold 仍未达标
  - 另有一个独立失败用例：`packages/config/test/settings.test.ts` 的“每日技术情报简报配置与 env override”

快照中的 4 个门槛项目基线：

| 项目                                      |  Lines | Statements | Functions | Branches |
| ----------------------------------------- | -----: | ---------: | --------: | -------: |
| `packages/agent-core`（已删除，历史快照） | 80.71% |     80.56% |    83.11% |   65.58% |
| `apps/backend/agent-server`               | 78.06% |     77.49% |    82.05% |   64.64% |
| `apps/frontend/agent-chat`                | 70.97% |     69.94% |    73.62% |   56.13% |
| `apps/frontend/agent-admin`               | 64.26% |     64.95% |    57.31% |   48.98% |

当前全仓基线：

- `lines`: `75.06%`
- `statements`: `74.57%`
- `functions`: `76.01%`
- `branches`: `60.39%`

## 快照中的 Top 10 Branch 缺口

- `apps/backend/agent-server/src/runtime/skills/skill-artifact-fetcher.ts` `0.00%`
- `apps/backend/agent-server/src/runtime/runtime.service.helpers.ts` `3.44%`
- `apps/backend/agent-server/src/runtime/skills/runtime-skill-install.service.ts` `3.84%`
- `apps/backend/agent-server/src/runtime/centers/runtime-learning-evidence-center.evidence.ts` `15.78%`
- `apps/backend/agent-server/src/runtime/actions/runtime-connector-governance-actions.ts` `20.00%`
- `apps/frontend/agent-admin/src/pages/connectors-center/connector-card.tsx` `0.00%`
- `apps/frontend/agent-admin/src/pages/connectors-center/connectors-center-summary.tsx` `0.00%`
- `apps/frontend/agent-admin/src/pages/connectors-center/connector-card-primitives.tsx` `0.00%`
- `apps/frontend/agent-chat/src/components/chat-message-cards/skill-suggestions-meta.ts` `25.00%`
- `packages/agent-core/src/graphs/recovery.graph.ts` `0.00%`（已删除包的历史快照）

## 四个门槛项目各自快照 branch 最低前 3

### `packages/agent-core`（已删除，历史快照）

- `graphs/recovery.graph.ts` `0.00%`
- `flows/chat/base-agent.ts` `32.25%`
- `graphs/main/main-graph-execution-helpers.ts` `34.37%`

### `apps/backend/agent-server`

- `runtime/skills/skill-artifact-fetcher.ts` `0.00%`
- `runtime/runtime.service.helpers.ts` `3.44%`
- `runtime/skills/runtime-skill-install.service.ts` `3.84%`

### `apps/frontend/agent-chat`

- `components/chat-message-cards/skill-suggestions-meta.ts` `25.00%`
- `hooks/chat-session/chat-session-formatters.ts` `30.76%`
- `features/runtime-panel/chat-runtime-drawer-cards.tsx` `35.07%`

### `apps/frontend/agent-admin`

- `features/connectors-center/connector-card.tsx` `0.00%`
- `features/connectors-center/connectors-center-summary.tsx` `0.00%`
- `features/connectors-center/connector-card-primitives.tsx` `0.00%`

## 本轮已收口的高收益缺口

- `apps/frontend/agent-chat/src/hooks/use-chat-session.ts`
- `apps/frontend/agent-admin/src/hooks/use-admin-dashboard.ts`
- `apps/backend/agent-server/src/runtime/centers/runtime-centers-governance.service.ts`
- `apps/backend/agent-server/src/runtime/core/runtime-provider-factories.ts`
- `apps/backend/agent-server/src/platform/platform.controller.ts`
- `apps/backend/agent-server/src/memory/memory.controller.ts`
- `apps/frontend/agent-chat/src/api/chat-api.ts`
- `apps/frontend/agent-chat/src/components/chat-message-cards/plan-question-card.tsx`
- `apps/frontend/agent-chat/src/components/chat-message-cards/card-meta.ts`
- `apps/frontend/agent-admin/src/pages/runtime-overview/components/runtime-summary-section.tsx`
- `apps/frontend/agent-admin/src/components/ui/chart.tsx`
- `apps/frontend/agent-admin/src/pages/connectors-center/connectors-center-panel.tsx`
- `packages/agent-core/src/adapters/llm/chat-model-factory.ts`
- `packages/agent-core/src/adapters/llm/zhipu-provider.ts`
- `agents/supervisor/src/flows/supervisor/nodes/supervisor-plan-node.ts`
- `packages/runtime/src/watchdog/execution-watchdog.ts`

## 下一轮建议优先级

1. `apps/backend/agent-server`
   - `runtime/skills/skill-artifact-fetcher.ts`
   - `runtime/runtime.service.helpers.ts`
   - `runtime/skills/runtime-skill-install.service.ts`
   - `runtime/centers/runtime-learning-evidence-center.evidence.ts`
2. `packages/agent-core`
   - `graphs/recovery.graph.ts`
   - `flows/chat/base-agent.ts`
   - `graphs/main/main-graph-execution-helpers.ts`
   - `graphs/main/main-graph-learning-jobs.ts`
3. `apps/frontend/agent-admin`
   - `features/connectors-center/connector-card.tsx`
   - `features/connectors-center/connectors-center-summary.tsx`
   - `features/connectors-center/connector-card-primitives.tsx`
4. `apps/frontend/agent-chat`
   - `components/chat-message-cards/skill-suggestions-meta.ts`
   - `hooks/chat-session/chat-session-formatters.ts`
   - `features/runtime-panel/chat-runtime-drawer-cards.tsx`
