# 测试覆盖率基线

状态：snapshot
文档类型：baseline
适用范围：`packages/*`、`apps/backend/agent-server`、`apps/frontend/*`
最后核对：2026-05-10

说明：这是 `2026-05-10` 的覆盖率快照，在校准 coverage include/exclude 规则后生成，用于反映 post-testing-coverage-85 基线。

生成时间：`2026-05-10`
命令：`pnpm test:coverage`

说明：

- 本次 coverage 数据已成功生成并写入 `artifacts/coverage/vitest/coverage-summary.json`
- `pnpm test:coverage` 最终返回非零，原因是全仓与项目级 threshold 仍未达标
- coverage exclude 规则已校准：只排除非运行时文件（纯类型文件、barrel-only 入口、前端 bootstrap 入口、模板 starter 示例）
- 不排除包含运行时业务逻辑的文件（schema、adapter、facade、repository、controller、service、graph node、runtime policy）

## 当前有效门槛项目基线

| 项目                        |  Lines | Statements | Functions | Branches |
| --------------------------- | -----: | ---------: | --------: | -------: |
| `packages/runtime`          | 59.97% |     60.10% |    61.04% |   55.39% |
| `apps/backend/agent-server` | 85.00% |     85.00% |    85.00% |   72.40% |
| `apps/frontend/agent-chat`  | 77.49% |     76.77% |    79.09% |   68.15% |
| `apps/frontend/agent-admin` | 71.36% |     71.08% |    71.45% |   60.34% |
| `apps/frontend/knowledge`   | 70.96% |     70.33% |    66.72% |   61.93% |

当前全仓基线：

- `lines`: `73.95%`
- `statements`: `73.46%`
- `functions`: `75.52%`
- `branches`: `62.06%`

## Top Gap Scopes (from `pnpm coverage:gaps`)

### `packages/runtime/src/` (lines 59.97%)

Top 0%-coverage files:

- `agents/base-agent.ts`
- `agents/planner-strategy.ts`
- `capabilities/capability-pool-bootstrap.ts`
- `flows/approval/research-skill-interruption.ts`
- `flows/approval/bootstrap/task-bootstrap-interrupt-nodes.ts`
- `flows/chat/direct-reply/direct-reply-interrupt-nodes.ts`
- `flows/learning/nodes/learning-candidate-confirmation.ts`
- `flows/review-stage/review-stage-nodes.ts`
- `flows/runtime-stage/runtime-stage-execution-resume.ts`
- `flows/runtime-stage/runtime-stage-execution.ts`
- `flows/runtime-stage/runtime-stage-research.ts`
- `graphs/main/execution/orchestration/pipeline/main-graph-pipeline-orchestrator.ts`
- `graphs/main/execution/pipeline/main-graph-pipeline-graph.ts`
- `graphs/main/runtime/lifecycle/approval/main-graph-lifecycle-approval-action.ts`
- `graphs/main/tasking/factory/task-record-builder.ts`
- `graphs/main/tasking/factory/task-skill-intervention.ts`
- `runtime/model-invocation/postprocessors/output-finalize-postprocessor.ts`
- `session/coordinator/session-coordinator-learning.ts`

### `apps/backend/agent-server/src/` (lines 85.00%, branches 72.40%)

Top gap files:

- `main.ts` (0%)
- `runtime/domain/observability/runtime-platform-console-log-analysis.ts` (0%)
- `runtime/intelligence/intelligence-memory.repository.ts` (0%)
- `workflow-runs/repositories/workflow-run.repository.ts` (11.11%)
- `domains/knowledge/runtime/knowledge-database.provider.ts` (0%)
- `infrastructure/external-process/skills-cli-runner.ts` (0%)
- `runtime/centers/runtime-learning-evidence-center.summary.ts` (0%)
- `domains/agent-gateway/quotas/agent-gateway-api-call.service.ts` (46.15%)
- `domains/knowledge/services/knowledge-document.service.ts` (52.23%)
- `runtime/domain/skills/runtime-skill-runtime-resolvers.ts` (37.50%)
- `domains/agent-gateway/auth-files/agent-gateway-auth-file-management.service.ts` (52.83%)
- `domains/agent-gateway/logs/agent-gateway-log.service.ts` (47.61%)
- `admin-auth/admin-auth.errors.ts` (59.09%)
- `workflow-runs/workflow-runs.service.ts` (65.71%)
- `domains/knowledge/rag/knowledge-rag-sdk.providers.ts` (48.61%)
- `runtime/core/runtime-workflow-execution-facade.ts` (58.33%)
- `api/knowledge/knowledge.controller.ts` (60.18%)
- `api/agent-gateway/agent-gateway-clients.controller.ts` (72.00%)
- `runtime/core/runtime.host.ts` (71.15%)

### `apps/frontend/agent-chat/src/` (lines 77.49%)

Top gap files:

- `components/search-results-drawer.tsx` (0%)
- `pages/chat-home/chat-memory-feedback-strip.tsx` (18.29%)
- `components/icons.tsx` (0%)
- `hooks/chat-session/chat-session-approval-actions.ts` (41.93%)
- `chat-runtime/agent-chat-session-provider.ts` (33.57%)
- `hooks/chat-session/use-chat-view-stream.ts` (40.42%)
- `pages/chat-home/chat-home-sidebar.tsx` (40.74%)
- `utils/map-thought-chain-to-projection.tsx` (48.14%)
- `hooks/chat-session/chat-session-skill-install-actions.ts` (48.78%)
- `components/chat-message-cards/approval-request-card.tsx` (64.70%)
- `hooks/chat-session/chat-session-formatters.ts` (56.52%)
- `pages/chat-home/chat-home-conversation.tsx` (63.33%)
- `pages/chat-home/chat-home-page.tsx` (59.78%)
- `components/chat-response-steps/agent-os-step-item.tsx` (52.94%)
- `hooks/chat-session/chat-session-lifecycle-actions.ts` (68.75%)
- `pages/chat-home/chat-memory-chips.tsx` (62.50%)
- `utils/agent-chat-debug.ts` (63.15%)
- `hooks/chat-session/use-chat-session-actions.ts` (67.63%)
- `hooks/chat-session/chat-session-action-utils.ts` (58.53%)
- `pages/chat-home/chat-home-mission-control.tsx` (78.57%)

