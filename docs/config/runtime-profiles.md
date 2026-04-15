# Runtime Profiles

状态：current
适用范围：`packages/config`、`apps/backend/agent-server`、`apps/worker`
最后核对：2026-04-14

## 1. 这篇文档说明什么

本文档说明当前仓库里的 runtime profile 如何区分默认策略，以及它们会影响哪些运行时行为。

## 2. 当前 profiles

当前统一支持 4 个 profile：

- `platform`
  - 平台宿主默认 profile
  - 默认 `balanced approval + controlled-first source policy`
- `company`
  - 公司 Agent 默认 profile
  - 默认 `strict approval + internal-only source policy`
- `personal`
  - 个人 Agent 默认 profile
  - 默认 `auto approval + open-web-allowed source policy`
- `cli`
  - 命令行 / REPL 默认 profile
  - 默认 `balanced approval + controlled-first source policy`

## 3. profile 会影响什么

profile 不只是数据目录标签，还会影响：

- budget policy
- source policy
- skill source preset
- connector preset
- worker routing
- company specialist selection
- 默认审批强度

## 4. 当前边界

`packages/config` 负责：

- profile 定义
- settings schema
- 默认策略
- 路径布局和存储策略

不负责：

- graph / flow 编排
- agent 业务决策
- 工具执行主逻辑

这些能力应继续留在 `@agent/agent-core` 或 `@agent/tools`。

## 5. 运行时约束

- backend 与 worker 在同一 profile 下应共享同一套 runtime state 解释
- 新增 profile 时，必须同步评估 approval、source、connector、skill source 的默认值
- 不能在 app 层各自发明 profile 别名或局部策略名

## 6. 继续阅读

- [config 文档目录](/Users/dev/Desktop/learning-agent-core/docs/config/README.md)
- [README](/Users/dev/Desktop/learning-agent-core/README.md)
- [Runtime State Machine](/Users/dev/Desktop/learning-agent-core/docs/runtime-state-machine.md)
