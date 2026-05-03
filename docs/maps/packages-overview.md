# 共享包（packages）一览

状态：current
文档类型：reference
适用范围：`packages/*` 边界与依赖方向
最后核对：2026-05-04

`packages/` 下的 workspace 包提供跨应用复用的实现与 contract。应用层默认只通过 `@agent/*` 依赖共享能力，不穿透到其它包的 `src/` 物理路径。

优先阅读：

- [docs/packages 文档索引](/docs/packages/README.md)
- [docs/architecture/ARCHITECTURE.md](/docs/architecture/ARCHITECTURE.md) 中的包协作约束

单个包的专项说明以各 `docs/packages/<name>/` 目录为准。
