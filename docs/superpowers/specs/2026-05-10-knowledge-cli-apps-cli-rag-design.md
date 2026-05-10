# Knowledge CLI Apps/CLI and RAG Boundary Design

状态：draft
文档类型：spec
适用范围：历史设计背景；当前实现入口为 `apps/cli/knowledge-cli`，旧入口为迁移前状态
最后核对：2026-05-10

> 迁移完成记录：当前实现已落位到 `apps/cli/knowledge-cli`，旧的 `apps/knowledge-cli` 当前态目录不再存在。本文作为迁移设计背景保留，下文关于旧路径、路径分叉和“后续实现”的描述均代表迁移前状态或设计时观察，不应作为待执行计划重复执行。

## 背景

课程收官资料把企业知识库 RAG 拆成两条主线：

- RAG pipeline：数据索引、检索前处理、检索、检索后处理、答案生成。
- RAG 工程层：core、indexing、adapters、runtime、observability、eval 等边界。

设计时观察到，仓库的 `@agent/knowledge` 已经基本朝这个方向演进：`packages/knowledge` 承载 SDK 化的 indexing、retrieval runtime、RAG runtime、adapter surface 与 contract；`apps/backend/agent-server` 承载生产宿主 wiring；`apps/frontend/knowledge` 承载知识库前端工作台。

迁移前，CLI 入口存在明显分叉：

- 实际目录仍是 `apps/knowledge-cli`。
- `apps/knowledge-cli/package.json` 的测试脚本已经引用 `apps/cli/knowledge-cli/test`。
- `apps/knowledge-cli/README.md` 与 `docs/apps/knowledge-cli/knowledge-cli.md` 已按 `apps/cli/knowledge-cli` 书写使用方式。
- `pnpm-workspace.yaml` 已包含 `apps/*/*`，支持二级 app 分组。

因此，本设计当时聚焦于确认 CLI 归位和 RAG 边界，不触达代理 graph 或 agent 执行链。迁移完成后，当前真实源码入口是 `apps/cli/knowledge-cli`，正式使用说明继续保留在 `/docs/apps/knowledge-cli/knowledge-cli.md`。

## 设计目标

- 在设计上确认 `apps` 下新增 `cli/` 分组。
- 将 `knowledge-cli` 的目标位置定义为 `apps/cli/knowledge-cli`。
- 保持 `packages/knowledge` 是 RAG SDK 主体，CLI 只作为 SDK 本地验证 app。
- 明确 `packages/knowledge/src/runtime` 与 `packages/knowledge/src/rag/runtime` 的职责差异，避免后续把 retrieval-only runtime 与 full RAG runtime 混用。
- 明确本轮不改 agents、不接生产向量库、不新增 observability 包。

## 非目标

- 不修改 `agents/*`，不新增子 Agent graph。
- 不改变 unified `agent-server` 的生产 Knowledge API。
- 不把 `knowledge-cli` 移入 `packages/knowledge`。
- 不把 CLI 升级为生产运维工具。
- 不新增真实 LLM generation、真实 embedding provider、pgvector / Chroma / OpenSearch 生产写入。
- 不拆分新的 `@agent/indexing`、`@agent/knowledge-runtime` 或 `@agent/observability` workspace 包。

## 推荐方案

设计采用“CLI app 分组归位，SDK 主体不拆包”的方案；该迁移已完成。

目标结构：

```text
apps/
  backend/
    agent-server/
  frontend/
    agent-admin/
    agent-chat/
    knowledge/
  cli/
    knowledge-cli/

packages/
  knowledge/
    src/core/
    src/indexing/
    src/runtime/
    src/rag/
    src/adapters/
```

`apps/cli/knowledge-cli` 是一个 app，而不是 package 内部脚手架。它通过 `@agent/knowledge` public exports 调用 SDK，证明 SDK 能脱离前端和 unified backend 跑通本地最小 RAG 闭环。

不采用继续保留 `apps/knowledge-cli` 的方案，因为它会让 `apps` 同时存在分组目录和单个 CLI app，后续增加 `runtime-cli`、`eval-cli` 或 `skill-cli` 时会继续扩散。

不采用 `packages/knowledge/cli` 的方案，因为 CLI 依赖命令行参数、文件系统、trace 文件和开发者体验，不属于 SDK public API，也不应进入 SDK 发布边界。

## 分层边界

### `packages/knowledge`

定位：可独立理解的 Knowledge / RAG SDK。

职责：

- 数据索引：本地 loader、chunking、source/chunk 写入 contract。
- 检索 runtime：query normalize、query variants、retrieval、post-retrieval、context expansion、context assembly。
- 完整 RAG runtime：planner、retrieval、answer provider、stream events。
- adapter surface：LangChain、Chroma、OpenAI-compatible、Supabase、OpenSearch 等 SDK 适配面。
- schema / contract：SDK 自有 JSON contract、RAG policy、retrieval result、stream event。

约束：

- 不依赖生产 backend、agent graph、runtime service 或 memory repository。
- 不直接读取 monorepo settings。
- 不把生产宿主能力内联回 SDK。

### `apps/cli/knowledge-cli`

定位：Knowledge SDK 的本地命令行验证 app。

职责：

- `index`：读取本地 `.md`、`.markdown`、`.txt`，调用 `runKnowledgeIndexing()` 生成 snapshot。
- `retrieval`：读取 snapshot，通过本地 search service 调用 `runKnowledgeRetrieval()`。
- `ask`：基于命中 chunk 做抽取式回答，展示 citations 和 debug hits。
- `--traceFile`：输出 JSONL trace，覆盖 `index`、`retrieval`、`answer` 阶段。

