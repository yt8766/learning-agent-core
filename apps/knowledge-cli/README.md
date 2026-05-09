# Knowledge CLI

`knowledge-cli` 是 Knowledge SDK 的本地端到端验证入口，用于从命令行跑通本地资料目录的索引、检索和抽取式问答。

## Commands

```bash
pnpm --dir apps/knowledge-cli dev -- index --dir ../../docs --indexFile /tmp/knowledge-index.json
pnpm --dir apps/knowledge-cli dev -- retrieval --indexFile /tmp/knowledge-index.json --query "Knowledge SDK 接入指南"
pnpm --dir apps/knowledge-cli dev -- ask --dir ../../docs --query "Knowledge SDK 接入指南" --debug
```

## Scope

- `index` 读取 `.md`、`.markdown`、`.txt` 文件，使用 `@agent/knowledge` 的 indexing pipeline 生成 snapshot。
- `retrieval` 读取 snapshot，通过本地关键词 search adapter 调用 `runKnowledgeRetrieval()`。
- `ask` 可以直接读取目录或复用 snapshot，输出命中引用和抽取式 answer。
- `--traceFile` 会写 JSONL trace，覆盖 `index`、`retrieval`、`answer` 阶段。

当前 CLI 不接真实 LLM 或生产向量库；它是 SDK 开发者体验和最小闭环验证入口，不替代 unified `agent-server` 的生产 Knowledge API。
