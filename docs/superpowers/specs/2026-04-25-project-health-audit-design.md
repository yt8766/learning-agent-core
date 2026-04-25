# Project Health Audit Design

状态：snapshot
文档类型：note
适用范围：仓库级项目健康审计与后续修复计划
最后核对：2026-04-25

## 背景

本仓库是面向开发自治的多 Agent monorepo，长期方向包含 `Human / Supervisor / 六部`、`agent-chat` 前线作战面、`agent-admin` 后台治理面，以及 `runtime / platform-runtime / agents / packages/core` 的分层边界。

当前仓库规范已经较强：schema-first contract、API 文档先行、graph/flow/service 分层、五层验证、文档同步和 package boundary 校验。本次审计的核心目标不是泛泛列代码味道，而是找出真实实现与这些长期约束之间的漂移、重复实现、前后端契约不一致，以及会影响后续交付的高风险债务。

本设计只定义审计和修复计划产出方式，不包含代码修改。

## 审计模式

采用风险分层综合审计，覆盖架构边界、工程质量、产品链路、前后端/API 一致性、重复实现、安全与凭据、数据持久化、可观察恢复和依赖治理，但按风险排序，不追求一次扫完每个角落。

风险分级：

- `P0 阻断交付`：会导致 `pnpm verify`、workspace 解析、构建、测试、依赖图或安全边界明显失败的问题。
- `P1 高风险漂移`：与仓库长期规范冲突，继续发展会破坏架构边界或前后端契约，例如 app 直连内部实现、schema-first 失守、graph/flow 职责混杂、API 文档与真实实现不一致。
- `P2 可维护性债务`：大文件临界、重复逻辑、compat 长期残留、测试覆盖薄弱、生成物或模板边界不清。
- `P3 后续优化`：体验、性能、脚本 ergonomics、文档索引、开发效率类改进。

## 证据标准

每条问题必须尽量提供可复核证据：

- 文件路径、代码位置、文档位置或静态扫描结果。
- 对应影响面：交付、架构边界、前后端一致性、可维护性、产品体验或验证体系。
- 确定性标记：`已确认` 或 `需进一步验证`。

不确定项不能写成事实，应明确说明还需要用哪类命令、测试或人工确认来验证。

当前工作区存在一批 `apps/llm-gateway` 相关未提交改动。审计报告必须区分：

- 主干或既有结构中的问题。
- 当前未提交开发改动引入或暴露的问题。

## 审计维度

### 1. 工作区与交付状态

检查未提交变更、构建产物、声明产物、lockfile/package 漂移、workspace glob 是否误纳入产物，以及 `.gitignore` 与实际生成物是否一致。

重点关注：

- `apps/llm-gateway` 未提交改动是否与当前 spec 或计划状态一致。
- `.next`、`build/types`、`.d.ts.map` 等生成物是否污染源码扫描或 workspace 解析。
- 新增或修改 `package.json` 后 `pnpm-lock.yaml` 是否同步。

### 2. 包与应用边界

检查 `apps/*` 是否直连 `packages/*/src`、`agents/*/src`，`runtime / platform-runtime / agents` 是否遵守分层，应用层是否只通过稳定 `@agent/*` 根入口消费能力。

重点关注：

- `apps/backend` 是否绕过 `@agent/platform-runtime` 或 runtime facade 拼官方 agent。
- `packages/runtime` 是否重新依赖具体 `agents/*` 实现。
- `packages/core` 是否混入运行时 aggregate、helper 或非 schema-first 稳定 contract。

### 3. 契约与 schema-first

检查稳定 DTO、API payload、SSE event、tool result、graph state 切片、approval/recover record 是否有 schema，是否存在裸 `JSON.parse` 后直接信任或手写 if 替代 schema parse 的长期 contract。

允许例外：

- 日志、测试 fixture、内部临时文件读取等非稳定外部 contract。
- 边界层中有明确错误处理和转换语义的局部 parse。

### 4. API 文档一致性

以 `docs/api/*.md` 为基准，对照后端 controller/route/DTO/schema、前端 `api/*`、types、页面消费字段和测试 fixture。

重点检查：

- `agent-chat`、`agent-admin`、`approvals`、`runtime`、`run-observatory` 文档与真实实现是否一致。
- 请求字段、响应字段、错误语义、兼容字段和事件 payload 是否发生分叉。
- 前端是否绕过 API 文档猜测字段，或后端是否新增字段但没有同步文档。

### 5. Graph / Flow / Service 分层

检查 graph 是否只做 state 与 wiring，flow 是否承载节点实现、prompt、schema、解析和重试策略，backend service 是否只做 HTTP/SSE/鉴权/运行时装配。

重点关注：

- `packages/runtime/src/graphs` 是否堆入过多业务节点实现。
- `agents/*/src/flows` 是否按 nodes/prompts/schemas/types 收敛。
- backend controller/service 是否内联子 Agent prompt、模型输出解析或 report/data flow。

### 6. 重复实现与职责分叉

把重复实现作为重点审计项，而不是只作为普通代码风格问题。

检查对象：

- runtime center 投影、approval/interrupt 兼容、skill/search/governance。
- `llm-gateway` auth/contracts/repository/provider 相关实现。
- 前端 API 类型映射、normalizer、runtime semantics。
- facade、adapter、repository、helper 是否在 backend、runtime、platform-runtime、agents 间重复承担同一职责。

结论分类：

- 合理的 thin compat。
- 应收敛的重复逻辑。
- 已造成行为分叉的重复实现。

