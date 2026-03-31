# AI 开发自治多 Agent 系统

这是一个基于 `NestJS + TypeScript + LangGraph + LangChain` 的多 Agent monorepo，面向“开发自治”场景，而不是普通聊天应用。当前系统按“Human / Supervisor / 六部”方向演进，用于承载：

- Supervisor / Ministry 协同执行
- 工具调用与审批
- Think / ThoughtChain / Evidence 主链路呈现
- 记忆、规则、技能学习闭环
- Runtime、Approvals、Learning、Skill Lab、Evidence、Connector & Policy 治理台

## 目录说明

- `apps/backend/agent-server`：后端主服务，提供 `/api` 接口
- `apps/worker`：异步执行、恢复与学习任务 worker
- `apps/frontend/agent-chat`：OpenClaw 风格前线作战面，负责执行与操作
- `apps/frontend/agent-admin`：六大中心后台指挥面，负责治理与运营
- `skills/*`：仓库级代理技能目录，给 Codex / Claude Code 这类代码代理读取
- `packages/agent-core`：Agent 运行时核心，内部优先按 `adapters / flows / governance / graphs / runtime / session / shared / workflows / types` 分层
- `packages/shared`：共享 DTO、领域类型、事件模型
- `packages/config`：运行时配置与路径解析
- `packages/memory`：memory、rules、runtime state 本地存储
- `packages/tools`：工具注册、审批规则、执行器
- `packages/skills`：运行时技能注册与技能卡领域包
- `packages/evals`：评估与复盘
- `data/*`：仓库根级本地运行数据（与 `apps/`、`packages/` 同级）
- `docs/*`：项目规范与模板文档

## LangGraph 应用结构

当前项目采用“Graph 入口清晰、共享能力集中、测试目录与源码分离”的结构规范：

- 结构规范文档：[`docs/langgraph-app-structure.md`](./docs/langgraph-app-structure.md)
- 主图与子图入口优先放在 `packages/agent-core/src/graphs`
- app 层只通过 `@agent/*` 依赖 graph/runtime facade，不在应用层重新拼 graph
- 从现在起，每个项目统一使用与 `src/` 同级的 `test/` 目录承载测试
- 根级 `vitest` 现在只发现 `test/` 目录中的测试

## Runtime Profiles

当前运行时支持 4 个 profile，用于区分平台、公司、个人和 CLI 的默认策略：

- `platform`
  - 平台宿主默认 profile
  - 默认 `balanced approval + controlled-first source policy`
- `company`
  - 公司 Agent 默认 profile
  - 默认 `strict approval + internal-only source policy`
- `personal`
  - 个人 Agent 默认 profile
  - 默认 `auto approval + open-web-allowed source policy`
- `cli`
  - 命令行/REPL 默认 profile
  - 默认 `balanced approval + controlled-first source policy`

这些 profile 不只影响数据目录，还会影响：

- budget policy
- source policy
- skill source preset
- connector preset
- worker routing / company specialist selection

## Context Strategy

当前运行时已引入基础 `ContextStrategy`，用于统一长对话和跨轮任务的上下文切片策略。

- 会话压缩摘要
- 最近若干轮原始消息
- top-K 历史 evidence
- top-K reused memory / rule / skill
- 上一轮 learning 评估摘要

这层策略先以本地启发式实现为主，后续再接入向量检索与语义缓存。

## Skills / Deep Agents 规范

仓库级代理 skill 现在默认按 `SKILL.md + frontmatter` 规范组织，并由本地后端 loader 直接解析：

- `skills/*/SKILL.md`
  - 顶部必须带 frontmatter
  - 最少声明 `name`、`description`
  - 推荐声明 `version`、`publisher`、`license`、`compatibility`、`metadata`、`allowed-tools`
- 本地能力不足检测会直接读取这些 skill 文档，形成：
  - local skill suggestions
  - 本地安全评估
  - 低风险自动安装判定
  - 安装后治理建议

当前检索层约定继续收敛到统一抽象：

- `MemorySearchService`
  - 面向 runtime / session / ministries 提供统一 memory/rule 检索入口
  - 同时参与 task 创建阶段的 `reusedMemories / reusedRules` 复用判定
  - 也会在 learning 评分前做 reuse enrichment
- `LocalSkillSearch`
  - 当前后端先提供本地版 skill 搜索候选
  - 基于 `SkillRegistry + 本地 manifests + profile/source policy`
  - 先服务于 capability gap 分析与 admin/task 视图，不依赖远程 marketplace
- `VectorIndexRepository`
  - 作为后续向量库接入点
  - 当前默认先接本地 `LocalVectorIndexRepository`
  - 通过 token overlap 做轻量排序，再为后续向量库留出替换位

本地 skill 安装前的安全评估当前已经结构化，至少会产出：

