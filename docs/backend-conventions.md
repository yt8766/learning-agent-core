# 后端规范

适用范围：

- `apps/backend/agent-server`
- `apps/worker`
- 与后端运行时直接相关的 `packages/*`

## 1. 技术边界

- 后端统一使用 `NestJS + TypeScript`
- 所有后端源码文件使用 `.ts`
- 应用层只通过 `@agent/*` 使用共享包
- 禁止应用层直连 `packages/*/src`
- 禁止应用层依赖其他应用的 `dist` 或 package 的 `build` 路径

## 2. 目录与模块规范

### `apps/backend/agent-server/src`

- `app/`：健康检查与轻量应用级信息
- `chat/`：会话、消息、SSE、恢复
- `tasks/`：内部执行观测与调试接口
- `approvals/`：审批接口
- `learning/`：学习确认与文档学习入口
- `memory/`：memory API 门面
- `rules/`：rules API 门面
- `skills/`：skills API 门面
- `runtime/`：后端运行时门面
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

当规模需要时再增加：

- `dto/*.ts`
- `types/*.ts`
- `constants/*.ts`

### `apps/worker/src`

- `bootstrap/`：worker 启动装配
- `jobs/`：任务与学习任务入口
- `consumers/`：事件或队列消费
- `runtime/`：调用 `@agent/agent-core`
- `recovery/`：checkpoint 恢复
- `health/`：健康与运行状态

## 3. 分层规范

- `controller`：收发请求、参数转换、调用 service
- `service`：业务编排与领域逻辑入口
- `module`：只做依赖组织
- 复杂复用逻辑进入 `packages/*`
- `RuntimeService` 作为后端运行时门面

禁止：

- 在 `controller` 中写复杂编排逻辑
- 在 `module` 中写业务逻辑
- 将可复用逻辑散落在多个 Nest 模块中复制实现

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

推荐结构示例：

- `data/memory/`
- `data/runtime/`
- `data/skills/`
- `data/logs/`（如果后续决定统一日志目录）

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

## 8. 包引用规范

推荐：

- `@agent/shared`
- `@agent/agent-core`
- `@agent/memory`
- `@agent/tools`
- `@agent/skills`

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

- 根级 `eslint.config.mjs`
- 根级 `prettier.config.js`
- 根级 `husky`
- 各 app/package 必要的 `tsconfig`

不要新增：

- 每个后端应用独立一套 ESLint
- 每个子目录独立一套 Prettier
- 大量重复脚本和重复检查配置
