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
- `.agents/skills/*`：仓库级代理技能目录，是 Codex 读取本仓库技能的正式入口
- `artifacts/*`：仓库级可重建产物目录；当前主要承载覆盖率与共享临时输出，默认不提交 Git
- `packages/core`：稳定 contract、共享 DTO、接口边界入口
- `packages/core/src/providers`：运行时对外依赖的 provider 抽象接口层
- `packages/config`：运行时配置与路径解析
- `packages/runtime`：执行引擎、会话驱动、运行时 facade
- `packages/adapters`：LLM/provider 等适配器隔离层
- `packages/knowledge`：RAG 知识接入、chunking、retrieval、citation/context 组装
- `packages/memory`：memory、rules、runtime state 本地存储
- `packages/tools`：工具注册、审批规则、执行器
- `agents/supervisor`：主控路由、workflow preset、subgraph 描述等 supervisor 入口
- `agents/data-report`：数据报表生成智能体入口
- `agents/coder`：代码生成智能体公开入口，承载 coder graph 与节点装配
- `agents/reviewer`：质量审核智能体公开入口，承载 reviewer graph 与节点装配
- `packages/templates`：前端模板仓，承载可供代码生成选择的页面/报表模板定义
- `packages/skill-runtime`：运行时技能注册与技能卡领域包；是 `@agent/skill-runtime` 的真实物理宿主
- `packages/evals`：评估与复盘
- `docs/archive/shared/*`：`packages/shared` 退场过程的历史台账与边界归档
- `data/*`：仓库根级本地运行数据（与 `apps/`、`packages/` 同级）
  - 运行时技能数据默认落在 `data/skill-runtime`
- `test/*`：仓库级（workspace-level）专用测试宿主
  - `test/integration/`：跨包、跨宿主、跨链路的 integration 测试
  - `test/smoke/`：仓库级最小可运行闭环 smoke 测试
  - `test/shared/`：仅限测试的共享 fixture、builder、matcher
  - 不承载宿主内 unit / spec；各宿主测试仍留在 `packages/*/test`、`apps/*/test`
  - 完整设计见 [`docs/packages/evals/workspace-test-host-design.md`](./docs/packages/evals/workspace-test-host-design.md)
- `docs/*`：项目规范、模块说明、联调结论与当前实现沉淀

如果需要看“当前每个目录现在在做什么”，优先阅读：

- [`docs/maps/repo-directory-overview.md`](./docs/maps/repo-directory-overview.md)
- [`docs/maps/apps-overview.md`](./docs/maps/apps-overview.md)
- [`docs/maps/packages-overview.md`](./docs/maps/packages-overview.md)
- [`docs/maps/data-overview.md`](./docs/maps/data-overview.md)

当前目录收敛状态补充：

- `packages/*` 与 `agents/*` 的职责、统一目录语法、root export / runtime boundary 规则已经统一沉淀到 `docs/*`
- 第一阶段 compat 根文件收缩已完成，`packages/evals`、`packages/skill-runtime`、`packages/report-kit`、`packages/templates` 以及 `packages/config` 的纯 compat `settings.*` 已切到“包根直出 canonical host”
- 一部分扁平包已经继续补出明确的 facade contract：
  - `packages/config/src/contracts/settings-facade.ts`
  - `packages/skill-runtime/src/contracts/skill-runtime-facade.ts`
  - `packages/evals/src/contracts/evals-facade.ts`
- 仍保留的 compat / facade 入口默认不是历史残留，而是刻意保留的稳定聚合层或 contract-first 入口；具体清单见 [`docs/packages/core/package-compat-sunset-candidates.md`](./docs/packages/core/package-compat-sunset-candidates.md)

根目录不再维护单独的 `TODO.md`。后续 roadmap、联调结论和模块待办统一沉淀到对应的 `docs/<module>/` 文档，并直接按最新实现更新原文档。

## LangGraph 应用结构

当前项目采用“Graph 入口清晰、共享能力集中、测试目录与源码分离”的结构规范：

- 结构规范文档：[`docs/conventions/langgraph-app-structure-guidelines.md`](./docs/conventions/langgraph-app-structure-guidelines.md)
- 主图与运行时 graph 入口优先放在 `packages/runtime/src/graphs`
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

- `.agents/skills/*/SKILL.md`
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

