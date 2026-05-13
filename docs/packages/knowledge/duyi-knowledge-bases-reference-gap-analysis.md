# Duyi Knowledge Bases Reference Gap Analysis

状态：current
文档类型：reference
适用范围：`packages/knowledge`、`apps/backend/agent-server/src/domains/knowledge`
最后核对：2026-05-11

## Reference Source

参考项目：`/Users/dev/Downloads/2026.5.9 企业知识库课程收官资料汇总/课堂代码/duyi-knowledge-bases`

该项目是课程型企业知识库完整样板，覆盖 Next/BFF、PostgreSQL/pgvector、文档 ingestion、RAG pipeline、retrieval trace、知识库权限与后台 debug。当前仓库只吸收能力语义，不复制它的包结构、BFF 路由、Prisma schema 或 `@duyi/specs` contract。

## Capability Mapping

| 参考项目能力                                                                            | 当前仓库落点                                                                                                   | 处理方式                                                              |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `apps/ai-service/src/rag/pipeline.ts` 的 query/retrieval/rerank/context/citation/status | `packages/knowledge/src/rag/*` 与 `apps/backend/agent-server/src/domains/knowledge/rag/*`                      | 保留当前 SDK planner/retrieval/answer 分层，补齐 trace 和 diagnostics |
| `apps/ai-service/src/rag/retriever.ts` 的 vector + keyword candidate merge              | `packages/knowledge/src/retrieval/hybrid-retrieval-engine.ts` 与 backend `KnowledgeDomainSearchServiceAdapter` | 继续使用 RRF，不照搬 keyword boost 作为终态                           |
| `apps/ai-service/src/ingestion/chunker.ts` 的 chunk hash、offset、token count           | `packages/knowledge/src/indexing/chunkers/*` 与 `KnowledgeIngestionWorker`                                     | 补质量门和 metadata，不复制课程 chunker 文件                          |
| live retrieval debug 与 persisted retrieval trace                                       | `packages/knowledge/src/observability/*`、`KnowledgeTraceService`、Knowledge Chat Lab                          | trace projection 必须 redacted，不保存 vendor 原始对象                |
| KB role、public KB、member relation                                                     | 当前 identity/knowledge domain permission service                                                              | 只作为场景校验，不迁移参考项目 auth/session                           |
| 文档追加、删除、运行中 job 阻断、embedding model mismatch 阻断                          | `KnowledgeDocumentService`、`KnowledgeBaseService`、repository contract                                        | 用后端 domain 测试覆盖                                                |

## Absorption Order

1. 先补 post-retrieval selection trace，让每个候选能解释 selected/dropped/stage/reason。
2. 再把 backend trace projection 收敛为候选数、选中数、丢弃原因计数，供 Chat Lab 与 Observability 使用。
3. 复核 ingestion 质量门：embedding 数量、空向量、维度、vector upsert count 均必须 fail-fast。
4. 复核文档生命周期：追加、删除、运行中 job、embedding model mismatch 都必须有稳定错误码。

## Do Not Copy

- 不复制 `apps/web` API route 或 BFF 结构。
- 不复制 `@duyi/specs`。
- 不复制 Prisma schema 或 migration。
- 不复制 `.env`、local PostgreSQL compose 或课程演示账号。
- 不把最终 answer generation 放进 `runKnowledgeRetrieval()`。

## Verification

本主题实现时至少执行：

```bash
pnpm --dir packages/knowledge exec vitest run test/contracts-boundary.test.ts test/post-retrieval-selection-trace.test.ts test/run-knowledge-retrieval.test.ts
pnpm --dir apps/backend/agent-server exec vitest run test/knowledge-domain/knowledge-rag-sdk-trace-projection.spec.ts test/knowledge-domain/knowledge-ingestion-sdk-pipeline.spec.ts
pnpm exec tsc -p packages/knowledge/tsconfig.json --noEmit
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm check:docs
```
