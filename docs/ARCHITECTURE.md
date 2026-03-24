# 架构总览

本文件描述当前仓库面向代码代理和开发者的长期架构方向。它不是逐文件 API 文档，而是帮助在实现细节变化时仍保持同一条演进主线。

## 1. 产品分工

仓库当前有两个前端应用，它们职责不同，不能做成重复产品。

### `agent-chat`

- 采用 **OpenClaw 模态**
- 是前线作战面
- 面向最终使用者与日常操作者
- 聊天只是入口，不是唯一主体

长期应保持这些一等能力：

- Chat thread
- Approval cards
- Think panel
- ThoughtChain timeline
- Source / Evidence cards
- Learning suggestions
- Skill reuse badges

关键操作都在消息流中完成：

- Approve
- Reject
- Reject with feedback
- Cancel
- Recover

### `agent-admin`

- 是后台指挥面
- 面向管理员、平台运营者、团队负责人
- 不是普通 dashboard，而是自治系统控制台

长期信息架构固定为六大中心：

- Runtime Center
- Approvals Center
- Learning Center
- Skill Lab
- Evidence Center
- Connector & Policy Center

## 2. 核心架构方向

当前系统按“皇帝-首辅-六部”方向演进。

### 顶层角色

- Human / 用户：最高权限主体
- Supervisor / 首辅：负责任务规划、路由、汇总、审批挂起与恢复

### 六部治理语义

- 吏部：路由、预算、选模、能力编排
- 户部：检索、研究、外部资料与知识上下文
- 工部：代码实现与重构
- 兵部：终端、浏览器、测试、发布
- 刑部：审查、安全、合规
- 礼部：协议、文档、交付整理

### 当前现实状态

- 仓库已经有六部 registry / route / checkpoint 语义
- 仍在从旧 `manager/research/executor/reviewer` 路径过渡到正式六部执行主体
- 新实现应优先继续朝“六部真实执行主体”收敛，而不是回退到单一聊天机器人模型

## 3. 运行闭环

当前和后续都应优先维持这个闭环：

1. 接收任务
2. 规划与路由
3. 检索与补充上下文
4. 执行
5. 审查
6. 审批或恢复
7. 汇总答复
8. 学习沉淀
9. 后续复用

对于高风险动作，流程必须经过审批门，不能默认跳过。

## 4. 学习系统方向

项目主线是开发自治，不是普通聊天问答。

学习系统默认策略：

- **受控来源优先**
- **高置信自动沉淀**

学习闭环目标：

1. 户部主动研究
2. 记录来源和可信度
3. 任务中引用历史经验
4. 任务后评估是否值得沉淀
5. 沉淀为 memory / rule / skill
6. 后续任务优先复用

### 当前阶段

当前仓库已经有：

- `LearningFlow`
- memory / rule / skill 候选
- Learning suggestions
- reused skill / evidence / checkpoint 语义

但还没有完全进入“主动研究 -> 评估 -> 沉淀 -> 复用”的成熟闭环，所以相关改动应继续补强这一点。

## 5. Think / ThoughtChain / Evidence

这三者是 `agent-chat` 的核心能力，不是装饰层。

- `Think`
  - 表达当前谁在思考、为什么这样做、下一步是什么
- `ThoughtChain`
  - 表达已走过哪些节点、各节点的角色化解释、当前停在什么地方
- `Evidence`
  - 表达本轮引用了哪些外部来源或系统证据，它们是否可信

这些信息应当始终可见或可展开查看，不能被迁移到只有后台才能看到的隐藏区域。

## 6. 审批与中断

高风险动作必须经过 HITL。

支持的决策语义：

- Approve
- Reject
- Reject with feedback

支持的运行语义：

- cancel
- recover
- observe

审批和恢复是 `agent-chat` 的主链能力，应优先以内联消息卡形式完成，而不是只依赖右侧工作台或后台页面。

## 7. MCP 与工具层

当前 MCP 仍有 skeleton / local-adapter 过渡实现。

长期方向：