- `KnowledgeSearchService`
  - 面向 runtime / session / ministries 提供统一知识检索入口
  - 承载知识源检索、citation 组装与 RAG context 准备
  - 作为 `packages/knowledge` 的稳定宿主能力，不再继续混放进 `packages/memory`

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
- Spec 结构校验：`pnpm test:spec`
- 原子层测试：`pnpm test:unit`
- Demo 闭环：`pnpm test:demo`
- 协同层测试：`pnpm test:integration`
- 仓库级协同测试：`pnpm test:workspace:integration`
- 仓库级冒烟测试：`pnpm test:workspace:smoke`
- 受影响范围 Spec：`pnpm test:spec:affected`
- 受影响范围 Lint：`pnpm lint:prettier:affected`、`pnpm lint:eslint:affected`
- 受影响范围 Demo：`pnpm test:demo:affected`
- 受影响范围仓库级协同测试：`pnpm test:workspace:integration:affected`
- 受影响范围 Prompt 回归：`pnpm eval:prompts:affected`
- 覆盖率测试：`pnpm test:coverage`
- 测试监听：`pnpm test:watch`
- Prompt 回归：`pnpm eval:prompts`
- Prompt 结果查看：`pnpm eval:prompts:view`

## Prompt 回归

仓库当前提供一套最小 `promptfoo` 回归入口，用于比较户部、刑部、礼部关键 prompt 的版本差异：

- 配置文件：[`packages/evals/promptfoo/ministry-prompts.promptfooconfig.yaml`](./packages/evals/promptfoo/ministry-prompts.promptfooconfig.yaml)
- 使用说明：[`docs/packages/evals/promptfoo-regression.md`](./docs/packages/evals/promptfoo-regression.md)

默认命令：

- `pnpm eval:prompts`
- `pnpm eval:prompts:view`

说明：

- 这套回归默认是“小样本、关键链路、可比较版本”的最小集合
- 仓库已将 `promptfoo` 固定为工作区开发依赖，提交前命中 prompt 相关改动时会由 `husky -> pnpm check:staged` 自动执行 `pnpm eval:prompts`
- 运行前仍需要可用的模型 API Key；当前默认读取 `OPENAI_API_KEY`
- `promptfoo` 运行时还要求 Node `^20.20.0 || >=22.22.0`；如果本地提交时 Node 版本暂不满足，该脚本会直接跳过本地阻塞且不覆盖 `latest-summary.json`，CI 仍应使用受支持版本执行真实回归
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

不要为了释放空间删除用户浏览器登录态、profile 数据或浏览器站点存储。特别是禁止删除或重置：

- Cookie
- Local Storage
- Session Storage
- IndexedDB
- Cache Storage / Service Worker 站点缓存

- `~/Library/Application Support/Google/Chrome`
- `~/Library/Caches/Google/Chrome`

根级清理脚本 `pnpm clean:lib` 现在也内置了这层保护：

- 只清理仓库内构建产物
- 如果目标路径命中上述 Chrome 目录，会直接拒绝执行

## CI 说明

仓库当前使用两套 GitHub Actions 工作流：

