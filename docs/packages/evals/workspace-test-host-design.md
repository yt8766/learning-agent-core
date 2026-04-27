# Workspace Test Host 设计

状态：current  
文档类型：architecture  
适用范围：workspace 根目录、`packages/*`、`agents/*`、`apps/*`、根级验证脚本与 CI 测试编排  
最后更新：2026-04-23
最后核对：2026-04-23

相关文档：

- [AGENTS](/AGENTS.md)
- [README](/README.md)
- [项目规范总览](/docs/conventions/project-conventions.md)
- [测试规范](/docs/conventions/test-conventions.md)
- [验证体系规范](/docs/packages/evals/verification-system-guidelines.md)
- [LangGraph 应用结构规范](/docs/conventions/langgraph-app-structure-guidelines.md)
- [架构总览](/docs/architecture/ARCHITECTURE.md)
- [API 文档目录](/docs/contracts/api/README.md)
- [前后端集成链路](/docs/integration/frontend-backend-integration.md)
- [Current System Flow](/docs/maps/system-flow-current-state.md)

## 1. 背景

当前仓库缺少与 `packages/`、`apps/`、`agents/` 同级的仓库级测试宿主，用来稳定承载两类测试：

- 跨包、跨宿主、跨链路的集成测试
- 仓库级最小冒烟闭环测试

随着系统继续沿"Human / Supervisor / 六部"方向演进，主风险点越来越集中在"边界之间是否还协作正确"，例如：

- `packages/core` contract 是否仍被 `runtime` 正确消费
- `platform-runtime` 是否仍能正确装配官方 agent
- backend 的 SSE / approval / recover 是否仍与前端消费契约一致
- runtime 主链、审批恢复、学习沉淀是否仍能跨宿主打通

这些验证如果继续散落在某个具体包内，容易出现以下问题：

- 某个宿主被迫承担全仓测试桶角色
- 测试语义和宿主职责不匹配
- 后续 CI 难以拆分仓库级 integration 与 smoke
- 跨包验证难以形成稳定治理边界

因此，需要在根级新增 `test/` 作为 workspace-level test host。

## 2. 目标

本设计的目标是：

- 为跨包、跨宿主、跨链路的 integration 测试提供稳定落点
- 为仓库级最小冒烟闭环提供稳定落点
- 让 CI 和验证脚本能显式区分"宿主内测试"与"仓库级测试"
- 不破坏现有宿主内测试规范，只补充边界之间的验证层

## 2.1 非目标

本设计明确不做以下事情：

- 不替代 `packages/*/test`、`apps/*/test`、`agents/*/test`
- 不替代 `packages/*/demo`
- 不把所有 unit / spec / schema parse 回归集中到根级 `test/`
- 不在第一阶段引入 `test/acceptance/`
- 不要求 workspace integration affected 一开始具备完整包图级精确映射；当前采用 changed paths 到根级 integration 用例的轻量映射策略

## 3. 宿主定位

根级 `test/` 是 workspace 级别的专用测试宿主，其物理位置放在 `packages/`、`apps/`、`agents/` 同级。

它只承载 workspace-level 测试，不承载任何宿主内原子测试。它不是任何一个包或应用的 `test/` 目录，也不是所有宿主测试的聚合桶。

所有可归属到单一宿主的测试，仍优先放在该宿主的 `test/` 目录，不要因为"方便"就上移到根级。

## 4. 职责划分

根级 `test/` 承载两类职责，且仅限这两类。

### 4.1 `Integration`

用于验证以下场景：

- 跨包 contract 协作
- 跨宿主装配协作
- 前后端协议联动
- 审批、恢复、SSE、runtime orchestration 等跨链路行为
- 不能自然归属到某个单一宿主的协同测试

### 4.2 `Smoke`

用于验证以下场景：

- workspace 最小 bootstrap
- 关键包根出口可加载
- 关键 runtime facade 可装配
- backend 最小启动与基本链路可用
- 前端最小壳层可启动或渲染
- 最短 happy path 是否仍可跑通

## 5. 与现有测试体系的关系

根级 `test/` 不是对现有测试规范的替代，而是补充。

当前推荐职责矩阵如下：

