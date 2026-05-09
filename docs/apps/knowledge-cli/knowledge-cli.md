状态：current
文档类型：guide
适用范围：`apps/knowledge-cli`
最后核对：2026-05-09

# Knowledge CLI

`apps/knowledge-cli` 是 Knowledge SDK 的命令行验证入口，用来证明 SDK 可以脱离 Knowledge App 前端和 unified backend，以开发者工具形态跑通本地 RAG 闭环。

## 当前能力

- `index`：读取本地 `.md`、`.markdown`、`.txt` 文件，调用 `@agent/knowledge` 的 `runKnowledgeIndexing()`，生成可复用 snapshot。
- `retrieval`：读取 snapshot，通过本地关键词 search adapter 调用 `runKnowledgeRetrieval()`，输出 topK chunk、score 和内容预览。
- `ask`：从本地目录或 snapshot 执行检索，并基于命中 chunk 生成抽取式 answer。
- `--traceFile`：输出 JSONL trace，事件阶段包含 `index`、`retrieval`、`answer`。

## 使用方式

```bash
pnpm --dir apps/knowledge-cli dev -- index --dir ../../docs --indexFile /tmp/knowledge-index.json
pnpm --dir apps/knowledge-cli dev -- retrieval --indexFile /tmp/knowledge-index.json --query "Knowledge SDK 接入指南"
pnpm --dir apps/knowledge-cli dev -- ask --dir ../../docs --query "Knowledge SDK 接入指南" --debug
```

`dev` 脚本会先构建 `packages/knowledge`，避免 CLI 运行时拿到过期的 `@agent/knowledge` package exports。

## 边界

CLI 只作为 SDK 开发体验和最小 Demo 闭环，不接真实 LLM、不直接写生产 pgvector，也不替代 `apps/backend/agent-server/src/domains/knowledge` 的生产 ingestion / chat / observability 实现。

后续如果要把它升级为生产调试工具，先补正式配置 contract，再接入真实 embedding provider、vector store 和 observer/exporter。
