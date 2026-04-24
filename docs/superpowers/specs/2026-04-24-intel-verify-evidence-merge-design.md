# Intel Verify And Evidence Merge Design

状态：current
文档类型：note
适用范围：`agents/intel-engine`、`apps/backend/agent-server/src/runtime/intel`、`docs/backend/frontend-ai-intel-system-design.md`
最后更新：2026-04-24
最后核对：2026-04-24

## 1. 背景

当前 `pnpm verify` 已通过文档、Prettier、ESLint、TypeScript typecheck 与 spec 层，但在 `test:unit` 阶段被 Intel 相关测试阻断。失败集中在 `agents/intel-engine` 与 backend Intel runner，直接原因是 `better-sqlite3` 原生模块的 Node ABI 与当前 Node 运行时不匹配。

同时，Intel 设计文档记录了一个真实未完成点：`raw_events -> merged signal` 的证据归并仍偏轻量。当前 digest 已能基于 `signal_sources` 生成 evidence summary，但 patrol 阶段还没有把 raw search result 到 merged signal 的证据绑定作为一等闭环明确收口。

本设计采用 C1：收口式修复。它保留现有 graph、service、repository 分层，只补齐 SQLite 初始化诊断和 patrol 证据归并，不引入新的存储抽象或跨前端治理 UI。

## 2. 目标

- 让 Intel SQLite 初始化失败时输出清晰、可行动的诊断信息，尤其是 `better-sqlite3` ABI mismatch。
- 保持真实 SQLite repository 测试覆盖，不把 native storage 全部替换成 fake。
- 在 patrol 链路中明确完成 `rawResults/raw_events -> normalizedSignals -> mergedSignals -> signal_sources` 的证据归并。
- 让同一 merged signal 可以累积多个 official/community source refs，并继续被 digest evidence summary 使用。
- 更新 `docs/backend/frontend-ai-intel-system-design.md`，反映新的证据归并状态与验证 blocker 状态。
- 恢复或明确证明 `pnpm verify` 的 Intel 阻断已消除；若本机 native 模块仍阻断，错误必须能直接说明修复动作。

## 3. 非目标

- 不接真实 Lark webhook、真实网络或真实 Minimax MCP 搜索作为阻塞验收。
- 不新增 `agent-admin` Evidence Center、Learning Center 或 Connector & Policy UI。
- 不实现 MCP `sse` / `streamable-http` transport。
- 不把 Intel storage 全面抽象成新的 provider/fake repository 体系。
- 不新增跨包稳定 evidence contract，除非现有 `@agent/core` Intel schema 无法表达本轮需求。

## 4. 现有链路

当前 Intel patrol 链路按下列顺序工作：

```text
config/intel/*.yaml
-> patrol graph
-> searchTasks
-> rawResults
-> raw_events
-> normalizedSignals
-> dedupe/merge
-> scoredSignals
-> alerts
-> deliveries
```

Digest 链路已经通过 `signalSources.listBySignalIds()` 构造 `signalEvidence`，并在 markdown 中展示 source count、official/community count 与 source references。

## 5. 设计

### 5.1 SQLite 初始化诊断

在 `agents/intel-engine/src/runtime/storage/intel-db.ts` 附近增加一个窄错误归一化边界。

行为：

- `createIntelDatabase(databaseFile)` 仍负责创建目录、打开 SQLite、初始化表结构。
- 当 `new Database(databaseFile)` 抛出 native binding / ABI mismatch 错误时，包装成项目可读错误。
- 新错误必须包含：
  - `better-sqlite3`
  - 当前错误属于 native module / Node ABI mismatch
  - 建议重新安装或 rebuild workspace 依赖
  - 原始错误作为 `cause` 保留
- 非 ABI 类错误保持原始语义向上抛出，避免把路径、权限、SQL 初始化问题误报成依赖问题。

这层不吞错、不降级、不自动执行安装命令。

