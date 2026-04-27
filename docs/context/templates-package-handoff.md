# templates 包交接文档

状态：current
文档类型：guide
适用范围：`packages/templates`
最后核对：2026-04-19

## 包定位

`packages/templates` 负责 starter、scaffold、report/page 模板资产与 registry。

## 当前主要目录

- `src/starters/`
- `src/scaffolds/`
- `src/reports/`
- `src/registries/`
- `src/contracts/`

## 修改前先读

- [docs/packages/templates/README.md](/docs/packages/templates/README.md)
- [docs/packages/templates/package-structure-guidelines.md](/docs/packages/templates/package-structure-guidelines.md)
- [docs/packages/templates/template-registry-and-usage.md](/docs/packages/templates/template-registry-and-usage.md)

## 改动边界

- 这里是模板资产仓，不负责 preview/runtime/execute 逻辑。
- 模板 manifest、registry contract 与资产内容应尽量分层，不要把运行时判断硬编码在模板定义里。
- 如果模板开始承载确定性生成逻辑，应评估是否应下沉到 `report-kit` 或对应宿主。

## 验证

- `pnpm exec tsc -p packages/templates/tsconfig.json --noEmit`
- `pnpm --dir packages/templates test`
- `pnpm --dir packages/templates test:integration`

## 交接提醒

- 改模板时不仅要看类型，还要关注消费侧是否依赖某些默认字段、命名或结构。
