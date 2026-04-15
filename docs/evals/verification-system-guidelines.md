# 验证体系规范

状态：current
适用范围：workspace 根包、`packages/*`、`apps/*`
最后核对：2026-04-15

本文件将“验证体系需求”收敛为当前仓库可直接执行的统一规范，供后续 AI 与开发者在新增功能、修复缺陷、重构与跨包协作时复用。

相关入口：

- [AGENTS.md](/Users/dev/Desktop/learning-agent-core/AGENTS.md)
- [项目规范总览](/Users/dev/Desktop/learning-agent-core/docs/project-conventions.md)
- [测试规范](/Users/dev/Desktop/learning-agent-core/docs/test-conventions.md)
- [测试覆盖率基线](/Users/dev/Desktop/learning-agent-core/docs/evals/testing-coverage-baseline.md)
- [Prompt Regression And Thresholds](/Users/dev/Desktop/learning-agent-core/docs/evals/prompt-regression-and-thresholds.md)

## 1. 核心目标

当前仓库的验证体系服务于多 Agent monorepo，而不是单一包的普通单测规范。统一目标是：

- 类型安全：确保 AI 生成或重构后的代码在静态层面可成立
- 协议安全：确保结构化输入输出、SSE payload、DTO、graph state 切片可校验
- 行为正确：确保节点、流程、UI 交互与状态机符合设计预期
- 跨包稳定：确保 `@agent/*` 包与 `apps/*` 的协作不因局部修改而退化
- 防止回归：确保聊天、审批、学习、来源引用、recover 等主链不被破坏
- 可持续演进：确保重构、拆分、迁移与接口演进能被证明没有破坏既有能力

## 2. 当前仓库采用的验证分层

原始需求里的五层验证在本仓库中收敛为“6 层验证 + 1 组治理门槛”。

### 2.1 Type 验证

基于 TypeScript 静态检查，保证源码、共享 contract、前后端边界与 graph state 类型正确。

### 2.2 Spec 验证

基于 `zod` 的运行时结构约束，保证模型输出、接口输入输出、配置与领域对象在运行时可证明合法。

### 2.3 Unit 验证

基于 Vitest 的原子逻辑测试，覆盖纯函数、schema、prompt builder、policy、parser、formatter、route resolver 等原子行为。

### 2.4 Integration 验证

验证多节点流程、跨模块协作、SSE、interrupt / recover、状态迁移、审批链路与 UI 行为联动。

### 2.5 Demo / 最小闭环验证

本仓库不强制每个包单独维护 `demo/` 目录，但强制要求“每轮改动都要补一个最小可证明闭环”。闭环形式可以是：

- 可直接运行的包级 demo
- 集成测试中的最小 happy path
- 面向 CLI / script / build 流程的最小命令验证
- 前端或后端的最小真实链路验证

换句话说，本仓库更看重“最小闭环被自动化验证”，而不是机械要求每个包都建一个 `demo/` 文件夹。

### 2.6 Eval 验证

针对核心 prompt、结构化输出合同与高风险模型链路的回归评测，当前主要由 `promptfoo` 承担。

### 2.7 治理门槛

除上述验证层外，当前仓库还强制执行：

- package boundary 检查
- backend structure 检查
- architecture 聚合检查
- 覆盖率门槛
- 文档同步更新

这些不属于传统“测试类型”，但在本仓库里属于验证体系的一部分，不能省略。

## 3. 目录与落位规范

原始需求中的 `__tests__/`、根级 `tests/integration`、根级 `tests/smoke` 目录，不直接套用到本仓库。

当前真实规则如下：

- 每个项目统一使用与 `src/` 同级的 `test/` 目录
- 不再新增 `src/**/*.test.ts`
- 不再新增 `src/**/*.spec.ts`
- 不再新增 `src/**/*.int-spec.ts`

标准落位：

- `packages/*/test`
- `apps/backend/agent-server/test`
- `apps/worker/test`
- `apps/frontend/agent-chat/test`
- `apps/frontend/agent-admin/test`

命名约定：

- Unit：`*.test.ts`、`*.spec.ts`、`*.test.tsx`、`*.spec.tsx`
- Integration：`*.int-spec.ts`、`*.int-spec.tsx`
- Prompt Eval：`*.promptfooconfig.yaml`

补充约束：

