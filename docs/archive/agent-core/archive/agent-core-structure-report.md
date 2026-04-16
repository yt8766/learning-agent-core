# agent-core 结构报告

状态：archive
文档类型：archive
适用范围：`packages/agent-core` 历史结构报告
最后核对：2026-04-15
说明：历史阶段报告，不代表当前实现

## 1. 参考项目结构观察

参考目录：`D:\渡一资料\前端架构课\coding-agent\完整代码\duyi-figma-make\server\agents`

它的顶层拆分非常清晰：

- `adapters/`
  - 面向外部系统的适配层
  - 例如 Figma、图片、Prompt、路由注册
- `flows/`
  - 面向业务流程拆分
  - 每条 flow 再拆成 `nodes / prompts / schemas / utils`
- `graphs/`
  - 负责图编排和入口工厂
  - 例如 `main.graph.ts`、`traditional.graph.ts`
- `shared/`
  - 多条 flow 共用的 prompt、schema、工具方法
- `utils/`
  - 跨 flow 的通用工具，例如模型、重试、mock、AST 处理

这套结构的优点是：

1. 按“流程”组织，而不是按“技术类型”散放文件
2. `graph` 和 `node` 分层明确
3. Prompt、Schema、Utils 都不会混在业务节点里
4. 后续新增一条 flow 时，目录天然可扩展

## 2. 当前项目现状

当前 `agent-core` 已经拆出了这些层：

- `models/`
- `agents/`
- `session/`
- `graph/`
- `runtime/`
- `types/`
- `tests/`

这比“全部塞在一个文件里”已经好很多，但和参考项目比，还差一层“以业务流为中心”的组织方式。

当前问题主要是：

1. `agents/` 只体现了角色划分，没有体现会话流、审批流、学习流
2. `graph/` 里现在更多是统一编排，但没有把不同 flow 分层出来
3. Prompt、Schema、事件映射、流式拼接逻辑还没有稳定归位
4. `models/` 更像 provider 层，未来还会继续膨胀

## 3. 建议的最终结构

在 **不拆成多个 package** 的前提下，建议 `packages/agent-core/src` 最终调整为：

```text
src/
├─ index.ts
├─ adapters/
│  ├─ llm/
│  │  ├─ chat-model-factory.ts
│  │  ├─ llm-provider.ts
│  │  └─ zhipu-provider.ts
│  ├─ memory/
│  ├─ tools/
│  └─ session/
├─ flows/
│  ├─ chat/
│  │  ├─ nodes/
│  │  │  ├─ manager-node.ts
│  │  │  ├─ research-node.ts
│  │  │  ├─ executor-node.ts
│  │  │  └─ reviewer-node.ts
│  │  ├─ prompts/
│  │  ├─ schemas/
│  │  └─ utils/
│  ├─ approval/
│  │  ├─ nodes/
│  │  └─ utils/
│  └─ learning/
│     ├─ nodes/
│     ├─ prompts/
│     └─ schemas/
├─ graphs/
│  ├─ main.graph.ts
│  ├─ chat.graph.ts
│  ├─ task.graph.ts
│  └─ recovery.graph.ts
├─ shared/
│  ├─ prompts/
│  ├─ schemas/
│  ├─ constants/
│  ├─ event-maps.ts
│  └─ message-types.ts
├─ runtime/
│  ├─ agent-runtime-context.ts
│  └─ token-stream.ts
├─ utils/
│  ├─ retry.ts
│  ├─ message-merge.ts
│  ├─ event-merge.ts
│  └─ time.ts
├─ session/
│  ├─ session-coordinator.ts
│  ├─ checkpoints.ts
│  ├─ session-events.ts
│  └─ session-store.ts
├─ tests/
└─ types/
```

## 4. 目录职责说明

### `adapters/`

只负责对接外部能力，不放业务决策。

建议放：

- LLM provider
- Tool adapter
- Memory adapter
- Session adapter

### `flows/`

这是核心。以后要把 Agent 逻辑从“按角色散放”升级成“按会话/审批/学习流程组织”。

建议：

- `chat/`：主对话流
- `approval/`：审批恢复流
- `learning/`：学习确认流

每个 flow 内再固定：

- `nodes/`
- `prompts/`
- `schemas/`
- `utils/`

### `graphs/`

只负责图定义和 flow 编排，不直接写业务细节。

建议：

- `main.graph.ts`：统一入口
- `chat.graph.ts`：聊天主链路
- `task.graph.ts`：任务观测/兼容链路
- `recovery.graph.ts`：恢复链路

### `shared/`

放 flow 之间共用但又不适合放全局 `utils/` 的内容：

- 事件映射
- prompt 片段
- schema 片段
- constants

### `runtime/`

保留运行时上下文和 token stream 控制。

### `session/`

继续保留，负责会话生命周期、checkpoint、事件持久化。

## 5. 与当前代码的映射关系

当前文件可以这样迁移：

- `models/chat-model-factory.ts` -> `adapters/llm/chat-model-factory.ts`
- `models/llm-provider.ts` -> `adapters/llm/llm-provider.ts`
- `models/zhipu-provider.ts` -> `adapters/llm/zhipu-provider.ts`
- `agents/manager/manager-agent.ts` -> `flows/chat/nodes/manager-node.ts`
- `agents/nodes/research-agent.ts` -> `flows/chat/nodes/research-node.ts`
- `agents/nodes/executor-agent.ts` -> `flows/chat/nodes/executor-node.ts`
- `agents/nodes/reviewer-agent.ts` -> `flows/chat/nodes/reviewer-node.ts`
- `graph/workflow.ts` -> `graphs/chat.graph.ts`
- `graph/orchestrator.ts` -> `graphs/main.graph.ts` 或 `graphs/task.graph.ts`
- `session/session-coordinator.ts` 继续留在 `session/`
- `runtime/agent-runtime-context.ts` 继续留在 `runtime/`

## 6. 结论

最终建议不是把 `agent-core` 继续按“技术类型”平铺，而是：

1. 保持单包 `agent-core`
2. 借鉴参考项目，顶层改成 `adapters / flows / graphs / shared / utils / runtime / session`
3. 在 `flows/` 里承载真正的多 Agent 业务流程
4. 在 `graphs/` 里承载图入口
5. 在 `session/` 里承载会话恢复与事件持久化

这样比当前结构更适合后续继续做：

- 流式 token 返回
- 审批恢复
- 学习确认
- 多条 Agent flow 共存
