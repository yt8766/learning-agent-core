# supervisor 文档目录

状态：current
文档类型：index
适用范围：`agents/supervisor`
最后核对：2026-04-18

本目录用于沉淀 `agents/supervisor` 的专项文档。

当前文档：

- [package-structure-guidelines.md](/docs/agents/supervisor/package-structure-guidelines.md)

当前职责：

- supervisor 主控公开入口
- workflow preset / workflow route / specialist routing
- bootstrap skill 列表与 subgraph descriptor
- supervisor planning / dispatch / delivery 相关 flow
- `LibuRouterMinistry`、`HubuSearchMinistry`、`LibuDocsMinistry` 的真实宿主
- 根入口导出的 bootstrap registry、workflow route/preset 与 main-route graph 已有专门 root export 测试锁定

优先阅读：

1. [package-structure-guidelines.md](/docs/agents/supervisor/package-structure-guidelines.md)
2. [架构总览](/docs/ARCHITECTURE.md)
3. [LangGraph 应用结构规范](/docs/langgraph-app-structure-guidelines.md)