- 新增测试时优先贴近被测模块语义分目录，不要把所有测试堆在 `test/` 根下
- 测试文件也受单文件 `400` 行限制约束，超出必须拆分
- 包内私有 helper 的测试放在该包 `test/` 目录，不要跨包堆放

## 4. 技术栈约束

当前验证体系默认且优先使用以下工具：

- `TypeScript`
- `Vitest`
- `zod`
- `promptfoo`
- 根级现有脚本与 `pnpm` 命令

补充说明：

- 如果要运行 TypeScript 脚本，仓库当前优先沿用现有脚本体系，不要求为满足“demo”强行引入新工具链
- `promptfoo` 用于模型层评测，不替代 `Vitest`
- 结构化输出与 schema 校验默认优先 `zod`

## 5. 各层验证的强制要求

## 5.1 Type 验证

所有改动默认必须经过类型检查。

最低基线以仓库现有规则为准：

```bash
pnpm exec tsc -p packages/shared/tsconfig.json --noEmit
pnpm exec tsc -p packages/agent-core/tsconfig.json --noEmit
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm exec tsc -p apps/frontend/agent-chat/tsconfig.app.json --noEmit
pnpm exec tsc -p apps/frontend/agent-admin/tsconfig.app.json --noEmit
```

当改动明确涉及其他包时，还应补对应项目的 `tsc --noEmit`。

可以使用的统一入口：

```bash
pnpm lint:tsc
```

禁止事项：

- 类型报错未清理就交付
- 依赖 `any`、断言或跳过类型收窄来掩盖真实 contract 问题
- 修改共享 DTO、SSE payload、graph state 切片后不补类型验证

## 5.2 Spec 验证

所有稳定结构化 contract 默认必须有显式 schema 约束。

强制适用场景：

- 模型 JSON 输出
- DTO / payload / tool result
- 配置对象
- graph 中跨节点传递的稳定结构化结果
- 对外 facade / adapter 的结构化输入输出

规则：

- 只要存在稳定 JSON 契约，就必须使用 `zod` 显式校验
- 不能只靠 `JSON.parse` + 手写 `if`
- 结构化输出调用必须走统一的结构化重试入口

验证方式：

- 为 schema 写 unit test
- 为 parse 成功 / 失败路径写测试
- 对关键 contract 做兼容性回归

## 5.3 Unit 验证

原子逻辑默认必须有单测，尤其是以下对象：

- parser / formatter / normalizer / mapper
- policy / resolver / selector
- prompt builder / structured prompt formatter
- schema / DTO mapper
- 稳定 facade / adapter 的纯逻辑部分
- 复杂条件分支中的纯计算逻辑

最低要求：

- 每个关键纯函数至少覆盖成功、边界、失败三类路径
- 测试名称必须表达业务意图
- 不允许只测内部实现细节而不测输入输出 contract

## 5.4 Integration 验证

只要改动触达主链、跨包协作或状态机，就必须补集成验证。

当前重点链路：

- 聊天直答链路
- supervisor workflow 链路
- approval / recover / cancel
- learning confirmation
- SSE streaming / fallback
- 研究到交付链路
- runtime 中心聚合与治理链路

LangGraph 相关额外要求：

- 主图或子图改动时，默认补整图测试、单节点测试或部分执行测试中的至少一种
- 如果涉及 interrupt / resume / checkpoint，至少要有一条整图测试或部分执行测试
- 新增 interrupt 节点时，至少覆盖触发、中断后恢复、拒绝或异常路径

## 5.5 Demo / 最小闭环验证

原始需求强调“每个包必须有 demo”。在本仓库中，统一改写为：

- 每轮改动都必须给出一个最小闭环证明
- 证明优先自动化，不接受只靠手工点点点

可接受形式：

- 一个新单测或集成测试
- 一个可运行脚本检查
- 一个 build / typecheck / prompt eval 验证
- 一个最小链路的 API、session、UI 测试

判断标准：

- 能证明当前改动不是纸面代码
- 能证明调用路径至少能跑通一次
- 后续修改时能作为回归保护

## 5.6 Eval 验证

对于 prompt、结构化输出、模型路由和交付口吻等高风险模型链路，必须走评测回归。

当前阻塞型核心套件：

- `supervisor-plan`
- `specialist-finding`
- `hubu-research`
- `xingbu-review`
- `libu-delivery`

门槛：

- 核心套件成功率必须大于 `90%`
- 低于门槛视为阻塞型回归

统一入口：

```bash
pnpm eval:prompts
pnpm eval:prompts:view
```

