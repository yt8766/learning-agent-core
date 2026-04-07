# 测试规范

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

当前规范采用“3 层测试 + 1 组通用门槛”：

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

- `pnpm test`
- `pnpm test:unit`
- `pnpm test:integration`
- `pnpm test:coverage`
- `pnpm test:watch`
- `pnpm eval:prompts`

## 2. 测试分层

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

### LangGraph Graph 测试补充

对于 `packages/agent-core` 里的主图、子图和带 interrupt 的流程，默认优先补以下三类测试：

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
  当前代表性样例位于 `packages/agent-core/test/graphs` 与 `packages/agent-core/test/flows`
- `Session -> SSE -> Message merge`：
  当前代表性样例位于 `apps/frontend/agent-chat/test/hooks`
- `Approval / Recover / Cancel`：
  代表性样例位于 `packages/agent-core/test/session`
- `多轮上下文追问`：
  代表性样例位于 `packages/agent-core/test/session`
- `Learning confirmation`：
  代表性样例位于 `packages/agent-core/test/session`
- `Research -> Delivery`：
  代表性样例位于 `packages/agent-core/test/flows`
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

- `packages/agent-core`
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

1. `packages/agent-core` 的会话、上下文、主图路由
2. `apps/backend/agent-server` 的 chat、runtime、approval
3. `apps/frontend/agent-chat` 的 SSE、输入、消息合并、状态面板
4. `apps/frontend/agent-admin` 的关键中心面板与运行态展示
5. `packages/evals` 的 tool call contract 核心套件
