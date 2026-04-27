# AGENTS.md

本文件面向进入仓库工作的代码代理（如 Codex）。

优先阅读：

- [README](/README.md)
- [项目规范总览](/docs/conventions/project-conventions.md)
- [架构总览](/docs/architecture/ARCHITECTURE.md)
- [API 文档目录](/docs/contracts/api/README.md)
- [前后端集成链路](/docs/integration/frontend-backend-integration.md)
- [验证体系规范](/docs/packages/evals/verification-system-guidelines.md)

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

### 子 Agent 落地规范

- 这里的“子 Agent”不是普通 helper，也不是 `workflows/*` 里的提示词函数。
- 子 Agent 必须有稳定 graph 入口，默认放在对应真实宿主：
  - runtime 主链图：`packages/runtime/src/graphs/<domain>/<domain>.graph.ts`
  - 专项 agent 图：`agents/<domain>/src/graphs/<domain>.graph.ts`；当专项 agent 的 graph 继续扩张时，同样优先升级为 `src/graphs/<domain>/<domain>.graph.ts`
- 子 Agent 的节点、prompt、schema、解析、校验、重试策略放在对应宿主的 `src/flows/<domain>/`；跨节点复用或 graph 共享的领域类型优先放在 `packages/core/src` 或宿主包的 `src/types/`。
- `src/flows/<domain>/prompts/` 只放提示词与提示词格式化函数，不要再把长系统提示词散落在 service、workflow 或 graph 文件里。
- `src/flows/<domain>/schemas/` 必须承载模型输出的结构约束；只要子 Agent 有稳定 JSON 契约，就必须用 schema 显式校验，不能只靠 `JSON.parse` + 手写 if。
- 当 `flows/<domain>/` 下节点数量或单文件复杂度继续增长时，必须拆到 `src/flows/<domain>/nodes/`，graph 只做 wiring，不要把几十个节点继续堆回单文件。
- 只要本轮改动触达某个手写源码文件，而该文件已超过 `400` 行，就必须在本轮继续拆分；`packages/runtime/src`、`packages/report-kit/src`、`agents/*/src` 与其他 `packages/*/src` 同样适用，优先拆到 `nodes/`、`prompts/`、`schemas/`、`runtime/`、`shared/`、`utils/` 或同域 helper 文件。
- `agents/supervisor/src/workflows/` 只放 workflow 路由、预设、轻量契约和分类策略，不放可执行子 Agent 主链。
- 后端 controller/service 只做 HTTP/SSE/鉴权/运行时装配，不允许直接内联子 Agent 的系统提示词、模型输出解析、结构校验或长流程节点。
- 报表生成默认走 `graphs/data-report.graph.ts` + `flows/data-report/*`，不能退回 `chat.service.ts` 或 `workflows/*` 胶水实现。
- `data-report` 的领域类型统一放在 `packages/core/src` 或 `agents/data-report/src/types/`，不要继续放在零散 flow 文件下。
- `data-report` 的确定性蓝图/骨架/路由/组装能力只允许放在 `packages/report-kit`；Graph 编译、节点编排、preview/runtime facade 只允许放在 `agents/data-report` 与 `packages/runtime`；`apps/backend/*/service` 只能调用这些 facade，不得直接拼 `report-kit` 流程、直接 `compile().invoke()` graph，或在 service 内重建 preview/sandpack/report-schema 子流程。

## 3. 前端实现原则

前端导入约束：

- 默认使用顶层静态 `import`
- 一般不允许写 `import('mermaid').then(...)`、`import('xxx')` 这类动态导入
- 类型位置同样不允许把 `import('pkg').Foo`、`import('zod/v4').ZodType<T>` 当成静态导入替代品；可静态声明时，必须改用顶层 `import type { Foo } from 'pkg'`
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

- 目录：`packages/skill-runtime`
- 作用：服务端运行时的技能注册、技能卡、技能领域模型

### 代理技能

- 目录：`.agents/skills/*`
- 作用：给 Codex / Claude Code 这类代码代理读取的仓库技能

