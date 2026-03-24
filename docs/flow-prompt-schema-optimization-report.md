# Flow / Prompt / Schema 优化建议报告

适用范围：

- `packages/agent-core/src/flows/*`
- `apps/frontend/agent-chat`
- `apps/frontend/agent-admin`

参考来源：

- `D:\渡一资料\前端架构课\coding-agent\完整代码\duyi-figma-make\server\agents\flows`

---

## 1. 先看参考实现的优点

参考目录最有价值的地方，不是“提示词写得更长”，而是它把每个阶段拆成了清晰的职责层：

- `nodes/`
  - 只负责执行节点逻辑，调用模型、拼接上下文、写回结果
- `prompts/`
  - 只负责系统提示词、用户提示词模板、输出约束
- `schemas/`
  - 只负责结构化输出定义和类型导出
- `utils/`
  - 只负责纯函数和解析工具

这套结构的核心收益有 4 个：

1. 节点逻辑不会和提示词、Schema 糊在一个文件里。
2. Prompt 修改不需要触碰业务执行逻辑，回归风险更低。
3. Schema 可以成为稳定的输出契约，便于测试和版本演进。
4. Flow 可以按阶段独立扩展，而不是继续堆进一个“大聊天流”。

---

## 2. 当前项目的主要问题

结合当前仓库代码，问题已经比较明确：

### 2.1 flow 目录拆分还不够彻底

当前 `packages/agent-core/src/flows/chat` 仍然是：

- `base-agent.ts`
- `nodes/manager-node.ts`
- `nodes/research-node.ts`
- `nodes/executor-node.ts`
- `nodes/reviewer-node.ts`

但节点里仍然内联了：

- `zod` schema
- system prompt
- fallback 文案
- 领域决策规则

代表文件：

- `packages/agent-core/src/flows/chat/nodes/manager-node.ts`
- `packages/agent-core/src/flows/chat/nodes/research-node.ts`

这会导致一个节点文件同时承担“提示词编排 + 输出契约 + 业务逻辑 + 容错逻辑”四种职责。

### 2.2 新旧命名共存，但缺少过渡层

当前仓库已经引入：

- `ministries`
- `workflow`
- `governance`
- `supervisor` 相关事件

但 `chat` flow 仍以旧：

- `manager`
- `research`
- `executor`
- `reviewer`

为主。问题不在“旧命名还在”，而在于缺少一个明确的迁移边界，导致后续新功能很容易继续往旧目录里加。

### 2.3 Prompt 规范尚未产品化

参考实现里的 prompt 普遍具备这些特点：

- 先定义角色
- 再定义任务目标
- 再定义字段填充规范
- 最后定义输出格式和 JSON 安全要求

当前仓库节点里的 prompt 还比较偏“单条 system 文本”，结构和复用性都不够稳定。

### 2.4 Schema 设计还不够显式

参考实现的 schema 有两个明显优点：

- 每个字段都有清晰 `describe`
- 会拆出子 Schema，而不是全部塞进一个 object

当前仓库很多结构化输出仍写成节点内联 `z.object(...)`，这对小实验可以接受，但不适合长期演进。

---

## 3. 对 agent-core 的优化建议

### 3.1 把 flow 统一改成“阶段目录”

建议把每个 flow 都统一成下面这类结构：

```text
packages/agent-core/src/flows/
├─ chat/
│  ├─ nodes/
│  ├─ prompts/
│  ├─ schemas/
│  ├─ utils/
│  ├─ contracts/
│  └─ index.ts
├─ learning/
│  ├─ nodes/
│  ├─ prompts/
│  ├─ schemas/
│  ├─ utils/
│  └─ index.ts
└─ approval/
   ├─ nodes/
   ├─ prompts/
   ├─ schemas/
   └─ index.ts
```

补充说明：

- `contracts/` 用来放节点输入输出、状态切片、事件映射约束
- `utils/` 只放纯函数，不放模型调用
- `index.ts` 只做导出，不做实现

### 3.2 节点中不再内联 Schema

例如 `manager-node.ts` 里的 `planSchema`，建议提取为：

- `packages/agent-core/src/flows/chat/schemas/manager-plan-schema.ts`

规范建议：

- 每个节点最多依赖一个主输出 Schema
- 子结构单独拆成私有 Schema
- 所有字段必须写 `describe`
- Schema 文件必须同时导出 `zod schema` 和 `infer type`

推荐写法：

