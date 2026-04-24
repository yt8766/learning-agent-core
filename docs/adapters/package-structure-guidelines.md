# adapters 包结构规范

状态：current
文档类型：convention
适用范围：`packages/adapters`
最后核对：2026-05-10

本文档说明 `packages/adapters` 如何按"稳定 adapter 边界 + provider 实现 + 工厂装配 + 输出安全 + 外部生态 indexing 转化"收敛目录结构。

## 1. 目标定位

`packages/adapters` 是项目的**外部生态双向转化层**，负责：

```text
第三方输出 -> 项目稳定契约（@agent/core 类型）
项目稳定契约 -> 第三方 SDK 输入
```

它不是：

- agent 业务 prompt 宿主
- graph 编排层
- runtime orchestration 层
- indexing pipeline 编排层（由 `@agent/knowledge` 负责）

## 2. 当前目录结构

```text
packages/adapters/
├─ src/
│  ├─ shared/               # 跨生态通用转化工具
│  │  ├─ metadata/          # normalize-metadata, merge-metadata
│  │  ├─ ids/               # stable-id, document-id, chunk-id
│  │  ├─ errors/            # AdapterError
│  │  └─ validation/        # validateVectorDimensions
│  │
│  ├─ langchain/            # LangChain 生态 adapter
│  │  ├─ shared/            # LangChain 专属 mapper
│  │  ├─ loaders/           # LangChainLoaderAdapter, createMarkdownDirectoryLoader
│  │  ├─ chunkers/          # LangChainChunkerAdapter, text splitter factories
│  │  └─ embedders/         # LangChainEmbedderAdapter
│  │
│  ├─ chroma/               # Chroma 生态 adapter
│  │  ├─ shared/            # chroma-collection, chroma-metadata.mapper
│  │  └─ stores/            # ChromaVectorStoreAdapter
│  │
│  ├─ contracts/            # LLM 稳定契约（llm-provider.types, model-capabilities）
│  ├─ openai-compatible/   # OpenAI 兼容 provider（provider/, chat/, embeddings/）
│  ├─ anthropic/           # Anthropic provider（provider/）
│  ├─ minimax/             # MiniMax provider（provider/, chat/）
│  ├─ zhipu/               # 智谱 provider（provider/, chat/）
│  ├─ mcp/                 # MCP skill providers（minimax/, zhipu/, future figma/）
│  ├─ factories/           # LLM 工厂注册表与 runtime wiring（llm/, runtime/）
│  ├─ routing/             # 模型路由与 provider registry（llm/）
│  ├─ resilience/          # LLM retry / fallback 策略
│  ├─ prompts/             # 共享 prompt 工具
│  ├─ structured-output/   # 结构化输出安全层
│  ├─ providers/           # ⚠️ compat re-export，勿新增实现
│  ├─ chat/                # ⚠️ compat re-export，勿新增实现
│  ├─ retry/               # ⚠️ compat re-export，勿新增实现
│  ├─ support/             # ⚠️ compat re-export，勿新增实现
│  ├─ utils/               # ⚠️ compat re-export，勿新增实现
│  └─ index.ts              # 根入口 barrel
├─ test/
├─ demo/
└─ package.json
```

## 3. 一级目录命名规范

外部生态 adapter 目录遵循：

```
一级目录 = 适配哪个外部生态（langchain/ chroma/ pinecone/ pgvector/）
二级目录 = 转化成项目内部什么角色（loaders/ chunkers/ embedders/ stores/）
```

LLM 相关目录按 **provider-first** 命名：`openai-compatible/`、`anthropic/`、`minimax/`、`zhipu/`。
每个 provider 顶层目录下再按功能角色分子目录：`provider/`、`chat/`、`embeddings/`。

MCP skills / provider adapter 统一写入 `mcp/<provider>/`。`minimax/`、`zhipu/` 顶层目录继续承载 LLM provider 与 chat factory；`mcp/minimax/`、`mcp/zhipu/` 承载 MCP server 安装计划、capability 风险分级与 secret requirements。后续 Figma 等 MCP skills 也按 `mcp/figma/` 新增，不写进 `@agent/tools`。

历史路径（`chat/`、`providers/`、`retry/`、`support/`）已降为 compat re-export，不再是规范写入目标。
新增实现必须写入对应 provider 顶层目录或 `resilience/`、`routing/`、`factories/`。

## 4. 契约来源规范

- **Indexing 契约**（Document / Chunk / Vector / Loader / Chunker / Embedder / VectorStore）定义在 `@agent/core/src/knowledge/indexing/contracts/`
- **LLM 契约**（LlmProvider / ModelCapabilities 等）定义在 `packages/adapters/src/contracts/llm/`

## 5. 第三方类型隔离原则

- 第三方 SDK 类型（`@langchain/*`、`chromadb`）只能出现在对应生态目录内（`langchain/`、`chroma/`）
- 严禁泄露到 `@agent/core`、`@agent/knowledge`、`@agent/runtime`、`agents/*`、`apps/*`

## 6. 继续阅读

- [adapters 文档目录](/docs/adapters/README.md)
- [Indexing Adapter 规范](/docs/adapters/indexing-adapter-guidelines.md)
- [LangChain Adapter 使用](/docs/adapters/langchain-adapter.md)
- [Chroma Adapter 使用](/docs/adapters/chroma-adapter.md)
- [Provider 扩展 SDK 指南](/docs/adapters/provider-extension-sdk-guidelines.md)
- [Knowledge Indexing 契约规范](/docs/knowledge/indexing-contract-guidelines.md)
