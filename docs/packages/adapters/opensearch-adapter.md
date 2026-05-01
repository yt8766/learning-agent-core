# OpenSearch Keyword Search Provider 使用文档

状态：current
文档类型：guide
适用范围：`packages/adapters/src/opensearch/`
最后核对：2026-05-01

## 概述

`OpenSearchKeywordSearchProvider` 实现 `@agent/knowledge` 的 `KnowledgeSearchService` 接口，用 OpenSearch 进行关键词检索，并将命中结果映射为 `RetrievalResult`。

## Health Check

`healthCheck()` 用于检查目标 index 是否可达。它只通过 `client.search()` 对配置的 `indexName` 发起 `size: 0` 的 `match_all` 探测，不执行真实业务检索，也不解析业务 hit。

成功时返回：

```ts
{
  status: 'healthy',
  checkedAt: '<ISO timestamp>',
  latencyMs: 12,
  message: 'OpenSearch index "knowledge-chunks" is reachable.'
}
```

失败时抛出 `AdapterError`，由运行时或装配层按自身降级策略转换为 `degraded` 诊断。

## 约束

- `indexName` 必须是非空字符串。
- `client.search` 必须存在，生产环境应注入 OpenSearch client 的 search 能力。
- `healthCheck()` 只验证 index reachability，不保证业务 schema、权限过滤或召回质量。
- 业务检索仍通过 `search()` 发起 `multi_match` query，并继续执行本地防御性过滤。
