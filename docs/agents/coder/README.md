# coder 文档目录

状态：current
文档类型：index
适用范围：`agents/coder`
最后核对：2026-04-18

本目录用于沉淀 `agents/coder` 的专项文档。

当前文档：

- [package-structure-guidelines.md](/docs/agents/coder/package-structure-guidelines.md)

当前职责：

- coder agent 公开入口
- `ExecutorAgent`
- `GongbuCodeMinistry`、`BingbuOpsMinistry`
- 执行 prompt、执行 schema、只读/审批/工具选择执行链
- 根入口导出的 agent、ministry、prompt、schema 已有专门 root export 测试锁定

优先阅读：

1. [package-structure-guidelines.md](/docs/agents/coder/package-structure-guidelines.md)
2. [LangGraph 应用结构规范](/docs/conventions/langgraph-app-structure-guidelines.md)