推荐结构：

```text
.agents/skills/
├─ README.md
└─ <skill-name>/
   ├─ SKILL.md
   ├─ references/
   ├─ scripts/
   └─ assets/
```

约束：

- 每个代理技能目录必须有 `SKILL.md`
- 不要把代理技能写进 `packages/skill-runtime`
- 不要把运行时 skill card/registry 写进 `.agents/skills/`

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
- 不要从应用层直连 `packages/*/src`、`agents/*/src`，也不要把 `@agent/<pkg>/<subpath>` 当成应用层稳定接口
- 如果某段能力已经需要被多个地方复用、逻辑开始变复杂、并且预计要独立演进，可以新建 `packages/<pkg>` 子包收敛边界；这类新包的最低结构要求只有 `package.json`
- `packages/` 下的每一个目录必须包含 `package.json`
- 新建 `packages/<pkg>` 时不要求立即提供实现代码，不要求立即创建 `src/` 目录，也不要求先塞入任何逻辑；可以先以 manifest 立包，再逐步补实现
- 依赖安装必须使用 `pnpm add`
- 安装到工作空间根时，必须使用 `pnpm add -w`
- 安装开发依赖时，必须使用 `pnpm add -D`；如果是工作空间根开发依赖，必须使用 `pnpm add -Dw`
- 只要新增 workspace 包，或修改任何 `package.json` 中的依赖、开发依赖、peer 依赖、optional 依赖、workspace 引用或脚本里会影响依赖图的包管理配置，就必须立刻同步更新 `pnpm-lock.yaml`，禁止把 manifest 变更与 lockfile 修复拆到后续提交
- 新增 workspace 包后，必须在提交前确认 `pnpm-lock.yaml` 的 `importers` 已出现对应条目；缺少 importer 视为未完成的依赖收口，不能提交
- 不允许使用本地 `.pnpm-store` 安装、通过 `--store-dir <local-path>` 指向本地 store 安装，或把 `.pnpm-store` 放在仓库内
- 依赖安装时不要手动指定本地 `store-dir`；pnpm 会通过软链接管理依赖，直接使用 `pnpm add` 即可
- 共享包构建输出：
  - `build/cjs`
  - `build/esm`
  - `build/types`
- 代码里涉及文件系统操作时，默认优先使用 `fs-extra`
- 除非是 Node 原生同步 API 的极小型启动逻辑、第三方接口硬约束，或测试明确需要 mock `node:fs` / `node:fs/promises`，否则不要新增原生 `fs` 作为默认实现
- 生成分支名、提交信息、PR 标题或判断提交流程时，必须先阅读并遵守 [GitHub Flow 规范](/docs/conventions/github-flow.md)
- 不允许只按通用 GitHub Flow 习惯临时命名分支；必须优先使用仓库 `docs/conventions/github-flow.md` 中定义的命名约定
- 禁止使用 `git commit --no-verify` 或任何等价方式绕过本地 hook；如果 hook 因既有红灯、环境、权限或外部依赖失败，必须先修复或明确记录 blocker，不能跳过 hook 强行提交
- 禁止使用 `git worktree` 创建、切换或维护并行工作区；所有开发、验证、提交与交付必须在当前 checkout 内串行完成。
- 如果任务会触达相同模块、共享边界、主链 graph、稳定 contract、接口文档或前后端协议，必须在当前 checkout 内按文件/目录级 ownership 串行推进，不能通过 worktree 并行规避冲突面。
- 已存在的历史 worktree 只能在确认不包含未迁移改动后清理；不得把 worktree 当作隔离开发、验证绕行、文档补交或 lockfile 修复的手段。

## 6.0 接口稳定性与可扩展封装规范

