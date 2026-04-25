# Project Health Audit Report

状态：snapshot
文档类型：note
适用范围：仓库级项目健康审计结果与修复计划
最后核对：2026-04-25

## 摘要

本次审计按 [Project Health Audit Design](/docs/superpowers/specs/2026-04-25-project-health-audit-design.md) 执行，采用只读扫描与并行子代理审计，覆盖工作区交付状态、API 文档一致性、包边界、schema-first、graph/flow/service 分层、重复实现、安全凭据、数据恢复、可观察性、依赖治理和前端工程质量。

总体结论：

- 当前没有发现 `pnpm` workspace 把 `.next` 生成包误识别为 workspace package；`pnpm list -r --depth -1` 只列出真实 workspace 包。
- `pnpm check:package-boundaries` 与 `pnpm check:source-artifacts` 当前通过，但审计发现它们仍有覆盖缺口。
- 主要风险集中在 4 类：安全凭据与 token 边界、API 文档和实现漂移、官方 agent / graph 分层漂移、运行态数据恢复与错误脱敏。
- 当前工作区存在大量 `apps/llm-gateway` 未提交改动；本报告把这些标为“未提交改动风险”，不把它们直接视为主干稳定状态。

## P0 阻断交付

### P0-1 根 `.env` 存在真实凭据形态

- 优先级：P0
- 问题：根 `.env` 中存在模型 provider key、MCP key、Lark webhook 等真实凭据形态。
- 证据：`.env:8`、`.env:20`、`.env:32`、`.env:42`；`git ls-files .env` 为空，说明文件未被 Git 跟踪但当前工作区可读。
- 影响：本机、日志、共享工作区或误打包泄露后，可直接调用外部服务或推送 webhook。
- 建议：立即轮换这些凭据；保留 `.env.example` 占位，真实值移到本机 secret manager 或部署平台 secret。报告和后续提交都不得复述真实值。
- 确定性：已确认。
- 处理类型：blocked。

## P1 高风险漂移

### P1-1 后端 app 直接依赖 `@agent/agents-intel-engine`，边界检查未覆盖

- 优先级：P1
- 问题：`apps/backend` 直接依赖并装配专项 official agent，绕过 `platform-runtime` 官方组合根；边界脚本未识别该新 official agent。
- 证据：`apps/backend/agent-server/package.json:33` 声明 `@agent/agents-intel-engine`；`apps/backend/agent-server/src/runtime/intel/intel-runner.ts:3` 直接 import `createIntelRepositories/execute*`；`scripts/check-package-boundaries.js:78` 的 official set 未包含 `@agent/agents-intel-engine`，但 `pnpm check:package-boundaries` 仍通过。
- 影响：`apps/*` 启动适配器边界被绕过，后续新增 official agent 容易继续逃逸治理。
- 建议：将 intel official 装配收敛到 `packages/platform-runtime` 或专门 facade，backend 只调用 runtime/core；同时把 `@agent/agents-intel-engine` 纳入边界脚本。
- 确定性：已确认。
- 处理类型：structural。

### P1-2 `llm-gateway` 新 HTTP API 未纳入 `docs/api` 主契约目录

- 优先级：P1
- 问题：当前未提交 `apps/llm-gateway` 改动引入 `/api/v1/*` 与 `/api/admin/auth/*`，但 `docs/api` 仍只列 agent-server API。
- 证据：`docs/api/README.md:8` 声明 `docs/api/` 是 API 契约唯一主入口；`apps/llm-gateway/app/api/v1/chat/completions/route.ts:5`、`apps/llm-gateway/app/api/admin/auth/login/route.ts:4` 已有路由。
- 影响：新消费者只能从代码或 integration 文档猜测 route、DTO、错误码、SSE 和鉴权语义。
- 建议：新增 `docs/api/llm-gateway.md` 并从 `docs/api/README.md` 链接；或明确声明 llm-gateway API 不归入主 API 目录，并在 `docs/frontend/llm-gateway` 补完整契约。
- 确定性：已确认。
- 处理类型：structural。

### P1-3 `llm-gateway` 管理端 refresh token 暴露给 `localStorage`

