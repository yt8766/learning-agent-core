# 契约文档目录

状态：current
文档类型：index
适用范围：`docs/contracts/`
最后核对：2026-04-27

本目录用于沉淀 API、SSE、DTO、tool result 和跨端稳定 contract。跨模块调用时序、联调排障和端到端背景放在 [docs/integration](/docs/integration/README.md)。

当前文档：

- [api/README.md](/docs/contracts/api/README.md)

当前优先阅读：

- 工具执行、安全沙箱与自动审查 API 关系：[api/README.md#工具执行治理-api-关系](/docs/contracts/api/README.md#工具执行治理-api-关系)
- 前后端接口开发入口：[api/README.md#前后端开发入口](/docs/contracts/api/README.md#前后端开发入口)

约定：

- 新增或修改跨端协议时，先更新本目录下的接口文档，再实现前后端。
- 稳定 JSON / DTO / event / payload contract 应与 `packages/core` schema-first 定义保持一致。
