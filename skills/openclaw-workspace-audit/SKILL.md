---
name: openclaw_workspace_audit
description: Use this skill to audit whether agent-chat and agent-admin still match the OpenClaw-style workspace and governance-console product direction.
version: '1.0.0'
publisher: workspace
license: Proprietary
compatibility: Requires repository access and is best used when chat workspace, admin console, evidence, or approval UX changed.
metadata:
  author: learning-agent-core
  ministry: libu-docs
allowed-tools:
  - read_local_file
  - list_directory
  - local-analysis
approval-policy: none
risk-level: low
---

# OpenClaw Workspace Audit

本 skill 用于审计 `agent-chat` 和 `agent-admin` 是否仍符合当前仓库约定的 OpenClaw 产品方向。

## 何时使用

- 用户要求检查产品形态是否跑偏
- `agent-chat` 或 `agent-admin` 做了较大 UI / IA 改动
- 需要确认页面是否还符合仓库规范

## 核心目标

### `agent-chat`

- 仍然是 OpenClaw 风格工作区，而不是普通聊天页
- 审批、Evidence、Learning、Think、ThoughtChain 仍是一等能力
- 聊天只是入口，不是唯一主体

### `agent-admin`

- 仍然是平台控制台，而不是 dashboard 拼装页
- 六大中心信息架构没有跑偏

## 操作步骤

1. 阅读 `AGENTS.md` 和 `docs/ARCHITECTURE.md`
2. 检查 `agent-chat` 主页面结构
3. 检查 `agent-admin` 导航与页面结构
4. 对照 `references/workspace-audit-checklist.md`
5. 输出偏差项和修正建议

## 推荐联动文件

- [AGENTS.md](/Users/dev/Desktop/learning-agent-core/AGENTS.md)
- [架构总览](/Users/dev/Desktop/learning-agent-core/docs/ARCHITECTURE.md)
- [Checklist](./references/workspace-audit-checklist.md)