- `verdict`
- `trustScore`
- `maxRiskLevel`
- `riskyTools`
- `missingDeclarations`

并同时考虑：

- source trust class
- 当前 runtime profile 是否允许该来源
- `allowed-tools`
- `requiredConnectors`
- `license`
- `compatibility`

## Budget Guard 与 Semantic Cache

当前 runtime 已补上两条默认约束，用于支撑后续的成本治理和上下文优化：

- `BudgetGuard`
  - 每个任务都带 `costBudgetUsd`
  - 会持续累计 `costConsumedUsd / costConsumedCny`
  - 超预算后优先切到 `fallbackModelId`
- `Semantic Cache`
  - 当前先做精确 prompt 指纹缓存
  - 命中后直接复用文本结果
  - 默认缓存文件落在仓库根级 `data/runtime/semantic-cache.json`

约束：

- 预算状态优先写入 `TaskRecord.budgetState`
- 精确 prompt 缓存只作为第一层，不替代后续向量语义缓存
- 运行时入口应复用统一的 `BudgetPolicy` 和 `semanticCacheFilePath`，不要各自发明路径和字段

## 开发入口

- 后端开发：`pnpm --dir apps/backend/agent-server start:dev`
- 后端生产：`pnpm --dir apps/backend/agent-server start:prod`
- 聊天前端：`pnpm --dir apps/frontend/agent-chat dev`（默认 `127.0.0.1:5173`）
- 管理前端：`pnpm --dir apps/frontend/agent-admin dev`（默认 `127.0.0.1:5174`）
- 库构建：`pnpm build:lib`
- 单元测试：`pnpm test`
- 原子层测试：`pnpm test:unit`
- 协同层测试：`pnpm test:integration`
- 覆盖率测试：`pnpm test:coverage`
- 测试监听：`pnpm test:watch`
- Prompt 回归：`pnpm eval:prompts`
- Prompt 结果查看：`pnpm eval:prompts:view`

## Prompt 回归

仓库当前提供一套最小 `promptfoo` 回归入口，用于比较户部、刑部、礼部关键 prompt 的版本差异：

- 配置文件：[`packages/evals/promptfoo/ministry-prompts.promptfooconfig.yaml`](./packages/evals/promptfoo/ministry-prompts.promptfooconfig.yaml)
- 使用说明：[`packages/evals/promptfoo/README.md`](./packages/evals/promptfoo/README.md)

默认命令：

- `pnpm eval:prompts`
- `pnpm eval:prompts:view`

说明：

- 这套回归默认是“小样本、关键链路、可比较版本”的最小集合
- 运行前需要本地可用的 `promptfoo` 命令和对应模型 API Key
- 当前核心阻塞套件：`supervisor-plan`、`specialist-finding`、`hubu-research`、`xingbu-review`、`libu-delivery`
- 核心套件成功率要求 `> 90%`，低于门槛会阻塞对应 CI 任务

覆盖率说明：

- `pnpm test:coverage` 已提供模块级 `>= 85%` 门槛校验
- 当前仓库覆盖率基线仍低于该目标，因此该命令目前用于显式质量检查与补测推进，不作为默认测试步骤替代 `pnpm test`

## 磁盘清理约束

如果本地磁盘空间不足，默认只清理仓库内可重建内容：

- 构建产物
- 临时缓存
- 日志
- 测试生成文件

不要为了释放空间删除用户浏览器登录态或 profile 数据。特别是禁止触碰：

- `~/Library/Application Support/Google/Chrome`
- `~/Library/Caches/Google/Chrome`

根级清理脚本 `pnpm clean:lib` 现在也内置了这层保护：

- 只清理仓库内构建产物
- 如果目标路径命中上述 Chrome 目录，会直接拒绝执行

## CI 说明

仓库当前使用两套 GitHub Actions 工作流：

- `PR 检查`：对应 [`.github/workflows/pr-check.yml`](./.github/workflows/pr-check.yml)
- `main 检查`：对应 [`.github/workflows/main-check.yml`](./.github/workflows/main-check.yml)

## Runtime Interrupts

审批、skill 安装、connector 治理和高风险工具调用，后续统一按可恢复 interrupt 主链收敛。

- 规范文档：[`docs/runtime-interrupts.md`](./docs/runtime-interrupts.md)
- 兼容期内允许同时保留 `pendingApproval`
- 终态目标是 `interrupt(payload) -> __interrupt__ -> Command({ resume })`

### PR 检查

`pull_request -> main` 时会触发 `PR 检查`，并拆成 4 个独立状态：

- `Lint`
- `Typecheck`
- `Test`
- `Build`

这套检查会结合 `changed-files` 做路径过滤：

- 只改前端目录时：
  - 优先跑前端类型检查
  - 只跑前端构建
- 改到后端、worker、packages 或根级工程配置时：
  - 跑后端与共享包类型检查
  - 跑测试
  - 跑后端和共享库构建
