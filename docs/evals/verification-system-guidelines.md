# 验证体系规范

状态：current
文档类型：evaluation
适用范围：workspace 根包、`packages/*`、`apps/*`
最后核对：2026-04-23

本文件将“验证体系需求”收敛为当前仓库可直接执行的统一规范，供后续 AI 与开发者在新增功能、修复缺陷、重构与跨包协作时复用。

相关入口：

- [AGENTS.md](/AGENTS.md)
- [项目规范总览](/docs/project-conventions.md)
- [测试规范](/docs/test-conventions.md)
- [Turbo Demo 三阶段迁移方案](/docs/evals/turbo-demo-stage-three-plan.md)
- [Turbo 循环依赖治理六阶段方案](/docs/evals/turbo-cycle-reduction-stage-six-plan.md)
- [测试覆盖率基线](/docs/evals/testing-coverage-baseline.md)
- [Prompt Regression And Thresholds](/docs/evals/prompt-regression-and-thresholds.md)

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

当前要求 `packages/*` 默认维护与 `src/` 同级的 `demo/` 目录和可直接运行的 `demo` 脚本，并继续强制“每轮改动都要补一个最小可证明闭环”。闭环形式可以是：

- 可直接运行的包级 demo
- 集成测试中的最小 happy path
- 面向 CLI / script / build 流程的最小命令验证
- 前端或后端的最小真实链路验证

换句话说，本仓库要求每个宿主都要有自动化最小闭环；packages 优先通过显式 `demo/` 尽早暴露包级构建产物和公开入口问题，其他宿主若不单独生成 `demo/`，则必须由 integration 或等价 smoke 验证承担这层责任。

当前默认宿主规则：

- `packages/*`：默认维护显式 `demo/` 与 `demo` 脚本，并纳入 `pnpm test:demo` / `pnpm test:demo:affected`
- 根级 `pnpm test:demo` 当前会先校验 `packages/*` 的 `demo/` 与 `demo` 脚本覆盖率，再执行各包 demo，防止“包存在但没人跑”的回退
- `packages/*` 当前默认至少提供 `demo/smoke.ts`；如需更深闭环，可继续补 `demo/contract.ts` 与 `demo/flow.ts`，根级 `pnpm test:demo` 会自动串行执行这些分层入口
- 需要收敛单包 Demo 时，可使用 `pnpm test:demo -- packages/<package-name>`；根级 runner 会忽略 CLI 参数中的 `--` 分隔符
- `agents/*`：默认允许由 integration、build 或其他自动化 smoke 承担最小闭环
- `apps/*` 与 `apps/backend/agent-server`：当前允许由 integration 或其他自动化最小闭环承担 Demo 层责任，但如果后续引入显式 demo，它必须明显比 integration 更轻

### 2.6 Eval 验证

针对核心 prompt、结构化输出合同与高风险模型链路的回归评测，当前主要由 `promptfoo` 承担。

### 2.7 治理门槛

除上述验证层外，当前仓库还强制执行：

- `prettier` 格式化
- `eslint` 静态检查与可自动修复项收口
- package boundary 检查
- backend structure 检查
- architecture 聚合检查
- 覆盖率门槛
- 文档同步更新

这些不属于传统“测试类型”，但在本仓库里属于验证体系的一部分，不能省略。

## 3. 目录与落位规范

原始需求中的 `__tests__/`、根级 `tests/integration`（复数形式）、根级 `tests/smoke` 目录，不直接套用到本仓库的命名习惯。

仓库级 workspace test host 的正式设计见 [Workspace Test Host 设计](/docs/evals/workspace-test-host-design.md)，其根级落点为 `test/`（单数），与各宿主的 `test/` 语义不同：根级 `test/` 只承载跨包 integration 与 workspace smoke，各宿主 `test/` 仍承载宿主内原子测试。

当前真实规则如下：

- 每个项目统一使用与 `src/` 同级的 `test/` 目录（宿主内测试）
- 跨包、跨宿主 integration 与 workspace smoke 落在根级 `test/`（workspace test host）
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
- `prettier`
- `eslint`
- 根级现有脚本与 `pnpm` 命令