约束：

- 只能通过 `@agent/knowledge` public exports 调用 SDK。
- 不从 `packages/knowledge/src/**` 深导入。
- 不接真实生产配置、真实用户权限、真实向量库写入。
- 不宣称 `ask` 是 LLM generation；它只是 extractive answer demo。

### `apps/backend/agent-server`

定位：生产 Knowledge 宿主。

职责：

- 映射配置、凭据、租户、权限、provider、memory / database repository。
- 调用 `@agent/knowledge` 的 SDK contract。
- 对外暴露生产 HTTP / SSE / admin API。

约束：

- 生产 ingestion、chat、governance、observability 不下沉到 CLI。
- CLI 不反向成为 backend 的执行依赖。

### `agents/*`

定位：Agent graph 与专项 agent 宿主。

本设计不触达 agents。后续如果要让 agent 主链调用知识库，应单独设计 graph node、interrupt、tool result、evidence 与审批协议，不能借 CLI 迁移顺手改代理。

## Runtime 命名解释

当前 `packages/knowledge` 同时存在 `src/runtime` 与 `src/rag/runtime`，建议文档中固定语义：

- `packages/knowledge/src/runtime`：retrieval-only runtime，负责从用户 query 到可供生成使用的 hits / contextBundle / diagnostics。
- `packages/knowledge/src/rag/runtime`：full RAG runtime，负责 planner -> retrieval -> answer，以及 streaming event。

这两个目录可以暂时共存，但必须避免后续把 answer provider、planner、stream event 放回 `src/runtime`。

## 迁移前不合理点

1. CLI 真实目录与文档、脚本不一致。
2. `apps/knowledge-cli/package.json` 的 `predev` 相对路径按 `apps/cli/knowledge-cli` 推导，在旧目录下不合理。
3. `apps` 目录缺少 `cli/` 分组，后续 CLI app 缺少统一落点。
4. CLI 的 `ask` 是抽取式回答，应继续明确为 demo，不应和生产 answer generation 混淆。
5. retrieval diagnostics 与 CLI trace 已有最小观测能力，但还不是课程资料中完整的 observability observer/exporter 设计；当前不应过早新建观测包。

## 迁移设计（已执行）

迁移实施时按纯迁移优先，不夹带 RAG 行为修改：

1. 新建 `apps/cli/` 并移动 `apps/knowledge-cli` 到 `apps/cli/knowledge-cli`。
2. 更新所有 `apps/knowledge-cli` 路径引用为 `apps/cli/knowledge-cli`。
3. 检查 `package.json` 中相对路径：
   - `predev` 应继续指向 `../../../packages/knowledge build:lib`。
   - test / turbo test 路径应指向 `apps/cli/knowledge-cli/test`。
4. 保持 CLI package name 暂为 `knowledge-cli`，不强制改名为 `@agent/knowledge-cli`。
5. 更新 `docs/apps/knowledge-cli/knowledge-cli.md` 的适用范围和使用方式；文档路径可先保留在 `docs/apps/knowledge-cli/`，因为它描述的是 app，不是源码目录镜像。
6. 使用 `rg "apps/knowledge-cli"` 扫描并清理旧路径。

## Contract 影响

本设计不改变公开 API contract。

稳定边界保持为：

- CLI 只消费 `@agent/knowledge` exports。
- `@agent/knowledge` 不因 CLI 迁移新增 public API。
- `pnpm-workspace.yaml` 已覆盖 `apps/*/*`，无需新增 workspace glob。
- 若后续 CLI 需要真实 provider，必须先新增 CLI 配置 contract，再接入 provider adapter，不能直接读取 backend settings。

## Testing and Verification（实施时）

迁移实施时至少验证：

```bash
pnpm --dir apps/cli/knowledge-cli typecheck
pnpm --dir apps/cli/knowledge-cli test
pnpm check:docs
```

如果迁移触发 package graph 或 lockfile 变化，再补：

```bash
pnpm install
```

如果 `packages/knowledge` 也被修改，再补：

```bash
pnpm --dir packages/knowledge typecheck
pnpm --dir packages/knowledge test
pnpm --dir packages/knowledge build:lib
```

## Documentation Impact（实施时）

迁移实施时需要同步更新：

- `apps/cli/knowledge-cli/README.md`
- `docs/apps/knowledge-cli/knowledge-cli.md`
- `docs/superpowers/plans/*knowledge*` 中仍指向旧目录的计划文档，如仍属于 current 入口则更新；历史计划可保留但需要避免被当作当前入口。

交付前必须执行：

```bash
rg "apps/knowledge-cli|knowledge-cli" docs apps package.json turbo.json pnpm-workspace.yaml
```

并清理与当前目录冲突的描述。

## Success Criteria

- 仓库中不存在当前态的 `apps/knowledge-cli` 目录。
- `apps/cli/knowledge-cli` 能被 pnpm workspace 识别。
- CLI README、正式 docs、package scripts 与真实目录一致。
- CLI 仍能跑通 index / retrieval / ask 的本地闭环。
- `packages/knowledge` 的 SDK 边界不因 CLI 迁移变宽。
- agents 目录无改动。

## 待确认

默认建议保留 package name 为 `knowledge-cli`。如果后续希望所有 workspace app 都带 scope，可单独设计命名迁移为 `@agent/knowledge-cli`，但这不应阻塞目录归位。