- 优先级：P1
- 问题：管理端 access/refresh token 存在浏览器 `localStorage`，未使用 HttpOnly/SameSite cookie 边界。
- 证据：`apps/llm-gateway/src/auth/admin-client-auth.ts:45`、`:82`、`:251` 操作 token storage；`apps/llm-gateway/src/auth/admin-auth.ts:241` 到 `:247` 的 session cookie 入口为空实现。
- 影响：任意 XSS 可读取 refresh token 并长期接管 admin 会话。
- 建议：改成服务端 HttpOnly Secure SameSite cookie，refresh token 不暴露给 JS；前端只做会话状态探测。
- 确定性：已确认。
- 处理类型：structural。

### P1-4 运行时错误原文和 stack 会被持久化并展示

- 优先级：P1
- 问题：运行时错误原文与 stack 会进入 trace/progress/agent state，并在 admin UI 展示。
- 证据：`packages/runtime/src/graphs/main/runtime/knowledge/main-graph-knowledge.ts:153` 到 `:223`、`:300` 到 `:329`；`apps/frontend/agent-admin/src/features/runtime-overview/components/runtime-summary-agent-errors.tsx:95`、`:146` 到 `:160`。
- 影响：provider error、工具 stderr、内部路径或 token 片段可能被持久化并展示给管理员或诊断任务。
- 建议：新增统一 `sanitizeRuntimeError()`，UI 展示 `errorCode + traceId + sanitizedSummary`；stack 只在受控 debug 模式或脱敏审计中可见。
- 确定性：已确认。
- 处理类型：structural。

### P1-5 运行态快照 JSON 解析失败会静默返回空状态

- 优先级：P1
- 问题：runtime state snapshot 解析失败时，repository 返回空 tasks/events/checkpoints/governance。
- 证据：`packages/memory/src/repositories/runtime-state-repository.ts:213` 到 `:321` 的 catch 分支；保存时 `:324` 到 `:327` 直接 `writeFile`。
- 影响：`data/runtime/tasks-state.json` 一旦损坏、半写或 schema 不兼容，任务、checkpoint、审批、治理记录可能表现为“全部消失”。
- 建议：使用 zod 解析、错误归因、备份文件、原子写入和坏快照隔离恢复。
- 确定性：已确认。
- 处理类型：structural。

### P1-6 `packages/core` 仍混入非 schema-first contract 与运行态 graph 契约

- 优先级：P1
- 问题：`packages/core` 有多组长期公共 contract 仍是裸 interface/type，且包含 graph state/handler 运行态契约。
- 证据：`packages/core/src/contracts/data-report/data-report-json.ts:29` 到 `:124`；`packages/core/src/contracts/data-report/data-report.ts:30` 到 `:112`；`packages/core/src/contracts/chat/chat-graph.ts:12`；`packages/core/src/contracts/platform-console/platform-console.ts:3`。
- 影响：稳定公共 contract 缺少 schema parse 回归，`core` 同时承载公共语言和运行态 aggregate，违背 schema-first 与真实宿主边界。
- 建议：稳定输入输出补 zod schema 并由 `z.infer` 推导；graph state/handlers 下沉到 `packages/runtime` 或对应 agent 宿主。
- 确定性：已确认。
- 处理类型：structural。

### P1-7 部分 graph 文件仍承载业务执行和仓储适配

- 优先级：P1
- 问题：部分 graph 文件不只做 state/wiring，还直接执行服务、拼 repository adapter、处理 stage callback 或 side effects。
- 证据：`agents/intel-engine/src/graphs/intel/intel.graph.ts:90` 到 `:170`；`packages/runtime/src/graphs/main/tasking/context/main-graph-task-context.ts:28` 到 `:180`；`packages/runtime/src/graphs/main/execution/pipeline/main-graph-pipeline-graph.ts:190` 到 `:325`。
- 影响：graph/flow/service 分层漂移，graph 文件变成半 service/半 orchestration，后续节点拆分、测试和恢复语义变重。
- 建议：intel 的 `run*State` 下沉到 `flows/intel/nodes`；runtime context/pipeline 适配下沉到 `flows/runtime-stage` 或 `runtime/`，graph 保留 Annotation、节点注册和边。
- 确定性：已确认。
- 处理类型：structural。

### P1-8 backend chat report-schema 链路仍掌握 data-report 专项策略

