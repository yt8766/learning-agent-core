# shared 文档归档

状态：archive
文档类型：index
适用范围：`docs/archive/shared/`
最后核对：2026-04-18

本目录用于归档 `packages/shared` 退场过程中的历史文档与迁移台账。

`packages/shared` 已于 `2026-04-18` 从 workspace 删除；这里的内容默认只作为迁移背景与边界依据阅读，不再表示当前可写入的新宿主，也不再对应任何现役 workspace 包。

当前原则：

- 稳定公共 contract 默认收敛到 `@agent/core`
- compat / facade / 展示友好别名应落到真实宿主本地
- 不再恢复 `packages/shared`
- 不再新增 `@agent/shared`

本目录主文档：

- 当前目录索引就是主入口；需要历史背景时优先从这里跳转到具体台账

阅读顺序：

1. [shared-removal-completed.md](/docs/archive/shared/shared-removal-completed.md)
2. [core-compat-boundary.md](/docs/archive/shared/core-compat-boundary.md)
3. [shared-removal-feasibility.md](/docs/archive/shared/shared-removal-feasibility.md)

当前文档：

- [shared-removal-completed.md](/docs/archive/shared/shared-removal-completed.md)
- [core-compat-boundary.md](/docs/archive/shared/core-compat-boundary.md)
- [shared-removal-feasibility.md](/docs/archive/shared/shared-removal-feasibility.md)

约定：

- 新的共享包边界规则请改看 [docs/packages/core/README.md](/docs/packages/core/README.md) 与 [docs/conventions/package-architecture-guidelines.md](/docs/conventions/package-architecture-guidelines.md)
- 如果需要理解运行时、前后端或 agent 侧的当前真实宿主，请分别回到 `docs/packages/runtime/`、`docs/apps/backend/`、`docs/apps/frontend/`、`docs/agents/`
- 不要再把本目录内容当成当前实现落位指南