### 5.2 Patrol 证据归并

Patrol 证据归并在现有节点和 repository 之上补齐，不改变 digest 读取链路。

数据规则：

- 每条 `PatrolSearchResult` 都解析出稳定 `contentHash`。
- `normalizeSignalsNode` 继续用 `dedupeKey` 识别事件同一性。
- `dedupeAndMergeNode` 继续负责把 incoming signal 合并到 existing signal。
- 新增或扩展一个 patrol evidence persistence 步骤，把 raw result 映射为 `IntelSignalSource` 并写入 `signal_sources`。
- 写入维持当前幂等约束：`signal_id + content_hash`。
- 同一 merged signal 可关联多个来源。
- `sourceType` 继续使用 `official | community`，供 digest evidence summary 统计。

映射策略：

- `signalId` 使用最终 merged/scored signal 的 `id`。
- `contentHash` 使用 raw result 的显式 `contentHash`，缺省时沿用当前 raw event hash 生成规则。
- `sourceName`、`sourceType`、`title`、`url`、`snippet`、`publishedAt`、`fetchedAt` 来自 raw result。
- `createdAt` 使用当前 job 的可测试时间输入，避免测试依赖真实时钟。

如果一个 raw result 的 normalized signal 被合并到既有 signal，source 必须挂到既有 signal 的 `id`，而不是临时 incoming id。

### 5.3 Digest 复用

Digest 不新增 storage 查询方式。它继续通过：

```text
daily digest collected signals
-> signalSources.listBySignalIds(signalIds)
-> buildSignalEvidence()
-> renderDigestContentNode()
```

本轮只补测试，证明 patrol 写入的多个 source refs 能在 digest evidence summary 中呈现 official/community source count。

## 6. 错误处理

- ABI mismatch：抛出带明确诊断的新错误，并保留 `cause`。
- SQLite 路径或权限错误：保持失败，不做自动 fallback。
- source 写入冲突：沿用当前 `ON CONFLICT(signal_id, content_hash) DO UPDATE`，保证重复 patrol 不制造重复 evidence。
- raw result 缺少 `contentHash`：使用确定性 fallback hash，不使用随机值。
- merge 后找不到对应 signal：视为实现错误，应由测试覆盖并失败，而不是静默丢 evidence。

## 7. 测试计划

### Spec / Unit

- `intel-db` 或 repository storage 层：模拟 ABI mismatch，断言错误信息可行动且保留 cause。
- `normalize / dedupe / evidence`：两个 raw result 归并到同一个 signal 后，写入两条 `signal_sources`。
- `repository`：重复写入相同 `signal_id + content_hash` 时保持幂等更新。
- `digest`：多个 source refs 能生成正确 source count、official/community count 与 references。
- backend `intel-runner`：继续覆盖 patrol、digest、retry 三类 scheduled job。

### Verification

本轮实现后至少执行：

```bash
pnpm test:unit
pnpm verify
```

如果本地 native ABI 仍阻断，则必须在交付说明中记录新错误信息，并说明是否属于本轮代码逻辑问题。

## 8. 文档更新

更新 `docs/backend/frontend-ai-intel-system-design.md`：

- 把 `raw_events -> merged signal` 证据归并偏轻量改为当前真实状态。
- 删除或改写“根级 `pnpm verify` 当前仍会被 Prettier 红灯阻断”的过时描述。
- 补充后续仍未覆盖的范围，例如 admin Evidence Center UI 与真实外部服务验收。

## 9. 验收标准

- Intel 相关 unit 测试不再因不透明 native stack 阻断。
- `signal_sources` 成为 patrol evidence 的确定性落点。
- 同一 signal 的多来源 evidence 可被 digest summary 读取并展示。
- `pnpm verify` 能跑完整，或在 native 环境异常时给出明确可行动错误。
- 实现不破坏 `agents/intel-engine` graph/service/repository 宿主边界。