## 6. 各模块最低验收标准

当前仓库不再按外部 RAG SDK 的 `core/runtime/indexing/eval` 目录硬套，而是按本仓库真实模块划分执行。

### 6.1 `packages/shared`

- 类型检查
- DTO / schema / normalize 逻辑单测
- 改共享 contract 时补调用方回归

### 6.2 `packages/config`

- 类型检查
- settings / profile / policy schema 测试
- 环境变量覆盖与默认值回归

### 6.3 `packages/model`

- 类型检查
- provider normalize / factory 单测
- fallback / candidate 选择逻辑测试

### 6.4 `packages/memory`

- 类型检查
- repository / search contract 单测
- 关键索引或搜索链路集成测试

### 6.5 `packages/tools`

- 类型检查
- registry / executor / approval preflight 单测
- sandbox / MCP / tool contract 集成测试

### 6.6 `packages/skills`

- 类型检查
- manifest loader / registry / source sync 单测
- 安装与来源治理关键路径集成测试

### 6.7 `packages/agent-core`

- 类型检查
- graph / flow / prompt / schema 单测
- LangGraph 主链、interrupt、recover、checkpoint 集成测试
- 关键 prompt 回归或最小结构化合同验证

### 6.8 `packages/report-kit`

- 类型检查
- blueprint / scaffold / assembly 单测
- 最小报表生成链路验证

### 6.9 `apps/backend/agent-server`

- 类型检查
- controller / service / DTO mapper 单测
- 关键 API、runtime center、SSE、审批恢复链路集成测试

### 6.10 `apps/worker`

- 类型检查
- 任务消费、重试、学习任务处理单测
- background runner / queue 协同集成测试

### 6.11 `apps/frontend/agent-chat`

- 类型检查
- hooks / formatters / reducers / card helpers 单测
- 会话、消息流、stream merge、approval 交互集成测试

### 6.12 `apps/frontend/agent-admin`

- 类型检查
- center 级 state / adapter / card mapper 单测
- runtime / approvals / learning / evidence / connectors 关键面板集成测试

## 7. 根级验证命令

当前仓库已存在的根命令应视为验证体系正式入口。

常用入口：

```bash
pnpm test
pnpm test:unit
pnpm test:integration
pnpm test:coverage
pnpm eval:prompts
pnpm lint:tsc
pnpm check:package-boundaries
pnpm check:architecture
```

补充说明：

- `pnpm check` 当前是重型全量检查，包含 prettier、eslint、测试、类型与架构检查
- 日常改动不一定每次都跑完整 `pnpm check`，但交付前应至少覆盖受影响范围所需的验证组合

## 8. 标准执行顺序

每完成一个功能、缺陷修复或重构，默认按以下顺序推进：

1. 先补失败测试或最小可证明检查
2. 完成实现
3. 先跑新增测试或受影响测试
4. 再跑对应类型检查
5. 如涉及主链或跨包协作，再跑集成验证
6. 如涉及 prompt / 模型结构化输出，再跑 eval 回归
7. 同步更新文档

如果改动涉及 `packages/*`，优先补：

```bash
pnpm build:lib
```

如果改动涉及后端装配或应用层联动，再补：

```bash
pnpm --dir apps/backend/agent-server build
```

## 9. 禁止事项

以下行为在本仓库中视为违反验证体系：

- 只改代码，不补任何自动化验证
- 只靠人工页面点击，不留回归保护
- 新增稳定结构化 contract 却没有 schema 校验
- 修改 graph / interrupt / recover 主链却不补流程级测试
- 修改共享 DTO、SSE payload、tool result 后不补调用方验证
- 用 snapshot 大面积替代行为断言
- 为了让测试通过而降低类型严格性或删除关键分支
- 把评测逻辑混进 runtime 主链，而不是沉淀到 `packages/evals` 或测试体系

## 10. 给后续 AI 的简版执行规则

后续 AI 在这个仓库做任何非纯文档改动时，默认按下面执行：

- 先补失败测试，优先 TDD
- 原子逻辑补 unit
- 主链和跨包协作补 integration
- 稳定结构化输出补 `zod` schema 与 parse 测试
- prompt 或模型结构化合同改动补 eval
- 至少跑受影响范围的 `tsc --noEmit`
- 涉及共享包优先跑 `pnpm build:lib`
- 改完代码后同步更新文档

如果一轮任务全部完成，必须明确告知“计划已完成”或等价结论。
