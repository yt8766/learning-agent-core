# 测试规范

状态：current
文档类型：convention
适用范围：`packages/*`、`apps/backend/agent-server`、`apps/frontend/*`
最后核对：2026-04-18

配套现状文档：

- [验证体系规范](/docs/evals/verification-system-guidelines.md)
- [Turbo 验证二阶段迁移方案](/docs/evals/turbo-verification-stage-two-plan.md)
- [Turbo Demo 三阶段迁移方案](/docs/evals/turbo-demo-stage-three-plan.md)
- [测试覆盖率基线](/docs/evals/testing-coverage-baseline.md)
- [Prompt Regression And Thresholds](/docs/evals/prompt-regression-and-thresholds.md)

适用范围：

- `packages/*`
- `apps/backend/agent-server`
- `apps/frontend/agent-chat`
- `apps/frontend/agent-admin`

测试目录约束：

- 每个项目统一使用与 `src/` 同级的 `test/` 目录
- 新增测试默认写入：
  - `packages/*/test`
  - `apps/backend/agent-server/test`
  - `apps/worker/test`
  - `apps/frontend/agent-chat/test`
  - `apps/frontend/agent-admin/test`
- 不再新增新的 `src/**/*.test.ts`、`src/**/*.spec.ts`、`src/**/*.int-spec.ts`
- 现有历史测试也已统一迁入 `test/`，根级 `vitest` 不再扫描 `src/` 下的测试文件

当前生成规范默认要求每个新增模块或重大改动同时考虑以下 5 类验证能力：

- `Type`：TypeScript 静态类型检查
- `Spec`：基于 `zod` 的结构校验
- `Unit`：原子逻辑单测
- `Demo`：最小可运行闭环
- `Integration`：跨模块或跨包协同验证

其中本文件聚焦“测试与可证明闭环”部分，当前仓库的测试执行主力采用“4 层自动化验证 + 1 组通用门槛”：

- `Spec`：schema、contract、parse / safeParse、normalization 回归
- `Unit`：原子逻辑、schema、prompt builder、policy、route resolver
- `Integration`：主链协同、状态迁移、事件输出、回退策略
- `Eval`：核心 Prompt 套件回归
- 通用门槛：模块级覆盖率、回归测试、低价值测试禁令

对于 LangGraph / 多 Agent 主图，测试对象不只是普通函数输出，还包括：

- 多节点流程
- 状态流转
- interrupt / resume
- checkpoint 持久化与恢复

因此主图相关测试默认采用“整图测试 + 单节点测试 + 部分执行测试”三层方法，不要只用纯函数单测替代流程验证。

## 1. 测试框架

- 项目统一使用 `Vitest`
- 根配置文件为 [vitest.config.js](../vitest.config.js)
- `promptfoo` 只用于模型层评测，不替代 `Vitest`
- 默认使用根级统一配置，不为每个子项目重复维护独立配置

当前命令：

- `pnpm typecheck`
- `pnpm test`
- `pnpm test:spec`
- `pnpm test:unit`
- `pnpm test:demo`
- `pnpm test:integration`
- `pnpm test:coverage`
- `pnpm test:watch`
- `pnpm eval:prompts`
- `pnpm eval:prompts:affected`
- `pnpm lint:prettier:check`
- `pnpm lint:eslint:check`
- `pnpm lint:prettier:affected`
- `pnpm lint:eslint:affected`
- `pnpm verify`
- `pnpm check:docs:turbo`
- `pnpm check:architecture:turbo`
- `pnpm verify:governance`
- `pnpm typecheck:affected`
- `pnpm test:spec:affected`
- `pnpm test:unit:affected`
- `pnpm test:demo:affected`
- `pnpm test:integration:affected`
- `pnpm verify:affected`

说明：

