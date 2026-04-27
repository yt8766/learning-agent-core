# templates 包结构规范

状态：current
文档类型：convention
适用范围：`packages/templates`
最后核对：2026-04-18

本文档说明 `packages/templates` 如何从“平铺模板目录”继续收敛到“模板资产层”的稳定结构。

## 1. 目标定位

`packages/templates` 负责回答：

- 有哪些模板资产
- 它们属于哪种模板类型
- 它们的 manifest、registry、entry file 如何组织

它不负责 preview/write/execute 逻辑。

## 2. 推荐结构

```text
packages/templates/
├─ src/
│  ├─ contracts/
│  ├─ schemas/
│  ├─ registries/
│  ├─ starters/
│  ├─ scaffolds/
│  ├─ reports/
│  ├─ shared/
│  ├─ utils/
│  └─ index.ts
├─ test/
└─ package.json
```

各目录语义：

- `contracts/`
  - template manifest / registry contract
- `schemas/`
  - template manifest、slot、entry schema
- `registries/`
  - page/scaffold/report template registry
- `starters/`
  - 起步工程模板，例如 `react-ts`
- `scaffolds/`
  - 脚手架模板
- `reports/`
  - 报表与数据看板模板，例如 `single-report-table`、`bonus-center-data`
- `shared/`
  - 模板 manifest、共享 assets
- `utils/`
  - template id、命名辅助

## 3. 允许内容

- 模板资产
- 模板 manifest / metadata / registry
- 模板 schema
- entry file 约束

## 4. 禁止内容

- preview/write/execute 逻辑
- tool executor
- runtime orchestration
- graph / flow
- 与模板无关的业务 helper

## 5. 当前收敛策略

本轮已先收敛最稳定、最适合作为包级入口的 registry 能力：

- `src/registries/frontend-template-registry.ts`
- `src/registries/scaffold-template-registry.ts`

当前已落地：

- `src/starters/react-ts`
  - 已作为起步工程模板真实宿主
- `src/scaffolds/agent-basic`
  - 已作为 agent 脚手架模板真实宿主
- `src/scaffolds/package-lib`
  - 已作为 package 脚手架模板真实宿主
- `src/reports/single-report-table`
  - 已作为单报表页面模板真实宿主
- `src/reports/bonus-center-data`
  - 已作为报表与数据看板模板真实宿主
- `src/contracts/template-definitions.ts`
  - 已作为模板定义主宿主
- `src/types.ts`
  - 当前只保留 compat re-export 职责

后续建议优先按模板类型收敛：

1. 起步工程模板 -> `starters/`
2. 脚手架模板 -> `scaffolds/`
3. 报表与数据看板模板 -> `reports/`
4. 继续保持包根入口直接对 `src/registries/*` 的 canonical host 导出，不重新引入 legacy 根文件

模板内部自己的 `pages/`、`services/`、`types/` 可以保留在模板根下闭包维护。

补充：

- 对当前仓库来说，`page-templates/` 过于泛化，容易把模板资产分类拉回抽象层
- `reports/` 更贴合现有资产现实，也能明确与通用起步模板区分
- `src/types.ts` 这类根级聚合文件后续应优先收敛到 `contracts/` 或 `shared/`，不再作为新增资产的默认落点

## 6. 第一批执行清单

建议先移动资产目录，再收 registry：

第一批目标目录：

- `src/react-ts` -> `src/starters/react-ts`
- `src/scaffold/agent-basic` -> `src/scaffolds/agent-basic`
- `src/scaffold/package-lib` -> `src/scaffolds/package-lib`
- `src/single-report-table` -> `src/reports/single-report-table`
- `src/bonus-center-data` -> `src/reports/bonus-center-data`

第一批要整理的入口：

- `src/registries/frontend-template-registry.ts`
- `src/registries/scaffold-template-registry.ts`
- `src/contracts/template-definitions.ts`
- `src/types.ts`

第一批验证重点：

- `packages/templates/test/template-registry.test.ts`
- `packages/templates/test/scaffold-template-registry.test.ts`
- `packages/templates/test/root-exports.test.ts`

## 7. 继续阅读

- [templates 文档目录](/docs/packages/templates/README.md)
- [Template Registry And Usage](/docs/packages/templates/template-registry-and-usage.md)
- [scaffold-generation.md](/docs/packages/tools/scaffold-generation.md)