- 优先级：P1
- 问题：backend chat helper 仍编排 data-report bundle flow、SSE stage/heartbeat/cache，并实现节点级模型策略。
- 证据：`apps/backend/agent-server/src/chat/chat-report-schema.helpers.ts:17`；`:245` 到 `:361`。
- 影响：虽然有 `runtime-data-report-facade`，backend 仍掌握 data-report 专项流程策略，和“apps/backend 只做 HTTP/SSE 装配并调用 facade”不完全一致。
- 建议：将 model policy、cache key、heartbeat/stage 映射下沉到 `agents/data-report` runtime facade 或 `platform-runtime` data-report facade；backend 只转发 DTO 与 SSE event。
- 确定性：已确认。
- 处理类型：structural。

### P1-9 `@agent/memory` 源码依赖 `@agent/core` 但 package 未声明

- 优先级：P1
- 问题：`packages/memory` 源码直接 import `@agent/core`，但 `packages/memory/package.json` 未声明该依赖。
- 证据：`packages/memory/src/repositories/memory-repository.ts:5` 到 `:14`；`packages/memory/src/repositories/runtime-state-repository.ts:5` 到 `:21`；`packages/memory/package.json:36` 到 `:39` 只声明 `@agent/adapters` 与 `@agent/config`。
- 影响：违反依赖声明策略；独立包解析、发布或严格安装时可能失败。
- 建议：在 `packages/memory/package.json` 显式声明 `@agent/core` 并同步 `pnpm-lock.yaml`。
- 确定性：已确认。
- 处理类型：quick win。

## P2 可维护性债务

### P2-1 `apps/llm-gateway/src/auth/admin-auth.ts` 达到 400 行红线

- 优先级：P2
- 问题：`admin-auth.ts` 正好 400 行，且是认证安全核心文件。
- 证据：行数扫描显示 `400 apps/llm-gateway/src/auth/admin-auth.ts`；文件同时包含 auth service、route singleton、JWT 签发/校验、env bootstrap、Response error mapping、Next redirect/session stub。
- 影响：后续触达该文件必须拆分；认证、token、repository、route adapter 职责继续耦合会抬高安全变更风险。
- 建议：拆到 `admin-auth.service.ts`、`admin-token.ts`、`admin-auth-route-runtime.ts` 等边界，并补 auth contract/parse 回归。
- 确定性：已确认。
- 处理类型：structural。

### P2-2 `agents/supervisor/src` 存在 `.d.ts.map` 声明映射产物

- 优先级：P2
- 问题：源码目录存在声明映射产物。
- 证据：`agents/supervisor/src/workflows/workflow-preset-registry.d.ts.map`；`pnpm check:source-artifacts` 当前通过，说明脚本未覆盖 `.d.ts.map`；`.gitignore` 只忽略 `packages/*/src/**/*.d.ts.map`，未覆盖 `agents/*/src/**/*.d.ts.map`。
- 影响：违反“声明产物不回写 src”规范，污染源码扫描与 workspace hygiene。
- 建议：清理该文件；修正 `check-source-artifacts` 的匹配与 `.gitignore`，覆盖 agents 下 `.d.ts.map`。
- 确定性：已确认。
- 处理类型：quick win。

### P2-3 `agent-chat` SSE JSON parse 缺少 malformed payload 保护

- 优先级：P2
- 问题：SSE event handler 直接 `JSON.parse(raw.data)`，没有局部 try/catch 或 fallback。
- 证据：`apps/frontend/agent-chat/src/hooks/chat-session/chat-session-stream-binding.ts:103`；同文件 `:137` 到 `:172` 才处理 `onerror` fallback。
- 影响：后端或代理层输出异常 SSE payload 时，前端事件处理器可能抛出未捕获异常，而不是进入 checkpoint/detail fallback。
- 建议：把 SSE event parse 收敛成 helper，失败时设置可观测错误并触发 detail/checkpoint fallback。
- 确定性：已确认。
- 处理类型：quick win。

### P2-4 Runtime execution mode alias 责任在文档和前端之间分叉

- 优先级：P2
- 问题：`docs/api/runtime.md` 要求前端不维护 legacy alias 映射，但两个前端都维护并写入请求。
- 证据：`docs/api/runtime.md:67`；`apps/frontend/agent-admin/src/lib/runtime-semantics.ts:23`；`apps/frontend/agent-chat/src/lib/runtime-semantics.ts:2`。
- 影响：文档边界与实现责任分叉，后续可能前后端各自改 alias。
- 建议：二选一：文档改为“前端仅在分享链接/历史输入边界做 canonical 化”；或移除前端 alias 映射，统一由后端兼容读取。
- 确定性：已确认。
- 处理类型：structural。