- `pnpm typecheck` 对应五层验证里的 `Type`
- `pnpm test:spec` 对应五层验证里的 `Spec`
- `pnpm test:spec` 会扫描各宿主 `test/` 目录下与 schema、contract、parser、normalization 相关，或显式使用 `zod` / `Schema.parse` / `safeParse` 的测试文件，并作为结构校验回归的统一入口
- `Demo` 在本仓库中指“最小可运行闭环”；当前不再要求 `packages/*` 与 `agents/*` 默认维护与 `src/` 同级的 `demo/`，优先使用 integration、build 或其他自动化 smoke 承担这层责任
- 当前默认规则是：
  - `packages/*` 与 `agents/*` 可以不再维护显式 `demo/` 与 `demo` 脚本
  - `apps/*` 与 `server` 当前同样允许由 integration 或等价自动化闭环承担 Demo 层责任
- `pnpm test:demo` 会动态发现仍保留 `demo/` 与 `demo` 脚本的宿主；没有独立 `demo/` 的宿主由 integration 或等价 smoke 承担最小闭环
- `pnpm test:spec:affected` 会基于 `VERIFY_BASE_REF...HEAD` 与本地 working tree 改动的并集，只执行受影响宿主的 spec 回归；未显式配置时默认使用 `origin/main`。当根级 `package.json`、`vitest.config.js` 或 spec runner 自身发生变化时，会自动提升为全仓 spec 回归
- `pnpm test:demo:affected` 会通过 `node ./scripts/run-turbo-affected.js demo` 只执行受影响宿主的 `demo`，并通过 Turbo task 依赖先补齐当前宿主及其工作空间依赖的 `build:lib`
- `pnpm lint:prettier:check` 与 `pnpm lint:eslint:check` 是根级非修复型治理门槛入口，供 `pnpm verify` 与 CI 直接复用
- `pnpm lint:prettier:affected` 与 `pnpm lint:eslint:affected` 会基于 `VERIFY_BASE_REF` 与 working tree 改动自动决定是只检查受影响文件，还是因共享 lint 配置变更而提升为全仓检查
- `pnpm eval:prompts:affected` 仍保留为独立入口，会在受影响范围内命中 prompt 敏感路径时执行 prompt regression；未命中时自动跳过
- 当前第三阶段对 `Demo` 的收敛策略是“直接复用既有 `demo`，不额外新增 `turbo:test:demo`”，详见 [Turbo Demo 三阶段迁移方案](/docs/evals/turbo-demo-stage-three-plan.md)
- 当前 Turbo `demo` 任务仍兼容历史宿主，但新宿主不再要求以 `demo/**` 作为最小闭环入口
- 如果某个宿主的 Demo 还依赖模板、脚手架或其他外部输入，应按宿主补例外规则，而不是把额外输入粗暴加进所有 Demo；只要宿主保留显式 `demo/` 目录，就必须同步保留 `demo` 脚本并让它可独立运行
- 对脚手架链路，`Demo` 不只指生成器自身能跑，还包括“生成出的目标至少存在最小可运行闭环”：
  - `package-lib` 需要验证最小类型闭环与 integration 闭环
  - `agent-basic` 需要验证 integration 闭环与最小类型闭环
- `pnpm verify` 是根级聚合入口，当前串联 `check:docs + lint:prettier:check + lint:eslint:check + typecheck + test:spec + test:unit + test:demo + test:integration + architecture`
- `pnpm verify:affected` 当前串联 `verify:governance + lint:prettier:affected + lint:eslint:affected + test:spec:affected + typecheck:affected + test:unit:affected + test:demo:affected + test:integration:affected`
- `pnpm verify:governance` 是当前已接入 Turbo 的治理校验入口，聚合 `check:docs + check:architecture`，可直接配合 Turbo 缓存、`--dry-run` 与 `--graph` 使用
- GitHub PR 校验当前默认执行受影响范围主入口：代码改动执行 `pnpm verify:affected`，并将 `VERIFY_BASE_REF` 对齐到 PR 的 base branch；prompt regression 暂时不再内嵌到这条主校验链路里，仍由独立入口承担；命中文档相关路径但没有代码改动时至少执行 `pnpm check:docs`
- GitHub main 校验当前默认执行全量主入口：`pnpm verify`；prompt 敏感改动继续通过独立 job 执行 `pnpm eval:prompts` 或 `pnpm eval:prompts:affected`
- 当前不要把根级 `typecheck`、`test:unit`、`test:integration` 直接改成 Turbo 任务入口；仓库仍存在 `runtime <-> agents/*` 的循环依赖，直接沿 package graph 编排会报错
- 后续二阶段迁移默认采用“新增 Turbo-only 包级任务”而不是直接篡改现有主入口，详见 [Turbo 验证二阶段迁移方案](/docs/evals/turbo-verification-stage-two-plan.md)
- 当前 Phase 2A 已落地的 Turbo-only 包级命令为：
  - `pnpm turbo:typecheck`
  - `pnpm turbo:test:unit`
  - `pnpm turbo:test:integration`
