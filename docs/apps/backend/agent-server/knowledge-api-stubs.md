# agent-server Knowledge API Stubs

状态：current
文档类型：reference
适用范围：`apps/backend/agent-server/src/knowledge`
对应接口规范：`docs/contracts/api/knowledge.md`
最后核对：2026-05-01

## 目标

Knowledge API stubs 用于 Knowledge 前端横向 MVP。它们返回固定 fixture，覆盖总览、知识库、文档、对话、观测和评测的基本数据面，让前端可以先打通端到端流程。

这些接口不是生产级持久化实现，不负责真实上传、解析、chunk、embedding、向量检索、LLM 生成、trace 写入或 eval 运行。

## 当前入口

```text
apps/backend/agent-server/src/knowledge/
  knowledge.controller.ts
  knowledge.service.ts
  knowledge-api-fixtures.ts
```

测试入口：

```text
apps/backend/agent-server/test/knowledge/knowledge-stub-api.spec.ts
```

## 当前覆盖

`KnowledgeController` 当前在 `knowledge/v1` 下暴露这些 stub 路由：

- `GET /dashboard/overview`
- `GET /knowledge-bases`
- `POST /knowledge-bases`
- `GET /knowledge-bases/:id`
- `GET /documents`
- `GET /documents/:id`
- `GET /documents/:id/jobs`
- `GET /documents/:id/chunks`
- `POST /chat`
- `POST /messages/:id/feedback`
- `GET /observability/metrics`
- `GET /observability/traces`
- `GET /observability/traces/:id`
- `GET /eval/datasets`
- `POST /eval/datasets`
- `GET /eval/runs`
- `POST /eval/runs`
- `GET /eval/runs/:id`
- `GET /eval/runs/:id/results`

全局 API prefix 由后端宿主统一处理，因此对外路径为 `/api/knowledge/v1/...`。

## 替换边界

后续纵向生产化时保持 controller 路径和 API contract 不变，逐步替换 service 内部：

- dashboard 来源改为真实统计聚合。
- knowledge base / document 来源改为 repository。
- chat 改为真实 RAG runtime + host generation。
- observability 改为 trace store 与 metrics projection。
- eval 改为 dataset / case / run / result 持久化与运行队列。
- fixture 文件在真实 repository 接线后只能作为测试 fixture，不再作为 service 数据源。