```text
packages/*/test         = 包内 unit / spec / integration
agents/*/test           = agent 内 unit / spec / integration
apps/*/test             = 应用内 unit / integration
packages/*/demo         = 包级最小闭环
test/integration        = 仓库级跨包 / 跨宿主 / 跨链路 integration
test/smoke              = 仓库级最小可运行闭环
```

## 6. 推荐目录结构

### 6.1 最小结构（当前阶段推荐）

```text
test/
├─ README.md
├─ integration/
│  ├─ runtime/
│  ├─ backend/
│  ├─ frontend-backend/
│  ├─ packages/
│  ├─ fixtures/
│  └─ helpers/
├─ smoke/
│  ├─ workspace/
│  ├─ backend/
│  ├─ apps/
│  ├─ packages/
│  ├─ fixtures/
│  └─ helpers/
└─ shared/
   ├─ fixtures/
   ├─ builders/
   └─ matchers/
```

这是推荐的初始版本，已足以覆盖当前仓库最需要的两类测试：

- 仓库级 integration
- 仓库级 smoke

### 6.2 可扩展结构

如果后续验收闭环需要单独分层，可以扩展为：

```text
test/
├─ README.md
├─ integration/
│  ├─ runtime/
│  ├─ backend/
│  ├─ frontend-backend/
│  ├─ packages/
│  ├─ fixtures/
│  └─ helpers/
├─ smoke/
│  ├─ workspace/
│  ├─ backend/
│  ├─ apps/
│  ├─ packages/
│  ├─ fixtures/
│  └─ helpers/
├─ acceptance/
│  ├─ chat-task-happy-path.acc-spec.ts
│  ├─ approval-recover-happy-path.acc-spec.ts
│  └─ learning-suggestion-surface.acc-spec.ts
└─ shared/
   ├─ fixtures/
   ├─ builders/
   └─ matchers/
```

但 `acceptance/` 不应与 `integration/` 内容重叠，只用于固定更高层业务闭环，且应在 integration 已足够清晰后再引入。

## 7. 子目录职责

### 7.1 `test/integration/`

用于放置仓库级跨包、跨宿主、跨链路的协同测试。

推荐子目录：

- `test/integration/runtime/`
  - runtime 主链 + approval/recover、task lifecycle 等协同测试
- `test/integration/backend/`
  - backend 模块之间的跨链路测试，例如 chat SSE、approval API、runtime centers API
- `test/integration/frontend-backend/`
  - 前后端联动契约测试，例如消息流、SSE payload、approval action flow、evidence contract
- `test/integration/packages/`
  - `core -> runtime`、`runtime -> tools`、`skill-runtime` 装载等跨包协同测试

辅助目录：

- `test/integration/fixtures/`
  - integration 层专用 fixture
- `test/integration/helpers/`
  - integration 层专用 helper，例如 test runtime builder、test session builder、SSE client helper

约束：

- 不放纯单包单函数测试
- 不放纯 schema parse 回归
- 不放仅验证某个 util 的原子逻辑
- helper 不能复制生产逻辑，只能做测试装配与断言辅助

### 7.2 `test/smoke/`

用于放置仓库级最小可运行闭环。

smoke 的重点不是分支覆盖率，而是证明"关键入口还活着"。

推荐子目录：

- `test/smoke/workspace/`
  - workspace bootstrap、pnpm install + build 基础流程、关键包根出口可加载
- `test/smoke/backend/`
  - backend 最小启动与基础通信入口
- `test/smoke/apps/`
  - 前端最小壳层可启动或渲染
- `test/smoke/packages/`
  - 关键包公开入口的最小可加载验证
- `test/smoke/fixtures/`
  - smoke 层专用 fixture
- `test/smoke/helpers/`
  - smoke bootstrap、临时工作区辅助器、环境变量注入辅助器

约束：

- smoke 必须快
- smoke 必须可定位失败点
- smoke 不承担深逻辑覆盖
- smoke 不应依赖脆弱外部服务
- 若必须依赖外部环境，应有显式 skip / guard 策略

### 7.3 `test/shared/`

用于承载仓库级测试共享资产，但只限测试支持代码。

推荐内容：

- `fixtures/`
  - 可跨 integration / smoke 复用的静态测试输入
- `builders/`
  - 测试数据 builder
- `matchers/`
  - 自定义断言与通用校验器

约束：

