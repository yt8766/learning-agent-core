# skill-runtime 文档目录

状态：current
文档类型：index
适用范围：`docs/skill-runtime/`
最后核对：2026-04-20

本目录用于沉淀 `packages/skill-runtime` 相关文档。

这里描述的是运行时技能资产，不是仓库级 `skills/*` 代理技能文档。

包边界：

- 职责：
  - skill manifest schema
  - runtime skill registry
  - source sync
  - install receipt / integrity
  - trust / compatibility / availability 基础判断
- 允许：
  - registry
  - manifest loader
  - source catalog
  - installer / receipt
  - lifecycle policy
- 禁止：
  - `skills/*` 仓库代理技能说明
  - agent graph
  - tool executor 主流程
  - memory / search 主链编排
- 依赖方向：
  - 只依赖 `@agent/config`、`@agent/core` 和必要第三方库
  - 由 `@agent/runtime`、`apps/*` 或 admin/lab 相关能力消费
- 公开入口：
  - 根入口：`@agent/skill-runtime`
  - `src/contracts/skill-runtime-facade.ts` 当前作为包根稳定导出的 facade contract
  - 当前真实宿主：
    - `src/registry/skill-registry.ts`
    - `src/sources/agent-skill-loader.ts`
    - `src/catalog/skill-card-listing.ts`
    - `src/install/skill-auto-install.ts`
    - `src/install/skill-artifact-fetcher.ts`
    - `src/install/remote-skill-install-paths.ts`
  - `@agent/skill-runtime` 根入口当前先通过 `contracts/skill-runtime-facade.ts` 导出上述 canonical host；legacy 根文件 `src/skill-registry.ts` 与 `src/agent-skill-loader.ts` 已删除
  - backend 的 `runtime/domain/skills/runtime-skill-card-listing.ts` 与 `runtime/domain/skills/runtime-skill-auto-install.ts` 当前只保留 compat re-export

约定：

- `packages/skill-runtime` 的专项文档统一放在 `docs/skill-runtime/`
- 新增 skill source、manifest 字段、install 流程或 lifecycle policy 后，需同步更新本目录文档
- 不要再把运行时技能文档混写进 `docs/skills/*`

当前文档：

- [package-structure-guidelines.md](/docs/skill-runtime/package-structure-guidelines.md)
