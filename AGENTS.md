# AGENTS.md

本文件面向进入仓库工作的代码代理（如 Codex）。

优先阅读：

- [README](/README.md)
- [项目规范总览](/docs/project-conventions.md)
- [架构总览](/docs/ARCHITECTURE.md)
- [前后端对接文档](/docs/integration/frontend-backend-integration.md)

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
  - runtime 主链图：`packages/runtime/src/graphs/<domain>.graph.ts`
  - 专项 agent 图：`agents/<domain>/src/graphs/<domain>.graph.ts`
- 子 Agent 的节点、prompt、schema、解析、校验、重试策略放在对应宿主的 `src/flows/<domain>/`；跨节点复用或 graph 共享的领域类型优先放在 `packages/core/src`、`packages/shared/src` 或宿主包的 `src/types/`。
- `src/flows/<domain>/prompts/` 只放提示词与提示词格式化函数，不要再把长系统提示词散落在 service、workflow 或 graph 文件里。
- `src/flows/<domain>/schemas/` 必须承载模型输出的结构约束；只要子 Agent 有稳定 JSON 契约，就必须用 schema 显式校验，不能只靠 `JSON.parse` + 手写 if。
- 当 `flows/<domain>/` 下节点数量或单文件复杂度继续增长时，必须拆到 `src/flows/<domain>/nodes/`，graph 只做 wiring，不要把几十个节点继续堆回单文件。
- 只要本轮改动触达某个手写源码文件，而该文件已超过 `400` 行，就必须在本轮继续拆分；`packages/runtime/src`、`packages/report-kit/src`、`agents/*/src` 与其他 `packages/*/src` 同样适用，优先拆到 `nodes/`、`prompts/`、`schemas/`、`runtime/`、`shared/`、`utils/` 或同域 helper 文件。
- `agents/supervisor/src/workflows/` 只放 workflow 路由、预设、轻量契约和分类策略，不放可执行子 Agent 主链。
- 后端 controller/service 只做 HTTP/SSE/鉴权/运行时装配，不允许直接内联子 Agent 的系统提示词、模型输出解析、结构校验或长流程节点。
- 报表生成默认走 `graphs/data-report.graph.ts` + `flows/data-report/*`，不能退回 `chat.service.ts` 或 `workflows/*` 胶水实现。
- `data-report` 的领域类型统一放在 `packages/core/src`、`packages/shared/src` 或 `agents/data-report/src/types/`，不要继续放在零散 flow 文件下。
- `data-report` 的确定性蓝图/骨架/路由/组装能力只允许放在 `packages/report-kit`；Graph 编译、节点编排、preview/runtime facade 只允许放在 `agents/data-report` 与 `packages/runtime`；`apps/backend/*/service` 只能调用这些 facade，不得直接拼 `report-kit` 流程、直接 `compile().invoke()` graph，或在 service 内重建 preview/sandpack/report-schema 子流程。

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

- 目录：`packages/skill-runtime`
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
- 不要把代理技能写进 `packages/skill-runtime`
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
- 依赖安装必须使用 `pnpm add`
- 安装到工作空间根时，必须使用 `pnpm add -w`
- 安装开发依赖时，必须使用 `pnpm add -D`；如果是工作空间根开发依赖，必须使用 `pnpm add -Dw`
- 不允许使用本地 `.pnpm-store` 安装、通过 `--store-dir <local-path>` 指向本地 store 安装，或把 `.pnpm-store` 放在仓库内
- 依赖安装时不要手动指定本地 `store-dir`；pnpm 会通过软链接管理依赖，直接使用 `pnpm add` 即可
- 共享包构建输出：
  - `build/cjs`
  - `build/esm`
  - `build/types`
- 代码里涉及文件系统操作时，默认优先使用 `fs-extra`
- 除非是 Node 原生同步 API 的极小型启动逻辑、第三方接口硬约束，或测试明确需要 mock `node:fs` / `node:fs/promises`，否则不要新增原生 `fs` 作为默认实现
- 生成分支名、提交信息、PR 标题或判断提交流程时，必须先阅读并遵守 [GitHub Flow 规范](/docs/github-flow.md)
- 不允许只按通用 GitHub Flow 习惯临时命名分支；必须优先使用仓库 `docs/github-flow.md` 中定义的命名约定

## 6.0 接口稳定性与可扩展封装规范