- 不放生产实现镜像
- 不放跨层业务编排
- 不把共享 helper 做成第二套 runtime
- 如果某 helper 强业务耦合，优先留在 `integration/helpers` 或 `smoke/helpers` 内部

## 8. 命名约定

根级 `test/` 建议采用以下命名：

- integration：`*.int-spec.ts`
- smoke：`*.smoke.ts`
- acceptance：`*.acc-spec.ts`

示例：

- `approval-recovery.int-spec.ts`
- `chat-stream-merge.int-spec.ts`
- `workspace-bootstrap.smoke.ts`
- `backend-startup.smoke.ts`

这与现有宿主内命名约定保持一致，不引入新后缀。

## 9. 边界：什么不该放这里

### 9.1 应放在宿主内 `test/` 的情况

以下内容不应上移到根级：

- 仅验证单一包或单一 agent 内部逻辑的 unit 测试
- 仅依赖单一宿主上下文的 integration

这些继续放在：

- `packages/*/test`
- `agents/*/test`
- `apps/*/test`

### 9.2 应放在 `packages/*/demo` 的情况

以下内容不应被根级 smoke 替代：

- 包根公开入口能否加载
- 包构建产物能否跑通最小闭环
- 包级 facade 的最小使用路径

这些仍优先落在：

- `packages/*/demo/smoke.ts`
- 可选的 `demo/contract.ts`
- 可选的 `demo/flow.ts`

### 9.3 应放在根级 `test/integration/` 的情况

以下内容适合放在根级 integration：

- `core` contract 被 `runtime` 实际消费的协作验证
- `platform-runtime` 装配官方 agent 的真实链路
- approval / recover 跨 runtime、session、backend 的协作验证
- backend SSE payload 与前端消费 contract 的一致性验证
- frontend-backend 的消息流合并语义验证
- 跨包 registry / facade / adapter 的真实协作验证

### 9.4 应放在根级 `test/smoke/` 的情况

以下内容适合放在根级 smoke：

- workspace bootstrap 最小验证（pnpm install + build 基础可跑通）
- 关键包根出口可加载验证
- 关键 runtime facade 可装配验证
- backend 最小启动验证
- 最短 happy path 可跑通验证

## 10. 推荐优先补齐的六类测试

以下六类是当前仓库最容易回归、且最难归属到某个单一包的风险面，建议在目录骨架建立后优先补齐：

1. **runtime 主链 integration**  
   验证 Supervisor + 六部节点协同是否仍正确协作。

2. **platform-runtime 装配 agent integration**  
   验证 `platform-runtime` 能正确装配官方 agent 并完成最小调用闭环。

3. **backend chat SSE integration**  
   验证后端 chat 链路的 SSE smoke 与基础通信入口。

4. **approval -> recover integration**  
   验证审批挂起、恢复、状态迁移是否仍正确。

5. **frontend-backend SSE payload integration**  
   验证前后端消息流契约是否一致。

6. **`core` contract -> `runtime` consumer integration**  
   验证稳定 contract 演进未破坏 runtime 消费方。

## 11. 与验证体系的映射关系

根级 `test/` 与当前验证体系的关系如下：

- `Type`
  - 不由根级 `test/` 直接承担
  - 仍由 `pnpm typecheck`、`tsc --noEmit` 等完成
- `Spec`
  - 不由根级 `test/` 作为主宿主
  - 仍由宿主内 `test/` + `zod` 回归完成
- `Unit`
  - 不进入根级 `test/`
  - 仍留在各宿主 `test/`
- `Demo`
  - `packages/*` 继续由 `demo/` 承担
  - 根级 `test/smoke` 是 workspace 层的补充 smoke，不替代包级 demo
- `Integration`
  - 根级 `test/integration` 承载仓库级跨包协同 integration
  - 宿主内 integration 继续由各宿主 `test/` 承担
- `Eval`
  - 不进入根级 `test/`
  - 仍由 `promptfoo` 独立承担

## 12. 与 CI 和验证脚本的集成策略

目录职责已确定，以下为各阶段 CI 与验证脚本接入的明确策略：

### 12.1 当前阶段（Phase 1-2）