- `PR 检查`：对应 [`.github/workflows/pr-check.yml`](./.github/workflows/pr-check.yml)
- `main 检查`：对应 [`.github/workflows/main-check.yml`](./.github/workflows/main-check.yml)
- 两套 workflow 都必须先执行 `pnpm/action-setup@v5`，再执行 `actions/setup-node@v5`
- 原因：仓库根 `package.json` 声明了 `"packageManager": "pnpm@10.32.1"`；`setup-node@v5` 会基于该字段自动探测包管理器缓存，如果这一步发生在 `pnpm` 安装之前，会直接报 `Unable to locate executable file: pnpm`
- 两套 workflow 的邮件通知当前统一固定在 `dawidd6/action-send-mail@v6`，用于规避 GitHub Actions 对 Node 20 JavaScript action 的弃用告警
- 两套 workflow 的 pnpm/Node/安装模板当前统一复用 [`.github/actions/setup-pnpm-workspace/action.yml`](./.github/actions/setup-pnpm-workspace/action.yml)，默认使用 `pnpm install --frozen-lockfile --prefer-offline`，以减少重复配置并尽量利用缓存
- 对不需要 pnpm 依赖安装的轻量 job，PR / main workflow 当前统一复用 [`.github/actions/setup-node-runtime/action.yml`](./.github/actions/setup-node-runtime/action.yml)，并显式关闭 `setup-node` 的自动 package manager cache，避免它在只装 Node 的场景下误探测根级 `pnpm` 配置
- PR 中需要 affected 计算的 job 当前统一改为“浅 checkout + 复用 [`.github/actions/fetch-pr-base-ref/action.yml`](./.github/actions/fetch-pr-base-ref/action.yml) 定向浅 fetch base branch”，不再默认拉整段 git 历史
- `Coverage Main` 虽然保留为非阻塞基线检查，但因为实际执行 `pnpm test:coverage`，仍必须走完整 workspace setup，而不是轻量 Node-only setup
- 根级治理校验与受影响范围 Turbo 入口当前统一复用 [scripts/turbo-runner.js](./scripts/turbo-runner.js)：会把 `--cache-dir` 与 `TMPDIR` / `TMP` / `TEMP` 显式切到系统临时卷下的 `learning-agent-core-turbo/`，并在 CI 中自动切到 `--cache=local:r,remote:r`，避免一次性 runner 写入无复用价值的本地 Turbo 缓存

## Runtime Interrupts

审批、skill 安装、connector 治理和高风险工具调用，后续统一按可恢复 interrupt 主链收敛。

- 规范文档：[`docs/packages/runtime/runtime-interrupts.md`](./docs/packages/runtime/runtime-interrupts.md)
- 兼容期内允许同时保留 `pendingApproval`
- 终态目标是 `interrupt(payload) -> __interrupt__ -> Command({ resume })`

### PR 检查

`pull_request -> main` 时会触发 `PR 检查`，当前主要状态包括：

- `Detect Changed Areas`
- `Lockfile Sync`
- `Docs Check`
- `Affected Verify`
- `Prompt Regression`

其中 `Affected Verify` 为聚合状态检查，内部会先串行执行 `Governance + Spec`，再并发执行 `Prettier / ESLint / Typecheck / Unit / Demo / Integration / Workspace Integration / Workspace Smoke`，以缩短 PR 关键路径，同时保留 `pnpm verify:affected` 对应的五层验证语义，并把仓库级冒烟提前到 PR 阶段暴露。

PR 中的 terminology 检查现在也拆成了独立轻量 job，不再挂在 `Affected Verify` 聚合 job 末尾，因此分支保护对应的聚合状态会更早收口。

`main 检查` 当前也采用同样的收口思路：先执行 `Governance + Spec`，再并发执行 `Prettier / ESLint / Typecheck / Unit / Demo / Integration / Workspace Integration / Workspace Smoke`，随后由聚合的 `Verify Main` 收口，并在验证通过后并发执行 `Build Main` 与非阻塞的 `Coverage Main`。

main 侧现在也会先做一层轻量变更分类：如果是 docs-only push，`build-main` 与 `coverage-main` 会自动跳过；`prompt-regression` 也只会在 prompt-sensitive 或代码相关改动时尝试运行。

邮件通知现在也做了更直观的状态强化：成功标题带 `✅`，失败标题带 `❌`，正文首行和引导区也会同步用状态符号强调结果。

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
- `main` 工作流中的缓存采用 `actions/cache/restore` + `actions/cache/save` 显式分离；只有在对应目录实际生成后才保存，避免 post-job cleanup 因路径不存在而报错
- PR / main workflow 当前统一通过 [`.github/actions/setup-pnpm-workspace/action.yml`](./.github/actions/setup-pnpm-workspace/action.yml) 复用 `actions/setup-node@v5` 的 `pnpm` 缓存配置，并把依赖安装收敛到默认的 `pnpm install --frozen-lockfile --prefer-offline`
- 受影响范围 Turbo 入口当前会把 `--cache-dir` 与 `TMPDIR` / `TMP` / `TEMP` 显式切到系统临时卷下的 `learning-agent-core-turbo/`，用于绕开仓库所在磁盘空间紧张时的本地 `No space left on device` 告警

### Prompt Regression CI

仓库现在额外支持一个可选的 prompt 回归 CI 任务：

