# core 文档目录

状态：current
适用范围：`docs/core/`
最后核对：2026-04-15

本目录用于沉淀 `packages/core` 相关文档。

`packages/core` 在本仓库里不是业务实现层，也不是 graph/runtime 编排层，而是稳定 contract facade。它优先回答的是“跨包怎么对齐边界”，不是“业务怎么跑起来”。

包边界：

- 职责：
  - 稳定共享数据模型的公共出口
  - Zod schema 驱动的结构约束
  - 跨包能力接口与 pipeline contract
  - 通用错误模型与兼容字段语义
- 允许：
  - DTO、Record、Enum、Schema、由 Schema 推导的 Type
  - 对外稳定的 interface、adapter contract、facade contract
  - pipeline stage、interrupt/recover payload、结构化事件 contract
  - 错误码、错误分类、重试/审批语义的结构定义
- 禁止：
  - 业务实现
  - 外部 SDK 接入
  - graph、flow、service、repository 执行逻辑
  - 调用方私有状态与包内内部目录约定
- 依赖方向：
  - 应尽量保持轻量，默认只承载稳定 contract
  - 其他包可依赖 `@agent/core` 获取公共边界
  - `@agent/core` 不应回填业务编排或基础设施实现

当前现实：

- `packages/core` 目前仍是迁移期 facade，源码只做 `shared` 的 re-export
- 这不改变它的目标职责：后续稳定公共 contract 仍应按 `core` 边界思考，而不是继续把 `core` 当“任何共用代码都能放”的杂物层

建议优先阅读：

1. [core contract 规范](/Users/dev/Desktop/learning-agent-core/docs/core/core-contract-guidelines.md)
2. [Packages 分层与依赖约定](/Users/dev/Desktop/learning-agent-core/docs/package-architecture-guidelines.md)
3. [Packages 目录说明](/Users/dev/Desktop/learning-agent-core/docs/packages-overview.md)