### 7. 工程质量与可维护性

检查 400 行红线、重复逻辑、死代码、声明产物污染、测试位置、动态导入、前端副作用和空 catch。

重点关注：

- 达到或接近 400 行的源码文件是否已经承担过多职责。
- `src/` 下是否存在误生成声明产物。
- `src/**/*.test.ts` 是否真实违反测试目录规范，或只是脚手架模板资产。
- 前端是否存在无清理的轮询、SSE fallback、定时器或隐式自激刷新。

### 8. 验证与文档体系

检查根级 `verify`、affected 校验、docs 索引、模块 README、过时文档、计划/spec 与真实状态是否分叉。

重点关注：

- `pnpm verify` 是否仍覆盖规范要求的五层验证。
- `pnpm verify:affected` 是否包含治理门槛、Spec、Demo 和 Integration。
- 新增实现是否有对应 docs 沉淀，旧文档是否仍误导后续 AI。

### 9. 安全与凭据边界

检查配置、鉴权、密钥、日志、错误响应与外部 provider 调用是否泄露敏感信息，或把安全语义散落到业务层。

重点关注：

- `.env`、`.env.example`、docker compose、示例配置是否区分真实密钥与占位值。
- API key、admin auth、cookie/session、password hash、provider secret 是否有清晰边界和测试覆盖。
- 日志、SSE、error response、provider error mapping 是否可能输出 token、secret、原始上游凭据或内部堆栈。
- `apps/llm-gateway` 中 auth、provider、rate-limit、secrets 相关未提交改动是否引入 P0/P1 风险。

### 10. 数据持久化与迁移风险

检查本地数据、数据库、缓存、运行态 checkpoint、memory/evidence/task record 的 schema 演进与兼容读取。

重点关注：

- `data/*`、repository、Postgres、Redis、本地 JSON 存储是否有明确职责边界。
- 新旧 schema 字段是否有默认值、兼容读取、迁移或回滚策略。
- checkpoint、interrupt history、memory、evidence、task record 的失败恢复是否可证明。
- 清理策略是否会误删用户运行数据、学习记录、审批记录或审计证据。

### 11. 运行时可观察性与可恢复性

检查长流程是否满足项目要求的 `cancel / recover / observe`，以及用户和管理员能否看清任务卡在哪里。

重点关注：

- 关键阶段是否输出 trace、checkpoint、event、interrupt、错误归因或后台任务状态。
- `agent-chat` 是否能展示 Think、ThoughtChain、Evidence、Approval、Learning 与 recover 状态。
- `agent-admin` 是否能从 Runtime / Approvals / Evidence / Learning 视角定位失败原因。
- 后台 worker、scheduler、briefing、provider 调用失败后是否有可恢复路径或明确降级语义。

### 12. 依赖与供应链治理

检查依赖声明、vendor 边界、重复依赖和工具链使用是否符合仓库规则。

重点关注：

- 子包源码直接 import 的依赖是否声明在对应 `package.json`，而不是只依赖根包偶然存在。
- 是否存在重复声明、未使用依赖、重资产依赖或过时依赖。
- 第三方 SDK、provider response/error/event 是否被 adapter/facade 转成项目自定义语义，避免穿透业务层。
- lockfile、workspace importer、CI 安装入口和本地安装策略是否一致。

## 报告结构

审计报告按问题条目输出，每条包含：

- `优先级`：P0/P1/P2/P3。
- `问题`：一句话说明不合理之处。
- `证据`：文件路径、代码位置、文档位置或扫描结果。
- `影响`：会影响交付、架构边界、前后端一致性、可维护性还是体验。
- `建议`：应该收敛到哪里，是否需要测试或文档。
- `确定性`：已确认 / 需进一步验证。
- `处理类型`：`quick win`、`structural` 或 `blocked`。

报告必须单列以下章节：

- 重复实现与职责分叉。
- 前后端实现和 `docs/api` 的一致性。
- 未提交 `apps/llm-gateway` 改动带来的临时风险。
- 生成物、声明产物、模板目录等边界问题。
- 安全与凭据边界。
- 数据持久化、迁移和恢复风险。
- 依赖与供应链治理。

处理类型说明：

- `quick win`：低风险、低耦合，通常半天内可以通过小改动清理。
- `structural`：需要设计、测试、迁移或跨模块协作，不能直接当作顺手修。
- `blocked`：需要人工决策、凭据、外部环境、产品取舍或历史上下文确认。

## 后续修复计划格式

审计完成后，修复计划按批次组织：

- `Batch 1`：低风险高收益。清理明显污染、文档漂移、检查脚本覆盖缺口。
- `Batch 2`：边界收敛。合并重复实现、补 schema/contract、修正前后端/API 对齐。
- `Batch 3`：较大结构优化。大文件拆分、graph/flow/service 迁移、体验与验证链路增强。

每个批次必须写清：

- 目标。
- 文件范围。
- 测试策略。
- 文档更新点。
- 风险与回滚方式。

## 非目标

本次设计不要求：

- 直接修改生产代码。
- 一次性修复所有审计发现。
- 对每个文件做逐行 code review。
- 在审计阶段执行破坏性清理。
- 把当前未提交 `apps/llm-gateway` 改动自动视为主干事实。

## 完成条件

审计设计完成后，应进入以下后续流程：

1. 用户审阅并确认本 spec。
2. 进入 implementation plan 阶段，为审计执行写出可操作计划。
3. 执行只读审计，产出项目健康报告。
4. 基于报告拆分修复计划，等待用户确认后再进入修复实施。
