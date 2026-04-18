# report-kit 包结构规范

状态：current
文档类型：convention
适用范围：`packages/report-kit`
最后核对：2026-04-18

本文档说明 `packages/report-kit` 如何作为“报表领域确定性生成引擎”维护当前目录结构，并继续向稳定边界收敛。

## 1. 目标定位

`packages/report-kit` 不负责 graph 编排，也不是工具平台层。

它负责的是 data-report 的确定性生成资产：

- blueprint
- scaffold
- assembly
- write pipeline

## 2. 推荐结构

```text
packages/report-kit/
├─ src/
│  ├─ contracts/
│  ├─ schemas/
│  ├─ blueprints/
│  ├─ scaffold/
│  ├─ assembly/
│  ├─ writers/
│  ├─ shared/
│  └─ index.ts
├─ test/
└─ package.json
```

各目录语义：

- `contracts/`
  - report blueprint / assembly / write contract
- `schemas/`
  - blueprint、scaffold、write-plan schema
- `blueprints/`
  - 蓝图资产与蓝图编译规则
- `scaffold/`
  - 脚手架构造与 inspect
- `assembly/`
  - page/route/component assembly
- `writers/`
  - file materialization、preview/write facade
- `shared/`
  - bundle file dedupe、模板映射、命名规则、领域共享 helper

## 3. 允许内容

- report blueprint
- scaffold
- assembly
- write / materialization
- sandpack post-process

## 4. 禁止内容

- graph
- agent orchestration
- tool registry
- sandbox executor
- backend service 内联编排
- 通用 prompt 主流程

## 5. 当前收敛策略

本轮已完成第一批物理收敛，以下目录已经是正式宿主：

- `src/blueprints/`
  - `data-report-blueprint.ts`
  - `data-report-blueprint-template.ts`
- `src/scaffold/`
  - `data-report-module-scaffold.ts`
  - `data-report-scaffold.ts`
- `src/assembly/`
  - `data-report-assembly.ts`
  - `data-report-routes.ts`
  - `data-report-ast-postprocess.ts`
- `src/writers/`
  - `data-report-write.ts`
- `src/contracts/`
  - `data-report-facade.ts`
- `src/shared/`
  - `data-report-bundle-files.ts`

补充：

- 包根 `src/index.ts` 当前通过 `src/contracts/data-report-facade.ts` 暴露稳定出口
- `assembly/` 与 `writers/` 共享的 bundle file 去重逻辑已下沉到 `shared/`，避免同一领域规则复制两份

后续源码收敛优先顺序：

1. 继续补 `schemas/`
2. 将剩余共享命名、模板映射与 helper 明确落到 `shared/`
3. 为 blueprint / assembly / write plan 补 schema-first contract
4. 继续保持包根入口直接对 canonical host 导出，不重新引入 legacy 根文件

## 6. 继续阅读

- [report-kit 文档目录](/docs/report-kit/README.md)
- [Data Report Pipeline](/docs/report-kit/data-report-pipeline.md)
- [Packages 分层与依赖约定](/docs/package-architecture-guidelines.md)
