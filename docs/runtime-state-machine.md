# Runtime State Machine

本文档固定当前 runtime、worker 与 chat 的主状态机语义，避免 backend、worker、admin、agent-chat 对同一状态产生不同解释。

## Task State

`TaskRecord.status` 使用以下 canonical 状态：

- `queued`
  - 任务已创建，等待 background runner 或主链继续消费
- `running`
  - 任务正在首辅主链或后台执行链中推进
- `waiting_approval`
  - 任务已暂停在司礼监 / InterruptController，等待人工审批、计划问题回答或补充输入
- `failed`
  - 任务执行失败，当前轮未恢复
- `completed`
  - 任务已完成并生成最终答复
- `cancelled`
  - 任务被人工取消或因超时策略终止
- `blocked`
  - 审批被拒绝或执行被显式阻断，需人工重新发起

其中：

- `activeInterrupt` / `interruptHistory` 仅是司礼监状态的持久化兼容投影
- 恢复入口统一经 `InterruptController`
- 不再为新逻辑新增 legacy alias

## Learning Job State

`LearningJob.status` 使用以下 canonical 状态：

- `queued`
  - learning job 已创建，等待 backend 内建 runner 或独立 worker 消费
- `running`
  - learning job 正在处理文档学习、研究学习或聚合写入
- `completed`
  - learning job 已完成并写入结果
- `failed`
  - learning job 执行失败，等待人工重试或重新创建

learning job 不再使用“创建即 completed”的同步语义。

## Backend vs Worker

- backend 内建 background runner
  - 作为开发环境、单机运行和兜底模式
  - 负责在未启用独立 worker 时消费 queued task / learning job
- 独立 `apps/worker`
  - 作为正式后台消费入口
  - 负责 background task、learning job、recover/retry/checkpoint replay 等异步链路

推荐语义：

- 本地开发：可启用 backend 内建 runner
- 稳定运行：以独立 worker 为主，backend 仅负责 API 与状态投影

## Chat Recovery Semantics

当前 chat 恢复语义固定为：

- `/chat/stream`
  - 主实时通道
  - 负责 token、delta、assistant message、终态事件
- `/chat/checkpoint`
  - 运行态兜底
  - 用于断流、idle close、审批态和 graphState 校准
- `/chat/messages`
  - 历史恢复与终态消息校准
- `/chat/events`
  - 历史时间线恢复与终态事件校准

因此：

- 运行中不再依赖全量 detail polling 驱动正文渲染
- `messages / events / checkpoint` 只做恢复和终态 reconcile
- 如果后续新增统一 `snapshot` 接口，它只作为新增恢复抽象，不替换现有兼容接口

## Interrupt Recovery

中断类恢复统一遵循：

- 审批中断：`waiting_approval -> approved/rejected -> resume or blocked`
- 计划问题中断：超时可按默认选项继续，进入 `running`
- 补充输入中断：超时可进入 `cancelled`
- skill install 审批：批准后恢复到当前 runtime 阶段，拒绝后进入 `blocked`

所有恢复链都必须：

- 可 observe
- 可 cancel
- 可 recover
- 保持 canonical 状态解释一致

## Runtime Discipline

当前首辅主链的运行纪律固定为：

- `ModeGate`
  - `plan` 只开放规划、只读研究和轻量上下文整理
  - `execute` 才开放完整六部执行能力
  - `imperial_direct` 允许快捷直达，但高风险动作仍受审批门约束
- `ContextFilter`
  - 会过滤系统战报、重复 thought copy、无关历史
  - 会为 `strategy / ministry / fallback` 构造不同受众切片
- `DispatchPlanner`
  - 票拟持久化顺序固定为 `strategy -> ministry -> fallback`
  - 群辅优先提供策略约束，六部再承接执行，通才只做降级兜底
- `Final Review`
  - workflow 型任务统一遵循 `ResultAggregator -> Xingbu final review -> Libu delivery`
  - `finalReviewState.decision` 只使用 `pass / revise_required / block`
  - `deliveryStatus` 只使用 `pending / delivered / interrupted`

当前项目采用的是：

- `worker` 异步执行 + background runner
- 通才兜底
- 六部治理语义

而不是独立 `gstask` 物理层。
