# templates 文档目录

状态：current
文档类型：index
适用范围：`docs/packages/templates/`
最后核对：2026-04-18

本目录用于沉淀 `packages/templates` 相关文档。

包边界：

- 职责：
  - 承载可被运行时和代码生成链路复用的模板定义
  - 作为模板资产层维护 manifest、metadata 与 registry
- 当前模板：
  - `src/starters/react-ts`
    - 前端页面生成基础模板
  - `src/scaffolds/package-lib`
    - 通用 `packages/*` 脚手架模板资产
  - `src/scaffolds/agent-basic`
    - 通用 `agents/*` 脚手架模板资产
- 约束：
  - 模板资产继续放 `packages/templates/src/*`
  - 当前模板资产仍以平铺目录为主，长期目标是按 `page-templates / scaffold-templates / starter-templates` 收敛
  - template registry 已先物理收敛到 `src/registries/*`
  - `@agent/templates` 根入口已直接导出 `src/registries/*` 的 canonical host；legacy 根文件 `src/template-registry.ts` 与 `src/scaffold-template-registry.ts` 已删除
  - `packages/templates` 的声明产物只允许输出到 `build/types/*`；`src/*.d.ts`、`src/*.d.ts.map` 一律视为误生成文件，不应提交
  - 根入口优先维护显式命名导出，不继续用整段 `export *` 把模板注册表与类型整包透传
  - 模板说明文档统一沉淀到 `docs/packages/templates/`
  - bundle 生成与写盘逻辑放在 `packages/tools/src/scaffold`

约定：

- `packages/templates` 的专项文档统一放在 `docs/packages/templates/`
- 新增模板结构、模板渲染规则或模板约束后，需同步更新本目录文档
- 如果当前只有索引文件，后续可在本目录继续补充专题文档

当前文档：

- [package-structure-guidelines.md](/docs/packages/templates/package-structure-guidelines.md)
- [template-registry-and-usage.md](/docs/packages/templates/template-registry-and-usage.md)
- [scaffold-generation.md](/docs/packages/tools/scaffold-generation.md)
