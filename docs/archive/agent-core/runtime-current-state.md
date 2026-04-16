# Runtime Current State

状态：history
文档类型：history
适用范围：`packages/agent-core`、`packages/runtime`、`agents/supervisor`
最后核对：2026-04-15

说明：这是 `packages/agent-core` 删除前后的迁移期快照，不代表当前实时实现结构。

## 1. 这篇文档说明什么

本文档描述 `agent-core` 当前已经收敛出来的运行时形态，重点回答“现在主链大致怎么分层、graph 和 flow 怎么配合、哪些边界不能再回退”。

## 2. 当前现实状态

- 仓库已经有六部 registry / route / checkpoint / workflow 语义
- 共享类型与部分接口仍保留旧 `manager / research / executor / reviewer` 兼容字段
- 新实现应优先继续朝“六部真实执行主体”收敛，而不是回退到单一聊天机器人模型

## 3. LangGraph 状态约束

在 `agent-core` 的 graph 实现里，需要明确区分：

- `zod`
  - 负责输出对象、协议字段、结构化结果的格式正确性
- `Annotation`
  - 负责 LangGraph state 字段如何存储和合并

简化理解：

- `zod = 数据格式层`
- `Annotation = 图状态层`

## 4. 当前目录收敛

当前推荐阅读需要区分“真实实现”与“兼容壳”：

- `graphs/`
  - `packages/agent-core/src/graphs`
    - 顶层 graph 入口：`chat / learning / recovery / main`
    - `main-route`、`subgraph-registry` 已迁到 `agents/supervisor/src/graphs`
  - graph 文件默认只保留状态定义与边编排
  - `main/` 只负责主编排图
  - `main/task/`：任务创建、上下文、运行态
  - `main/lifecycle/`：快照、审批、后台协作、学习协作
  - `main/background/`：background lease 与 learning jobs runtime
  - `main/knowledge/`：citation / freshness / diagnosis evidence
  - `main/orchestration/`：bridge、execution helper
  - `main/pipeline/`：plan / research / execute / review / interrupt
- `flows/`
  - `packages/agent-core/src/flows`
    - 继续承载 chat / approval / learning / ministries / data-report
    - `flows/supervisor` 已迁到 `agents/supervisor/src/flows/supervisor`
- `runtime/`
  - 真实实现已迁到 `packages/runtime/src/runtime`
- `session/`
  - 真实实现已迁到 `packages/runtime/src/session`
- `shared/`
  - 只保留跨模块 prompt / schema / contract
- `utils/`
  - 只保留纯工具，不承载主控制流
- `workflows/`
  - 真实实现已迁到 `agents/supervisor/src/workflows`

## 5. 收敛原则

- `graphs` 优先表达状态机与编排阶段，不承载通用工具
- graph 节点默认实现、handler fallback 与业务逻辑优先放入 `flows/*`
- `flows` 优先表达六部 / 首辅的执行语义
- `runtime` 与 `session` 的新实现只允许继续写入 `packages/runtime`
- `supervisor`、`workflow route`、`workflow preset`、`bootstrap registry` 的新实现只允许继续写入 `agents/supervisor`
- `src/index.ts` 只导出稳定公共入口，不继续暴露 `graphs/main/*` 内部碎片

## 6. 当前推荐分层

当前真实分层已调整为：

```text
packages/
├─ runtime/src/
│  ├─ runtime/
│  ├─ session/
│  └─ governance/
├─ adapters/src/
│  └─ llm/
├─ agents/supervisor/src/
│  ├─ bootstrap/
│  ├─ flows/
│  ├─ graphs/
│  └─ workflows/
└─ agent-core/src/
   ├─ graphs/
   ├─ flows/
   ├─ shared/
   ├─ utils/
   └─ types/
```

约束：

- `packages/runtime` 负责 runtime / session / governance 的真实实现
- `agents/supervisor` 负责 bootstrap、main-route、workflow preset / route、supervisor flow 的真实实现
- `packages/agent-core/src/graphs`、`src/flows` 继续承载尚未迁移完的 graph / flow，并对已迁移模块保留兼容导出
- `shared/` 放跨流程复用的事件映射、schema、prompt 与工具
- `utils/` 放纯函数型通用工具，不承载 service 和运行时状态
- `agent-core/src/workflows` 当前只允许兼容 re-export，不再继续堆主实现

## 7. 当前迁移约束

- 如果改动涉及 `runtime / session / governance`，优先修改 `packages/runtime/src/*`
- 如果改动涉及 `supervisor / workflow route / workflow preset / bootstrap registry / subgraph registry / main-route`，优先修改 `agents/supervisor/src/*`
- 只有在兼容性需要时，才在 `packages/agent-core/src/*` 对应旧路径补 re-export
- `packages/agent-core/src` 新增主实现前，必须先确认对应能力是否已经有新包归属，避免回迁

## 8. 继续阅读

- [agent-core 文档目录](/Users/dev/Desktop/learning-agent-core/docs/archive/agent-core/README.md)
- [架构总览](/Users/dev/Desktop/learning-agent-core/docs/ARCHITECTURE.md)
- [LangGraph 应用结构规范](/Users/dev/Desktop/learning-agent-core/docs/langgraph-app-structure-guidelines.md)