补充说明：

- 如果要运行 TypeScript 脚本，仓库当前优先沿用现有脚本体系，不要求为满足“demo”强行引入新工具链
- `promptfoo` 用于模型层评测，不替代 `Vitest`
- 结构化输出与 schema 校验默认优先 `zod`
- 当前 Turbo 只安全接入了根级治理校验入口：`check:docs` 与 `check:architecture`
- 根级 `typecheck`、`build` 与基于包图的 `test` 任务仍以根级脚本为主；虽然 `@agent/runtime <- @agent/agent-kit -> agents/*` 已拆掉历史主循环，但 Turbo 主链收敛仍需继续按阶段方案推进
- 根级 `start:dev` 也不应继续经由 `turbo start:dev` 走 package graph；当前根级入口固定代理到 `apps/backend/agent-server`，避免开发启动被现有循环依赖阻断
- 当前已新增 Turbo-only 包级验证通道：
  - `turbo:typecheck`
  - `turbo:test:unit`
  - `turbo:test:integration`
- 这条通道用于单包缓存、`--filter` 与执行预览，不替代根级 `pnpm verify`
- `turbo:typecheck` 当前直接代理到各 workspace 自身的 `typecheck` 脚本；对应 workspace 的 `tsconfig` 现在是唯一事实来源，不再依赖额外的 `run-package-typecheck` 包装脚本
- 当前已新增根级受影响范围入口：
  - `pnpm lint:prettier:affected`
  - `pnpm lint:eslint:affected`
  - `pnpm typecheck:affected`
  - `pnpm test:spec:affected`
  - `pnpm test:unit:affected`
  - `pnpm test:demo:affected`
  - `pnpm test:integration:affected`
  - `pnpm test:workspace:integration:affected`
  - `pnpm eval:prompts:affected`
  - `pnpm verify:affected`
- `verify:affected` 默认先执行治理门槛与受影响范围 Spec，再执行受影响包的 Type / Unit / Demo / Integration，最后执行 workspace-level integration
- `Eval` 当前保留为独立入口：`pnpm eval:prompts:affected`
- 根级 workspace test host 当前已有显式本地入口：
  - `pnpm test:workspace:integration`：只执行根级 `test/integration/**` 下的 workspace-level integration
  - `pnpm test:workspace:smoke`：只执行根级 `test/smoke/**` 下的 workspace-level smoke
  - `pnpm test:workspace:integration:affected`：基于 changed paths 映射到受影响的根级 integration 用例，作为 PR CI 与 `verify:affected` 的阻塞项；全局验证配置或共享 helper 变化时自动提升为全量 workspace integration
- workspace smoke 当前已并入 `pnpm verify`，并在 PR CI 与 main CI 中作为阻塞项执行；`pnpm verify:affected` 仍保持受影响范围主入口，不直接内联全量 smoke，本地推送前由 `.husky/pre-push` 额外执行 `pnpm test:workspace:smoke`
- 受影响范围入口默认读取环境变量 `VERIFY_BASE_REF`；未显式配置时回落到 `origin/main`
- `Demo` 当前直接复用 workspace 既有 `demo` 脚本，并通过 Turbo 的 `demo -> build:lib -> ^build:lib` 编排获得受影响范围筛选与依赖构建能力；详细边界见 [Turbo Demo 三阶段迁移方案](/docs/evals/turbo-demo-stage-three-plan.md)
- `demo` 任务当前显式追踪 `demo/**`、`src/**`、`package.json`、`tsconfig.json` 与 `tsconfig.*.json`，以减少无关文件改动导致的缓存失效
- 对存在额外模板或脚手架依赖的宿主，应使用宿主级例外补充 `inputs`；当前仓库里的 scaffold 回归已迁回 `packages/tools` 测试与 integration，不再保留独立 demo 例外
- 更深的 Turbo 主链收敛仍需继续清理剩余任务边界与 `dependsOn` 编排；下一阶段治理路线见 [Turbo 循环依赖治理六阶段方案](/docs/evals/turbo-cycle-reduction-stage-six-plan.md)

