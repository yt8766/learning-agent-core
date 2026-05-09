# Legacy Data Import

状态：current
文档类型：reference
适用范围：`apps/backend/agent-server/src/runtime/legacy-data-import`
最后核对：2026-05-08

`LEGACY_DATA_IMPORT=once` 是 root `data/*` 退役期间的一次性导入入口。它只读取旧文件，不写回、不删除、不迁移 root `data/` 默认持久化路径，也不恢复 root data fallback。

## 当前实现

- 入口：`src/runtime/legacy-data-import/index.ts`
- Runner：`LegacyDataImportRunner`
- Repository contract：`LegacyDataImportRepository`
- 测试用实现：`InMemoryLegacyDataImportRepository`
- Postgres-ready 实现：`SqlLegacyDataImportRepository`
- Env factory：`createLegacyDataImportRunnerFromEnv`

Runner 会扫描 `dataRoot` 下这些旧目录：

- `runtime`
- `memory`
- `rules`
- `knowledge`
- `skills`

只处理 `.json` 和 `.jsonl` 文件。`.json` 文件如果是数组，则数组元素逐条导入；如果是对象或其他 JSON 值，则作为单条记录导入。`.jsonl` 文件按非空行逐条解析，坏行记录 error，其他有效行继续导入。

## 幂等语义

每条导入记录都有稳定 `receiptKey`，由 domain、相对 source file、item index 和稳定序列化后的 payload 计算。Repository 在 `hasReceipt(receiptKey)` 为 true 时跳过该记录，因此重复运行不会重复导入已 receipt 的 payload。

parse/read/write 类错误通过稳定 `errorKey` 去重。坏 JSONL 行会写入 error receipt，并保留 domain、source file、format、line number、error code 和 message，便于后续人工处理。

Runner 不删除源文件，也不修改源文件内容。root `data/*` 的删除仍必须等 root-data deprecation 计划全部完成后执行。

## Postgres 装配边界

`createLegacyDataImportRunnerFromEnv()` 仅在 `LEGACY_DATA_IMPORT=once` 时启用：

- 未提供 `DATABASE_URL`：返回 in-memory repository，适合测试或本地 dry-run 骨架验证。
- `BACKEND_PERSISTENCE=postgres` 但未提供 `DATABASE_URL`：直接失败。legacy import SQL staging 当前只接受 `DATABASE_URL`，不得在 DB_HOST-only Postgres 部署中静默退回 in-memory repository。
- 提供 `DATABASE_URL`：创建 SQL client，执行 `LEGACY_DATA_IMPORT_SCHEMA_SQL`，并返回 `SqlLegacyDataImportRepository`。
- 提供 `domainWriters`：先创建上述 staging repository，再包装为 `CompositeLegacyDataImportRepository`。创建阶段只完成装配，不会调用 writer。

当前 SQL repository 写三类 backend-owned 表：

- `legacy_data_import_records`
- `legacy_data_import_receipts`
- `legacy_data_import_errors`

这些表用于保留导入骨架、receipts 和 errors。它们不是 memory、rules、knowledge、skills 的终态 domain repository。

## Bootstrap 与领域写入边界

`createLegacyDataImportRunnerFromEnv()` 可接收 `domainWriters`，用于把 legacy import bootstrap 连接到各领域 repository 或 adapter。启用后，runner 仍只负责扫描旧文件、解析 `.json` / `.jsonl`、计算 receipt/error key，并把 parsed record 交给 repository contract。

`CompositeLegacyDataImportRepository` 的职责顺序是：

1. 先向 staging repository 记录 import row。
2. 再按 `record.domain` 把 parsed record 转交对应 domain writer。

domain writer 负责 schema validation、payload 到领域模型的映射、以及真实领域 repository 写入。runner 不得直接导入 backend domain services，也不得在扫描流程中内联 memory、rules、knowledge、skills 的业务映射。

## 风险与后续

当前导入骨架尚未默认接入真实 Postgres domain repositories，因此生产环境即使启用 SQL repository，也只是把旧 payload 收敛到 backend-owned legacy import tables，并写入 receipts/errors。后续需要通过 `domainWriters` 为 memory、rules、knowledge、skills、runtime state 分别补 mapper 或领域 repository 适配，再逐步删除 root `data/*`。

涉及导入语义变更时，优先更新本文件和 `docs/superpowers/plans/2026-05-07-root-data-deprecation.md`，并运行：

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/legacy-data-import/legacy-data-import.runner.test.ts
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm check:docs
```
