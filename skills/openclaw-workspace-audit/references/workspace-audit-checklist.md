# OpenClaw Workspace Audit Checklist

## `agent-chat`

- 是否仍以工作区方式组织，而不是单一对话页
- Chat thread 是否仍是主链
- Approval cards 是否在消息中可操作
- Think 是否可见
- ThoughtChain 是否可见
- Evidence / Source 是否可见
- Learning suggestions 是否可见
- Skill reuse 是否可见
- 工作台是否允许收起，但不是彻底隐藏

## `agent-admin`

- 是否存在固定平台导航
- 是否围绕这六个中心组织：
  - Runtime
  - Approvals
  - Learning
  - Skill Lab
  - Evidence
  - Connector & Policy
- 是否支持 drill-down，而不是只有静态卡片

## 偏差判定

只要出现以下任一情况，就应视为偏离目标：

- `agent-chat` 退回纯聊天产品
- 审批不再在消息主链中完成
- Think / ThoughtChain / Evidence 被藏到不可见区域
- `agent-admin` 退回普通 dashboard
