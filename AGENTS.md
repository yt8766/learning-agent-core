# AGENTS.md

本文件面向进入仓库工作的代码代理（如 Codex）。

优先阅读：

- [README](/Users/dev/Desktop/learning-agent-core/README.md)
- [PROJECT_CONVENTIONS.md](/Users/dev/Desktop/learning-agent-core/PROJECT_CONVENTIONS.md)
- [架构总览](/Users/dev/Desktop/learning-agent-core/docs/ARCHITECTURE.md)
- [前后端对接文档](/Users/dev/Desktop/learning-agent-core/docs/frontend-backend-integration.md)

## 1. 产品定位

这是一个面向开发自治的多 Agent 系统，不是普通聊天应用。

- `apps/frontend/agent-chat`
  - 采用 **OpenClaw 模态**
  - 是前线作战面
  - 负责聊天、自动执行、审批、Think、ThoughtChain、Evidence、Learning suggestions、Skill reuse
- `apps/frontend/agent-admin`
  - 是后台指挥面
  - 负责 Runtime、Approvals、Learning、Skill Lab、Evidence、Connector & Policy 六大中心

不要把两个前端做成重复产品：

- `agent-chat` 负责执行与操作
- `agent-admin` 负责治理与运营

## 2. 当前架构方向

当前系统按“皇帝-首辅-六部”方向演进：

- Human / 用户：最高权限主体
- Supervisor / 首辅：负责任务规划、路由、汇总、审批挂起与恢复
- 六部治理语义：
  - 吏部：路由、预算、选模、能力编排
  - 户部：检索、研究、外部资料与知识上下文
  - 工部：代码实现与重构
  - 兵部：终端、浏览器、测试、发布
  - 刑部：审查、安全、合规
  - 礼部：协议、文档、交付整理

修改时优先朝这个方向收敛，不要退回单一聊天机器人思路。

## 3. 前端实现原则

### `agent-chat`

- 默认按 OpenClaw 风格工作区实现
- 主界面优先包含：
  - Chat thread
  - Approval cards
  - Think panel
  - ThoughtChain timeline
  - Source / Evidence cards
  - Learning suggestions
  - Skill reuse badges
- 关键操作都在聊天记录中完成：
  - Approve
  - Reject
  - Reject with feedback
  - Cancel
  - Recover

### `agent-admin`

按六大中心控制台实现：

- Runtime Center
- Approvals Center
- Learning Center
- Skill Lab
- Evidence Center
- Connector & Policy Center

## 4. Skills 目录规范

仓库里存在两种不同含义的“skill”，不要混用。

### 运行时技能

- 目录：`packages/skills`
- 作用：服务端运行时的技能注册、技能卡、技能领域模型

### 代理技能

- 目录：`skills/*`
- 作用：给 Codex / Claude Code 这类代码代理读取的仓库技能

推荐结构：

```text
skills/
├─ README.md
└─ <skill-name>/
   ├─ SKILL.md
   ├─ references/
   ├─ scripts/
   └─ assets/
```

约束：

- 每个代理技能目录必须有 `SKILL.md`
- 不要把代理技能写进 `packages/skills`
- 不要把运行时 skill card/registry 写进 `skills/`

## 5. 共享模型与执行策略

优先补齐和复用这些模型：

- `TaskRecord`
- `ChatCheckpointRecord`
- `SkillCard`
- `EvidenceRecord`
- `McpCapability`

默认执行策略：

- 主动学习采用：
  - **受控来源优先**
  - **高置信自动沉淀**
- 高风险动作必须进入审批门
- 所有长流程都要可：
  - cancel
  - recover
  - observe

## 6. 构建规则

- 应用层只通过 `@agent/*` 依赖共享包
- 不要从应用层直连 `packages/*/src`
- 共享包构建输出：
  - `build/cjs`
  - `build/esm`
  - `build/types`

如果改动涉及 `packages/*`，优先执行：

```bash
pnpm build:lib
pnpm --dir apps/backend/agent-server build
```

## 7. 最低检查

- shared：
  - `pnpm exec tsc -p packages/shared/tsconfig.json --noEmit`
- agent-core：
  - `pnpm exec tsc -p packages/agent-core/tsconfig.json --noEmit`
- backend：
  - `pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit`
- `agent-chat`：
  - `pnpm exec tsc -p apps/frontend/agent-chat/tsconfig.app.json --noEmit`
- `agent-admin`：
  - `pnpm exec tsc -p apps/frontend/agent-admin/tsconfig.app.json --noEmit`