- 所有新增或修改实现，默认优先面向稳定接口编程，而不是面向具体调用方、临时页面或单次流程硬编码。
- 只要本轮改动涉及前后端联调、跨包 API、SSE payload、DTO、事件、tool result、graph state 切片或其他会被多个模块消费的接口，必须先定义接口文档，再开始前后端实现；禁止前端和后端各自先写代码、再事后倒推协议。
- 接口文档必须先明确：接口目的、入口路径或调用方式、请求参数、响应或事件 schema、错误语义、兼容策略、字段演进约束，以及前后端各自负责的实现边界；能落 schema 的内容，必须与 `packages/core` 或宿主 `schemas/` 中的正式定义保持一致。
- 前端开发、后端开发、联调、测试与文档更新都必须以同一份接口文档为准；接口发生变更时，先更新接口文档与 schema/contract，再同步修改前后端实现和验证，禁止让文档长期落后于真实协议。
- `packages/shared` 已于 `2026-04-18` 从 workspace 删除；历史迁移台账保留在 `docs/archive/shared/*`，后续不要再新增 `@agent/shared` 或 `packages/shared/*`。
- 稳定 contract 默认收敛到 `packages/core`；运行时 aggregate、展示 facade、helper reclaim 与 compat 主实现必须落在真实宿主，不允许重新引入第二个 shared 包层。
- `packages/core` 默认采用 schema-first：所有稳定 JSON / DTO / event / payload contract 必须先定义 schema，再通过 `z.infer<typeof Schema>` 推导类型；不要继续在 `core` 新增只有 interface/type、没有 schema 的长期公共 contract。
- 发现稳定 contract 与运行时聚合/展示类型混放时，必须继续拆成 `core stable contract + 宿主本地 aggregate/facade`，禁止把 compat 重新堆回公共包。
- `helper / workflow / prompt / bootstrap registry` 的主实现必须落在真实宿主，不允许迁进 `packages/core` 伪共享；默认落点为 `agents/supervisor`、`packages/runtime`、`packages/skill-runtime` 等真实业务包。
- 如需兼容历史入口，只允许在真实宿主或应用本地保留 thin compat re-export，不允许恢复 `@agent/shared` 包名。
- 对外暴露的模块必须先定义清晰边界：输入、输出、错误语义、版本兼容策略，再落具体实现；禁止先把实现写散，再事后补接口包装。
- 涉及跨包、跨模块、前后端、graph 与 tool、service 与 repository 之间的协作时，优先抽象稳定 `contract / adapter / facade`，避免调用方直接耦合底层细节。
- 高变动逻辑与稳定契约必须分离：易变部分下沉到 `flows/`、`runtime/`、`adapters/`、`repositories/` 等内部实现；稳定部分通过 `@agent/*` 根入口、DTO、schema、facade 对外暴露。
- 第三方依赖边界默认遵守“允许使用，不允许穿透”：
  - 业务代码不得直接耦合第三方实现细节；第三方能力进入主链流程、跨包 contract、前后端协议、graph state、tool result、审批事件、模型输出或持久化记录时，必须先经过项目自定义的稳定 `contract / adapter / facade / provider` 边界。
  - 第三方 SDK 调用、vendor response/error/event 适配、协议转换与 vendor-specific 参数，默认集中在 `adapters/`、`providers/`、`clients/`、`repositories/`、`runtime/` 等边界层；`flows/`、`graphs/`、`services/`、UI 业务组件默认只消费项目自定义接口。
  - 不允许让第三方类型、错误对象、事件结构、状态机语义直接穿透到业务层、公共 contract 或持久化结构；必须在边界层先转换为项目自己的 schema/type/error 语义，例如 provider error、connector error、tool result、approval record、event record。
  - 对第三方能力应优先抽象“项目需要的能力接口”，不要机械复刻 vendor API；新增第三方接入时，优先新增 provider/adapter 实现，而不是在业务层复制调用链或追加 `if/else`。
  - 评估新增第三方依赖或直接接入第三方 SDK 时，至少先确认：是否已有项目内 provider/adapter/facade；第三方对象是否会穿透到业务层或公共 contract；是否需要先定义项目 schema/type；错误、重试、超时、取消、恢复、审计语义由哪一层负责；是否已补 adapter 层测试或 contract parse 回归。
  - 允许的例外仅限：React/Vite/zod/测试框架等基础设施在对应技术层直接使用；极薄的启动装配层创建第三方 client/SDK 实例但不得泄漏到业务调用方；兼容迁移期间保留带明确标注的 thin compat。