### P2-5 `agent-chat` SSE 事件文档遗漏 core schema 与前端消费事件

- 优先级：P2
- 问题：`docs/api/agent-chat.md` 事件列表未覆盖多个 core schema 与前端实际消费事件。
- 证据：`docs/api/agent-chat.md:70`；`packages/core/src/tasking/schemas/chat.ts:115`；`apps/frontend/agent-chat/src/hooks/chat-session/chat-session-formatters.ts:7`。
- 影响：新增前端或外部客户端会漏处理终态、进度和恢复事件。
- 建议：事件表拆成 canonical、compat、UI-only/observability 三类，并补关键 payload 字段。
- 确定性：已确认。
- 处理类型：quick win。

### P2-6 `ApprovalResumeInput` 文档少写 `feedback` 和 `value`

- 优先级：P2
- 问题：恢复输入文档只列 `interruptId/action/payload`，缺少 core schema 中的 `feedback` 与 `value`。
- 证据：`docs/api/agent-chat.md:58`；`docs/api/approvals.md:47`；`packages/core/src/governance/schemas/governance.schema.ts:62`。
- 影响：plan-question、supplemental-input 等恢复输入可能被新调用方错误塞进 `payload`。
- 建议：补齐字段和各 action 的推荐字段组合。
- 确定性：已确认。
- 处理类型：quick win。

### P2-7 `agent-admin.md` 未覆盖 briefing platform API

- 优先级：P2
- 问题：后端已有 `/api/platform/briefings/*`，前端也消费，但 `docs/api/agent-admin.md` 未列该专题接口。
- 证据：`apps/backend/agent-server/src/platform/platform-briefings.controller.ts:20`；`apps/frontend/agent-admin/src/api/admin-api-platform.ts:168`；`docs/api/agent-admin.md:39`。
- 影响：后台运行简报链路没有稳定 API 契约入口。
- 建议：补到 `agent-admin.md`，或单独新增 runtime briefing API 文档并从 API README 链接。
- 确定性：已确认。
- 处理类型：quick win。

### P2-8 `llm-gateway` API Key 管理文档与 HTTP route 接线状态不一致

- 优先级：P2
- 问题：`docs/frontend/llm-gateway/README.md` 声称 API Key 管理 contract 已稳定，但当前只看到 auth 与 `/api/v1/*` route，没有 admin API key 管理 route。
- 证据：`docs/frontend/llm-gateway/README.md:52`；`apps/llm-gateway/src/contracts/admin-api-key.ts:31`；`find apps/llm-gateway/app/api/admin -type f` 只返回 auth route。
- 影响：读者会误以为后台 key 列表/详情/创建 HTTP API 已可用。
- 建议：把文档改为“内部 contract/服务已就绪，HTTP route 未接线”，或补齐并文档化 admin key routes。
- 确定性：已确认。
- 处理类型：blocked。

### P2-9 Memory JSONL 单行损坏会被静默跳过

- 优先级：P2
- 问题：memory repository 读取 JSONL 时，单行 parse/normalize 失败直接跳过。
- 证据：`packages/memory/src/repositories/memory-repository.ts:269` 到 `:285`。
- 影响：学习记录、evidence link、用户偏好可能部分丢失且无告警，治理中心无法定位坏行。
- 建议：记录坏行位置和原因，隔离到 `.corrupt` 或审计事件；读取时返回健康状态。
- 确定性：已确认。
- 处理类型：quick win。

### P2-10 Postgres admin auth 缺少版本化迁移策略

- 优先级：P2
- 问题：Postgres admin auth 通过 `create table if not exists` 自动建表，但无 migration 版本/回滚策略。
- 证据：`apps/llm-gateway/src/repositories/postgres-admin-auth.ts:116` 到 `:162`。
- 影响：后续字段、索引、约束调整无法可靠演进，本地和生产 schema 可能漂移。
- 建议：引入轻量 migrations 表和版本化迁移，补旧 schema 升级测试。
- 确定性：已确认。
- 处理类型：structural。

### P2-11 前端源码仍有 inline import type

