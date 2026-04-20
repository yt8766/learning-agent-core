# platform-runtime-boundary 重构记录

状态：completed
分支：`chore/platform-runtime-boundary`
完成日期：2026-04-20

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