- 目录分组名与物理落位必须一致：如果已经创建 `repositories/`、`nodes/`、`prompts/`、`schemas/`、`types/`、`adapters/`、`runtime/`、`shared/`、`utils/` 等目录，并在其中使用 `index.ts` 作为分组 barrel，则该目录名对应的主要实现也必须物理放进该目录；不要长期保留“目录里只有 `index.ts`，实现却散在父目录”的半收敛结构。
- 如果兼容迁移期间不得不保留 barrel-only 目录，必须在相邻文档或代码注释中显式标注“过渡态”，并在本轮或明确后续计划里继续完成物理收敛；不能把这种结构当成终态。
- 仓库已提供 `pnpm check:barrel-layout` 作为目录 barrel 物理落位的固定检查入口；涉及目录收敛时默认把它纳入本轮验证。
- 默认追求高内聚、低耦合：
  - 一个模块只负责一个清晰领域能力，避免同时承担协议转换、流程编排、状态存储和 UI 拼装。
  - 如果两个模块总是一起修改，优先重新划分边界，而不是继续相互引用、透传上下文或复制分支逻辑。
- 默认追求可扩展而不是堆条件分支：
  - 优先新增实现点、策略对象、节点、adapter、provider，而不是不断在原处追加 `if/else` 或布尔开关把旧模块改成“万能入口”。
  - 新接入一个模型、来源、connector、skill source、tool executor、报告模板时，应优先复用既有接口并新增实现，而不是复制整条调用链。
- 默认追求可复制的封装：
  - 一段能力如果预期会在第二个场景复用，就应提炼为可独立测试、可组合、可替换的封装，而不是复制粘贴后靠局部改名维持。
  - 复制只允许作为短期止血；一旦本轮已出现第二处相似实现，应在本轮顺手收敛为共享接口、helper、adapter、schema 或 facade。
- 禁止让调用方依赖隐式约定：
  - 不允许依赖“字段刚好有这个值”“当前实现恰好先调用 A 再调用 B”“某个内部目录结构目前没变”这类脆弱前提。
  - 需要顺序、幂等、回退、兼容、重试、审批语义时，必须写进接口 contract、schema、类型或文档。
- 接口编辑必须优先考虑兼容性：
  - 修改已有 DTO、事件、SSE payload、tool result、graph state 切片时，先评估调用方和存量数据影响。
  - 能兼容演进时，不要直接破坏式改名或删字段；必须破坏式调整时，要同步更新调用方、测试和文档，并显式说明迁移策略。
- 封装必须可验证：
  - 对外 contract、adapter 映射、解析器、facade、策略选择器至少应有最小测试或可证明检查。
  - 重构如果声称“只是搬运和封装”，也要证明行为不变，而不是只靠人工目测。

如果改动涉及 `packages/*`，优先执行：

```bash
pnpm build:lib
pnpm --dir apps/backend/agent-server build
```

## 6.1 文档沉淀与清理规范

- 以后每次完成功能、修复缺陷、调整链路、补齐约束或确认重要联调结论后，必须同步把结果写入文档，不能只改代码不沉淀。
- 文档必须放在 `docs/<module>/` 目录下，按当前主要改动模块归档：
- `packages/runtime/*` 与已删除 `packages/agent-core` 的历史迁移文档 -> `docs/archive/agent-core/`
  - `apps/backend/*` -> `docs/apps/backend/agent-server/`
  - `apps/frontend/agent-chat/*` -> `docs/apps/frontend/agent-chat/`
  - `apps/frontend/agent-admin/*` -> `docs/apps/frontend/agent-admin/`
  - 跨模块链路说明可放在 `docs/integration/`
