# Runtime Interrupts

本文件定义仓库内“审批 / 人工确认 / 等待补充输入”相关流程的统一中断规范。

目标不是再扩展一套 `pendingApproval` 变体，而是把“中断”明确为 runtime 与 graph 的主控制原语。

## 1. 基本原则

- 任何“需要用户确认后才能继续”的流程，默认使用可恢复中断语义
- `pendingApproval` 是治理投影和兼容字段，不应继续充当新的控制流原语
- 高风险工具、skill 安装、connector 配置、外部副作用操作，应优先进入中断，而不是等节点完整结束后再异步挂起
- 中断必须可恢复、可持久化、可回放

## 2. 两类中断

### 阻塞式中断

适用于：

- skill 安装审批
- connector secret / enable / disable
- 删除文件、批量 patch、发布、扣费、外部写操作
- 任何不可逆或高风险动作

语义：

- graph 在中断点立即停止
- 外界收到中断 payload
- 必须等待用户输入或审批恢复

### 非阻塞式中断

适用于：

- 建议补齐某个 skill 或 connector，但当前轮仍可继续
- 需要用户补充信息，但不阻断低风险主流程

语义：

- runtime 发出显式中断/提示信号
- UI 可展示卡片
- graph 可在策略允许时继续

## 3. LangGraph 主链要求

后续新的阻塞式中断应优先采用 LangGraph 官方模式：

1. 在节点或工具内部调用 `interrupt(payload)`
2. 依赖 checkpointer 持久化图状态
3. 使用稳定的 `thread_id`
4. 外部通过 `result.__interrupt__` 读取中断数据
5. 用户确认后使用 `Command({ resume })` 恢复同一线程

约束：

- 中断点之前的逻辑必须幂等，因为恢复时节点前半段可能重跑
- 不要把 `interrupt()` 包在会吞掉控制流的 `try/catch` 里
- 中断 payload 必须足以让 chat/admin 直接渲染审批卡

## 4. 仓库共享协议

共享类型层提供两类记录：

- `ApprovalInterruptRecord`
  - 表示当前或历史中断
  - 标识来源是 `graph` 还是 `tool`
  - 标识是 `blocking` 还是 `non-blocking`
  - 标识恢复方式是 `command` 还是兼容期的 `approval-recovery`
- `ApprovalResumeInput`
  - 表示外界提供给恢复入口的 resume 数据

`TaskRecord.activeInterrupt` 与 `ChatCheckpointRecord.activeInterrupt` 表示当前主中断；`interruptHistory` 用于审计和回放。
这两个字段是 persisted compatibility projection，不是新的主控制流命名；运行归属统一指向 `司礼监 / InterruptController`。

## 5. 与旧字段的关系

兼容期内允许同时维护：

- `pendingApproval`
- `activeInterrupt`
- `interruptHistory`

约束：

- 新能力优先写 `activeInterrupt`
- `activeInterrupt / interruptHistory` 仅作为持久化兼容投影暴露给 UI / export / replay
- 所有恢复入口按 `司礼监 / InterruptController` 解释 `activeInterrupt / interruptHistory`
- 若需要兼容现有 chat/admin 卡片，再同步生成 `pendingApproval`
- 不允许只新增 `pendingApproval` 而完全没有 interrupt 语义

## 6. 第一批迁移对象

优先顺序：

1. skill install approval
2. connector governance
3. runtime governance
4. 高风险 filesystem / terminal / publish 工具

## 7. 当前阶段说明

当前仓库仍以 `approval-recovery` 为主恢复链。
在真正接入 LangGraph checkpointer + `Command({ resume })` 前，`ApprovalInterruptRecord.resumeStrategy` 允许暂时为 `approval-recovery`。
这不是终态，只是为了让前后端先围绕统一中断协议收敛。