- 当前 Phase 2B 已落地的受影响范围入口为：
  - `pnpm typecheck:affected`
  - `pnpm test:spec:affected`
  - `pnpm test:unit:affected`
  - `pnpm test:demo:affected`
  - `pnpm test:integration:affected`
  - `pnpm verify:affected`

## 1.1 强制执行要求

- [验证体系规范](/docs/evals/verification-system-guidelines.md) 是当前仓库所有非纯文档改动的固定验证总入口；每次改动文件时，都必须先按该文档判断本轮需要补齐的验证层级、治理门槛与命令组合。
- 只要本轮触达代码、配置、模板、脚手架、构建脚本或测试文件，完成前就必须补齐五层验证，不允许只跑其中一层就结束。
- 默认优先执行根级 `pnpm verify`；如果它全绿，视为本轮仓库级验证已收口。
- 禁止因为“只是单文件改动”“只是重构”“只是补测试”“只是调模板”而跳过 [验证体系规范](/docs/evals/verification-system-guidelines.md) 要求的 Type / Spec / Unit / Demo / Integration / Eval / 治理门槛判断。
- 如果 `pnpm verify` 被与本轮无关的既有红灯、网络、凭据、外部服务或环境问题阻断，仍必须对受影响范围逐层补齐以下验证：
  - `Governance`：`pnpm lint:prettier:check`、`pnpm lint:eslint:check`，或受影响范围的 `pnpm lint:prettier:affected`、`pnpm lint:eslint:affected`
  - `Type`：`pnpm typecheck` 或受影响项目的 `tsc --noEmit`
  - `Spec`：`pnpm test:spec`、`pnpm test:spec:affected` 或受影响项目的 schema parse / safeParse 回归
  - `Unit`：`pnpm test:unit` 或受影响项目的 unit tests
  - `Demo`：根级优先 `pnpm test:demo`；受影响范围优先 `pnpm test:demo:affected`，也可执行等价最小闭环，例如 integration、build 或宿主自定义 smoke
  - `Integration`：`pnpm test:integration` 或受影响项目的 integration tests
  - `Eval`：涉及 prompt 敏感路径时执行 `pnpm eval:prompts` 或 `pnpm eval:prompts:affected`
- 只要本轮触达模板、脚手架、CLI、工具 adapter、workflow preset、审批恢复或最小闭环相关实现，这五层验证依旧全部生效，不能因为“只是生成链路”就跳过 Demo / Integration
- 纯文档改动至少执行 `pnpm check:docs`；如果文档与代码同轮变更，仍按五层验证执行。
- 如果只想预览治理校验会执行哪些 Turbo 任务，可运行 `pnpm exec turbo run check:docs check:architecture --dry-run=json` 或 `pnpm exec turbo run check:docs check:architecture --graph=turbo-verify-governance.html`。
- 交付说明里必须明确写出：
  - 实际执行了哪些验证命令
  - 哪一层因什么 blocker 未执行
  - blocker 是否属于本轮改动

## 2. 五层验证落地方式

### Type（类型层）

- 默认通过 `pnpm typecheck` 或受影响包的 `tsc --noEmit` 验证
- 修改共享 DTO、graph state、SSE payload、公共 facade 后必须补类型检查

