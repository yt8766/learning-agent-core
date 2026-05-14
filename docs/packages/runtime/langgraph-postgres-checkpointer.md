# LangGraph PostgreSQL Persistence

状态：current
文档类型：guide
适用范围：`packages/runtime`
最后核对：2026-05-03

## Checkpointer 当前实现

`packages/runtime` 默认仍使用 LangGraph `MemorySaver`，便于本地开发、单测和无数据库启动。生产或需要跨进程恢复 LangGraph 状态时，可通过配置切换到官方 `@langchain/langgraph-checkpoint-postgres` 的 `PostgresSaver`。

入口：

- 配置解析：`packages/config/src/loaders/settings-loader.ts`
- checkpointer 工厂：`packages/runtime/src/runtime/langgraph-checkpointer.ts`
- runtime 装配：`packages/runtime/src/orchestration/main-graph-runtime-modules.ts`
- 初始化时机：`AgentOrchestrator.initialize()`

## 配置

启用 PostgreSQL：

```bash
LANGGRAPH_CHECKPOINTER=postgres
LANGGRAPH_POSTGRES_URI='postgresql://postgres:postgres@localhost:5442/postgres?sslmode=disable'
LANGGRAPH_POSTGRES_SCHEMA=agent_runtime
```

兼容变量：

- `LANGGRAPH_CHECKPOINT_POSTGRES_URI`
- `LANGGRAPH_CHECKPOINT_POSTGRES_SCHEMA`

默认值：

- `LANGGRAPH_CHECKPOINTER` 未配置时为 `memory`
- `LANGGRAPH_POSTGRES_SCHEMA` 未配置时为 `public`
- `LANGGRAPH_POSTGRES_SETUP_ON_INITIALIZE` 未配置时为 `true`

`LANGGRAPH_CHECKPOINTER=postgres` 时必须提供连接串；缺失会 fail fast，避免运行到 graph 中断或 resume 时才暴露持久化不可用。

## 初始化语义

Postgres 模式下，runtime 会在 `AgentOrchestrator.initialize()` 中调用 `PostgresSaver.setup()`。这个调用负责创建并迁移 LangGraph checkpoint 表结构，必须早于任何主链 graph 编译后的 invoke/resume。

如需由外部迁移系统管理表结构，可设置：

```bash
LANGGRAPH_POSTGRES_SETUP_ON_INITIALIZE=false
```

关闭后 runtime 只创建 `PostgresSaver` 并注入 graph，不主动建表；调用方必须保证数据库 schema 已经就绪。

## Graph 注入边界

主链仍通过 `BaseCheckpointSaver` 注入，不允许在 graph、node、flow 或 backend service 内直接创建 `PostgresSaver`。

当前注入路径：

1. `createLangGraphCheckpointer(settings.langGraphCheckpointer)` 创建 checkpointer handle。
2. `MainGraphBridge` 持有 `graphCheckpointer`。
3. `buildTaskPipelineGraph(...)`、`buildDirectReplyInterruptGraph(...)`、`buildTaskBootstrapInterruptGraph(...)` 在 `compile({ checkpointer })` 时注入。

后续新增依赖 checkpoint 的 graph 时，应继续复用这条 runtime 装配路径，不要在具体 graph 文件里读取 env 或新建数据库连接。

## 验证

最小回归：

```bash
pnpm exec vitest run --config vitest.config.js packages/config/test/settings.test.ts -t "defaults LangGraph checkpoints"
pnpm --dir packages/runtime test -- langgraph-checkpointer-factory.test.ts
pnpm exec tsc -p packages/runtime/tsconfig.json --noEmit
```

如果配置或 `package.json` 发生变化，还需要确认 `pnpm-lock.yaml` 已同步。

## 长期 Store 当前实现

Checkpoint 只负责单个 thread 内的短期状态恢复、interrupt resume 与时间旅行；长期记忆必须走 LangGraph Store。

当前 runtime 通过 `packages/runtime/src/runtime/langgraph-store.ts` 创建长期 Store：

- `LANGGRAPH_STORE` 未配置时使用 `InMemoryStore`
- `LANGGRAPH_STORE=postgres` 时使用 `@langchain/langgraph-checkpoint-postgres/store` 的 `PostgresStore`
- JS/TS 侧当前官方包没有 `AsyncPostgresStore` 导出；本文档中的生产 Postgres Store 对应 `PostgresStore`
- 当前仓库仍使用 CommonJS + `moduleResolution: Node`；`packages/runtime/types/langgraph-checkpoint-postgres-store/index.d.ts` 为 `@langchain/langgraph-checkpoint-postgres/store` 提供窄化类型声明。runtime 只在 `LANGGRAPH_STORE=postgres` 分支通过 `langgraph-postgres-store-loader` 同步加载官方子路径，避免 memory store、demo 或源码态执行误触发第三方 Postgres store 包。
- 语义搜索默认开启，但只有 `KNOWLEDGE_EMBEDDING_DIMENSIONS` 大于 `0` 且 runtime embedding provider 可用时才创建向量索引

配置：

```bash
LANGGRAPH_STORE=postgres
LANGGRAPH_STORE_POSTGRES_URI='postgresql://postgres:postgres@localhost:5442/postgres?sslmode=disable'
LANGGRAPH_STORE_POSTGRES_SCHEMA=agent_memory
LANGGRAPH_STORE_POSTGRES_SETUP_ON_INITIALIZE=true
LANGGRAPH_STORE_SEMANTIC_SEARCH=true
LANGGRAPH_STORE_INDEX_FIELDS='$.text,$.summary,$.content'
LANGGRAPH_STORE_DISTANCE_METRIC=cosine
```

默认值：

- `LANGGRAPH_STORE`：`memory`
- `LANGGRAPH_STORE_POSTGRES_SCHEMA`：`public`
- `LANGGRAPH_STORE_POSTGRES_SETUP_ON_INITIALIZE`：`true`
- `LANGGRAPH_STORE_SEMANTIC_SEARCH`：`true`
- `LANGGRAPH_STORE_INDEX_FIELDS`：`$.text,$.summary,$.content`

`LANGGRAPH_STORE=postgres` 时必须提供 `LANGGRAPH_STORE_POSTGRES_URI`；缺失会 fail fast。

## Store 注入边界

长期 Store 和 checkpoint 一样，只允许在 runtime 装配层创建并注入 graph：

1. `loadSettings(...)` 解析 `settings.langGraphStore`
2. `createLangGraphStore(settings.langGraphStore)` 创建 Store handle
3. `AgentOrchestrator.initialize()` 调用 Store 初始化
4. 主链 graph 通过 `compile({ checkpointer, store })` 注入
5. `AgentOrchestrator.close()` 关闭 Store，再关闭 checkpointer

graph、node、flow、backend service 不允许直接读取 env 或新建 `PostgresStore`。如果节点需要读写长期记忆，应通过 LangGraph runtime store 或本仓 runtime/memory facade，并保持 namespace 带上 user / workspace / org 等隔离维度。

## 与 RAG 的关系

长期 Store 与 RAG 不冲突：

- Store 面向用户画像、偏好、长期事实、程序性经验，生命周期跨 thread
- RAG 面向外部知识库、文档 chunk、资料检索和权限化语料
- 两者可以在上下文组装阶段并行或串行召回，但必须保留不同 evidence/source 类型

不要把 RAG 命中的资料直接当长期记忆写入 Store；也不要把用户偏好和画像沉到知识库 chunk。长期记忆写入仍需经过 `packages/memory` 的 evidence、confidence、scope 与治理语义。