- 优先级：P2
- 问题：`agent-admin` 页面中使用 `ReturnType<typeof import(...)>` 作为类型。
- 证据：`apps/frontend/agent-admin/src/pages/dashboard/dashboard-center-content.tsx:18`。
- 影响：违反前端静态 import/type 规范。
- 建议：从 `use-admin-dashboard` 导出 `AdminDashboardState` 类型，或在文件顶部 `import type`。
- 确定性：已确认。
- 处理类型：quick win。

### P2-12 `agent-admin` dashboard refresh effect 可能重复触发

- 优先级：P2
- 问题：通用 page change refresh 与 runtime/filter 专项 refresh 可能重复调用 `refreshPageCenter('runtime')`。
- 证据：`apps/frontend/agent-admin/src/hooks/use-admin-dashboard.ts:204` 到 `:221`。
- 影响：页面切换或过滤变化时可能重复请求，放大运行态中心刷新压力。
- 建议：合并 refresh owner，按 `page + filters` 统一派发；或让 page change effect 排除专项 filter owner。
- 确定性：需进一步用网络面板或测试验证触发次数。
- 处理类型：structural。

### P2-13 build/types 复制依赖包内部路径，审计噪声较大

- 优先级：P2
- 问题：`agents/*/build/types/packages/*` 与大型 graph declaration 产物大量存在。
- 证据：`find agents -path '*/build/types/packages/*'` 命中大量路径；`agents/data-report/build/types/.../data-report-json.graph.d.ts` 可达 2256 行。
- 影响：虽不在 `src`，但 build/types 把依赖包内部路径复制进 agent 产物，静态审计和包边界扫描容易被噪声淹没，也提示 declaration 输出入口可能过宽。
- 建议：检查各 agent `tsconfig.types.json` / tsup declaration 配置，只生成公开入口声明；审计脚本默认 prune `build`。
- 确定性：已确认。
- 处理类型：quick win。

## P3 后续优化

### P3-1 `agent-admin` 导航文案仍写“六大中心”，实际暴露更多专项入口

- 优先级：P3
- 问题：后台导航实际暴露 12 个中心/专项入口，但文案仍写“六大中心”。
- 证据：`apps/frontend/agent-admin/src/components/app-sidebar.tsx:60` 到 `:88`；`:175`。
- 影响：产品职责没有漂移到聊天产品，但治理信息架构文案与真实入口数量不一致，后续 AI 容易误判六大中心边界。
- 建议：保留六大治理主轴，把额外入口标为专项治理/扩展中心，或更新规范说明。
- 确定性：已确认。
- 处理类型：quick win。

### P3-2 `.worktrees/llm-gateway-e2e/node_modules` 会污染宽泛扫描

- 优先级：P3
- 问题：仓库内存在 `.worktrees/llm-gateway-e2e/node_modules`，宽泛 `find` 会扫到大量 package manifests。
- 证据：`.gitignore:90` 忽略 `.worktrees`，但目录仍在当前工作区。
- 影响：依赖盘点、package 搜索、健康审计容易误把隔离 worktree 依赖当主仓库依赖。
- 建议：审计脚本默认 prune `.worktrees`、`.next`、`node_modules`；长期将 worktree 放到仓库外。
- 确定性：已确认。
- 处理类型：quick win。

## 重复实现与职责分叉

- thin compat：backend domain skills/connectors 文件多为薄 re-export，例如 `runtime-skill-auto-install.ts`、`runtime-skill-install-paths.ts`、`runtime-skill-search-resolution.ts`、`runtime-connector-governance-state.ts`。当前合理，但应保留迁移注释和删除计划。
- thin compat：Approvals Center 投影 backend 文件 `runtime-approvals-center.ts` 仅 re-export `@agent/runtime`，当前合理。
- should converge：runtime center / platform console 投影横跨 backend 与 platform-runtime。`packages/platform-runtime/src/centers/runtime-center-projection.build.ts` 负责 projection，backend 仍包装显示名、agent error、workflow metadata、fallback shell 和 normalize。建议继续把纯 projection / fallback record builder 下沉到 `platform-runtime`。
- should converge：report-schema direct response 策略在 backend 与 data-report agent 间分叉。backend 既调用 facade，又定义 node model policy/cache/SSE stage；建议归并到 data-report facade。
- behavior fork：official agent 边界治理未识别 `agents-intel-engine`，backend 已直连但检查脚本未报错。

## 前后端与 API 文档一致性

重点不一致项：