- **workspace integration 阻塞 PR**：PR 增量校验通过 `pnpm test:workspace:integration:affected` 执行 workspace integration
- **workspace smoke 阻塞 PR / main**：当前 PR 与 main 校验都执行 `pnpm test:workspace:smoke`，用于守住 backend、apps、packages 的最小仓库级冒烟闭环
- workspace integration / smoke 的执行入口与宿主内验证分离：
  - 宿主内：`pnpm test:integration`（现有入口）
  - workspace integration：`pnpm test:workspace:integration`
  - workspace smoke：`pnpm test:workspace:smoke`
- `pnpm test:unit` 明确排除 `*.int-spec.ts`、`*.smoke.ts` 与 `*.acc-spec.ts`，避免 workspace integration / smoke / acceptance 被误归入 Unit 层

### 12.2 后续阶段（Phase 3）

- workspace integration 继续纳入 PR / main CI；`test:workspace:integration:affected` 已基于 changed paths 映射到受影响的根级 integration 用例
- workspace smoke 已纳入 PR / main 阻塞链；后续新增 smoke 时必须保持无外部服务依赖，或提供显式 guard
- 引入外部环境 guard：需要外部服务的 smoke/integration 通过环境变量显式 skip，防止在无外部服务的 CI 环境失败

### 12.3 不应提前绑死的实现细节

- 脚本命名与 Vitest 配置参数，在接入阶段确认
- Turbo affected 策略，在 Phase 3 与现有 `verify:affected` 对齐

### 12.4 决策表

| 决策项                                                       | 当前结论                                                                        |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| 根级 `test/` 是否替代宿主内 `test/`                          | 否                                                                              |
| 根级 `test/` 是否替代 `packages/*/demo`                      | 否                                                                              |
| 第一阶段是否引入 `test/acceptance/`                          | 否                                                                              |
| 第一阶段目录是否采用 `integration / smoke / shared` 最小结构 | 是                                                                              |
| 集成测试命名                                                 | `*.int-spec.ts`                                                                 |
| 冒烟测试命名                                                 | `*.smoke.ts`                                                                    |
| 根级 `test/` 是否承载 unit / spec                            | 否                                                                              |
| PR 是否阻塞 workspace integration                            | 是，执行 `pnpm test:workspace:integration:affected`                             |
| PR 是否阻塞 workspace smoke                                  | 否                                                                              |
| main 是否阻塞 workspace integration                          | 是，执行 `pnpm test:workspace:integration`                                      |
| main 是否阻塞 workspace smoke                                | 是，执行 `pnpm test:workspace:smoke`                                            |
| affected 策略                                                | changed paths 映射到根级 integration 用例；全局配置或共享 helper 变化时全量执行 |

## 13. 风险与约束

如果根级 `test/` 没有边界约束，容易退化成新的"全仓测试杂物间"。因此需要明确以下约束：

### 13.1 不替代宿主测试

根级 `test/` 不能成为"懒得判断就都往这里放"的默认落点。

### 13.2 不承载原子测试

任何明显属于 `Unit` 或 `Spec` 的内容，默认不允许放到根级。

### 13.3 不复制生产逻辑

shared/helper 只做测试装配，不重新实现 runtime、session、approval 或 message merge 逻辑。

### 13.4 不依赖高脆弱环境

smoke 与 integration 尽量避免依赖真实第三方服务、凭据或网络。必须依赖外部环境时，要有显式 skip / guard 策略，并在 CI 中隔离这类用例。

## 14. 实施阶段

### Phase 1：目录骨架与约束文件（已完成）

- ✅ 创建根级 `test/` 目录骨架
- ✅ 补充 `test/README.md`，明确职责边界与禁止事项
- ✅ 更新 `docs/conventions/test-conventions.md`，补充根级 `test/` 作为 workspace test host 的正式说明
- ✅ 更新 `docs/packages/evals/verification-system-guidelines.md`，补充 workspace test host 引用
- ✅ 更新 `README.md`，补充根级 `test/` 目录职责说明

### Phase 2：第一批 integration / smoke 用例（已完成并扩展）

已落地的六类首批用例：

