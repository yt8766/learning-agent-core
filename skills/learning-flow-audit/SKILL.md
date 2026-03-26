---
name: learning_flow_audit
description: Use this skill to audit the learning loop, evidence provenance, candidate generation, and reuse behavior across learning-agent-core.
version: '1.0.0'
publisher: workspace
license: Proprietary
compatibility: Requires repository access and should be used when learning, evidence, or skill evolution flows are under review.
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

# Learning Flow Audit

本 skill 用于审计 LearningFlow 是否仍沿着“主动研究 -> 评估 -> 沉淀 -> 复用”的方向演进，而不是回退成静态候选展示。

## 何时使用

- 用户要求检查自主学习、自主技能、自主沉淀相关能力
- 修改涉及：
  - `packages/agent-core/src/flows/learning/*`
  - checkpoint learning 字段
  - Learning suggestions
  - Skill Lab
  - memory / rule / skill 候选或晋升逻辑

## 核心目标

检查系统是否仍满足：

1. 能主动研究
2. 能记录来源与可信度
3. 能生成 learning evaluation
4. 能沉淀 memory / rule / skill
5. 能在后续任务复用

## 仓库特定关注点

- `TaskRecord` / `ChatCheckpointRecord` 是否还带 learning 相关字段
- `agent-chat` 是否仍可展示 learning suggestions
- `agent-admin` 是否仍可治理 Learning Center / Skill Lab
- reusedSkills / externalSources / learningEvaluation 是否仍贯通

## 操作步骤

1. 检查相关 shared 类型
2. 检查 LearningFlow 与 session checkpoint
3. 检查 chat/admin 前端消费
4. 对照 `references/learning-checklist.md`
5. 输出：
   - 当前已具备能力
   - 缺口
   - 回归风险
   - 下一步优先建议

## 推荐联动文件

- [AGENTS.md](/Users/dev/Desktop/learning-agent-core/AGENTS.md)
- [架构总览](/Users/dev/Desktop/learning-agent-core/docs/ARCHITECTURE.md)
- [Checklist](./references/learning-checklist.md)