```ts
export const ManagerPlanSchema = z.object({ ... });
export type ManagerPlanOutput = z.infer<typeof ManagerPlanSchema>;
```

### 3.3 节点中不再硬编码 system prompt

例如 `research-node.ts` 里的系统提示词，建议提取为：

- `packages/agent-core/src/flows/chat/prompts/research-prompts.ts`

规范建议：

- 一个节点至少拆出 `SYSTEM_PROMPT`
- 如有复杂拼接，再补 `buildUserPrompt()` 或 `buildPromptMessages()`
- 共享提示词约束放到 `shared/prompts`

推荐模式：

```ts
export const RESEARCH_SYSTEM_PROMPT = `...`;

export function buildResearchUserPrompt(input: ResearchPromptInput) {
  return JSON.stringify(input);
}
```

### 3.4 建立“旧 chat flow”到“ministry flow”的迁移策略

建议不要继续直接在 `flows/chat/nodes/*.ts` 里演进新能力，而是：

1. 旧 `manager / research / executor / reviewer` 保持兼容维护。
2. 新增能力优先进入 `flows/ministries/*` 或新的 `flows/supervisor/*`。
3. 在 `graphs/` 或 `workflows/` 层做路由和编排。
4. 文档里明确旧 flow 只做兼容，不再作为首选扩展点。

这一步很关键，否则目录虽有 `ministries`，实际开发还是会回流到旧结构。

### 3.5 为每个节点建立最小测试单元

参考实现虽然主要展示结构，但当前仓库已经进入工程化阶段，建议补这几类测试：

- prompt 组装测试
- schema 解析测试
- fallback 逻辑测试
- 事件映射测试

最少要求：

- 每新增一个结构化节点，就要有一个“模型输出样例 -> schema parse”测试

---

## 4. Prompt 编写规范建议

建议把当前项目的 Prompt 规范收敛成固定模板：

1. 角色定义
2. 任务目标
3. 输入字段说明
4. 决策规则
5. 字段填充规则
6. 输出格式要求
7. 安全约束

建议新增这些规则：

- Prompt 不要在节点里直接写超长模板字符串
- Prompt 必须显式声明输出语言
- Prompt 必须显式声明“只输出符合 Schema 的 JSON”或“只输出最终答复”
- Prompt 中出现枚举值时，必须与 Schema 枚举保持一致
- Prompt 中的字段解释，必须和 `zod describe` 语义一致

反模式：

- prompt 和 schema 各写各的，字段名不一致
- prompt 要求输出 A，schema 却定义成 B
- 节点里夹杂多段 fallback 提示，没有统一出口

---

## 5. Schema 编写规范建议

建议把 Schema 规范提升到“项目级约束”：

- Schema 文件命名统一为 `*-schema.ts`
- 一个文件只定义一个主 Schema
- 子 Schema 可以同文件私有定义
- 所有字段必须带 `describe`
- 枚举优先使用 `z.enum([...])`
- 可空字段明确用 `nullable()`，可选字段明确用 `optional()`
- 对数组字段尽量给出数量约束，如 `min/max`
- 输出给 LLM 的 Schema，不要混入运行时无关字段

建议再补两条：

- 复杂对象优先“分层 Schema”，不要一个 150 行大对象写到底
- 结构化输出先服务编排和校验，不要一开始就做成全领域超大 DTO

---

## 6. 前端规范补强建议

### 6.1 单文件行数上限

建议立刻纳入硬性规范：

- `apps/frontend/*/src` 下手写源码文件，单文件不得超过 400 行
- 超过 400 行，必须拆分组件、hooks、adapter、constants 或 types

拆分优先级：

1. 先拆视图块
2. 再拆状态逻辑
3. 再拆常量映射
4. 再拆类型和 adapter

当前仓库已明显超标的文件：

- `apps/frontend/agent-chat/src/pages/chat-home/chat-home-page.tsx`：1024 行
- `apps/frontend/agent-chat/src/hooks/use-chat-session.ts`：813 行
- `apps/frontend/agent-admin/src/hooks/use-admin-dashboard.ts`：586 行
- `apps/frontend/agent-admin/src/features/runtime-overview/runtime-overview-panel.tsx`：455 行
- `apps/frontend/agent-admin/src/types/admin.ts`：427 行

这说明规则不是“预防未来问题”，而是当前已经需要治理。

### 6.2 页面、面板、hook 的职责边界

建议增加明确限制：