1. ✅ **runtime 主链 integration** → `test/integration/runtime/runtime-main-chain.int-spec.ts`
2. ✅ **platform-runtime 装配 agent integration** → `test/integration/packages/platform-runtime-agent-assembly.int-spec.ts`
3. ✅ **core contract → runtime consumer integration** → `test/integration/packages/core-to-runtime-contract.int-spec.ts`
4. ✅ **approval -> recover integration** → `test/integration/runtime/approval-recover-contract.int-spec.ts`
5. ✅ **frontend-backend SSE payload integration** → `test/integration/frontend-backend/sse-payload-contract.int-spec.ts`
6. ✅ **backend chat SSE smoke** → `test/smoke/backend/backend-startup.smoke.ts`

当前补齐的扩展矩阵：

- ✅ **backend chat SSE controller integration** → `test/integration/backend/chat-sse-controller.int-spec.ts`
- ✅ **frontend-backend stream merge integration** → `test/integration/frontend-backend/chat-session-stream-merge.int-spec.ts`
- ✅ **runtime graph contract projection integration** → `test/integration/runtime/runtime-graph-contract-projection.int-spec.ts`
- ✅ **platform-runtime public entrypoints integration** → `test/integration/packages/platform-runtime-public-entrypoints.int-spec.ts`
- ✅ **approval recover state machine integration** → `test/integration/runtime/approval-recover-state-machine.int-spec.ts`
- ✅ **learning confirmation integration** → `test/integration/runtime/learning-confirmation.int-spec.ts`
- ✅ **runtime graph execution integration** → `test/integration/runtime/runtime-graph-execution.int-spec.ts`
- ✅ **agent-chat workspace smoke** → `test/smoke/apps/agent-chat-workspace.smoke.ts`
- ✅ **agent-admin dashboard smoke** → `test/smoke/apps/agent-admin-dashboard.smoke.ts`
- ✅ **agent-admin centers smoke** → `test/smoke/apps/agent-admin-centers.smoke.ts`
- ✅ **backend module smoke** → `test/smoke/backend/backend-module.smoke.ts`
- ✅ **packages public entrypoints smoke** → `test/smoke/packages/package-public-entrypoints.smoke.ts`
- ✅ **workspace smoke topology** → `test/smoke/workspace/workspace-smoke-entrypoints.smoke.ts`

### Phase 3：纳入 CI 与验证脚本（已完成基础接入）

- ✅ 已提供本地显式验证脚本：
  - `pnpm test:workspace:integration`
  - `pnpm test:workspace:integration:affected`
  - `pnpm test:workspace:smoke`
- ✅ 已将 `test:workspace:integration:affected` 纳入 PR CI 与 `verify:affected`
- ✅ 已将 `test:workspace:integration:affected` 从全量执行收敛为 changed paths 映射策略
- ✅ 已将 `test:workspace:integration` 和 `test:workspace:smoke` 纳入 main CI
- ✅ 已将 `test:workspace:smoke` 纳入 PR CI 的阻塞矩阵
- 后续只需按新增 workspace integration 用例继续维护映射表
- 持续显式区分 workspace integration 与宿主内 integration 的执行入口

### Phase 4：按需引入 acceptance

只有当以下条件同时成立时，再考虑新增 `test/acceptance/`：

- 已有稳定、长期存在的 happy path
- integration 已足够清晰
- acceptance 的目标不是重复 integration，而是固定更高层业务闭环

## 15. 建议优先阅读顺序

后续 AI 或开发者在实现这一设计前，建议按以下顺序阅读：

1. [docs/packages/evals/verification-system-guidelines.md](/docs/packages/evals/verification-system-guidelines.md)
2. [docs/conventions/test-conventions.md](/docs/conventions/test-conventions.md)
3. [docs/conventions/langgraph-app-structure-guidelines.md](/docs/conventions/langgraph-app-structure-guidelines.md)
4. [docs/integration/frontend-backend-integration.md](/docs/integration/frontend-backend-integration.md)
5. [docs/maps/system-flow-current-state.md](/docs/maps/system-flow-current-state.md)

## 16. 结论

本设计建议在仓库根级新增 `test/` 作为 workspace-level test host：

- `test/integration/` 负责仓库级跨包 / 跨宿主 / 跨链路 integration
- `test/smoke/` 负责仓库级最小可运行闭环
- `test/shared/` 负责仓库级测试支持资产

这能在不破坏当前测试规范的前提下，为多 Agent monorepo 的仓库级验证补上清晰、稳定、可演进的宿主边界。