### Spec（结构层）

- 所有稳定结构化 contract 默认要有 `zod` schema
- schema 的成功、失败、边界路径默认写入 `test/` 下可被 `pnpm test:spec` 识别的回归用例
- 不允许只靠 `JSON.parse` + 零散 `if` 作为正式验证

## 3. 测试分层

### Unit（原子层）

- 负责证明函数、schema、parser、formatter、policy、selector 的局部行为
- 是覆盖率的主要贡献来源之一

### Demo（最小闭环）

- 负责证明模块或链路“至少能跑通一次”
- 当前 `packages/*` 与 `agents/*` 不再默认维护与 `src/` 同级的 `demo/`
- `package-lib` 与 `agent-basic` 脚手架都默认使用 integration 作为最小可运行闭环
- 可接受形式包括：
  - 一条最小 happy path integration test
  - 一个 build / CLI / API / UI 最小链路验证
  - 仍保留历史 demo 脚本的宿主可以继续复用它
- 对不单独生成 `demo/` 的宿主，必须明确由 integration 或其他自动化闭环承担这层责任

### Integration（协同层）

- 负责证明跨节点、跨模块、跨包协作没有断
- 主链、审批、恢复、SSE、学习、前后端联动默认优先补这层

### Unit（原子层）

命名：

- `*.test.ts`
- `*.spec.ts`
- `*.test.tsx`
- `*.spec.tsx`

建议：

- 原子逻辑优先使用 `*.test.ts`
- 不强制全仓改名迁移
- 测试文件位置优先放在各项目 `test/` 目录的对应子目录中，而不是与源码混放

适用对象：

- shared types / schema
- utils / parser / formatter
- BudgetGuard / policy / route resolver
- prompt builder / prompt formatter
- 重要纯函数与映射逻辑

编写要求：

- 优先测输入输出
- 每个关键纯函数至少覆盖成功、边界、失败 3 类路径
- 不依赖内部私有实现细节

### Integration（协同层）

命名：

- 新增测试优先采用 `*.int-spec.ts`
- React 交互场景可使用 `*.int-spec.tsx`

执行命令：

- `pnpm test:integration`
- `pnpm --dir <package-or-agent> test:integration`

适用对象：

- `Supervisor -> Ministry`
- `Session -> SSE -> Message merge`
- `Approval / Recover / Cancel`
- `Research -> Delivery`
- `Learning confirmation`

门槛定义：

- 不使用“核心 Flow 全覆盖”这种不可执行说法
- 改为“核心状态迁移矩阵覆盖”
- 每条主链至少覆盖：
  - 成功
  - 异常
  - 回退
  - 终止

当前核心链路清单：

- 聊天直答链路
- supervisor workflow 链路
- approval recovery 链路
- learning confirmation 链路
- SSE streaming / fallback 链路

包级执行约定：

- 包级 `test:integration` 默认只扫描当前项目 `test/` 目录下的 `*.int-spec.ts` 与 `*.int-spec.tsx`
- 当前统一通过 [scripts/run-package-integration-tests.js](/scripts/run-package-integration-tests.js) 枚举文件后再调用根 [vitest.config.js](/vitest.config.js)
- 如果当前包没有 integration 用例，脚本应稳定返回成功并输出 `no integration tests found`，不要把“暂无集成测试”变成失败原因

### LangGraph Graph 测试补充

对于 `packages/runtime` 与 `agents/*` 里的主图、子图和带 interrupt 的流程，默认优先补以下三类测试：

#### 1. 整图测试

目标：

- 验证 graph 从入口跑到终态是否符合预期
- 验证最终 state、trace、checkpoint、interrupt 历史是否正确

约束：

- 每个测试用例都要重新创建 graph
- 每个测试用例都要重新创建 checkpointer
- 不允许跨 test 共享 graph 实例或 checkpointer，避免状态污染

适用场景：

- 主图 happy path
- interrupt 后恢复到完成
- recover / cancel / fallback 主链

