# Knowledge Source Ingestion 接线状态

状态：current
文档类型：reference
适用范围：`packages/knowledge` sourceType、ingestion、retrieval contract
最后核对：2026-05-01

## 核对结论

本轮用 `rg` 核对了 `repo-docs`、`workspace-docs`、`connector-manifest`、`catalog-sync`、`user-upload`、`web-curated` 与候选 `agent-skill` 在代码、测试和文档中的真实使用位置。当前事实是：

- `sourceType` schema 是稳定 contract 边界，只说明 retrieval / runtime artifact 可以承载这些来源；它不等于 loader、权限 metadata、receipt、embedding 写入或 host production wiring 已经完成。
- `KnowledgeSource` / `RetrievalRequest` / `RetrievalHit` 的检索 contract 已支持六类正式 `sourceType`。
- `KnowledgeSourceRecord` 运行态 artifact schema 已对齐六类正式 `sourceType`，避免上传文档或精选网页后续写入 `cangjing` snapshot 时被 runtime schema 拦住。
- `ingestLocalKnowledge()` 当前只自动枚举本地 README、`docs/**/*.md` 与部分 `package.json` manifest；它不会主动扫描 user upload、web curated、catalog sync 或 agent skill 目录。
- source ingestion payload builders 已覆盖 user upload、catalog sync、web curated 与 connector sync 的字段规范化入口；`createKnowledgeSourceIngestionLoader()` 可把这些 payload 规范化为 indexing `Document[]`；`runKnowledgeIndexing()` 再通过 `sourceIndex` / `fulltextIndex` / `vectorIndex` fanout 写入统一边界。`ingestKnowledgeSourcePayloads()` 已提供本地 runtime store facade：写入 source/chunk/receipt snapshot，并通过注入的 vector writer 写入向量边界。
- backend `RuntimeKnowledgeService.ingestKnowledgeSources()` 已接入 `ingestKnowledgeSourcePayloads()`；`POST /api/platform/knowledge/sources/ingest` 已提供规范化 payload 的最小 HTTP facade。`RuntimeKnowledgeService.ingestUserUploadSource()` 与 `POST /api/platform/knowledge/sources/user-upload/ingest` 已提供 workspace 内已落盘上传文件的最小 adapter，会读取文件、写入 uploadedBy / allowedRoles / mimeType metadata，并复用 user upload payload builder。`RuntimeKnowledgeService.ingestCatalogSyncSources()` 与 `POST /api/platform/knowledge/sources/catalog-sync/ingest` 已提供上游已同步 catalog entries 的最小 adapter。`RuntimeKnowledgeService.ingestWebCuratedSources()` 与 `POST /api/platform/knowledge/sources/web-curated/ingest` 已提供上游已抓取清洗 curated URL entries 的最小 adapter；`runtime-web-curated-ingestion-job.ts` 已提供可注入 `fetchUrl` / `cleanContent` / `trustPolicy` 的最小 job 边界，用于把 curated URL 拉取产物送入现有 adapter。`RuntimeKnowledgeService.ingestConnectorSyncSources()` 与 `POST /api/platform/knowledge/sources/connector-sync/ingest` 已提供上游 connector sync entries 的最小 adapter，当前复用 `connector-manifest` sourceType + `metadata.docType=connector-sync`。multipart 上传、对象存储下载、外部 catalog 拉取、真实网页抓取器、connector API 同步 job 仍待后续接线。
- backend HTTP smoke 已覆盖 `POST /api/platform/knowledge/sources/ingest` 后读取 `GET /api/platform/runtime-center` 的闭环；`ingestLocalKnowledge()` 刷新本地 docs/manifest snapshot 时必须保留已由生产来源 ingestion 写入的 source/chunk/receipt 记录，避免 Runtime Center projection 把刚写入的来源清空。
- `packages/knowledge/demo/production-ingestion-runtime-center.ts` 新增了接近生产的 fake demo：用 fake OpenSearch / fake Chroma 验证全来源样例可以进入统一 `RetrievalRequest` / `RetrievalHit`，并投影为 Runtime Center / agent-admin 可消费 payload。它是 contract rehearsal，不代表真实 backend `RuntimeHost` 已完成生产 SDK、凭据和 ingestion 调度接线。
- `agent-skill` 不新增为正式 `sourceType`。当前决策是：代理技能若进入 Hybrid Search，先作为 `workspace-docs` / `repo-docs` 的子类写入，并通过 `metadata.docType = "agent-skill"` 区分；运行时技能 manifest 则继续复用 `connector-manifest` 或后续 catalog 来源，并通过 `metadata.docType = "runtime-skill"` 区分。只有当产品需要对 agent skills 做独立来源级权限、配额或生命周期治理时，才重新评估新增一等 sourceType。

