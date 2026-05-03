# 仓库目录鸟瞰

状态：current
文档类型：reference
适用范围：`docs/maps/`、新成员上手
最后核对：2026-05-04

本页给出 monorepo 顶层目录的默认知情范围，避免在错误层级改代码。

- `apps/`：可部署应用（前端、后端入口、gateway 等）
- `packages/`：可复用的共享库（runtime、core contract、adapters 等）
- `agents/`：领域 Agent 包与 graph/flow 宿主
- `docs/`：规范、架构、契约与集成说明

权威结构与演进方向以 [docs/architecture/ARCHITECTURE.md](/docs/architecture/ARCHITECTURE.md) 为准。