#### 2. 单节点测试

目标：

- 把复杂节点当成纯逻辑单元验证输入输出
- 聚焦 prompt builder、route、policy、state slice 更新等局部行为

做法：

- graph 编译后直接取节点并执行 `invoke`
- 只验证节点输入输出与副作用 contract

注意：

- 单节点测试默认不覆盖 checkpointer
- 单节点测试不等价于流程测试，不能替代 interrupt / resume / checkpoint 回归

#### 3. 部分执行测试

目标：

- 不从 `START` 跑整图，只验证中间一段流程
- 尤其适合复杂 graph、中断恢复、局部状态迁移

做法：

- 通过 checkpoint / `updateState` 人工构造中间状态
- 指定“相当于某节点刚执行完”
- 使用同一个 `thread_id` 继续 `invoke`
- 只断言目标片段之后的行为

适用场景：

- interrupt 后 resume
- 审批通过后继续执行
- 从 planning / review / delivery 中段恢复

补充要求：

- 只要流程依赖 LangGraph interrupt、resume 或 checkpoint，就至少要有一条整图测试或部分执行测试
- 只测 prompt / parser / route，不足以证明流程正确
- 新增 interrupt 节点时，至少覆盖：
  - 中断触发
  - 恢复继续
  - 异常输入或拒绝路径

当前已落地样例：

- `Supervisor -> Ministry`：
  当前代表性样例位于 `packages/runtime/test` 与 `apps/backend/agent-server/test/runtime`
- `Session -> SSE -> Message merge`：
  当前代表性样例位于 `packages/runtime/test/session-inline-capability.int-spec.ts` 与 `apps/frontend/agent-chat/test/hooks`
  其中 `packages/runtime/test/session-inline-capability.int-spec.ts` 已覆盖 inline capability 响应落盘、checkpoint recovery 与 cancel fallback 最小闭环
- `Approval / Recover / Cancel`：
  代表性样例位于 `packages/runtime/test/approval-recovery.int-spec.ts`、`apps/backend/agent-server/test/chat` 与 `apps/frontend/agent-chat/test/hooks/chat-session`
- `多轮上下文追问`：
  代表性样例位于 `apps/frontend/agent-chat/test/hooks/chat-session`
- `Learning confirmation`：
  代表性样例位于 `apps/backend/agent-server/test/runtime/testing`
- `Research -> Delivery`：
  代表性样例位于 `apps/backend/agent-server/test/chat` 与 `apps/backend/agent-server/test/runtime/testing`
- `Runtime audit 聚合`：
  代表性样例位于 `apps/backend/agent-server/test/runtime`

### Eval（模型层）

命名：

- `*.promptfooconfig.yaml`

工具：

- `promptfoo`

适用对象：

- Prompt 版本迭代
- Tool call 参数结构
- 结构化输出合同
- Delivery 口吻与 contract stability

规则：

- 只评估核心 Prompt 套件，不扩成大矩阵
- 每个关键 prompt 保留 2 到 6 条代表性高风险样例
- 核心套件成功率必须 `> 90%`
- 核心套件不达标时阻塞主分支
- 非核心探索性评测只生成报告，不阻塞

当前核心 Prompt 套件：

- `supervisor-plan`
- `specialist-finding`
- `hubu-research`
- `xingbu-review`
- `libu-delivery`

说明：

- `tool call contract` 属于下一批优先补齐的 Eval 套件
- 在该套件正式加入核心清单前，不作为当前阻塞项

## 3. 覆盖率门槛

覆盖率门槛按模块执行，不按单个测试文件执行。

统一要求：

- `lines >= 85%`
- `statements >= 85%`
- `functions >= 85%`
- `branches >= 85%`

当前按模块卡门槛：

- `packages/runtime`
- `apps/backend/agent-server`
- `apps/frontend/agent-chat`
- `apps/frontend/agent-admin`

执行规则：