### `apps/frontend/agent-admin/src/` (lines 71.36%)

Top gap files:

- `pages/company-agents/company-live-bundle-result.tsx` (0%)
- `pages/runtime-overview/components/runtime-workflow-catalog-card.tsx` (0%)
- `pages/workflow-lab/WorkflowLabPage.tsx` (0%)
- `pages/workflow-lab/components/NodeDetailPanel.tsx` (0%)
- `pages/workflow-lab/components/NodeTimeline.tsx` (0%)
- `pages/workflow-lab/components/NodeTimelinePanel.tsx` (0%)
- `pages/workflow-lab/components/RunHistoryList.tsx` (0%)
- `pages/workflow-lab/components/WorkflowList.tsx` (0%)
- `pages/workflow-lab/components/WorkflowRunForm.tsx` (0%)
- `pages/company-agents/company-live-expert-consult-result.tsx` (16.66%)
- `pages/learning-center/memory-governance-tools-card.tsx` (12.04%)
- `pages/learning-center/profile-center-panel.tsx` (17.50%)
- `pages/learning-center/memory-resolution-queue-card.tsx` (20.00%)
- `pages/company-agents/company-live-node-trace.tsx` (40.00%)
- `pages/runtime-overview/components/runtime-agent-graph-overlay-card.tsx` (25.00%)
- `pages/company-agents/company-live-expert-consult-form.tsx` (29.62%)
- `pages/dashboard/dashboard-center-lazy-registry.tsx` (22.22%)
- `app/app.tsx` (0%)
- `components/ui/scroll-area.tsx` (0%)
- `hooks/admin-dashboard/admin-dashboard-actions.ts` (0%)

### `apps/frontend/knowledge/src/` (lines 70.96%)

Top gap files:

- `pages/account/account-settings-page.tsx` (0%)
- `pages/documents/document-upload-panel.tsx` (0%)
- `pages/knowledge-bases/knowledge-base-detail-page.tsx` (0%)
- `pages/settings/settings-keys-page.tsx` (0%)
- `pages/settings/settings-security-page.tsx` (0%)
- `pages/users/users-page.tsx` (0%)
- `pages/agent-flow/agent-flow-node.tsx` (16.66%)
- `pages/chat-lab/chat-lab-sidebar.tsx` (23.07%)
- `pages/settings/settings-models-page.tsx` (0%)
- `pages/settings/settings-storage-page.tsx` (0%)
- `app/layout/app-shell.tsx` (35.71%)
- `pages/overview/knowledge-overview-chart.tsx` (33.33%)
- `hooks/use-document-detail.ts` (51.16%)
- `pages/overview/overview-page.tsx` (80.00%)
- `pages/settings/settings-page.tsx` (50.00%)
- `pages/auth/auth-provider.tsx` (51.61%)
- `pages/chat-lab/chat-lab-messages.tsx` (56.00%)
- `chat-runtime/knowledge-chat-actions.ts` (50.00%)
- `hooks/use-knowledge-observability.ts` (66.66%)
- `pages/agent-flow/agent-flow-properties-panel.tsx` (66.66%)

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
- `agents/supervisor/src/flows/supervisor/nodes/supervisor-plan-node.ts`
- `packages/runtime/src/watchdog/execution-watchdog.ts`

## 下一轮建议优先级

1. `packages/runtime` -- flows, capabilities, agents (18 files at 0%)
2. `apps/backend/agent-server` -- controllers, repositories, infrastructure (6 files at 0%)
3. `apps/frontend/agent-admin` -- workflow-lab, learning-center, company-agents (14 files at 0%)
4. `apps/frontend/agent-chat` -- chat-home, cognition, search (4 files at 0%)
5. `apps/frontend/knowledge` -- pages, hooks (7 files at 0%)

## 验证结果

### pnpm verify:affected

通过。所有受影响范围的验证命令均成功执行。

### pnpm verify

因外部阻塞失败。失败原因：`packages/platform-runtime/demo/contract.ts` 无法找到模块 `./modules/types.js`（来自 `@langchain/langgraph-checkpoint-postgres`）。这是依赖问题，与覆盖率工作无关。

### pnpm test:coverage

返回非零。覆盖率仍未达到 85% 门槛。当前全仓基线：

- lines: 73.93% (目标 85%)
- statements: 73.44% (目标 85%)
- functions: 75.51% (目标 85%)
- branches: 62.05% (目标 85%)

### pnpm coverage:gaps

已执行。详见上方 Top Gap Scopes 部分。

## 结论

覆盖率工作已取得显著进展，但尚未达到 85% 的目标门槛。主要差距在于：

1. `packages/runtime` 覆盖率仍然较低（lines 59.97%），需要继续补充测试
2. 前端应用覆盖率普遍在 70-78% 之间，需要继续补充组件和 hook 测试
3. 后端 branches 覆盖率（72.40%）需要进一步提升

建议继续按照下一轮优先级补充测试，直到达到 85% 的目标门槛。