- `page.tsx` 只负责页面装配、路由入口、布局组织
- `panel.tsx` 只负责一个业务面板的展示与交互
- `hook.ts` 只负责状态、请求编排、订阅、派生数据
- `adapter.ts` 只负责服务端数据到 UI 数据的转换
- `constants.ts` 只负责标签、枚举映射、文案映射

不要再把这些内容混到一个页面文件里。

### 6.3 前端目录再细一层

建议在 `features/*` 下允许固定二级结构：

```text
features/chat-thread/
├─ components/
├─ hooks/
├─ adapters/
├─ constants/
├─ types.ts
└─ chat-thread.tsx
```

这样比把所有东西都平铺在 `features/` 下面更利于增长。

### 6.4 事件映射和标签映射独立文件

像 `chat-home-page.tsx` 里的：

- `AGENT_LABELS`
- `EVENT_LABELS`
- `FILTER_OPTIONS`

都不应继续留在页面文件里，建议拆到：

- `features/chat/constants/chat-labels.ts`
- `features/chat/constants/chat-filters.ts`

### 6.5 Hook 进一步拆成“数据层 + 视图层”

像 `use-chat-session.ts` 现在同时处理：

- API 调用
- SSE 订阅
- 本地 optimistic update
- checkpoint 刷新
- session 列表刷新
- 文案映射辅助函数

建议拆成：

- `use-chat-session-query.ts`
- `use-chat-session-stream.ts`
- `use-chat-session-actions.ts`
- `chat-session-selectors.ts`

否则 hook 会继续膨胀成新的“上帝文件”。

---

## 7. 还建议补哪些项目规范

除了 400 行限制，我建议再补下面这些约束。

### 7.1 前端单文件职责数限制

一个前端文件最多承担以下一种主职责：

- 页面装配
- 业务展示
- 状态编排
- 数据适配
- 类型声明
- 常量映射

如果一个文件同时承担 3 种以上职责，哪怕没到 400 行，也建议拆分。

### 7.2 页面文件禁止直接写大量业务常量

页面文件中禁止长期保留：

- 超过 20 行的标签映射表
- 超过 20 行的事件映射表
- 超过 20 行的 mock 数据

这些都应提取。

### 7.3 共享类型优先，前端本地类型只做视图补充

建议明确：

- 能复用 `@agent/shared` 的类型，不要在前端重复定义
- 前端本地 `types/` 只放 UI 衍生类型、表单类型、视图模型

### 7.4 一个组件最多管理一种异步资源

如果一个组件同时直接处理：

- sessions
- messages
- events
- checkpoint

这通常说明它应该拆成容器组件和展示组件。

### 7.5 组件拆分优先按“领域块”而不是“纯视觉块”

例如 `agent-chat` 中，优先拆成：

- `thread`
- `approvals`
- `think`
- `thought-chain`
- `evidence`
- `learning`

而不是只拆成 `left / center / right` 这种纯布局组件。

### 7.6 样式文件也应控制规模

建议同步加一条：

- 前端 CSS 文件同样建议不超过 400 行
- 超过后按页面区块或 feature 拆分

### 7.7 大对象映射优先字典化和模块化

事件类型、状态标签、风险标签、按钮文案这类内容，建议统一放入：

- `constants/`
- `mappers/`

不要散落在页面和 hook 中重复出现。

### 7.8 命名要与产品语义同步

既然当前项目目标是“Supervisor / 六部”，那前端命名也应逐步从：

- `agent-status`
- `event-timeline`

演进到更贴近产品语义的：

- `thought-chain`
- `evidence-panel`
- `runtime-observe`
- `ministry-status`

否则 UI 术语、后端术语、文档术语会长期三套并行。

---

## 8. 推荐的落地顺序

建议按这个顺序推进：

1. 先更新规范文档，把 400 行限制、Prompt/Schema 规则写进去。
2. 再从 `apps/frontend/agent-chat/src/pages/chat-home/chat-home-page.tsx` 开始拆分。
3. 把 `use-chat-session.ts` 拆成 query / stream / actions / selectors。
4. 把 `flows/chat` 的内联 schema 和 prompt 抽出到 `schemas/`、`prompts/`。
5. 新增能力只进入 `ministries / workflows / governance` 新结构，不再扩旧 chat flow。

---

## 9. 一句话结论

这次最值得补的，不是再多写几段 Prompt，而是把“节点逻辑、提示词、Schema、前端页面、前端状态”全部从大文件里拆开，形成稳定的契约边界。参考项目给出的真正启发，是工程结构，而不只是提示词文本本身。
