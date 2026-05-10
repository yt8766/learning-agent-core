# SDK 文档目录

状态：current
文档类型：index
适用范围：`docs/sdk/`
最后核对：2026-05-08

本目录用于沉淀可被外部或跨宿主消费的 SDK 使用文档。这里记录的是 SDK 使用方式、公共入口、装配边界和浏览器 / Node 侧接入约束；具体包内部职责仍归档在 `docs/packages/<pkg>/`。

当前文档：

- [Knowledge SDK 接入指南](/docs/sdk/knowledge.md)

放置规则：

- SDK 使用文档、接入手册、公共入口说明优先放在本目录。
- 包内部架构、源码边界、迁移状态仍放在对应 `docs/packages/<pkg>/`。
- API / SSE / DTO 契约继续放在 `docs/contracts/`，不要和 SDK 使用手册混写。
