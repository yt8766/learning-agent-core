---
name: release_check
description: Use this skill for pre-release checks, build verification, approval-sensitive release readiness review, and publish-risk analysis in learning-agent-core.
version: '1.0.0'
publisher: workspace
license: Proprietary
compatibility: Requires repository and CI context. Release or write actions still follow runtime approval policy.
metadata:
  author: learning-agent-core
  ministry: bingbu-ops
triggers:
  - release
  - pre-release
recommended-ministries:
  - bingbu-ops
  - xingbu-review
recommended-specialists:
  - technical-architecture
allowed-tools:
  - read_local_file
  - list_directory
  - run_terminal
execution-hints:
  - Verify build and typecheck before any publish-sensitive step.
  - Prefer runtime-governance approval if a command stalls or requires interaction.
compression-hints:
  - Replace long CI logs with artifact summaries before passing to review and learning.
approval-policy: high-risk-only
risk-level: medium
---

# Release Check

本 skill 用于在本仓库里执行发布前检查，确保构建、类型、关键链路和高风险变更状态可被确认。

## 何时使用

在这些场景下优先使用：

- 用户要求发布前检查
- 准备合并到主分支
- 修改涉及 `packages/*`、`agent-core`、后端接口或双前端主流程
- 修改涉及审批、Learning、MCP、运行时 checkpoint

## 核心目标

1. 确认共享包产物可用
2. 确认后端和前端可构建
3. 确认关键运行链路没有明显回归
4. 确认高风险动作、审批、恢复语义没有破坏

## 仓库特定检查点

- 如果改动涉及 `packages/*`，优先执行 `pnpm build:lib`
- `agent-chat` 不能退回纯聊天页
- `agent-admin` 不能退回普通 dashboard
- `@agent/*` 包解析必须指向 `build/*`，不能直连 `packages/*/src`
- `build:lib` 必须是串行执行
- 如果改动影响审批、学习、Evidence，必须检查共享类型和消费端是否同步

## 操作步骤

1. 识别改动范围
2. 对照 `references/release-checklist.md`
3. 执行最小必要验证
4. 输出：
   - 已验证项
   - 未验证项
   - 风险结论
   - 是否建议继续发布

## 推荐联动文件

- [AGENTS.md](/Users/dev/Desktop/learning-agent-core/AGENTS.md)
- [架构总览](/Users/dev/Desktop/learning-agent-core/docs/ARCHITECTURE.md)
- [Checklist](./references/release-checklist.md)