- 本地提交时，如果 staged 文件命中 `agents/**/prompts/**`、`packages/**/prompts/**`、`apps/**/prompts/**`、`packages/evals/promptfoo/**` 或 prompt 回归脚本，会自动执行 `pnpm eval:prompts`
- PR 工作流里会在改到上述 prompt 相关路径、`packages/**`、`scripts/**`、工作流或根级工程配置时尝试运行
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
- 必须通过当前配置的 PR 关键检查，至少包括：
  - `Lockfile Sync`
  - `Full Lint`
  - `Full Verify`
- 建议开启“需要分支为最新状态后才能合并”
- 建议开启“新提交后自动失效旧审批”

如果团队后续还会继续扩大规模，建议再补两条：

- 限制谁可以直接修改分支保护规则
- 对 `main` 启用合并队列或 squash merge 策略，保持提交历史整洁

## 规范入口

- [给 Codex / Agents 的规范](./AGENTS.md)
- [后端规范](./docs/conventions/backend-conventions.md)
- [前端规范](./docs/conventions/frontend-conventions.md)
- [GitHub Flow 规范](./docs/conventions/github-flow.md)
- [模板示例](./docs/conventions/project-template-guidelines.md)
- [测试规范](./docs/conventions/test-conventions.md)
- [agent-core 历史结构报告（归档）](./docs/archive/agent-core/archive/agent-core-structure-report.md)
- [架构总览](./docs/architecture/ARCHITECTURE.md)
- [API 文档目录](./docs/contracts/api/README.md)
- [前后端集成链路](./docs/integration/frontend-backend-integration.md)
- [仓库目录概览](./docs/maps/repo-directory-overview.md)
- [规范总览](./docs/conventions/project-conventions.md)

## For Codex / Agents

如果你是进入本仓库工作的代码代理，请先阅读：

1. [AGENTS.md](./AGENTS.md)
2. [README.md](./README.md)
3. [架构总览](./docs/architecture/ARCHITECTURE.md)
4. [API 文档目录](./docs/contracts/api/README.md)
5. [前后端集成链路](./docs/integration/frontend-backend-integration.md)

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
- 仓库级代理技能放在 `.agents/skills/*/SKILL.md`，不要和 `packages/skill-runtime` 混用

## 工程原则

- 应用通过 `@agent/*` 使用共享包，不直连 `packages/*/src`
- `packages/*/src` 只保留 `.ts` 源码
- 应用输出使用 `dist/`
- 共享包输出使用 `build/cjs`、`build/esm`、`build/types`
- 本地运行数据统一进入仓库根级 `data/`
- 规范以文档为主，配少量根级检查，不为每个子项目重复堆配置

## 最低检查

- 只要本轮触达代码、配置、模板、脚手架、构建脚本或测试文件，完成前默认先跑 `pnpm verify`
- `pnpm verify` 当前会串联 `check:docs + lint:prettier:check + lint:eslint:check + typecheck + test:spec + test:unit + test:demo + test:integration + test:workspace:integration + test:workspace:smoke + check:architecture`
- `pnpm verify:affected` 当前会串联 `verify:governance + lint:prettier:affected + lint:eslint:affected + test:spec:affected + typecheck:affected + test:unit:affected + test:demo:affected + test:integration:affected + test:workspace:integration:affected`
- 所有 `*:affected` 入口默认基于 `VERIFY_BASE_REF` 判定受影响范围；未显式配置时回落到 `origin/main`
- GitHub PR 校验当前也以这条主入口为准：代码改动默认按 `pnpm verify:affected` 的层级拆成并发 job 执行，并额外阻塞执行 `pnpm test:workspace:smoke`，最终用聚合的 `Affected Verify` 状态收口；纯文档改动默认跑 `pnpm check:docs`
- 如果 `pnpm verify` 被与本轮无关的既有红灯或环境问题阻断，仍必须对受影响范围补齐 `Type / Spec / Unit / Demo / Integration` 五层验证，并在交付说明中写明 blocker
- 纯文档改动至少执行 `pnpm check:docs`
- runtime：`pnpm exec tsc -p packages/runtime/tsconfig.json --noEmit`
- backend：`pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit`
- agent-chat：`pnpm exec tsc -p apps/frontend/agent-chat/tsconfig.app.json --noEmit`
- agent-admin：`pnpm exec tsc -p apps/frontend/agent-admin/tsconfig.app.json --noEmit`