- 不允许把新的模块专项文档继续平铺在 `docs/` 根目录；根目录只保留总览、全局规范、架构类文档。
- 新文档应优先记录：
  - 当前真实生效的实现，而不是理想状态
  - 关键入口、边界、事件、缓存、开关、测试约束
  - 已踩过的坑、误判点、回归风险
  - 后续 AI 继续改动时不能破坏的行为
- 完成功能后，除新增/更新文档外，还必须检查并清理过时文档：
  - 删除与当前实现明显不符、且已无保留价值的旧文档
  - 将仍有部分参考价值但内容已过期的文档显式标注“过时”或改写为最新实现
  - 避免同一主题在多个位置出现互相冲突的说明
- 每次任务完成后，除检查实现文档外，还必须顺手检查本轮涉及的规范文档是否已经过期：
  - 包括但不限于 `AGENTS.md`、`docs/conventions/project-conventions.md`、模块 `README`、专题 `*-conventions.md` / `*-guidelines.md`
  - 如果实现、流程、目录边界、验证要求或交付要求已经变化，必须在本轮同步更新规范，不要把“规范已失效”留到后续任务
  - 如果暂时无法在本轮彻底改完，至少要显式标注“过时”并指出正确入口，避免后续 AI 继续按旧规范执行
- 如果本轮改动影响既有文档内容，必须直接更新原文档，而不是只额外新增一份“补充说明”导致知识分叉。
- 交付时应在结果中明确说明：
  - 新增或更新了哪些文档
  - 是否清理了过时文档
  - 后续 AI 应优先阅读哪些文档

## 7. 完成后验证

- [验证体系规范](/docs/packages/evals/verification-system-guidelines.md) 是当前仓库所有非纯文档改动的固定验证总入口；只要本轮改动触达代码、配置、模板、脚手架、构建脚本或测试文件，就必须按该文档执行验证，不允许跳过为“局部小改”“只改一个文件”或“只是重构”。
- 只要本轮触达代码、配置、模板、脚手架、构建脚本或测试文件，交付前就必须补齐五层验证，不允许只改代码不校验。
- 五层验证固定为：
  - `Type`：TypeScript 静态类型检查
  - `Spec`：基于 `zod` 的结构校验与 parse 回归
- `Unit`：原子逻辑单测
- `Demo`：最小可运行闭环
- `Integration`：跨模块、跨包、跨节点协同验证
- 默认优先执行根级 `pnpm verify`；如果它全绿，视为本轮仓库级验证已收口。
- 当前根级 `pnpm verify` 必须覆盖 `pnpm lint:prettier:check`、`pnpm lint:eslint:check`、`pnpm test:spec` 与 `pnpm test:demo`，确保治理门槛、`Spec` 和 `Demo` 都不是只停留在口头约定或目录存在。
- 每次改动文件时，都必须先按 [验证体系规范](/docs/packages/evals/verification-system-guidelines.md) 判断本轮需要补齐的层级、门槛和命令；禁止凭经验只跑 `test`、只跑 `build`、只跑单个 `tsc` 或只做手工验证后直接交付。
- 如果 `pnpm verify` 被与本轮无关的既有红灯、外部服务、凭据、网络或环境问题阻断，仍必须对受影响范围逐层补齐五层验证，并在交付中明确说明：
  - 实际执行了哪些命令
  - 哪一层因什么 blocker 未能完成
  - blocker 是否属于本轮改动
- 纯文档改动至少执行 `pnpm check:docs`；如果文档改动同时伴随代码或配置改动，仍按五层验证执行。

## 7.1 最低检查

- runtime：
  - `pnpm exec tsc -p packages/runtime/tsconfig.json --noEmit`
- backend：
  - `pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit`
- `agent-chat`：
  - `pnpm exec tsc -p apps/frontend/agent-chat/tsconfig.app.json --noEmit`
- `agent-admin`：
  - `pnpm exec tsc -p apps/frontend/agent-admin/tsconfig.app.json --noEmit`

## 8. Codex 执行补充规范

