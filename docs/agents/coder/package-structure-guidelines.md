# coder 包结构规范

状态：current
文档类型：convention
适用范围：`agents/coder`
最后核对：2026-05-02

本文档说明 `agents/coder` 如何继续作为工部/兵部执行智能体宿主收敛结构。

## 1. 目标定位

`agents/coder` 负责：

- `ExecutorAgent`
- `GongbuCodeMinistry`
- `BingbuOpsMinistry`
- 代码执行、工具选择、只读批处理、审批门、执行 prompt / schema

它不负责：

- runtime session / checkpoint / graph orchestration
- tool registry / sandbox / filesystem executor 实现
- review 决策与 delivery 总结

## 2. 推荐结构

```text
agents/coder/
├─ src/
│  ├─ flows/
│  │  ├─ chat/
│  │  └─ ministries/
│  ├─ capabilities/
│  ├─ runtime/
│  ├─ utils/
│  └─ index.ts
├─ test/
└─ package.json
```

各目录语义：

- `flows/chat/`
  - `ExecutorAgent` 与 chat 节点
- `flows/ministries/gongbu-code/`
  - 代码执行链、prompt、schema、tool selection、approval gate
- `flows/ministries/bingbu-ops-ministry.ts`
  - 兵部执行入口
- `capabilities/`
  - 执行模式与能力门控
- `runtime/`
  - agent runtime context / streaming facade

## 3. 当前收敛策略

当前已经明确：

- `gongbu-code/*`
  - 作为代码执行链的真实宿主
- 根入口
  - 只暴露稳定公共面，不对外泄漏内部目录细节
- `runtime` 依赖边界
  - 共享 agent foundation 仅允许通过 `@agent/runtime` 根入口消费
  - runtime facade 仅允许通过 `@agent/runtime` 根入口消费
  - 不允许直接依赖 `packages/runtime/src/*`，也不允许依赖 `runtime/agent-bridges/*` 这类 runtime 内部过渡层
- 工具执行边界
  - `read_local_file`、`list_directory` 等 `capabilityType: "local-tool"` 必须通过 runtime sandbox 执行，不能仅因为 context 存在 `mcpClientManager` 就当作 MCP capability 调用。
  - 只有 `mcpClientManager.hasCapability(toolName)` 为 true 时，`gongbu-code` runner 才能调用 `invokeCapability(toolName, request)`；否则必须 fallback 到 `context.sandbox.execute(request)`。
  - 这个边界避免主聊天出现 `MCP capability read_local_file is not registered` / `list_directory is not registered` 这类本地工具误投 MCP 的错误。

后续继续收敛时：

1. 新的执行节点优先落在 `flows/chat/` 或 `flows/ministries/gongbu-code/`
2. prompt 与 schema 继续贴着执行域目录落位
3. 不把执行实现重新搬到 `packages/runtime` 或 `packages/tools`
4. 已纳入 root export 测试的 agent、ministry、prompt、schema 继续保持“根入口稳定 + 真实宿主明确”
