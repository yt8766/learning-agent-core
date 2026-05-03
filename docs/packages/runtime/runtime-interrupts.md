# Runtime Interrupts

状态：current
文档类型：reference
适用范围：运行时中断规范
最后核对：2026-05-01

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

## 3.1 Agent 节点中断注意事项

这些规则适用于所有会在 LangGraph 节点、工具节点或 agent graph 主链里调用 `interrupt(payload)` 的实现。

### 不要吞掉 `interrupt()` 的控制流

`interrupt()` 的暂停语义依赖 LangGraph 内部抛出的专用控制流异常。节点代码不得用宽泛 `try/catch` 把这个异常吃掉，否则 graph 无法暂停，chat/admin 也收不到人工交互卡片。

推荐写法：

```ts
async function approvalNode(state: State) {
  const approved = interrupt({ kind: 'approval', question: 'Approve this change?' });

  try {
    await fetchSupplementalContext(state.requestId);
  } catch (error) {
    await recordRecoverableDiagnostic(error);
  }

  return { approved };
}
```

如果外部调用必须放在同一个 `try/catch` 中，只允许处理明确关心的错误；其余错误必须原样抛回去，让 LangGraph 能接住中断控制流：

```ts
async function approvalNode(state: State) {
  try {
    const approved = interrupt({ kind: 'approval', question: 'Approve this change?' });
    await callRemoteService(state.requestId);
    return { approved };
  } catch (error) {
    if (error instanceof NetworkError) {
      await recordRecoverableDiagnostic(error);
    }

    throw error;
  }
}
```

禁止写法：

```ts
async function approvalNode() {
  try {
    return interrupt({ kind: 'approval', question: 'Approve?' });
  } catch (error) {
    return { approved: false };
  }
}
```

### 保持 `interrupt()` 调用顺序稳定

LangGraph 恢复执行时会从节点函数开头重跑，并按调用顺序把 resume 值映射回每一个 `interrupt()`。同一个节点内多个中断的数量与顺序必须稳定。

允许：

```ts
async function profileNode() {
  const name = interrupt({ field: 'name' });
  const age = interrupt({ field: 'age' });
  const city = interrupt({ field: 'city' });

  return { name, age, city };
}
```

避免在条件分支、非确定性分支或动态列表循环中改变中断数量或顺序：

```ts
async function profileNode(state: State) {
  const name = interrupt({ field: 'name' });

  if (state.needsAge) {
    interrupt({ field: 'age' });
  }

  const city = interrupt({ field: 'city' });
  return { name, city };
}
```

动态审批列表应先在上游节点固化为稳定、有序、带 `id` 的 proposal，然后在单个中断 payload 中提交整组可审批项；或者拆成多个 graph 节点，由 graph wiring 保证顺序，而不是在一个节点内按运行时动态数组循环调用 `interrupt()`。

### 中断 payload 和 resume 值必须可 JSON 序列化

中断会被 checkpointer 持久化并在恢复时反序列化。`payload` 与预期 resume 值只能包含原始类型、数组和普通对象；不要传函数、类实例、连接对象、流、`Request`、`Response`、带原型链的对象或不可稳定 JSON 化的数据。

推荐传递配置或校验标识：

```ts
const response = interrupt({
  kind: 'supplemental-input',
  question: 'Enter user details',
  fields: ['name', 'email', 'age'],
  validatorType: 'nonEmptyProfile',
  currentValues: state.userProfile ?? {}
});
```

不要把校验函数或处理器实例塞进 payload。真正的 validator、processor、client 应在节点恢复后由本地代码重新创建。

### `interrupt()` 前的副作用必须幂等

恢复执行不是从中断行继续，而是从节点函数开头重新跑到对应的 `interrupt()`。因此中断点之前的所有外部副作用都可能重复执行。

允许放在 `interrupt()` 前的操作必须具备幂等语义，例如按稳定 `requestId` upsert、覆盖状态、写入可去重的 pending record：

```ts
async function approvalNode(state: State) {
  await approvalRepository.upsertPendingRequest({
    requestId: state.requestId,
    status: 'pending_approval'
  });

  const approved = interrupt({ kind: 'approval', requestId: state.requestId });
  return { approved };
}
```

非幂等操作默认放到中断之后，或拆进后续节点：

```ts
async function notificationNode(state: State) {
  if (state.approved) {
    await notificationService.sendApprovalResult({
      requestId: state.requestId,
      status: 'approved'
    });
  }

  return state;
}
```

禁止在 `interrupt()` 前直接 `insert` 审计日志、append 历史、发送通知、扣费、发布、写外部系统或创建无法按稳定 key 去重的记录。

当前 runtime 内置的 LangGraph skill-install 中断必须通过 `flows/approval/interrupt-idempotency.ts` 写入 pending interrupt / pending approval：

- `recordPendingInterruptOnce(...)` 只允许同一个 `interrupt.id + pending` 在 `interruptHistory` 中保留一条记录；恢复重放时允许替换同一条 pending 投影，但不追加第二条。
- `recordPendingApprovalOnce(...)` 只允许同一个 `taskId + intent + actor + pending` 写入一条审批记录。
- `attachTool`、`recordToolUsage`、`approval_gate` trace、progress delta 和 `markExecutionStepBlocked` 这类会产生外部可见投影的操作，只能在首次写入 pending interrupt 时执行。

Supervisor 计划问题中断必须在恢复重放时识别已有 pending `plan-question` interrupt：重放不再增加 `planTurnsUsed`，也不再重复追加 `interruptHistory`、`approvals`、trace 或 progress。

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
LangGraph checkpointer 已可通过 `LANGGRAPH_CHECKPOINTER=postgres` 切换为官方 `PostgresSaver`，详见 [langgraph-postgres-checkpointer.md](/docs/packages/runtime/langgraph-postgres-checkpointer.md)。
在主链完全切到 `Command({ resume })` 前，`ApprovalInterruptRecord.resumeStrategy` 仍允许暂时为 `approval-recovery`。
这不是终态，只是为了让前后端先围绕统一中断协议收敛，并把 checkpoint 持久化能力先落到 runtime 装配边界。