## 4.1 当前 Turbo 接入边界

当前仓库已经在 `turbo.json` 中为以下根级治理命令声明了 root task：

- `check:docs`
- `check:architecture`

推荐入口：

```bash
pnpm check:docs:turbo
pnpm check:architecture:turbo
pnpm verify:governance
```

推荐预览方式：

```bash
pnpm exec turbo run check:docs check:architecture --dry-run=json
pnpm exec turbo run check:docs check:architecture --graph=turbo-verify-governance.html
```

约束说明：

- `verify:governance` 只覆盖治理门槛，不替代根级 `pnpm verify`
- 需要完成五层验证时，仍优先使用 `pnpm verify`，或在根级验证被无关 blocker 卡住时，按受影响范围逐层补齐 Type / Spec / Unit / Demo / Integration
- 后续若要继续把 `typecheck`、`test:unit`、`test:integration` 精准迁入 Turbo，必须先处理当前循环依赖并统一 `apps/*`、`agents/*`、`packages/*` 的任务边界；详见 [Turbo 循环依赖治理六阶段方案](/docs/evals/turbo-cycle-reduction-stage-six-plan.md)

## 5. 各层验证的强制要求

## 5.1 Type 验证

所有改动默认必须经过类型检查。

最低基线以仓库现有规则为准：