## 来源状态矩阵

| 来源                      | sourceType                                                                   | Retrieval contract   | Runtime artifact schema | Local ingestion                                                              | Production wiring                                                                                                                                                                         | 当前判断                                                                            |
| ------------------------- | ---------------------------------------------------------------------------- | -------------------- | ----------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| repo docs                 | `repo-docs`                                                                  | 已有                 | 已有                    | 已有，`docs/**/*.md`                                                         | backend runtime center 会调用 `ingestLocalKnowledge()` 读取本地 snapshot                                                                                                                  | 当前最明确，仍需按具体部署确认 embedding 凭据与 searchable 状态                     |
| workspace docs            | `workspace-docs`                                                             | 已有                 | 已有                    | 已有，`README.md` 与 `docs/conventions/project-conventions.md`               | 同上                                                                                                                                                                                      | 已有最小本地 ingestion，不等于所有 workspace 文档都完整接入                         |
| connector manifest / sync | `connector-manifest`                                                         | 已有                 | 已有                    | 已有，当前枚举根 `package.json` 与 agent-server `package.json` 作为 manifest | backend 已有上游 connector sync entries adapter：`POST /api/platform/knowledge/sources/connector-sync/ingest` -> builder -> source/chunk/receipt/vector                                   | manifest 本地枚举已有；connector API 同步 / 鉴权 / 清洗 job 待补                    |
| catalog sync              | `catalog-sync`                                                               | 已有                 | 已有                    | 不主动枚举；由上游 catalog job 提供已同步 entries                            | backend 已有上游 entries adapter：`POST /api/platform/knowledge/sources/catalog-sync/ingest` -> builder -> source/chunk/receipt/vector                                                    | 已有最小 entries adapter；外部 catalog 拉取 / 鉴权仍待补                            |
| user upload               | `user-upload`                                                                | 已有                 | 已有                    | 不主动枚举；由上游 upload job 提供已落盘文件                                 | backend 已有 workspace 内文件读取 adapter：`POST /api/platform/knowledge/sources/user-upload/ingest` -> builder -> source/chunk/receipt/vector                                            | 已有最小文件读取 adapter；multipart / 对象存储 / 鉴权仍待补                         |
| web curated               | `web-curated`                                                                | 已有                 | 已有                    | 不主动枚举；由上游 curated job 提供已抓取清洗 entries                        | backend 已有上游 entries adapter：`POST /api/platform/knowledge/sources/web-curated/ingest` -> builder -> source/chunk/receipt/vector；并有可注入 fetch/clean/trustPolicy 的最小 job 边界 | 已有最小 entries adapter 与 job 编排边界；真实抓取器 / robots / 版权策略 / 调度待补 |
| agent skills              | 不新增；复用 `workspace-docs` / `repo-docs` + `metadata.docType=agent-skill` | 未声明 `agent-skill` | 未声明 `agent-skill`    | 未接入                                                                       | skill runtime 走 `.agents/skills`、`packages/skill` 和 backend skill sources 链路                                                                                                         | 映射策略已定；真实 ingestion job 仍待补                                             |

## 近生产 integration / demo 骨架

新增可运行骨架：

- `packages/knowledge/test/production-ingestion-runtime-center.demo.test.ts`
- `packages/knowledge/demo/production-ingestion-runtime-center.ts`
- `apps/backend/agent-server/test/platform/knowledge-ingestion.http-smoke.spec.ts`

该骨架覆盖的可验证路径是：

```text
fake RuntimeHost
  -> fake AgentRuntime.knowledgeSearchService
  -> fake OpenSearch keyword service + fake Chroma vector provider
  -> HybridKnowledgeSearchService
  -> RetrievalRequest / RetrievalHit[]
  -> Runtime Center knowledgeOverview / knowledgeSearchStatus / knowledgeSearchLastDiagnostics
  -> agent-admin runtime payload shape
```

backend HTTP smoke 额外覆盖：

```text
Nest testing app
  -> POST /api/platform/knowledge/sources/ingest
  -> RuntimeKnowledgeService.ingestKnowledgeSources()
  -> @agent/knowledge ingestKnowledgeSourcePayloads()
  -> source/chunk/receipt snapshot
  -> GET /api/platform/runtime-center
  -> Runtime Center knowledgeOverview.latestReceipts
```

