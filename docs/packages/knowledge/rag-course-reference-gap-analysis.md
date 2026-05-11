# RAG Course Reference Gap Analysis

状态：current
文档类型：reference
适用范围：`packages/knowledge`
最后核对：2026-05-11

## Reference Source

参考项目：`/Users/dev/Downloads/2026.5.9 企业知识库课程收官资料汇总/课堂代码/rag`

该项目是教学用多包 RAG SDK，适合作为能力 checklist，不作为当前仓库的代码结构来源。当前仓库的真实宿主是 `packages/knowledge`，所有吸收动作必须落入 `@agent/knowledge` 的 schema-first contract、runtime stage、retrieval service、adapter boundary、observability/eval 文档体系。

## Capability Mapping

| 课程项目能力                                                 | 当前合理落点                                                                                           | 处理方式                                                                    |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `packages/core/src/spec/*`                                   | `packages/knowledge/src/contracts/*` 或 `packages/knowledge/src/core/*`                                | 只参考 schema-first 思路，不复制 `@rag_sdk/core` 类型                       |
| `packages/indexing/src/pipeline/run-indexing.ts`             | `packages/knowledge/src/indexing/pipeline/run-knowledge-indexing.ts`                                   | 参考 stage observation 与 fanout 思路                                       |
| `packages/runtime/src/pipeline/run-runtime.ts`               | `packages/knowledge/src/runtime/pipeline/run-knowledge-retrieval.ts`                                   | 参考 stage timing 与 diagnostics，不复制 generator 主链                     |
| `packages/runtime/src/defaults/post-retrieval-strategies.ts` | `packages/knowledge/src/runtime/defaults/*`                                                            | 优先吸收 selection trace、budget trim、source coverage、near duplicate 语义 |
| `packages/adapters/src/*`                                    | `packages/knowledge/src/adapters/*`                                                                    | 只参考 adapter boundary，不恢复独立 `packages/adapters`                     |
| `packages/observability/src/*`                               | `packages/knowledge/src/observability/*` 和 `contracts/schemas/knowledge-observability-eval.schema.ts` | 只映射到 Knowledge RAG trace contract                                       |
| `packages/eval/src/*`                                        | `packages/knowledge/src/eval/*`                                                                        | 参考 trace-to-sample 闭环                                                   |
| `app/cli/src/rag/runtime/*`                                  | `packages/knowledge/demo/*` 或 test support                                                            | 参考 snapshot smoke，不作为生产 runtime                                     |

## First Absorption Slice

第一批只做 post-retrieval selection trace：

1. 每个候选 hit 记录 `chunkId`、`sourceId`、`selected`、`stage`、`reason`、`score`。
2. 被 filter/rank/diversifier/postProcessor 丢弃的候选必须有稳定 reason。
3. diagnostics 中保留 `selectionTrace`，trace event 中只记录计数，避免日志过大。
4. 不改变 `KnowledgeRetrievalResult.hits` 的行为。

## Do Not Copy

- 不复制课程项目多包结构。
- 不复制 `@rag_sdk/*` 包名、类型名或 public API。
- 不恢复 `packages/adapters` 作为当前实现入口。
- 不把最终 answer generation 放进 `packages/knowledge` 默认 retrieval runtime。
- 不让第三方 SDK 原始类型进入 stable contract。

## Verification

实现 post-retrieval selection trace 时至少执行：

```bash
pnpm --dir packages/knowledge exec vitest run test/post-retrieval-selection-trace.test.ts test/run-knowledge-retrieval.test.ts
pnpm exec tsc -p packages/knowledge/tsconfig.json --noEmit
pnpm check:docs
```
