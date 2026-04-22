# Workspace Test Host 设计

状态：current  
文档类型：architecture  
适用范围：workspace 根目录、`packages/*`、`agents/*`、`apps/*`、根级验证脚本与 CI 测试编排  
最后更新：2026-04-22  
最后核对：2026-04-22

相关文档：

- [AGENTS](/AGENTS.md)
- [README](/README.md)
- [项目规范总览](/docs/project-conventions.md)
- [测试规范](/docs/test-conventions.md)
- [验证体系规范](/docs/evals/verification-system-guidelines.md)
- [LangGraph 应用结构规范](/docs/langgraph-app-structure-guidelines.md)
- [架构总览](/docs/ARCHITECTURE.md)
- [前后端对接文档](/docs/integration/frontend-backend-integration.md)
- [Current System Flow](/docs/integration/system-flow-current-state.md)

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

设计阶段只确定目录职责，脚本与扫描规则按以下原则在实施阶段逐步收敛：

- 目录先行定义职责，脚本在后续实施阶段接入
- 不在目录设计阶段把扫描策略与实现细节绑死
- 后续可显式区分：
  - 宿主内 integration（现有 `pnpm test:integration`）
  - workspace integration（`test/integration`）
  - workspace smoke（`test/smoke`）
- 根级 `test/integration` 与 `test/smoke` 逐步纳入：
  - 本地验证脚本
  - CI job
  - affected 计算与执行策略

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

### Phase 1：目录骨架与约束文件

- 创建根级 `test/` 目录骨架（无需填测试文件）
- 补充 `test/README.md`，明确职责边界与禁止事项
- 更新 `docs/test-conventions.md` 与 `docs/evals/verification-system-guidelines.md`，补充根级 `test/` 作为 workspace test host 的正式说明

### Phase 2：第一批 integration 用例

- 按第 10 节推荐的六类，优先补齐 1-2 类最高风险 integration
- 配套补充对应 fixtures 与 helpers
- 确认可纳入 `pnpm test:integration` 扫描范围

### Phase 3：纳入 CI 与验证脚本

- 把根级 `test/integration` 与 `test/smoke` 逐步纳入本地验证脚本、CI job 与 affected 计算策略
- 显式区分 workspace integration 与宿主内 integration 的执行入口

### Phase 4：按需引入 acceptance

只有当以下条件同时成立时，再考虑新增 `test/acceptance/`：

- 已有稳定、长期存在的 happy path
- integration 已足够清晰
- acceptance 的目标不是重复 integration，而是固定更高层业务闭环

## 15. 建议优先阅读顺序

后续 AI 或开发者在实现这一设计前，建议按以下顺序阅读：

1. [docs/evals/verification-system-guidelines.md](/docs/evals/verification-system-guidelines.md)
2. [docs/test-conventions.md](/docs/test-conventions.md)
3. [docs/langgraph-app-structure-guidelines.md](/docs/langgraph-app-structure-guidelines.md)
4. [docs/integration/frontend-backend-integration.md](/docs/integration/frontend-backend-integration.md)
5. [docs/integration/system-flow-current-state.md](/docs/integration/system-flow-current-state.md)

## 16. 结论

本设计建议在仓库根级新增 `test/` 作为 workspace-level test host：

- `test/integration/` 负责仓库级跨包 / 跨宿主 / 跨链路 integration
- `test/smoke/` 负责仓库级最小可运行闭环
- `test/shared/` 负责仓库级测试支持资产

这能在不破坏当前测试规范的前提下，为多 Agent monorepo 的仓库级验证补上清晰、稳定、可演进的宿主边界。
