# 系统运行闭环（当前态）

状态：current
文档类型：reference
适用范围：Runtime、Supervisor、审批与学习链路的鸟瞰
最后核对：2026-05-04

本页描述“从用户发起到执行与治理”的主路径在当前仓库中的落点，便于联调与排障。

权威说明优先阅读：

- [docs/architecture/ARCHITECTURE.md](/docs/architecture/ARCHITECTURE.md)
- [docs/integration/frontend-backend-integration.md](/docs/integration/frontend-backend-integration.md)
- [docs/packages/runtime](/docs/packages/runtime/README.md) 与 [docs/agents/supervisor](/docs/agents/supervisor/README.md)

涉及 LangGraph 中断与恢复时，遵守 runtime 文档中的 interrupt 约束。