- `llm-gateway` 新 API 面未纳入 `docs/api` 主入口。
- Runtime execution mode alias 的责任在文档与前端实现之间分叉。
- `agent-chat` SSE 文档遗漏终态、进度、恢复等事件。
- `ApprovalResumeInput` 文档漏写 `feedback` 与 `value`。
- `agent-admin` 文档漏写 briefing platform API。
- `llm-gateway` API Key 文档与 route 接线状态不一致。

非问题：

- `docs/api/*` 写 `/api/...`，前端 client 写 `/chat`、`/platform`，是因为 `VITE_API_BASE_URL` 默认包含 `/api`。
- `GET /api/chat/stream` 只写 `data: <JSON>`，不使用自定义 `event:` 字段，与当前实现一致。
- `/v1/*` 到 `/api/v1/*` rewrite 有 `apps/llm-gateway/vercel.json` 支撑，不只是口头约定。

## 安全、凭据与数据恢复风险

优先级最高的风险：

1. 根 `.env` 真实凭据形态：需要人工轮换与 secret 管理迁移。
2. `llm-gateway` refresh token 暴露在 `localStorage`：需要迁移到 HttpOnly cookie。
3. runtime raw error/stack 持久化并展示：需要统一脱敏。
4. runtime snapshot 解析失败静默清空：需要 schema parse、原子写入和坏快照隔离。
5. memory JSONL 坏行静默跳过：需要坏行审计与恢复提示。

## 未提交 llm-gateway 改动风险

当前未提交 `apps/llm-gateway` 改动较多，且涉及 auth、provider、rate-limit、secrets、admin contracts、routes、tests、docs、lockfile。审计建议在继续实现前先收口这些风险：

- `admin-auth.ts` 已达 400 行，继续改动前应拆分。
- 新 route/API 面应先有 `docs/api/llm-gateway.md` 或明确文档归属。
- refresh token 不应进入 `localStorage`。
- API Key 管理文档应准确区分“contract/service 已就绪”和“HTTP route 已接线”。
- Postgres auth schema 需要迁移版本策略。
  <<<<<<< HEAD
  <<<<<<< HEAD
  =======
  > > > > > > > 2a7d071b (fix: harden runtime state and agent boundaries)

## 修复进展

截至 `2026-04-25`，已完成第一批与第二批可安全收口项：

- 已修复源码产物检查缺口：`check-source-artifacts` 现在覆盖 `agents/*/src/**/*.d.ts.map`，并清理 `agents/supervisor/src/workflows/workflow-preset-registry.d.ts.map`。
- 已修复 `agent-chat` malformed SSE payload 风险：事件解析失败会进入 checkpoint/detail fallback，不再从 `onmessage` 抛出未捕获 `SyntaxError`。
- 已修复 `agent-admin` inline import type，并将侧栏分组文案改为“治理中心与专项入口”。
- 已补齐 `agent-chat` / `approvals` / `agent-admin` 中 Approval resume、SSE 事件与 briefing API 的关键文档缺口；这些文档文件当前仍混有既有未提交改动，后续应单独收口。
- 已把 `@agent/agents-intel-engine` 纳入 official agent 边界检查，并将 backend intel 定时任务执行收口到 `@agent/platform-runtime` facade，backend 仅保留 `runtime/core/runtime-intel-facade.ts` 入口。
- 已修复 runtime state snapshot 损坏静默清空问题：缺文件保持空状态兼容，损坏 JSON/normalize 失败改为带路径上下文抛错；保存改为同目录临时文件 + rename，避免并发读到半写 JSON。
- 已为 memory JSONL 坏行增加 repository health 状态，合法行继续读取，坏行行号与原因可通过 `getHealthStatus()` 观察。
  <<<<<<< HEAD
  =======
  > > > > > > > # fa3e0f19 (docs: add project health audit report)
  > > > > > > >
  > > > > > > > 2a7d071b (fix: harden runtime state and agent boundaries)
- 现有 `package.json` 与 `pnpm-lock.yaml` 已在工作区修改，提交前必须确认 lockfile importer 与依赖声明同步。

## Watchlist

这些文件接近 400 行或职责偏重，暂不全部列为立即修复项，但后续触达时应优先拆分：

