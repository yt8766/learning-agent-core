# platform-runtime-boundary 重构记录

状态：completed
文档类型：history
适用范围：packages/runtime, apps/frontend, apps/backend
最后核对：2026-04-22
分支：`chore/platform-runtime-boundary`
完成日期：2026-04-20（初始）/ 2026-04-22（深度重构 Phase 1-5 + 近限文件拆分）

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

### Commit 9: `a1d7fd4c` — P0 高优先级 hooks/service 重构

11 个文件变更，完成 3 个 P0 级架构重构：

| 重构目标                                                        | 原行数 | 拆分后 | 提取文件                                            | 新增测试     |
| --------------------------------------------------------------- | ------ | ------ | --------------------------------------------------- | ------------ |
| `use-admin-dashboard.ts` — useReducer 替换 8 个 filter useState | 380    | 356    | `admin-dashboard-filter-state.ts` (74 行)           | 4 spec tests |
| `use-chat-session.ts` — 流式/轮询逻辑提取                       | 349    | 232    | `use-chat-session-stream-manager.ts` (180 行)       | 5 spec tests |
| `runtime-tech-briefing.service.ts` — processCategory 提取       | 382    | 290    | `runtime-tech-briefing-category-runner.ts` (107 行) | 3 spec tests |

验证：`pnpm verify` 9 阶段全绿（docs / prettier / eslint / typecheck / spec / unit / demo / integration / architecture）。

### Commit 10: `5f57d80f` — 补充 barrel 索引 + 清理死文件

5 个文件变更：

- 新建 `packages/runtime/src/bridges/index.ts` barrel
- 新建 `packages/runtime/src/capabilities/index.ts` barrel
- 新建 `packages/runtime/src/utils/index.ts` barrel
- 删除 `tmp/` 目录、`skills/.DS_Store`、`scripts/run-package-typecheck.js`

### Commit 11: `07970070` — 完成全部 runtime 子域 barrel 并精简主入口

5 个文件变更：

- 新建 `packages/runtime/src/flows/index.ts` barrel
- 新建 `packages/runtime/src/graphs/index.ts` barrel
- 新建 `packages/runtime/src/runtime/index.ts` barrel（84 行，覆盖 20+ 模块）
- 新建 `packages/runtime/src/session/index.ts` barrel
- 精简 `packages/runtime/src/index.ts`：139 行 → 49 行，所有子域通过 barrel 导入

Runtime 模块化现状：11 个子域全部具备 barrel index，主入口按域分组 re-export。

### Commit 12: `c5d03da0` — 15 个近限文件拆分（380-400 行）

35 个文件变更，将 15 个接近 400 行阈值的生产文件预防性拆分：

| 原文件                                             | 原行数 | 拆分后 | 提取文件                                                             |
| -------------------------------------------------- | ------ | ------ | -------------------------------------------------------------------- |
| `memory-browser-card.tsx`                          | 400    | ~310   | `memory-browser-card-components.tsx`                                 |
| `orchestration.ts` (core schemas)                  | 397    | ~190   | `orchestration-state-records.ts` (211 行)                            |
| `agent-runtime.ts`                                 | 391    | ~174   | `agent-runtime-mcp-configuration.ts` (220 行)                        |
| `chat-capability-intents.service.ts`               | 394    | ~310   | `chat-capability-intents-skills.ts`                                  |
| `chat-session-control-actions.ts`                  | 389    | ~217   | `chat-session-skill-install-actions.ts` (170 行)                     |
| `admin-dashboard-refresh-actions.ts`               | 397    | ~310   | `admin-dashboard-page-loaders.ts`                                    |
| `runtime-tech-briefing-storage.ts`                 | 382    | ~290   | `runtime-tech-briefing-status.ts` + `runtime-tech-briefing-paths.ts` |
| `memory-repository.ts`                             | 388    | ~304   | `memory-repository-lifecycle.ts` (167 行)                            |
| `approvals-panel.tsx`                              | 381    | ~310   | `approvals-panel-labels.ts` (70 行)                                  |
| `runtime-summary-tools.tsx`                        | 380    | ~265   | `runtime-summary-tools-helpers.ts` (115 行)                          |
| `session-coordinator-turns.ts`                     | 390    | ~300   | `session-coordinator-routing-hints.ts` (90 行)                       |
| `runtime-analytics.ts`                             | 384    | ~224   | `runtime-analytics-helpers.ts` (160 行)                              |
| `tool-registry.ts` (knowledge defs)                | 395    | ~310   | `mcp-tool-definitions.ts`                                            |
| `runtime-tech-briefing-localize-render-content.ts` | 386    | ~236   | `runtime-tech-briefing-category-rules.ts` (150 行)                   |
| `main-graph-task-context.ts`                       | 384    | ~285   | `main-graph-task-context-usage.ts` (134 行)                          |

拆分模式：

- 依赖注入委托模式（`*Deps` 接口 + private `*Deps()` 方法）：agent-runtime, memory-repository, task-context, analytics, coordinator-turns
- 纯函数/常量提取模式：approvals-panel-labels, summary-tools-helpers, mcp-tool-definitions, category-rules, orchestration-state-records
- Re-export 兼容模式：所有 15 个拆分均从原文件 re-export 以保持向后兼容

### Commit 13: `3bb505b1` — 文档更新

更新重构记录文档。

### Commit 14: `b91c4e1e` — knowledge pipeline 契约统一

将 `packages/knowledge` 的 indexing pipeline 与 `@agent/core` 契约层统一：

- 删除 `KnowledgeDocumentLoader / KnowledgeChunker / KnowledgeEmbedder / KnowledgeIndexWriter` 等并行接口（9 个文件）
- `runKnowledgeIndexing` 现在接受 `@agent/core` 定义的 `Loader / Chunker / Embedder / VectorStore`
- 新增 `FixedWindowChunker`（实现 `@agent/core` `Chunker`）
- 新增 `KnowledgeSourceConfig`（知识库元数据默认值）
- 向量 metadata 写入 `sourceId / title / uri / content / sourceType / trustClass`，供 `LocalKnowledgeSearchService` 检索

### Commit 15: `b968bdce` — ExchangeMallChart 配置提取

将 `packages/templates/ExchangeMallChart.tsx` 的 40 条 key 配置和分组定义提取到 `exchange-mall-chart.keys.ts`：

- 430 → 235 行（-195 行）
- `packages/templates` 现在也无超过 400 行的源码文件

## 最终验证结果（更新）

- `pnpm verify` 9 阶段全绿
- **零生产源码文件超过 400 行（包含 `packages/templates`）**
- 仅 1 个生产文件保持 380-400 行（`run-observatory-compare-support.ts` 385 行，评估为高内聚无需拆分）
- runtime 主入口从 139 行精简至 49 行
- 共 12 个新增 spec 测试覆盖 3 个 P0 重构
- `@agent/core` 现为 indexing pipeline 唯一契约层，adapters 实现、knowledge 消费
- 分支共 17 个提交，全部独立验证通过
