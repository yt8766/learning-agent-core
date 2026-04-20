# platform-runtime-boundary 重构记录

状态：completed
文档类型：history
适用范围：packages/runtime, apps/frontend, apps/backend
最后核对：2026-04-21
分支：`chore/platform-runtime-boundary`
完成日期：2026-04-20（初始）/ 2026-04-21（深度重构 Phase 1-5）

## 改动概述

本轮在 `chore/platform-runtime-boundary` 分支上完成了两个批次的提交：

### Commit 1: `f07424ac` — 平台-运行时边界收敛

94 个文件变更，涵盖：

- `packages/platform-runtime` 官方组合根落地
- `packages/agent-kit` 通用 Agent descriptor/registry contract 下沉
- runtime dependency wiring 对齐
- 前后端消费路径统一收口到 `@agent/*` 公开入口
- 测试修复（`resolveWorkflowPreset` mock、`vi.mock` importOriginal 模式）

### Commit 2: `4ff110cb` — 超限生产文件拆分

14 个文件变更，将 7 个超过 400 行的生产源码文件拆分至阈值以下：

| 原文件                                                                        | 原行数 | 拆分后 | 提取文件                                    |
| ----------------------------------------------------------------------------- | ------ | ------ | ------------------------------------------- |
| `packages/tools/src/registry/tool-registry.ts`                                | 477    | 99     | `definitions/knowledge-tool-definitions.ts` |
| `packages/runtime/src/session/session-coordinator-compression.ts`             | 491    | 245    | `session-compression-helpers.ts`            |
| `packages/runtime/src/session/session-coordinator-sync.ts`                    | 477    | 315    | `session-coordinator-sync-helpers.ts`       |
| `packages/memory/src/repositories/memory-repository.ts`                       | 424    | 388    | `memory-repository.types.ts`                |
| `packages/runtime/src/session/session-coordinator-thinking-helpers.ts`        | 409    | 279    | `session-thinking-resolvers.ts`             |
| `packages/tools/src/approval/approval-service.ts`                             | 403    | 367    | `approval-service.types.ts`                 |
| `packages/runtime/src/graphs/main/tasking/context/main-graph-task-context.ts` | 402    | 384    | `main-graph-task-context.types.ts`          |

所有原文件通过 re-export 保持向后兼容，外部消费者无需修改 import 路径。

## 验证结果

- TypeScript：runtime / memory / tools / backend 四个 tsconfig 全部 `--noEmit` 通过
- ESLint：0 warnings
- Prettier：全量格式检查通过
- Barrel layout：`pnpm check:barrel-layout` 通过
- Spec tests：113/113 通过
- Demo tests：13 projects × 3 layers 全部通过
- Pre-commit staged tests：369/369 通过

### Commit 3: `4512fea6` — 文档更新

3 个文件变更，同步文档。

### Commit 4: `f926689e` — 前端超限文件拆分 + 边界违规修复

15 个文件变更，将 3 个前端超限文件拆分：

| 原文件                                                                                  | 原行数 | 拆分后 | 提取文件                                  |
| --------------------------------------------------------------------------------------- | ------ | ------ | ----------------------------------------- |
| `agent-admin/src/hooks/admin-dashboard/admin-dashboard-actions.ts`                      | 550    | 320    | `admin-dashboard-actions.types.ts`        |
| `agent-admin/src/features/runtime-overview/components/runtime-run-workbench-support.ts` | 430    | 260    | `runtime-run-workbench-support.types.ts`  |
| `agent-server/src/runtime/domain/data-report/runtime-data-report-facade.ts`             | 410    | 380    | 边界修复：DI 注入 `resolveWorkflowPreset` |

### Commit 5: `c2393de9` — P2 清理

删除空 `store/.gitkeep` 占位目录。

### Commit 6: `5d155a7b` — 前端超限文件深度拆分（Phase 2）

17 个文件变更，将 8 个 >400 行前端生产文件全部拆至阈值以下：

| 原文件                                    | 原行数 | 拆分后 | 提取文件                                                                                                  |
| ----------------------------------------- | ------ | ------ | --------------------------------------------------------------------------------------------------------- |
| `use-chat-session-actions.ts`             | 579    | 295    | `chat-session-action-utils.ts` + `chat-session-approval-actions.ts` + `chat-session-lifecycle-actions.ts` |
| `runtime-run-workbench-card.tsx`          | 489    | 271    | `runtime-run-workbench-replay-draft.tsx`                                                                  |
| `admin-dashboard-mutation-actions.ts`     | 455    | 296    | `admin-dashboard-mutation-connector-actions.ts`                                                           |
| `learning-center-record-sections.tsx`     | 440    | 283    | `learning-center-record-candidate-sections.tsx`                                                           |
| `chat-home-workbench-section-renders.tsx` | 427    | 243    | `chat-home-workbench-cabinet-renders.tsx`                                                                 |
| `run-observatory-panel.tsx`               | 422    | 131    | `run-observatory-panel-cards.tsx`                                                                         |
| `use-admin-dashboard.ts`                  | 411    | 380    | `admin-dashboard-hash-sync.ts`                                                                            |
| `admin-dashboard-constants.ts`            | —      | —      | 导出 `ExecutionModeFilter` / `InteractionKindFilter` 类型                                                 |

拆分模式：

- 工厂函数模式（chat-session-actions, mutation-actions）
- 子组件提取模式（observatory-panel, workbench-card, learning-sections）
- Re-export 兼容模式（workbench-section-renders）

### Commit 7: `a11bd58b` — runtime 子域 barrel 索引

3 个文件变更：

- 新建 `packages/runtime/src/governance/index.ts` barrel
- 新建 `packages/runtime/src/contracts/index.ts` barrel
- 重构 `packages/runtime/src/index.ts` 从 barrel 导入

## 最终验证结果

- TypeScript：runtime / backend / agent-admin / agent-chat 全部 `--noEmit` 通过
- Vitest：403 test files, 1336 tests 全部通过
- Barrel layout：`pnpm check:barrel-layout` 通过
- Package boundaries：`pnpm check:package-boundaries` 通过
- 无生产源码文件超过 400 行（`packages/templates` 报表模板除外）

### Commit 9: `a1d7fd4c` — P0 高优先级 hooks/service 重构

11 个文件变更，完成 3 个 P0 级架构重构：

| 重构目标                                                        | 原行数 | 拆分后 | 提取文件                                            | 新增测试     |
| --------------------------------------------------------------- | ------ | ------ | --------------------------------------------------- | ------------ |
| `use-admin-dashboard.ts` — useReducer 替换 8 个 filter useState | 380    | 356    | `admin-dashboard-filter-state.ts` (74 行)           | 4 spec tests |
| `use-chat-session.ts` — 流式/轮询逻辑提取                       | 349    | 232    | `use-chat-session-stream-manager.ts` (180 行)       | 5 spec tests |
| `runtime-tech-briefing.service.ts` — processCategory 提取       | 382    | 290    | `runtime-tech-briefing-category-runner.ts` (107 行) | 3 spec tests |

验证：`pnpm verify` 9 阶段全绿（docs / prettier / eslint / typecheck / spec / unit / demo / integration / architecture）。
