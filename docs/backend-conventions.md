# 后端规范

状态：current
文档类型：convention
适用范围：后端工程规范
最后核对：2026-04-19

适用范围：

- `apps/backend/agent-server`
- `apps/worker`
- 与后端运行时直接相关的 `packages/*`

## 1. 技术边界

- 后端统一使用 `NestJS + TypeScript`
- 所有后端源码文件使用 `.ts`
- 应用层只通过 `@agent/*` 使用共享包
- 禁止应用层直连 `packages/*/src`、`agents/*/src`，也禁止依赖 `@agent/<pkg>/<subpath>`
- 禁止应用层依赖其他应用的 `dist` 或 package 的 `build` 路径
- 当前仓库已通过 `apps/worker/test/app-dependency-boundary.test.ts` 对 `apps/backend/agent-server`、`apps/frontend/*` 与 `apps/worker` 统一执行应用层依赖边界校验

## 2. 目录与模块规范

本节默认对齐 NestJS 官方的 feature module 组织方式：按业务域分目录，每个模块围绕 `module / controller / service` 展开，DTO 与接口放在模块目录内，而不是全局散落。

参考：

- [NestJS Modules](https://docs.nestjs.com/modules)
- [NestJS Controllers](https://docs.nestjs.com/controllers)
- [NestJS Providers](https://docs.nestjs.com/providers)

### `apps/backend/agent-server/src`

- `app/`：健康检查与轻量应用级信息
- `chat/`：会话、消息、SSE、恢复
- `message-gateway/`：消息网关相关 DTO、接口与规范化逻辑
- `tasks/`：内部执行观测与调试接口
- `approvals/`：审批接口
- `learning/`：学习确认与文档学习入口
- `evidence/`：evidence API 门面
- `memory/`：memory API 门面
- `rules/`：rules API 门面
- `skills/`：skills API 门面
- `templates/`：模板查询与模板接口
- `platform/`：平台视图与整包 console 相关接口；`platform console` 默认拆成 per-center controller，不再堆单一总 controller
- `runtime/`：后端运行时门面
- `cors/`：跨域配置
- `logger/`：日志模块、filter、middleware、interceptor
- `common/`：跨模块复用的 Nest 通用层
  - `dto/`
  - `filters/`
  - `interceptors/`
  - `pipes/`
  - `decorators/`
  - `types/`

每个业务域默认包含：

- `*.module.ts`
- `*.controller.ts`
- `*.service.ts`
- `*.service.spec.ts`

当规模需要时再增加：

- `dto/*.ts`
- `entities/*.ts`
- `interfaces/*.ts`

推荐业务模块结构：

```text
<module>/
├── dto/
│   ├── create-<module>.dto.ts
│   └── update-<module>.dto.ts
├── entities/
│   └── <module>.entity.ts
├── interfaces/
├── <module>.module.ts
├── <module>.controller.ts
├── <module>.service.ts
└── <module>.service.spec.ts
```

补充约束：

- 后端业务模块目录默认只允许这三类子目录：
  - `dto/`
  - `entities/`
  - `interfaces/`
- 其中 `dto/`、`interfaces/` 直接对齐 NestJS 官方 feature module 示例；`entities/` 是在实际工程中针对数据库/持久化层补充的扩展目录
- `app/`、`logger/`、`runtime/` 作为现阶段基础设施/遗留目录，可暂不完全遵循这套业务模块模板
- `tasks/`、`approvals/`、`learning/` 已统一回到标准 Nest feature module 布局：`src/<domain>/<domain>.controller.ts` + `src/<domain>/<domain>.service.ts`
- `pnpm check:backend-structure` 当前同时接受两种布局：
  - 经典平铺布局：`src/<domain>/<domain>.controller.ts` + `src/<domain>/<domain>.service.ts`
  - 下沉收敛布局：`src/<domain>/<domain>.module.ts` + `src/modules/<domain>/controllers|services/*`
- `runtime/` 中的纯计算/持久化辅助片段，优先继续抽到 `src/modules/<domain>/services/*`；当前 `runtime-metrics` 已开始承接 usage/eval analytics 与 provider audit 真实实现，`runtime-governance` 也已开始承接治理快照聚合与持久化读取
- 其他新增或被修改的业务模块，应按上面的目录模板收敛，不再继续扩散 `types/`、`constants/`、`helpers/` 等随意命名子目录
- `common/` 不作为业务杂项收纳层，只承载 Nest HTTP 边界通用件：
  - 可放：query/body DTO、通用 parse pipe、装饰器、filter、interceptor、少量 HTTP 侧通用类型
  - 不可放：runtime 编排、业务 service、面向单一模块的 helper、临时兜底逻辑

### `apps/worker/src`

- `bootstrap/`：worker 启动装配
- `jobs/`：任务与学习任务入口
- `consumers/`：事件或队列消费
- `runtime/`：调用 `@agent/platform-runtime` 创建官方 runtime facade，并通过 `@agent/runtime` 使用 kernel 能力
- `recovery/`：checkpoint 恢复
- `health/`：健康与运行状态

## 3. 分层规范

- `controller`：收发请求、参数转换、调用 service
- `service`：业务编排与领域逻辑入口
- `module`：只做依赖组织
- 复杂复用逻辑进入 `packages/*`
- `RuntimeService` 作为后端运行时门面
- 官方 Agent 装配统一通过 `@agent/platform-runtime` 进入，backend 只选择装配方案并暴露 Nest 入口

禁止：

- 在 `controller` 中写复杂编排逻辑
- 在 `module` 中写业务逻辑
- 将可复用逻辑散落在多个 Nest 模块中复制实现
- 在 backend service 内直接拼官方 Agent graph、内联 Agent prompt、重建 report generation chain 或复制 worker runtime host

### Runtime 模块补充

`runtime/` 目录虽然属于基础设施层，但新代码也应遵守“按稳定 provider 分边界”的原则，不再继续向单一总门面回退。

当前推荐边界：

- `RuntimeTaskService`
  - task、approval、learning job
- `RuntimeSessionService`
  - session、message、checkpoint、recover、subscribe
- `RuntimeKnowledgeService`
  - memory、rule
- `RuntimeSkillCatalogService`
  - skill catalog 与治理
- `RuntimeCentersService`
  - Runtime / Learning / Evidence / Connectors / Skill Sources / Platform Console
- `RuntimeService`
  - 仅作为兼容 facade 与少量聚合入口

当前 `runtime/` 下的主要组织目录包括：

- `actions/`
- `architecture/`
- `briefings/`
- `centers/`
- `core/`
- `helpers/`
- `modules/`
- `knowledge/`
- `schedules/`
- `services/`
- `skills/`
- `testing/`
- `tools/`
- `wenyuan/`

额外约束：

- 稳定 runtime metrics / governance 主实现统一放在 `packages/runtime`
- backend 应直接依赖 `@agent/runtime` 根入口，不再恢复 `modules/runtime-metrics`、`modules/runtime-governance` compat 双轨

约束：

- 新增业务模块默认直接依赖最窄 provider，不要优先注入 `RuntimeService`
- `RuntimeService` 的测试重点应是 facade 聚合和兼容行为，而不是替代各 provider 自测
- `runtime/` 下如果出现再次逼近 400 行的 provider，应继续按领域边界拆分，而不是回到“大 service”
- `platform console` 这类跨中心聚合 payload，默认需要显式 schema/normalizer，不能再让 `any` / `unknown` 直接穿透到 controller、export helper 或前端边界
- `runtime/` 可以保留 Nest facade、SSE/HTTP DTO 适配、请求上下文、日志与错误映射
- `runtime/` 不应继续承接官方 Agent 默认注册、workflow registry、graph compile/invoke 默认装配；这些属于 `packages/platform-runtime`
- worker 与 backend 需要共享的 runtime 装配，只能上提到 `packages/platform-runtime`，不要让 worker 反向依赖 backend，也不要在两个 app 里复制装配

## 3.1 文件长度规范

- `apps/backend/agent-server/src` 与 `apps/worker/src` 下的手写源码文件，单文件默认不得超过 **400 行**
- `apps/backend/agent-server/test` 与 `apps/worker/test` 下的测试文件，也默认不得超过 **400 行**
- 超过 400 行必须拆分，优先拆到：
  - `dto/`
  - `entities/`
  - `interfaces/`
  - 额外 service/helper 文件（仅在确有必要时，并优先沉淀到共享包）
- 禁止把 controller、service 持续堆成超长“万能文件”
- 禁止把大量场景持续堆进单个超长 `*.spec.ts`；测试文件超过 400 行时，也必须按模块、场景或 helper 拆分

当前仓库已增加自动检查：

- `pnpm check:backend-structure`
- `pnpm check:staged` 在有后端改动时会自动执行这条检查

## 4. API 规范

- 所有外部接口统一使用 `/api` 前缀
- 路由命名保持资源导向和稳定
- `chat sessions` 是主产品入口
- `tasks` 保留为内部执行、观测和调试接口
- DTO 命名以 `Dto` 结尾
- 请求和响应必须有明确类型

## 5. 日志规范

- 统一使用项目 logger 模块
- 启动日志风格保持接近官方 Nest 输出
- 请求日志必须包含 `requestId` 与 `traceId`
- 对 `password`、`token`、`authorization`、`secret`、`apiKey` 等字段做脱敏
- 请求、响应、异常、启动日志风格保持一致

### 异常捕获（补充）

禁止：

- 空 `catch`：`catch {}` 或 `catch (_e) {}` 且块内无任何有效处理
- 无说明地吞掉异常，导致排障时无从追溯

`catch` 内至少具备其一：

- 使用项目 logger 记录（含 `requestId` / `traceId` 等已有上下文时一并带上），或
- 重新抛出、包装为 `HttpException` / 领域错误后抛出，或
- 经业务确认可忽略的降级路径，并用注释说明忽略条件与风险边界

与日志规范一致：不得记录密钥类敏感字段。

## 6. Agent 与持久化规范

- `AgentOrchestrator` 负责任务执行与图编排
- `SessionCoordinator` 负责聊天会话、消息、事件和 checkpoint
- `chat/stream` 是 SSE 事件流入口；普通文本 prompt 默认应优先命中 direct-reply 流式回复，复杂工作流请求再进入完整多 Agent 编排
- `session / task / approval / learning candidate` 必须支持恢复
- 高风险动作必须审批
- 学习产物先进入确认态，再写入长期存储

## 7. 本地数据目录规范

- 本地运行数据统一放在仓库根级 `data/`
- `data/` 与 `apps/`、`packages/` 同级
- 禁止把 memory、rules、skills、runtime state 等运行数据放进具体 app 目录
- 禁止新增 `apps/backend/agent-server/data` 这类应用内数据目录作为长期方案
- 后端读取和写入本地数据时，默认以仓库根级 `data/` 为准
- `apps/backend/agent-server/logs` 与历史遗留 `apps/backend/agent-server/data` 只允许承载可清理产物；需要定期清理时，优先使用 `pnpm --dir apps/backend/agent-server cleanup:artifacts`
- 清理策略默认只删除过期日志和 app-local 遗留数据；不要对根级 `data/memory`、`data/runtime`、`data/knowledge`、`data/skills` 做无差别删除
- 如果 app-local 目录与根级 `data/*` 同时存在同名运行时文件，根级 `data/*` 始终是唯一 canonical 数据源；app-local 副本应在本轮迁移内删除

推荐结构示例：

- `data/memory/`
- `data/runtime/`
- `data/skills/`
- `data/knowledge/`

### Runtime Profile 补充

后端和独立 runtime 入口应显式声明 profile，而不是默认共享同一套策略。

- `platform`
  - 平台宿主默认 profile
- `company`
  - 公司 Agent / worker 默认 profile
- `personal`
  - 个人 Agent 默认 profile
- `cli`
  - CLI / REPL 默认 profile

profile 至少应影响：

- 本地数据目录
- budget policy
- source policy
- skill source preset
- connector preset
- worker routing / specialist availability

### Context Strategy 补充

后端与独立 runtime 在创建任务时，应优先通过统一的 context strategy 生成任务上下文，而不是把整段聊天记录原样传入模型。

当前最小上下文切片应优先包含：

- 压缩后的会话摘要
- 最近若干轮原始消息
- top-K reused memory / rule / skill
- top-K evidence
- 上一轮 learning evaluation 摘要

检索实现应优先通过统一的 `MemorySearchService` 注入，而不是让 session、research、learning 各自直接拼 repository 查询。

task 创建阶段也应优先把统一检索层的命中结果映射到：

- `reusedMemories`
- `reusedRules`
- internal evidence

LearningFlow 在正式评分前，应优先先做一次基于当前 goal 的 reuse enrichment。

后续如果接向量库，应优先挂在 `VectorIndexRepository` 后面，而不是在具体 app/service 中直接接数据库 SDK。

当前仓库默认允许一个本地轻量实现作为过渡层：

- `LocalVectorIndexRepository`
  - 用于在没有外部向量库时提供基础排序能力
  - 不应替代后续正式 embedding/vector store 抽象

### Local Skill Search 补充

在远程 marketplace 没有完全接通前，后端应优先提供本地 skill suggestion 能力：

- 输入：
  - task goal
  - 已安装 skill
  - 本地 manifests
  - profile/source policy
- 输出：
  - ready/installable/blocked 三类本地候选

本地 skill manifest 应优先通过 `skills/*/SKILL.md` frontmatter loader 生成，而不是在 service 中长期手写硬编码 manifest。

本地安全评估至少应考虑：

- `allowed-tools`
- `approval-policy`
- `risk-level`
- `compatibility`
- `license`

当前统一安全评估产物必须包含：

- `verdict`
- `trustScore`
- `sourceTrustClass`
- `profileCompatible`
- `maxRiskLevel`
- `riskyTools`
- `missingDeclarations`

`low-risk-auto` 只能在以下条件同时满足时触发：

- `verdict = allow`
- `trustScore >= 70`
- 当前没有 ready installed skill 命中

不要在 app 层直接各自实现一套本地 skill 匹配逻辑，优先收敛到统一后端服务。

### Subgraph Trail 补充

后端运行时在执行 research / execution / review / skill-install / background-runner 这些正式子图时，应同步写入：

- `TaskRecord.subgraphTrail`
- `ChatCheckpointRecord.subgraphTrail`

不要只在 trace 文本里留下痕迹。admin 与审计回放需要能直接读取结构化子图轨迹。

### Budget Guard / Semantic Cache 补充

后端与独立 runtime 入口应统一复用 runtime 级预算守卫和缓存约束，不要在 controller / service 内自行拼装一套轻量逻辑。

当前约定：

- 每个任务的 `budgetState` 至少应维护：
  - `costBudgetUsd`
  - `costConsumedUsd`
  - `costConsumedCny`
  - `fallbackModelId`
  - `overBudget`
- provider usage 回写时，应同步更新 `TaskRecord.budgetState`
- 语义缓存当前先采用精确 prompt 指纹缓存
- 默认缓存文件由 runtime settings 提供：
  - `semanticCacheFilePath`

禁止：

- 在 app 层单独维护另一套 cost counter
- 在某个单独 controller 内新增私有 prompt cache
- 前后端各自发明成本预算字段

### Platform Runtime 补充

`packages/platform-runtime` 已成为 backend 与 worker 的官方装配入口：

- backend：
  - 加载 Nest provider
  - 解析 HTTP/SSE 请求
  - 构造 request auth/context
  - 通过 `createDefaultPlatformRuntime(...)` 选择官方装配方案
  - 调用 runtime facade 并映射响应、事件、错误
- worker：
  - 加载 settings/profile
  - 消费后台 job
  - 通过 `createDefaultPlatformRuntime(...)` 选择官方装配方案
  - 调用 runtime facade
  - 写回状态、事件、checkpoint

禁止：

- backend 或 worker 各自内联官方 Agent registry
- backend 或 worker 自己拼 `supervisor/coder/reviewer/data-report` graph
- backend 或 worker 直接依赖 `@agent/agents-*`
- worker 暴露平台 controller
- backend 复制 worker loop 或长流程后台驱动

## 8. 包引用规范

推荐：

- `@agent/core`
- `@agent/runtime`
- `@agent/platform-runtime`
- `@agent/memory`
- `@agent/tools`
- `@agent/skill-runtime`

禁止：

- `../../../../../packages/agent-core/src/...`
- `../build/...`
- `../dist/...`

## 9. 命名规范

- 文件名：`kebab-case`
- 类名：`PascalCase`
- DTO 文件：`*.dto.ts`
- 模块文件：`*.module.ts`
- 控制器文件：`*.controller.ts`
- 服务文件：`*.service.ts`

## 10. 后端检查建议

保留少量根级约束：

- 根级 `eslint.config.js`
- 根级 `prettier.config.js`
- 根级 `husky`
- 各 app/package 必要的 `tsconfig`

不要新增：

- 每个后端应用独立一套 ESLint
- 每个子目录独立一套 Prettier
- 大量重复脚本和重复检查配置