```bash
pnpm typecheck
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

- 优先通过 `pnpm test:spec` 或 `pnpm test:spec:affected` 运行结构校验回归
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

原始需求强调“每个包必须有 demo”。在当前仓库中，packages 层按该要求落地，其他宿主保留等价自动化闭环豁免：

- 每轮改动都必须给出一个最小闭环证明
- 证明优先自动化，不接受只靠手工点点点
- `packages/*` 的默认入口是显式 `demo/` + `demo` 脚本；如果某个包暂时无法提供，必须在文档中说明由哪条 integration / smoke 负责替代

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

## 5.7 治理门槛验证

`prettier` 与 `eslint` 不归入 Type / Spec / Unit / Demo / Integration / Eval 任一单独测试层，但它们属于当前仓库验证体系的阻塞型治理门槛，默认不能省略。

当前固定要求：

- 代码改动默认必须确保格式与静态 lint 规则收口
- `prettier` 负责统一格式、Markdown/JSON/CSS/TS 等可自动格式化文件的一致性
- `eslint` 负责发现未使用变量、危险模式、React/TS 约束和可自动修复的规范问题
- 不允许以“类型已通过”“测试已通过”替代 `eslint` / `prettier`
- 不允许为了通过 `eslint` 而静默关闭关键规则、扩大忽略范围或引入无意义规避代码

统一入口：

```bash
pnpm lint:prettier
pnpm lint:eslint
pnpm lint:prettier:check
pnpm lint:eslint:check
pnpm lint:prettier:affected
pnpm lint:eslint:affected
pnpm check
```

执行约束：

- `pnpm check` 当前是重型全量入口，串联 `prettier + eslint + 测试 + 类型 + architecture`
- 日常交付不一定每次都跑完整 `pnpm check`，但必须至少确保本轮改动范围内的 `prettier` 与 `eslint` 问题已收口
- 根级 `pnpm verify` 当前已纳入 `pnpm lint:prettier:check` 与 `pnpm lint:eslint:check`
- 受影响范围交付默认优先使用 `pnpm lint:prettier:affected` 与 `pnpm lint:eslint:affected`
- 纯文档改动至少执行 `pnpm check:docs`；如果文档改动同时触达代码块、配置样例或脚本片段并可能影响格式规则，仍应补充相应格式检查

## 6. 各模块最低验收标准

当前仓库不再按外部 RAG SDK 的 `core/runtime/indexing/eval` 目录硬套，而是按本仓库真实模块划分执行。

### 6.1 `packages/config`

- 类型检查
- settings / profile / policy schema 测试
- 环境变量覆盖与默认值回归

### 6.2 `packages/adapters`

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

### 6.6 `packages/skill-runtime` / `@agent/skill-runtime`

- 类型检查
- manifest loader / registry / source sync 单测
- 安装与来源治理关键路径集成测试

### 6.7 `packages/runtime`

- 类型检查
- graph / flow / prompt / schema 单测
- LangGraph 主链、interrupt、recover、checkpoint 集成测试
- 关键 prompt 回归或最小结构化合同验证

### 6.8 `agents/*`

- 类型检查
- 对应 graph / flow / prompt / schema 单测
- 子 Agent 的 planning / execution / review / delivery 主链集成测试
- 稳定结构化合同的 schema parse 回归

### 6.9 `packages/report-kit`

- 类型检查
- blueprint / scaffold / assembly 单测
- 最小报表生成链路验证

### 6.10 `apps/backend/agent-server`

- 类型检查
- controller / service / DTO mapper 单测
- 关键 API、runtime center、SSE、审批恢复链路集成测试

### 6.11 `apps/worker`

- 类型检查
- 任务消费、重试、学习任务处理单测
- background runner / queue 协同集成测试

### 6.12 `apps/frontend/agent-chat`

- 类型检查
- hooks / formatters / reducers / card helpers 单测
- 会话、消息流、stream merge、approval 交互集成测试

### 6.13 `apps/frontend/agent-admin`

- 类型检查
- center 级 state / adapter / card mapper 单测
- runtime / approvals / learning / evidence / connectors 关键面板集成测试

## 7. 根级验证命令

当前仓库已存在的根命令应视为验证体系正式入口。

常用入口：

```bash
pnpm test
pnpm test:spec
pnpm test:unit
pnpm test:demo
pnpm test:integration
pnpm test:workspace:integration
pnpm test:workspace:integration:affected
pnpm test:workspace:smoke
pnpm test:coverage
pnpm eval:prompts
pnpm eval:prompts:affected
pnpm lint:prettier
pnpm lint:eslint
pnpm lint:prettier:check
pnpm lint:eslint:check
pnpm lint:prettier:affected
pnpm lint:eslint:affected
pnpm lint:tsc
pnpm check
pnpm check:package-boundaries
pnpm check:architecture
```

补充说明：

- `pnpm check` 当前是重型全量检查，包含 prettier、eslint、测试、类型与架构检查
- 日常改动不一定每次都跑完整 `pnpm check`，但交付前应至少覆盖受影响范围所需的验证组合

## 7.1 CI 对齐规则

CI 流程也必须与本文件的验证入口保持一致，不能长期维持另一套“文档写一套、workflow 跑另一套”的规则。

当前固定映射如下：

- PR 增量校验：`/.github/workflows/pr-check.yml`
  - 代码改动默认按 `pnpm verify:affected` 的层级执行：先跑 `verify:governance + test:spec:affected`，再并发跑 `lint:prettier:affected + lint:eslint:affected + typecheck:affected + test:unit:affected + test:demo:affected + test:integration:affected + test:workspace:integration:affected + test:workspace:smoke`
  - PR 阶段 workspace integration 与 workspace smoke 都是阻塞项，确保进入 review 前已经覆盖仓库级协同与冒烟闭环
  - 并发层最终由聚合的 `Affected Verify` job 收口，便于保持分支保护检查名稳定
  - PR 中的 terminology 检查默认拆为独立轻量 job，不再挂在 `Affected Verify` 聚合 job 末尾，以缩短关键路径
  - 共享环境准备默认复用 `/.github/actions/setup-pnpm-workspace/action.yml`，并优先使用 `pnpm install --frozen-lockfile --prefer-offline`
  - `docs`、`lockfile`、聚合 `verify` 这类轻量 Node job 默认复用 `/.github/actions/setup-node-runtime/action.yml`，并显式关闭 `setup-node` 的自动 package manager cache
  - 需要 affected 计算的 PR job 默认采用浅 checkout，并通过 `/.github/actions/fetch-pr-base-ref/action.yml` 定向浅 fetch `origin/${base_ref}`，避免为比较基线拉取整段 git 历史
  - 根级治理校验与受影响范围 Turbo 包装脚本当前统一复用 `scripts/turbo-runner.js`：默认把 Turbo `--cache-dir` 与 `TMPDIR` / `TMP` / `TEMP` 指向系统临时卷下的 `learning-agent-core-turbo/`，并在 CI 中自动切到 `--cache=local:r,remote:r`
  - `VERIFY_BASE_REF` 默认对齐到 `origin/${base_ref}`，确保受影响范围判断与目标分支一致
  - 纯文档改动至少执行 `pnpm check:docs`
  - prompt 敏感改动额外执行 `pnpm eval:prompts:affected`
- main 全量校验：`/.github/workflows/main-check.yml`
  - 默认按 `pnpm verify` 的层级执行：先跑 `verify:governance + test:spec`，再并发跑 `lint:prettier:check + lint:eslint:check + typecheck + test:unit + test:demo + test:integration + test:workspace:integration + test:workspace:smoke`
  - main 阶段 workspace integration 与 workspace smoke 都是阻塞项，确保主干持续覆盖仓库级协同与冒烟闭环
  - 并发层最终由聚合的 `Verify Main` job 收口，便于保持主干验证状态清晰
  - docs-only push 当前默认跳过 `build-main` 与 `coverage-main`；`prompt-regression` 只在 prompt-sensitive 或代码相关改动时尝试运行
  - 共享环境准备默认复用 `/.github/actions/setup-pnpm-workspace/action.yml`，并优先使用 `pnpm install --frozen-lockfile --prefer-offline`
  - `lockfile` 与 `coverage-main` 中的轻量 terminology 检查默认复用 `/.github/actions/setup-node-runtime/action.yml`
  - 但 `coverage-main` 只要实际执行 `pnpm test:coverage`，就必须使用完整 workspace setup；只有其中的纯 Node 辅助脚本可以视为轻量检查
  - prompt 回归独立执行 `pnpm eval:prompts`
  - `pnpm build`、覆盖率基线或其他非验证体系附加检查可以追加在 `Verify Main` 之后，但不能替代根级 `pnpm verify` 对应的五层语义
- lockfile 漂移检查继续通过 `node ./scripts/check-lockfile-sync.js` 提前失败；它属于 CI 前置门，不替代 `pnpm install --frozen-lockfile`

补充约束：

- 不要在 CI 中把五层验证重新拆散成“只跑 lint / tsc / test”的旧式拼装流来替代 `pnpm verify` 或 `pnpm verify:affected`
- 如果因为 secrets、外部 API 或 prompt artifact 上传需求把 Eval 单独拆成 job，必须在文档中明确这是同一验证体系里的独立层，不得与五层验证主入口语义冲突
- 当根脚本、受影响范围脚本或工作流入口发生变化时，必须同步更新本文件、相关规范文档与对应 workflow，避免再次漂移

## 8. 标准执行顺序

每完成一个功能、缺陷修复或重构，默认按以下顺序推进：

1. 先补失败测试或最小可证明检查
2. 完成实现
3. 先跑新增测试或受影响测试
4. 再跑对应类型检查
5. 再收口 `prettier` 与 `eslint` 治理门槛
6. 如涉及主链或跨包协作，再跑集成验证
7. 如涉及 prompt / 模型结构化输出，再跑 eval 回归
8. 如走受影响范围验证，优先确认 `VERIFY_BASE_REF` 是否正确
9. 同步更新文档

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
- 改动代码后不收口 `prettier` 或 `eslint`
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
- 收口 `prettier` 与 `eslint` 治理门槛
- 涉及共享包优先跑 `pnpm build:lib`
- 改完代码后同步更新文档

如果一轮任务全部完成，必须明确告知“计划已完成”或等价结论。