本 demo 刻意只写在 `packages/knowledge`，没有修改 backend `RuntimeHost`。它证明的是统一 contract 与 projection payload 的最小闭环：

- user upload 使用 `sourceType = "user-upload"`。
- connector sync 样例暂以 `sourceType = "connector-manifest"` + `metadata.docType = "connector-sync"` 表达；真实 connector content ingestion 仍需单独接线。
- catalog sync 使用 `sourceType = "catalog-sync"`。
- web curated 使用 `sourceType = "web-curated"`。
- agent skills 不新增 `agent-skill`，demo 中以 `sourceType = "workspace-docs"` + `metadata.docType = "agent-skill"` 做 rehearsal。

剩余生产接线点：

- backend `RuntimeHost` 需要把真实 OpenSearch / Chroma SDK client、凭据、health ping 与 provider diagnostics 注入到 runtime knowledge search factory。
- user upload 已有 workspace 内文件读取 adapter，catalog sync 与 connector sync 已有上游 entries adapter，web curated 已有可注入 fetch/clean/trustPolicy 的最小 job 编排边界；真实 connector API 同步、真实网页抓取器、权限 metadata 与 vendor response 清洗仍待上游 job 继续补齐。
- Runtime Center 当前可展示 `knowledgeSearchStatus` 与最近 query diagnostics；若要展示各来源 ingestion lag、receipt 错误和 provider latency，需要 backend 子代理继续扩展正式 projection contract。
- agent-admin 只能消费 Runtime Center projection，不应从原始 task dump 或本 demo 反推知识检索状态。

## rg 核对摘要

- `packages/knowledge/src/contracts/schemas/knowledge-retrieval.schema.ts`：检索 contract 的 `KnowledgeSourceTypeSchema` 声明六类正式来源。
- `packages/knowledge/src/contracts/schemas/knowledge-runtime.schema.ts`：运行态 `KnowledgeSourceRecordSchema` 已对齐六类正式来源。
- `packages/knowledge/src/runtime/local-knowledge-store.helpers.ts`：`listKnowledgeCandidates()` 当前只产出 `workspace-docs`、`repo-docs`、`connector-manifest`。
- `packages/knowledge/src/indexing/pipeline/run-knowledge-indexing.ts`：`sourceConfig.sourceType` 和 document metadata 会写入 source / fulltext / vector writer fanout；没有内置具体来源 loader。
- `packages/knowledge/src/indexing/loaders/source-ingestion-loader.ts`：提供 `createKnowledgeSourceIngestionLoader()`，用于把生产来源 payload 规范化为 indexing `Document[]`，并拒绝未声明 sourceType，例如 `agent-skill`。
- `packages/knowledge/src/indexing/loaders/source-ingestion-payload-builders.ts`：提供 user upload、catalog sync、web curated、connector sync payload builder；builder 只做字段规范化和 schema 校验，不做来源采集。
- `packages/knowledge/src/runtime/local-knowledge-source-ingestion.ts`：提供 `ingestKnowledgeSourcePayloads()`，把生产来源 payload 写入本地 source/chunk/receipt snapshot，并将 vector 写入调用方注入的 `KnowledgeVectorIndexWriter`。
- `apps/backend/agent-server/src/runtime/services/runtime-knowledge.service.ts`：提供 `ingestKnowledgeSources()` 服务层调度入口，复用 RuntimeHost settings 与 vector index repository。
- `apps/backend/agent-server/src/runtime/services/runtime-knowledge.service.ts`：`ingestUserUploadSource()` 读取 workspace 内已落盘文件，调用 `buildUserUploadKnowledgePayload()` 后进入同一 ingestion facade，并防止读取 workspace 外路径。
- `apps/backend/agent-server/src/runtime/services/runtime-knowledge.service.ts`：`ingestCatalogSyncSources()` 接收上游已同步 catalog entries，调用 `buildCatalogSyncKnowledgePayload()` 后进入同一 ingestion facade。
- `apps/backend/agent-server/src/runtime/services/runtime-knowledge.service.ts`：`ingestWebCuratedSources()` 接收上游已抓取清洗 curated URL entries，调用 `buildWebCuratedKnowledgePayload()` 后进入同一 ingestion facade。
- `apps/backend/agent-server/src/runtime/domain/knowledge/runtime-web-curated-ingestion-job.ts`：提供 web curated 最小 job 边界，通过注入 `fetchUrl`、可选 `cleanContent` 与 `trustPolicy`，把 URL 来源转成 `RuntimeWebCuratedKnowledgeIngestionInput[]` 后调用现有 adapter；真实 HTTP/MCP 抓取器、robots / 版权策略和调度仍不在该文件内。
- `apps/backend/agent-server/src/runtime/services/runtime-knowledge.service.ts`：`ingestConnectorSyncSources()` 接收上游 connector sync entries，调用 `buildConnectorSyncKnowledgePayload()` 后以 `connector-manifest` sourceType 进入同一 ingestion facade。
- `apps/backend/agent-server/src/platform/knowledge-ingestion.controller.ts`：提供 `POST /api/platform/knowledge/sources/ingest`、`POST /api/platform/knowledge/sources/user-upload/ingest`、`POST /api/platform/knowledge/sources/catalog-sync/ingest`、`POST /api/platform/knowledge/sources/web-curated/ingest` 与 `POST /api/platform/knowledge/sources/connector-sync/ingest` HTTP facade；这些入口不是 multipart upload、外部 catalog 拉取器、网页抓取器或 connector API 同步器。
- `packages/knowledge/test/indexing-pipeline.test.ts`：覆盖 `user-upload`、`catalog-sync`、`web-curated` 通过 `sourceIndex` / `fulltextIndex` / `vectorIndex` 同步写入统一边界。
- `packages/knowledge/test/source-ingestion-loader.test.ts`：覆盖生产来源 payload -> Document[] -> source/chunk/vector fanout 的最小闭环。
- `packages/knowledge/test/contracts-boundary.test.ts`：覆盖六类正式来源的 schema parse，并明确拒绝 `agent-skill`。
- `packages/knowledge/test/local-knowledge-store.test.ts`：覆盖本地 docs/manifest ingestion snapshot，但没有覆盖 user upload、web curated、catalog sync。
- `packages/knowledge/test/production-ingestion-runtime-center.demo.test.ts`：用 fake OpenSearch / fake Chroma 覆盖全来源样例进入统一 retrieval，并形成 Runtime Center / agent-admin payload 的最小可运行路径。
- `apps/backend/agent-server/test/platform/knowledge-ingestion.http-smoke.spec.ts`：用隔离临时 workspace 覆盖 Nest HTTP ingestion facade 写入后 Runtime Center projection 仍能读到生产来源 receipt。
- backend runtime center 通过 `ingestLocalKnowledge()` / `readKnowledgeOverview()` 消费本地 snapshot；user upload 的 workspace 文件读取 adapter、catalog sync / web curated / connector sync 的上游 entries adapter 已有，未在本轮范围内接入真实 connector API 同步 job。

