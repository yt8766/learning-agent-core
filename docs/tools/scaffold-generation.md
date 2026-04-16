# Scaffold Generation

状态：current
文档类型：reference
适用范围：`packages/tools/src/scaffold/*`、`packages/templates/src/scaffold/*`
最后核对：2026-04-16

## 1. 当前宿主

通用 `packages/*` / `agents/*` 脚手架能力不再使用独立的 `packages/scaffold-kit` 包。

当前固定分层为：

- `packages/templates/src/scaffold/*`
  - 只承载模板资产与模板 registry 元数据
- `packages/tools/src/scaffold/*`
  - 承载 scaffold 的 list / preview / inspect / write 实现
  - 通过 `@agent/tools` 根入口对外暴露稳定 API
- supervisor / runtime `/scaffold`
  - 只通过 tool registry 与 workflow preset 调用上层能力

## 2. 当前公开 API

统一从 `@agent/tools` 导入：

```ts
import {
  buildAgentScaffold,
  buildPackageScaffold,
  inspectScaffoldTarget,
  listScaffoldTemplates,
  writeScaffoldBundle
} from '@agent/tools';
```

默认能力边界：

- `listScaffoldTemplates()`
  - 返回 `package-lib` / `agent-basic` 等模板元数据
- `buildPackageScaffold()` / `buildAgentScaffold()`
  - 渲染模板占位符，生成只读 bundle
- `inspectScaffoldTarget()`
  - 统一做目标目录预检，返回冲突文件与安全写入判断
- `writeScaffoldBundle()`
  - 在通过上层审批与预检后写入目标目录

## 3. 约束

- `packages/templates` 不负责 bundle 渲染与写盘
- `packages/tools` 不回流模板资产实现，只消费模板 registry 与静态模板目录
- `/scaffold` 仍然要求显式命令触发，不做自由文本自动推断
- `write_scaffold` 仍然属于高风险写入工具，保持审批与 workspace path preflight

## 4. 验证

当前回归保护位于：

- `packages/tools/test/scaffold/scaffold-core.test.ts`
- `packages/tools/test/scaffold/scaffold-core.int-spec.ts`
- `packages/tools/test/scaffold/scaffold-executor.test.ts`
- `agents/coder/test/gongbu-code-ministry-scaffold.test.ts`
- `packages/templates/test/scaffold-template-registry.test.ts`
