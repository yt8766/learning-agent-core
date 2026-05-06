# Knowledge Admin Governance API Contract

状态：current
文档类型：reference
适用范围：`apps/frontend/agent-admin`、`apps/backend/agent-server`、`packages/core`
最后核对：2026-05-04

## 1. Purpose

`GET /api/platform/knowledge/governance` 为 `agent-admin` 的 Knowledge Governance 视图提供只读治理投影。该接口不是知识库业务 CRUD 入口，也不返回原始文档内容、provider response、检索 raw trace、credential、token、request config 或第三方 SDK 错误对象。

当前前端只消费脱敏后的 `KnowledgeGovernanceProjection`，用于展示知识库总量、provider 健康、摄入来源状态、检索诊断摘要与 agent 使用概览。

## 2. Endpoint

| Method | Path                                 | Query / Body | Response                        | 权限       |
| ------ | ------------------------------------ | ------------ | ------------------------------- | ---------- |
| GET    | `/api/platform/knowledge/governance` | none         | `KnowledgeGovernanceProjection` | admin 用户 |

调用方必须携带当前平台认证凭据。后端必须在 controller/service 边界完成鉴权与脱敏投影装配，不能把 provider/vendor 原始对象直接透传给前端。

## 3. Response Schema

Canonical schema 定义在 `packages/core/src/contracts/knowledge-service`：

```ts
export type KnowledgeProviderHealthStatus = 'ok' | 'degraded' | 'unconfigured';

export interface KnowledgeGovernanceProjection {
  summary: {
    knowledgeBaseCount: number;
    documentCount: number;
    readyDocumentCount: number;
    failedJobCount: number;
    warningCount: number;
  };
  providerHealth: Array<{
    provider: 'embedding' | 'vector' | 'keyword' | 'generation';
    status: KnowledgeProviderHealthStatus;
    warningCount: number;
    reason?: string;
  }>;
  ingestionSources: Array<{
    id: string;
    label: string;
    sourceType: string;
    status: 'active' | 'paused' | 'failed' | 'unknown';
    indexedDocumentCount: number;
    failedDocumentCount: number;
  }>;
  retrievalDiagnostics: Array<{
    id: string;
    query: string;
    retrievalMode: string;
    hitCount: number;
    totalCount: number;
    failedRetrieverCount: number;
  }>;
  agentUsage: Array<{
    agentId: string;
    agentLabel: string;
    knowledgeBaseIds: string[];
    recentRunCount: number;
    evidenceCount: number;
  }>;
  updatedAt: string;
}
```

所有 count 字段必须是非负整数。`updatedAt` 必须是 ISO datetime 字符串。新增字段只能按兼容 additive 方式演进；重命名、删除或改变枚举语义属于破坏式变更，必须先更新 contract、schema、调用方和回归测试。

## 4. Redacted Projection Boundary

该 projection 只承载 admin 控制台展示所需的稳定摘要：

- `summary` 聚合知识库、文档、失败任务与 warning 数量。
- `providerHealth` 只展示 provider 类型、项目内稳定健康状态、warning 数与脱敏原因。
- `ingestionSources` 只展示来源标识、标签、类型、状态与文档计数。
- `retrievalDiagnostics` 只展示查询摘要、检索模式和命中/失败数量。
- `agentUsage` 只展示 agent 标识、展示名、关联知识库 ID 和近期使用计数。

不得返回原始文档片段、用户私密输入、embedding 向量、reranker 分数明细、vendor request/response、provider headers、stack trace、secret、token 或未脱敏错误对象。

## 5. Errors

错误响应沿用平台 API 的稳定错误语义：

| HTTP | code             | 语义                       |
| ---- | ---------------- | -------------------------- |
| 401  | `auth_required`  | 未携带或无法识别认证凭据。 |
| 403  | `auth_forbidden` | 当前用户不是 admin。       |
| 500  | `internal_error` | 服务端无法生成治理投影。   |

错误 `message` 必须可展示且已脱敏；`requestId` 用于日志关联。`details` 如存在，也只能包含 JSON-safe 的字段级摘要、稳定枚举或资源 ID，不能透传 provider/vendor 原始错误。