- `Unit` 负责提供主要覆盖贡献
- `Integration` 负责覆盖关键状态迁移与协同行为
- 覆盖率不是 `Unit` 独占指标，而是模块质量线
- 修改核心链路时，不允许通过补低价值测试来“刷”覆盖率

遗留白名单原则：

- 若历史遗留区域暂时无法达标，必须显式记录原因、负责人和清理时间
- 不允许隐式跳过或口头例外

## 4. Mock 与隔离规则

- 只 mock 当前测试真正依赖的外部边界
- 优先 mock：
  - 网络请求
  - 文件写入
  - 时间
  - 随机值
  - 大模型调用
- 不要 mock 自己正在验证的核心逻辑

推荐：

- provider、executor、repository、gateway 做替身
- 单测不调用真实模型或真实外部 API

## 5. 回归测试要求

- 每次修 bug 必补回归测试
- 改 prompt、路由、会话上下文、流式事件、审批链路时，必须补 regression case
- 改 graph 节点顺序、阶段 trace、interrupt / resume、checkpoint 恢复语义时，必须补对应整图测试、部分执行测试或节点回归
- 关键模块至少同时具备：
  - `Unit`
  - 至少一条 `Integration`
  - 相关 Prompt 改动时的 `Eval`

## 5.1 阶段可观测性测试要求

主图不是黑盒。凡是用户能在 `agent-chat` 或 `agent-admin` 里观察到的阶段，测试都应覆盖其可见性，不要只断言最终答案。

至少应验证：

- 关键阶段会写入 `trace`
- 关键阶段会产生对应事件或 checkpoint 摘要
- interrupt / recover / cancel / delivery 不会静默发生

推荐断言：

- `task.trace` 中包含目标节点
- session events 中包含目标阶段事件
- checkpoint / think / thoughtChain 可以看到对应阶段说明

## 6. 低价值测试禁令

禁止以下测试作为覆盖率补数手段：

- 空壳 DTO 测试
- 只断言 `toBeDefined`
- 大量无意义快照
- mock 掉被测核心逻辑后再断言“流程通过”
- 只验证 import / render 不报错，但不验证行为结果

反例：

```ts
it('works', () => {
  expect(result).toBeDefined();
});
```

合格示例：

```ts
it('在 SSE 首个 assistant_token 到达时关闭 think loading 并保留正文流', () => {
  const next = syncCheckpointFromStreamEvent(checkpoint, event);

  expect(next?.thinkState?.loading).toBe(false);
  expect(next?.graphState?.status).toBe('running');
});
```

## 7. 本地数据与测试隔离

- 测试不要写入正式运行数据
- 正式运行数据统一放根级 `data/`
- 测试落盘使用临时目录或独立测试路径

推荐：

- `os.tmpdir()`
- 临时测试目录

禁止：

- 写入 `apps/backend/agent-server/data`
- 写入正式 `data/runtime/tasks-state.json`

## 8. CI 规则

当前 CI 默认执行：

- `pnpm test`
- `pnpm lint:tsc`
- `pnpm eval:prompts`（仅在核心 Prompt 回归条件满足且密钥可用时）

覆盖率门槛执行方式：

- `pnpm test:coverage` 已作为显式门槛命令提供
- 当前仓库基线尚未达到 `>= 85%`，因此未提升为默认 PR 阻塞项
- 当四个目标模块完成补测并达标后，再将 `pnpm test:coverage` 升级为默认 CI 阻塞步骤

PR 规则：

- 核心链路改动但没有新增测试，默认不应通过
- 覆盖率下降需要明确说明原因
- Prompt 或模型路由相关改动，默认需要检查 Eval 结果

## 9. 当前推荐补测顺序

1. `packages/runtime` 与 `agents/*` 的会话、上下文、主图路由
2. `apps/backend/agent-server` 的 chat、runtime、approval
3. `apps/frontend/agent-chat` 的 SSE、输入、消息合并、状态面板
4. `apps/frontend/agent-admin` 的关键中心面板与运行态展示
5. `packages/evals` 的 tool call contract 核心套件
