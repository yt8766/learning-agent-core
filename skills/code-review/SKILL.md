---
name: code_review
description: Use this skill for repository code review, regression risk analysis, approval-flow impact checks, and release-safety review in learning-agent-core.
version: '1.0.0'
publisher: workspace
license: Proprietary
compatibility: Requires repository access. Use build or test tooling only when verification is needed.
metadata:
  author: learning-agent-core
  ministry: xingbu-review
allowed-tools:
  - read_local_file
  - list_directory
  - local-analysis
approval-policy: none
risk-level: low
---

# Code Review

本 skill 用于在本仓库里执行“资深工程师式”的代码审查。

## 何时使用

在这些场景下优先使用：

- 用户明确要求“review”
- 需要检查某次改动是否会引入回归、风险或隐藏 bug
- 需要对前端、后端、agent-core、shared 类型变更做系统化审查

## 审查目标

优先发现这些问题：

1. 行为回归
2. 状态流转错误
3. 异步时序 / 中断恢复问题
4. 类型与数据模型不一致
5. 权限、审批、风险控制缺口
6. 缺少必要测试或验证

## 仓库特定关注点

结合本仓库现状，review 时额外检查：

- `agent-chat` 是否把审批、Evidence、Learning、Think、ThoughtChain 从消息主链中移走
- `agent-admin` 是否退化成普通 dashboard，而不是六大中心控制台
- `packages/core` 与各宿主本地 compat/facade 类型层是否保持一致
- `packages/*` 构建是否仍遵守 `build/cjs`、`build/esm`、`build/types`
- `apps/*` 是否错误直连 `packages/*/src`
- 与 LearningFlow、MCP、审批流有关的改动是否破坏既有闭环

## 操作步骤

1. 先定位改动范围
   - 优先看目标文件、相关调用点、共享类型
2. 对照 `references/checklist.md`
   - 逐项检查高风险点
3. 如果涉及运行链路
   - 检查是否需要类型检查、build、测试验证
4. 输出 findings
   - 以 bug、风险、缺失验证为主
   - 总结放后面，findings 放前面

## 输出要求

- 先给 findings，再给简短总结
- findings 优先按严重程度排序
- 每个 finding 尽量包含：
  - 文件路径
  - 风险描述
  - 为什么会有问题
  - 是否建议补测试

## 推荐联动文件

- [AGENTS.md](/Users/dev/Desktop/learning-agent-core/AGENTS.md)
- [架构总览](/Users/dev/Desktop/learning-agent-core/docs/ARCHITECTURE.md)
- [Checklist](./references/checklist.md)