- 只改文档时：
  - 不强制跑整套代码检查

这样可以减少 monorepo 中无关目录改动带来的重复校验时间。

### main 检查

`push -> main` 时会触发 `main 检查`，执行完整校验：

- `ESLint`
- `Prettier --check`
- `TypeScript typecheck`
- `Vitest`
- `build`
- `Prompt Regression`（仅在配置 `OPENAI_API_KEY` 时启用，否则自动跳过）

同时会启用这几层缓存来提升速度：

- `pnpm` 依赖缓存
- `Turbo` 缓存：`.turbo/cache`
- 构建产物缓存：
  - `apps/**/dist`
  - `packages/**/build`

### Prompt Regression CI

仓库现在额外支持一个可选的 prompt 回归 CI 任务：

- PR 工作流里会在改到 `packages/**`、`scripts/**`、工作流或根级工程配置时尝试运行
- main 工作流里会在每次推送时尝试运行
- 如果仓库 secrets 中没有配置 `OPENAI_API_KEY`，任务会显式跳过，不阻塞主检查
- 如果配置了 `OPENAI_API_KEY`，会执行 `pnpm eval:prompts`，并上传：
  - `packages/evals/promptfoo/latest-promptfoo-results.json`
  - `packages/evals/promptfoo/latest-summary.json`

## 分支保护建议

建议在 GitHub 仓库设置里为 `main` 分支开启以下规则：

- 禁止直接推送到 `main`
- 必须通过 Pull Request 合并
- 必须等待状态检查通过后才能合并
- 必须通过以下 4 个 PR 检查：
  - `Lint`
  - `Typecheck`
  - `Test`
  - `Build`
- 建议开启“需要分支为最新状态后才能合并”
- 建议开启“新提交后自动失效旧审批”

如果团队后续还会继续扩大规模，建议再补两条：

- 限制谁可以直接修改分支保护规则
- 对 `main` 启用合并队列或 squash merge 策略，保持提交历史整洁

## 规范入口

- [给 Codex / Agents 的规范](./AGENTS.md)
- [后端规范](./docs/backend-conventions.md)
- [前端规范](./docs/frontend-conventions.md)
- [GitHub Flow 规范](./docs/github-flow.md)
- [模板示例](./docs/project-templates.md)
- [测试规范](./docs/test-conventions.md)
- [agent-core 结构报告](./docs/agent-core-structure-report.md)
- [架构总览](./docs/ARCHITECTURE.md)
- [前后端对接文档](./docs/frontend-backend-integration.md)
- [规范总览](./PROJECT_CONVENTIONS.md)

## For Codex / Agents

如果你是进入本仓库工作的代码代理，请先阅读：

1. [AGENTS.md](./AGENTS.md)
2. [README.md](./README.md)
3. [架构总览](./docs/ARCHITECTURE.md)
4. [前后端对接文档](./docs/frontend-backend-integration.md)

最重要的当前约束：

- `agent-chat` 采用 OpenClaw 模态，作为前线作战面
- `agent-admin` 做平台控制台，作为后台指挥面
- 当前系统按“皇帝-首辅-六部”方向收敛，新增实现优先使用 `supervisor / ministry / workflow` 语义
- `agent-chat` 的消息入口默认采用当前项目版 first-match 路由：
  - 显式 workflow 命令、非通用 preset、修改类请求、Figma 类请求走多 Agent 工作流
  - 普通文本 prompt 默认优先走 direct-reply 流式聊天
- `agent-chat` 的主聊天区优先保持顺滑对话体验：
  - 默认只展示用户消息、Agent 最终回复、必要审批/终止卡
  - Think、ThoughtChain、Evidence、Learning、Skill、Route 等运行态信息优先收纳到 workbench / runtime panel
- 共享包改动后，优先执行 `pnpm build:lib`
- 仓库级代理技能放在 `skills/*/SKILL.md`，不要和 `packages/skills` 混用

## 工程原则

- 应用通过 `@agent/*` 使用共享包，不直连 `packages/*/src`
- `packages/*/src` 只保留 `.ts` 源码
- 应用输出使用 `dist/`
- 共享包输出使用 `build/cjs`、`build/esm`、`build/types`
- 本地运行数据统一进入仓库根级 `data/`
- 规范以文档为主，配少量根级检查，不为每个子项目重复堆配置

## 最低检查

- shared：`pnpm exec tsc -p packages/shared/tsconfig.json --noEmit`
- agent-core：`pnpm exec tsc -p packages/agent-core/tsconfig.json --noEmit`
- backend：`pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit`
- agent-chat：`pnpm exec tsc -p apps/frontend/agent-chat/tsconfig.app.json --noEmit`
- agent-admin：`pnpm exec tsc -p apps/frontend/agent-admin/tsconfig.app.json --noEmit`