- 给定计划后，默认连续执行，不要停下来反复询问“是否继续”。
- 只要用户要求“实现整个计划”“继续执行计划”“按计划收尾”，就必须把该计划视为单一连续任务，默认一直执行到整套计划完成；不允许只做完一个阶段、一个子模块或一轮收口后就停下来把“继续”重新交还给用户，除非遇到真实阻断、隐含高风险决策，或用户明确改写计划边界。
- 同一阻断优先自修复，最多连续尝试 `3` 次；只有达到上限才允许报告阻塞。
- 每次改动完成后都必须补齐五层验证，或明确记录阻断原因；不要只改代码不校验。
- 默认采用 **TDD（Test-Driven Development）** 推进新增功能、修复和重构：先写失败测试，再写最小实现，最后在测试保护下重构。
- 对“实现需求 / 修复缺陷 / 重构收敛 / 需要可交付结果”的任务，默认按 `.agents/skills/task-delivery-loop` 的闭环执行：
  - 任务定级与完成条件
  - 需求与影响面分析
  - Red
  - Green
  - Refactor
  - Cleanup
  - Verification
  - Docs
  - Delivery
- `Cleanup` 不是可选优化，而是默认动作：
  - 删除已无调用、无兼容价值的旧文件、旧规范、旧导出、废弃 helper 与死代码
  - 清理未接线 graph 分支、过渡态中转文件、已经失效的旧说明
  - 如果某个旧文件仍需保留兼容职责，必须明确标注其过渡用途，而不是静默残留
- **当一轮计划中的任务已全部完成时，必须明确告知用户“计划已完成”或等价结论。**

## 8. Codex 执行规则

进入仓库执行计划时，默认按“高级自主执行代理”工作，不做无意义停顿。

### 执行循环

- 当用户已经给出计划，或仓库中存在明确执行清单时，必须进入连续执行循环：
  - 先确定本轮任务属于 `feature`、`fix`、`refactor`、`docs-only` 或 `review-only`
  - 明确本轮完成条件与交付边界
  - 读取下一个未完成任务
  - 先为该任务补一个能失败的最小测试，优先从使用者视角定义接口、输入和预期输出
  - 直接修改代码、运行命令、完成实现
  - 在实现转绿后主动执行 cleanup，删除无用文件与过时说明，避免新旧实现并存
  - 立即做验证：先确认新测试转绿，再补充类型检查、构建或最小可证明检查
  - 同步更新文档、规范与索引入口，避免知识分叉
  - 更新计划状态或在内部状态中推进
- 自动进入下一项，不要反复询问“是否继续”
- 除非遇到真实阻断，否则不要停在“分析完成，等待确认”
- 即使已经完成某一阶段、某一批文件或某一条子清单，只要原计划还有未完成项，也必须继续推进下一项；阶段性完成只能作为进度汇报，不能当作停止条件。

### TDD 规则

- 默认遵循 **Red - Green - Refactor**：
  - Red：先写一个会失败的自动化测试，测试必须精确描述本轮需求
  - Green：只写让当前测试通过所必需的最小代码，不在这一步提前做额外抽象
  - Refactor：在测试全绿的前提下整理结构、提炼 helper、去重、改名，并在每次重构后重新运行测试