## agent skills 映射策略

决策：不新增 `agent-skill` 一等 sourceType。

原因是现在存在两套 skill 语义：

- 代理技能：`.agents/skills/*`，给 Codex / Claude Code 等代码代理读取。
- 运行时技能：`packages/skill` 与 backend skill sources 链路，用于 runtime 能力注册、安装、治理和复用。

当前映射策略：

1. `.agents/skills/*/SKILL.md` 作为 `workspace-docs` 或 `repo-docs` 的子类接入，通过 `metadata.docType = "agent-skill"` 区分。
2. 运行时 skill manifest 作为 `connector-manifest` 或 `catalog-sync` 接入，通过 `metadata.docType = "runtime-skill"` 区分。
3. UI / filter 若需要筛选 agent skills，优先使用 metadata filter，不依赖新的 sourceType。

重新评估新增 `agent-skill` sourceType 的触发条件：产品需要对 agent skills 做独立来源级权限、配额、保留策略、同步 lag 或一等生命周期治理；一旦触发，必须同步补 retrieval/runtime schema、loader、indexing、filter 与 hybrid 回归测试。

## 后续清单

- 为 user upload 继续补 multipart / 对象存储 / 鉴权上游 job；当前 backend adapter 只处理已落在 workspace 内的文件。
- 为 catalog sync 继续补真实外部 catalog 拉取 / 鉴权 / vendor response 清洗 job；当前 backend adapter 只处理上游已同步 entries。
- 为 web curated 接入真实网页抓取器、robots / 版权策略与调度；当前最小 job 边界已经支持注入抓取、清洗和 `trustClass` 策略。
- 明确 connector manifest 与 connector content 的边界：manifest 已有最小本地 ingestion，connector 同步内容已有最小 backend adapter，但真实 connector API 同步 job 仍需独立接线。
- 若 agent skills 进入 Hybrid Search，按 `workspace-docs` / `repo-docs` + `metadata.docType=agent-skill` 先补 ingestion job、metadata filter 与 hybrid 回归；不要新增 `agent-skill` sourceType。