- 所有新增或修改实现，默认优先面向稳定接口编程，而不是面向具体调用方、临时页面或单次流程硬编码。
- `packages/core` 与 `packages/shared` 如果承载同一类稳定 contract，默认继续把主 contract 收到 `packages/core`；`packages/shared` 只保留展示组合、默认类型参数和 compat re-export，不允许长期双轨维护。
- `packages/core` 默认采用 schema-first：所有稳定 JSON / DTO / event / payload contract 必须先定义 schema，再通过 `z.infer<typeof Schema>` 推导类型；不要继续在 `core` 新增只有 interface/type、没有 schema 的长期公共 contract。
- 一旦发现 `packages/shared` 与 `packages/core` 存在“同功能、同语义、同消费边界”的 contract，必须以 `packages/core` 为唯一主宿主，并把 `packages/shared` 改成 compat re-export；禁止长期保留两份平行主定义。
- 对外暴露的模块必须先定义清晰边界：输入、输出、错误语义、版本兼容策略，再落具体实现；禁止先把实现写散，再事后补接口包装。
- 涉及跨包、跨模块、前后端、graph 与 tool、service 与 repository 之间的协作时，优先抽象稳定 `contract / adapter / facade`，避免调用方直接耦合底层细节。
- 高变动逻辑与稳定契约必须分离：易变部分下沉到 `flows/`、`runtime/`、`adapters/`、`repositories/` 等内部实现；稳定部分通过 `@agent/*` 根入口、DTO、schema、facade 对外暴露。
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
  - `apps/backend/*` -> `docs/backend/`
  - `apps/frontend/agent-chat/*` -> `docs/frontend/agent-chat/`
  - `apps/frontend/agent-admin/*` -> `docs/frontend/agent-admin/`
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
  - 包括但不限于 `AGENTS.md`、`docs/project-conventions.md`、模块 `README`、专题 `*-conventions.md` / `*-guidelines.md`
  - 如果实现、流程、目录边界、验证要求或交付要求已经变化，必须在本轮同步更新规范，不要把“规范已失效”留到后续任务
  - 如果暂时无法在本轮彻底改完，至少要显式标注“过时”并指出正确入口，避免后续 AI 继续按旧规范执行
- 如果本轮改动影响既有文档内容，必须直接更新原文档，而不是只额外新增一份“补充说明”导致知识分叉。
- 交付时应在结果中明确说明：
  - 新增或更新了哪些文档
  - 是否清理了过时文档
  - 后续 AI 应优先阅读哪些文档

## 7. 完成后验证

- 只要本轮触达代码、配置、模板、脚手架、构建脚本或测试文件，交付前就必须补齐五层验证，不允许只改代码不校验。
- 五层验证固定为：
  - `Type`：TypeScript 静态类型检查
  - `Spec`：基于 `zod` 的结构校验与 parse 回归
- `Unit`：原子逻辑单测
- `Demo`：最小可运行闭环
- `Integration`：跨模块、跨包、跨节点协同验证
- 默认优先执行根级 `pnpm verify`；如果它全绿，视为本轮仓库级验证已收口。
- 当前根级 `pnpm verify` 必须覆盖 `pnpm test:spec` 与 `pnpm test:demo`，确保 `Spec` 和 `Demo` 两层都不是只停留在口头约定或目录存在。
- 如果 `pnpm verify` 被与本轮无关的既有红灯、外部服务、凭据、网络或环境问题阻断，仍必须对受影响范围逐层补齐五层验证，并在交付中明确说明：
  - 实际执行了哪些命令
  - 哪一层因什么 blocker 未能完成
  - blocker 是否属于本轮改动
- 纯文档改动至少执行 `pnpm check:docs`；如果文档改动同时伴随代码或配置改动，仍按五层验证执行。

## 7.1 最低检查

- shared：
  - `pnpm exec tsc -p packages/shared/tsconfig.json --noEmit`
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
- 同一阻断优先自修复，最多连续尝试 `3` 次；只有达到上限才允许报告阻塞。
- 每次改动完成后都必须补齐五层验证，或明确记录阻断原因；不要只改代码不校验。
- 默认采用 **TDD（Test-Driven Development）** 推进新增功能、修复和重构：先写失败测试，再写最小实现，最后在测试保护下重构。
- **当一轮计划中的任务已全部完成时，必须明确告知用户“计划已完成”或等价结论。**

## 8. Codex 执行规则

进入仓库执行计划时，默认按“高级自主执行代理”工作，不做无意义停顿。

### 执行循环

- 当用户已经给出计划，或仓库中存在明确执行清单时，必须进入连续执行循环：
  - 读取下一个未完成任务
  - 先为该任务补一个能失败的最小测试，优先从使用者视角定义接口、输入和预期输出
  - 直接修改代码、运行命令、完成实现
  - 立即做验证：先确认新测试转绿，再补充类型检查、构建或最小可证明检查
  - 更新计划状态或在内部状态中推进
  - 自动进入下一项，不要反复询问“是否继续”
- 除非遇到真实阻断，否则不要停在“分析完成，等待确认”

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