- 除非是纯文档、纯配置搬运、纯脚手架或测试基础设施修复，否则不要跳过 Red 阶段直接写生产代码
- 修复缺陷时，优先先补能复现该缺陷的测试，再做修复，避免“改好了但没有防回归用例”
- 做文件拆分、提炼 helper、组件瘦身时，也要优先为将被提炼的行为补测试，确保重构前后语义一致
- 测试命名必须直接表达业务意图，避免只写“should work”这类无信息量描述
- 如果当前任务无法合理落单元测试，至少补最小可证明检查，并在结果里说明为什么没有采用完整 TDD
- 新增逻辑默认以可测试为前提设计：尽量降低耦合、减少隐藏状态、优先纯函数和清晰边界

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
- 新增、重构或替换实现后，必须主动清理本轮改动引入或遗留的未使用节点、未接线 graph 分支、未引用导出、废弃 helper 与死代码；不要把“已经没用到”的实现继续留在仓库里
- 每次任务收尾时，必须检查本轮涉及的旧文件、旧规范、旧脚手架、旧 README、旧中转 re-export 是否仍有保留价值；如果没有，默认本轮直接删除，而不是留给后续继续误导
- 每次任务收尾时，必须回看本轮涉及的规范是否仍与真实实现一致；若发现规范过期，必须立即更新或显式标注过时，不能在明知失效的情况下结束任务
- 修改任何主链逻辑时，必须默认遵守：
  - 不破坏现有功能
  - 不降低已建立的测试覆盖
  - 不回退已经稳定的聊天、审批、学习、来源引用等体验
- 严禁删除或重置用户浏览器数据，尤其是 Chrome 的登录态、Cookie、Local Storage、Session Storage、IndexedDB、站点缓存与 profile 数据
- 特别是不要触碰以下目录：
  - `~/Library/Application Support/Google/Chrome`
  - `~/Library/Caches/Google/Chrome`

### 完成条件

- 只有在计划项全部完成，且必要验证通过后，才允许真正停止
- 如果用户明确要求“实现整套方案”，默认目标是完成到可运行、可验证、可交付，而不是只落一半骨架
- 完成条件默认包含“代码、测试、文档”三者同时收口；文档未更新或旧文档未清理，不算真正完成
- 对多阶段计划，真正的“完成”只指整个计划闭环结束；“完成第一阶段/第二阶段”不等于任务完成，除非用户明确把阶段性交付定义为本轮终点

## 9. 强制交互协议（仅 @github/copilot 执行）

> **适用范围**：本节规则仅面向 GitHub Copilot CLI（`@github/copilot`）执行。
> 其他代码代理（如 Codex、Claude Code）不受本节约束，按各自默认行为工作。
> 本节规则来源于全局 `~/.copilot/AGENTS.md`，因项目级 AGENTS.md 优先级更高会覆盖全局配置，故在此处显式声明以确保生效。

### 核心规则

每次回复结束前必须调用 `ASK_USER` 工具。

每次执行 `git commit` 之前，必须先对当前准备提交的修改做一次 code review。

这是不可跳过的强制协议。在每一轮回复中，必须执行以下操作之一：

1. 完成用户请求后，立即调用 `ASK_USER` 工具，提出与当前上下文相关的后续问题。
2. 存在任何不确定性时，不要猜测执行，立即调用 `ASK_USER` 工具进行澄清。

执行 `git commit` 前的 code review 至少必须满足以下要求：

- review 范围必须覆盖当前待提交 diff；如果已经 `git add`，优先 review staged diff，否则 review 当前工作区 diff。
- review 重点必须优先检查：功能回归、边界条件、类型/契约破坏、测试缺失、潜在安全与数据破坏风险。
- 如果发现问题，必须先修复，或至少先向用户明确说明风险并得到继续提交的确认；不能在已知存在缺陷时直接提交。
- 完成 review 后再执行 `git commit`；禁止跳过 review 直接提交。

### 禁止行为

- 禁止在不调用 `ASK_USER` 的情况下结束回复。
- 禁止使用终结性表达，如"希望对你有帮助""如有问题随时提问"等。
- 禁止猜测用户意图；不确定就使用 `ASK_USER` 工具查询。
- 禁止未经过当前修改 code review 就直接执行 `git commit`。

### 严格生命周期管理

- 严禁自我判定结束；即便任务看起来已完成，也必须通过 `ASK_USER` 询问是否需要进行边缘情况测试或代码优化。
- 严禁直接输出"祝你编程愉快"等结束语。
- 在调用 `ASK_USER` 时，必须提供至少 3 个互斥的后续执行方向。

### 推荐提问方向模板

1. 是否要继续做边缘情况测试？
2. 是否要继续做性能优化？
3. 是否要继续做结构重构或可维护性整理？
