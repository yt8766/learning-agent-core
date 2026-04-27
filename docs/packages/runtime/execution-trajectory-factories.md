# Execution Fabric 与 Task Trajectory Runtime Factories

状态：current
文档类型：reference
适用范围：`packages/runtime` Phase 2 execution fabric / task trajectory factory 与 helper
最后核对：2026-04-26

本文档固定 Phase 2 Runtime factories 的当前边界：`packages/runtime` 只提供创建 `@agent/core` execution / trajectory records 的 factory 与 helper，让 runtime 能用稳定 contract 组装运行轨迹记录。

Phase 2 不改变真实 tool executor，不接入 backend / frontend，也不新增 API 投影。

## 1. 目的

Phase 2 的目标是让 runtime 内部先拥有稳定、可测试的记录创建入口：

- 执行前能创建 execution request
- 策略判断能创建 execution policy decision
- 执行后能创建 execution result
- task 推进时能创建 trajectory step / artifact
- 多个 execution record 与 trajectory record 之间能通过 linker helpers 保持可追踪关系

这些 factory 输出必须能被 `@agent/core` 对应 schema parse。它们只负责把 runtime 当前已知的输入整理为稳定 record，不负责替代真实执行器、审批门、持久化层或前后端投影。

## 2. Execution Fabric Factories

Execution Fabric factories 面向单次工具或节点执行的请求、策略与结果记录。

当前固定入口：

- `createExecutionRequest`
  - 创建一次 execution request record
  - 用于表达 runtime 准备执行的节点、工具、输入摘要、风险分类和关联上下文
- `createExecutionPolicyDecision`
  - 创建一次 execution policy decision record
  - 用于表达当前 request 被允许、拒绝或需要审批的策略结论
- `createExecutionResult`
  - 创建一次 execution result record
  - 用于表达执行成功、失败、取消或被阻断后的结果摘要
- `normalizeExecutionRiskClass`
  - 将 runtime 层输入的风险级别归一化为 `@agent/core` contract 可接受的 risk class
  - 未知或缺失风险不得被默默解释为高权限执行许可
- `listDefaultExecutionNodes`
  - 返回 runtime Phase 2 默认可识别的 execution node 列表
  - 该列表是 factory/helper 识别范围，不等同于真实 executor registry
- `findExecutionNode`
  - 按稳定 id 或节点描述查找默认 execution node
  - 只用于记录创建和测试辅助，不负责执行路由

Execution Fabric factory 的核心约束：

- 输出 record 必须通过 `@agent/core` execution schema parse
- factory 可以填充稳定默认值，但不能伪造真实执行结果
- 业务一致性校验只做到 schema 级别；跨字段严格一致性留给后续 runtime builder / validator
- 不在 factory 内调用 tool executor、repository、backend service 或 frontend projection

## 3. Task Trajectory Factories

Task Trajectory factories 面向任务推进过程中的步骤、产物与整体轨迹。

当前固定入口：

- `createTrajectoryStep`
  - 创建 task trajectory step record
  - 用于描述一个 task 在 runtime 中经历的阶段、节点、状态变化和关联 execution record
- `createTrajectoryArtifact`
  - 创建 task trajectory artifact record
  - 用于描述执行过程中产生的文件、证据、摘要、计划、报告或其他可追踪产物
- `buildTaskTrajectory`
  - 根据 task、step、artifact 与关联上下文组装完整 task trajectory record
  - 该入口负责 record 形状收口，不负责 replay 或持久化
- trajectory linker helpers
  - 将 execution request / policy decision / result 与 trajectory step / artifact 建立稳定引用
  - 用于后续 backend projection API 或 evidence 视图消费

Task Trajectory factory 的核心约束：

- 输出 record 必须通过 `@agent/core` trajectory schema parse
- step 与 artifact 可以引用 execution record，但 factory 不验证真实执行是否已经发生
- trajectory linker helpers 只建立引用关系，不执行跨存储查询
- 严格的时间线完整性、状态转移合法性和重复记录合并留给后续 runtime builder / validator

## 4. 边界

Phase 2 factories 的边界固定为：

- 只在 `packages/runtime` 提供 factory/helper
- 只创建 `@agent/core` execution / trajectory records
- 只保证 schema parse 与基础默认值归一
- 不改变真实 tool executor
- 不接 backend / frontend
- 不做持久化
- 不做 replay
- 不新增或修改 API
- 不承担跨步骤严格业务一致性判定

后续如果需要更强一致性，应新增 runtime builder / validator，并让 builder / validator 消费这些 factory 输出；不要把跨节点状态机、持久化读取或 API 投影逻辑塞回 factory。

## 5. 测试入口

Phase 2 factory 的当前测试入口固定为：

- `packages/runtime/test/execution-fabric-flow.test.ts`
- `packages/runtime/test/task-trajectory-flow.test.ts`

这些测试应优先证明：

- factory 输出可被 `@agent/core` schema parse
- 默认值和风险归一化语义稳定
- execution record 与 trajectory record 的 linker helpers 能建立可追踪引用
- factory 不依赖真实 executor、backend service 或 frontend 运行时

## 6. 后续接线建议

后续接线时建议按现有执行链上的真实成功 / 失败位置逐步接入：

1. 在 tool call 准备执行时创建 execution request。
2. 在 runtime policy / approval 决策完成时创建 execution policy decision。
3. 在 tool call 成功、失败、取消或被阻断后创建 execution result。
4. 在对应 task 阶段推进时创建 trajectory step。
5. 在产生文件、证据、摘要、报告或其他产物时创建 trajectory artifact。
6. 使用 trajectory linker helpers 将 request、decision、result、step、artifact 串成可投影轨迹。
7. 在 runtime 内部记录稳定后，再进入 backend projection API，由 backend 负责对 chat/admin 暴露展示视图。

接线顺序应保持“runtime 先形成稳定 record，backend 再做 projection，frontend 只消费投影视图”。不要让 frontend 反向推断 execution / trajectory 语义，也不要让 backend service 直接重建 runtime factory 逻辑。
