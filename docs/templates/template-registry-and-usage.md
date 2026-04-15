# Template Registry And Usage

状态：current
适用范围：`packages/templates`
最后核对：2026-04-14

## 1. 这篇文档说明什么

本文档说明 `packages/templates` 当前有哪些模板资产，以及它们在生成链路中的用途。

## 2. 当前模板目录

`packages/templates/src` 当前主要包含：

- `src/react-ts`
  - 前端页面生成基础模板
- `src/single-report-table`
  - 单报表表格类模板
- `src/bonus-center-data`
  - 数据大盘 / 业务报表示例模板

## 3. 模板使用边界

`packages/templates` 负责：

- 模板资产
- 模板目录组织
- 模板元数据 / registry 承载位

不负责：

- 运行时调度逻辑
- 工具执行逻辑
- agent flow 编排

## 4. 当前约束

- 模板源码继续放在 `packages/templates/src/*`
- 模板说明与使用约定统一放在 `docs/templates/`
- 新增模板时，优先补清：
  - 适用场景
  - 入口文件
  - 是否参与代码生成或报表生成
- `src/bonus-center-data` 这类业务报表模板如果已经由外层模块卡片提供标题，内部图表卡片不要再重复渲染 `common.base.chart` 一类的通用小标题，避免出现双标题

## 5. 继续阅读

- [templates 文档目录](/Users/dev/Desktop/learning-agent-core/docs/templates/README.md)
- [模板示例](/Users/dev/Desktop/learning-agent-core/docs/project-template-guidelines.md)