- `agents/intel-engine/src/runtime/storage/intel.repositories.ts`：398 行。
- `apps/backend/agent-server/src/chat/chat-direct-response.helpers.ts`：393 行。
- `apps/frontend/agent-admin/src/features/run-observatory/run-observatory-compare-support.ts`：385 行。
- `apps/frontend/agent-admin/src/components/app-sidebar.tsx`：372 行。
- `apps/frontend/agent-admin/src/hooks/use-admin-dashboard.ts`：359 行。
- `apps/frontend/agent-chat/src/api/chat-api.ts`：366 行。
- `apps/frontend/agent-chat/src/hooks/chat-session/chat-session-checkpoint.ts`：352 行。
- `apps/frontend/agent-chat/src/hooks/chat-session/chat-session-events.ts`：351 行。
- `apps/llm-gateway/src/gateway/gateway-service.ts`：366 行，当前未提交改动。
- `packages/templates/src/reports/.../TaskCompleteMetrics.tsx`：387 行，但属于模板资产，优先级低于运行时代码。

## 修复计划

### Batch 1：低风险高收益

目标：先清掉明显污染和文档漂移，降低后续审计噪声。

- 清理 `agents/supervisor/src/workflows/workflow-preset-registry.d.ts.map`，修正 `check-source-artifacts` 与 `.gitignore` 覆盖 `agents/*/src/**/*.d.ts.map`。
- 补 `@agent/memory` 对 `@agent/core` 的依赖声明并同步 `pnpm-lock.yaml`。
- 补 `ApprovalResumeInput` 的 `feedback/value` 文档。
- 补 `agent-chat` SSE event 文档表。
- 补 `agent-admin` briefing platform API 文档。
- 修复 `dashboard-center-content.tsx` inline import type。
- 为 `agent-chat` SSE malformed JSON 增加 parse helper 与 fallback 测试。

验证策略：`pnpm check:docs`、`pnpm check:source-artifacts`、`pnpm check:package-boundaries`、受影响前端 `tsc`、相关 Vitest。

### Batch 2：边界收敛

目标：修正高风险边界漂移。

- 将 `@agent/agents-intel-engine` 纳入 `platform-runtime` 官方装配或专门 facade，backend 不再直接依赖 official agent。
- 更新 `check-package-boundaries`，覆盖 `@agent/agents-intel-engine` 与未来 official agent 扩展规则。
- 将 `PlatformRuntimeMetadata.SubgraphDescriptor` 从 supervisor agent 类型中解耦。
- 将 report-schema node model policy、cache key、SSE stage 映射下沉到 data-report facade。
- 明确 Runtime execution mode alias 责任：改文档或改前端实现。
- 新增或完善 `docs/api/llm-gateway.md`。

验证策略：`pnpm check:architecture`、`pnpm build:lib`、`pnpm --dir apps/backend/agent-server build`、相关 contract/spec tests。

### Batch 3：安全、数据和结构性治理

目标：处理需要设计和迁移的结构问题。

- 轮换根 `.env` 中真实凭据，并迁移到 secret manager 或部署平台 secret。
- 将 `llm-gateway` admin refresh token 从 `localStorage` 迁移到 HttpOnly Secure SameSite cookie。
- 增加 runtime error 脱敏 facade，UI 只展示 sanitized summary、code、traceId。
- 为 runtime snapshot repository 引入 zod parse、原子写入、备份和坏快照隔离恢复。
- 为 memory JSONL 坏行增加审计事件和隔离策略。
- 为 Postgres admin auth 增加 migration 表和版本化迁移。
- 将 `core` 中 graph state/handlers 与非 schema-first contract 分阶段迁出或补 schema。
- 将 graph 文件中的服务调用、仓储适配和业务 fallback 下沉到 flows/runtime 层。

验证策略：按模块补 TDD；至少覆盖 Type、Spec、Unit、Demo、Integration；最终跑 `pnpm verify`，若被无关环境阻断则按影响范围逐层补齐并记录 blocker。

## 验证记录

已执行只读检查：

- `git status --short`
- `git branch --show-current`
- `git log --oneline -8`
- `find packages agents apps ... -name package.json`
- `find packages agents apps ... -name '*.d.ts' -o -name '*.d.ts.map'`
- `find packages agents apps ... -exec wc -l`
- `find packages agents apps ... -name '*.test.ts' ...`
- `pnpm list -r --depth -1`
- `pnpm check:source-artifacts`
- `pnpm check:package-boundaries`
- 多组 `rg` / `sed` / `nl` 针对 API、graph、schema、security、frontend runtime 和 dependency surfaces。

待报告写入后执行：

- `pnpm check:docs`
