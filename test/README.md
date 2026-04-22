# test/

Workspace-level test host for the `learning-agent-core` monorepo.

设计文档：[docs/evals/workspace-test-host-design.md](/docs/evals/workspace-test-host-design.md)

## 职责

本目录是仓库级（workspace-level）测试宿主，只承载两类内容：

| 目录           | 职责                                     |
| -------------- | ---------------------------------------- |
| `integration/` | 跨包、跨宿主、跨链路的 integration 测试  |
| `smoke/`       | 仓库级最小可运行闭环（workspace smoke）  |
| `shared/`      | 仅限测试的共享 fixture、builder、matcher |

## 命名约定

- integration 测试文件：`*.int-spec.ts`
- smoke 测试文件：`*.smoke.ts`
- acceptance 测试文件（待引入）：`*.acc-spec.ts`

## 禁止事项

- ❌ 不放纯单包单函数 unit 测试 → 放到 `packages/*/test`
- ❌ 不放纯 schema parse 回归 → 放到宿主内 `test/`
- ❌ 不放仅验证单一宿主的 integration → 放到该宿主 `test/`
- ❌ 不复制生产逻辑到 shared/helpers → helpers 只做测试装配
- ❌ 不依赖高脆弱外部服务，必须依赖时加显式 skip/guard

## 与宿主内 `test/` 的区别

```
packages/*/test     宿主内 unit / spec / integration
agents/*/test       宿主内 unit / spec / integration
apps/*/test         应用内 unit / integration
test/integration    仓库级跨包跨宿主 integration  ← 本目录
test/smoke          仓库级最小可运行闭环           ← 本目录
```