- 真实 MCP transport 成为主路径
- 不再继续扩展本地硬编码工具分叉
- capability 必须带完整治理信息：
  - schema
  - risk metadata
  - approval metadata
  - trust metadata
  - health metadata

在 `agent-admin` 中，connector / capability / policy 是一等治理对象，而不是调试信息。

## 8. 共享领域模型

前后端必须共享同一套领域模型，不要各自发明平行字段。

当前优先维护这些对象：

### `TaskRecord`

- `budgetState`
- `queueState`
- `retryPolicy`
- `evidenceRefs`
- `externalSources`
- `reusedMemories`
- `reusedRules`
- `reusedSkills`
- `learningEvaluation`

### `ChatCheckpointRecord`

- `externalSources`
- `learningEvaluation`
- `budgetState`
- `reusedSkills`

### `SkillCard`

- `version`
- `successRate`
- `promotionState`
- `sourceRuns`

### `EvidenceRecord`

- `sourceUrl`
- `sourceType`
- `trustClass`
- `summary`
- `linkedRunId`

### `McpCapability`

- `transport`
- `trustClass`
- `approvalPolicy`
- `healthState`

## 9. 工程与构建约束

### 包依赖规则

- 应用层只通过 `@agent/*` 依赖共享包
- 不要从应用层直连 `packages/*/src`

### 构建规则

- 应用输出进入 `dist/`
- 共享包输出进入：
  - `build/cjs`
  - `build/esm`
  - `build/types`

### 当前已知坑

- `packages/*/src` 可能混入历史 `.js/.d.ts/.map`
- `tsup` 入口应只打 `.ts` 运行时源码
- `build:lib` 必须串行执行，避免只生成 `build/types`

如果改动涉及 `packages/*`，在验证应用前优先执行：

```bash
pnpm build:lib
```

再执行需要的应用构建或类型检查。

## 10. Skills 目录分层

为了兼容 Codex、Claude Code 一类代理工作流，仓库需要明确区分两类 skill。

### A. 运行时 skill

- 目录：`packages/skills`
- 用途：运行时 skill registry、skill card、实验区/稳定区领域模型
- 被后端、shared、admin 消费

### B. 仓库级代理 skill

- 目录：`skills/*`
- 用途：给代码代理看的工作流规范、脚本和参考资料
- 采用 `Claude Code / Codex` 常见结构

推荐目录：

```text
skills/
├─ README.md
├─ <skill-name>/
│  ├─ SKILL.md
│  ├─ references/
│  ├─ scripts/
│  └─ assets/
```

规则：

- `SKILL.md` 是每个代理 skill 的入口
- `references/` 放规范、样例、领域知识
- `scripts/` 放可执行脚本
- `assets/` 放模板或静态资源
- 仓库级代理 skill 不应与运行时 `packages/skills` 混合
- 新增代理工作流时，优先考虑放进 `skills/`，而不是塞进随机文档目录

## 11. 优先级

没有更具体用户要求时，默认按这条优先级推进：

1. 强化 `agent-chat` 的 OpenClaw 工作区体验
2. 强化 `agent-admin` 六大中心控制台
3. 把六部从治理语义升级成真实执行主体
4. 把 LearningFlow 升级成主动学习闭环
5. 把 MCP 从 skeleton 升级成真实 transport 主路径

不优先做：

- 单纯视觉模仿
- 与开发自治主线无关的平台广度
- 让 `agent-chat` 与 `agent-admin` 职责重叠

## 12. 建议阅读顺序

如果你是进入本仓库工作的代码代理，建议按这个顺序阅读：

1. [AGENTS.md](/Users/dev/Desktop/learning-agent-core/AGENTS.md)
2. [README.md](/Users/dev/Desktop/learning-agent-core/README.md)
3. [前后端对接文档](/Users/dev/Desktop/learning-agent-core/docs/frontend-backend-integration.md)
4. [后端规范](/Users/dev/Desktop/learning-agent-core/docs/backend-conventions.md)
5. [前端规范](/Users/dev/Desktop/learning-agent-core/docs/frontend-conventions.md)
