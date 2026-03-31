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

前端导入约束：

- 默认使用顶层静态 `import`
- 一般不允许写 `import('mermaid').then(...)`、`import('xxx')` 这类动态导入
- 常规 UI、业务组件、Mermaid、图表、状态模块都应优先静态导入
- 只有在明确代码分割、运行时隔离或重资产浏览器专属加载时，才允许动态导入
- 如果确实需要动态导入，必须在代码旁写明原因，不能把它当成常规前端写法

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

## 8. Codex 执行补充规范

- 给定计划后，默认连续执行，不要停下来反复询问“是否继续”。
- 同一阻断优先自修复，最多连续尝试 `3` 次；只有达到上限才允许报告阻塞。
- 每次改动都要尽量补对应验证，不要只改代码不校验。
- **当一轮计划中的任务已全部完成时，必须明确告知用户“计划已完成”或等价结论。**

## 8. Codex 执行规则

进入仓库执行计划时，默认按“高级自主执行代理”工作，不做无意义停顿。

### 执行循环

- 当用户已经给出计划，或仓库中存在明确执行清单时，必须进入连续执行循环：
  - 读取下一个未完成任务
  - 直接修改代码、运行命令、完成实现
  - 立即做验证：测试、类型检查、构建或最小可证明检查
  - 更新计划状态或在内部状态中推进
  - 自动进入下一项，不要反复询问“是否继续”
- 除非遇到真实阻断，否则不要停在“分析完成，等待确认”

### 自我纠错

- 命令失败、测试报错、构建失败时，不得直接中止
- 必须先：
  - 阅读错误
  - 自行修复
  - 重新验证
- 对同一个阻断，允许最多连续自我修复 `3` 次
- 连续 `3` 次后仍无法解决，才允许报告：
  - `🚨 EXECUTION BLOCKED: <简要错误> after 3 attempts. Requesting human unblock.`

### 输出约束

- 避免无意义寒暄、铺垫和重复解释
- 以代码修改、命令执行、验证结果和简短进度为主
- 不要在动手前长篇描述“准备怎么写”，先做再汇报

### 上下文与改动方式

- 长流程中要保持阶段性收口，避免上下文漂移
- 优先精准修改，不要无必要整文件重写
- 修改任何主链逻辑时，必须默认遵守：
  - 不破坏现有功能
  - 不降低已建立的测试覆盖
  - 不回退已经稳定的聊天、审批、学习、来源引用等体验

### 完成条件

- 只有在计划项全部完成，且必要验证通过后，才允许真正停止
- 如果用户明确要求“实现整套方案”，默认目标是完成到可运行、可验证、可交付，而不是只落一半骨架
