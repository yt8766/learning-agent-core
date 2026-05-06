# Frontend Vercel React Refactor Design

状态：snapshot
文档类型：plan
适用范围：`apps/frontend/agent-admin`、`apps/frontend/agent-chat`、`apps/frontend/codex-chat`、`apps/frontend/knowledge`
最后核对：2026-05-05

## 背景

本设计基于仓库技能 [vercel-react-best-practices](/.agents/skills/vercel-react-best-practices/SKILL.md) 对前端应用的只读检查结果。当前仓库没有发现 Next.js 前端应用，因此本轮设计主要面向 React + Vite SPA 场景；Next.js server-side 规则暂不作为实施范围。

检查发现的问题集中在几类横向能力：

1. `agent-admin` 与 `knowledge` 缺少路由级或页面级代码分割，低频页面、图表、流程画布等重型模块会进入首屏静态 bundle。
2. `knowledge` 已经有 `QueryClient`，但主要数据 hooks 仍手写 `loading / error / reload / requestIdRef / mountedRef`，没有统一使用 React Query 的请求去重、缓存和 invalidation。
3. `knowledge` observability 首屏存在可优化的异步瀑布流。
4. `agent-admin` 初始化刷新链路存在部分瀑布流和重复触发风险。
5. `agent-chat` 部分 memo 依赖整个 `chat` facade，实际容易随每次 render 重算。
6. `knowledge` token storage 多次同步读取 `localStorage`，且缺少版本化 schema。
7. 若干高频 projection helper 存在低优先级数组链式遍历和重复排序。

本设计选择“分层分阶段治理”：先收敛横向能力，再按应用落地，避免每个应用各自修出一套模式。

## 目标

1. 让低频页面、中心面板、图表和流程画布从首屏 bundle 中拆出。
2. 将 `knowledge` 列表、详情、observability、evals、governance 等数据请求收敛到 React Query。
3. 缩窄 `agent-chat` 与 `agent-admin` 中高频派生数据的 memo 依赖，减少不必要重算。
4. 拆分 `codex-chat` 的大文件和混合职责，让 shell 只做装配。
5. 为 `knowledge` token storage 建立版本化、可迁移、可缓存的本地存储边界。
6. 每个阶段都能独立验证、独立提交、独立回滚。

## 非目标

- 不在本轮引入 Next.js，也不将 Vite SPA 迁移到 Next.js。
- 不重做 `agent-chat`、`agent-admin`、`knowledge` 或 `codex-chat` 的视觉风格。
- 不改变后端 API 契约。
- 不把所有前端请求或状态统一抽成新的共享包。
- 不在同一阶段同时重写聊天主链路和后台治理台刷新主链路。
- 不用代码分割规避正常静态导入规范；动态导入只用于明确的代码分割、重型浏览器模块和低频页面加载。

## 设计原则

### 横向能力先统一

代码分割、query key、错误边界、storage schema、projection helper 等能力先定义统一落点，再分别应用到各前端。避免 `agent-admin`、`knowledge` 和 `agent-chat` 各自形成不兼容的局部模式。

### 保持外部接口稳定

`knowledge` 的现有页面 hooks 优先保留当前返回结构，例如 `loading`、`error`、`reload`、`documents`。内部可以迁移到 React Query，但页面组件不应在同一阶段被迫大面积重写。

### 重构必须可回滚

每个阶段独立提交。阶段 1 的 lazy registry 可以退回静态 import；阶段 2 的 query 化可以按 hook 回退；阶段 3 的 projection 优化可以按页面回退；阶段 4 的 storage 新格式必须兼容旧格式。

### 聊天主链路不退化

`agent-chat` 的重渲染优化只缩窄依赖和提炼 projection，不改变发送、stream、checkpoint、审批、来源引用、思考态等用户可见语义。

## 阶段 1：Bundle 分割与重型依赖延迟加载

### 范围

- `apps/frontend/agent-admin`
- `apps/frontend/knowledge`

### 目标

- 低频页面、中心面板、图表、流程画布不再全部进入首屏 bundle。
- 对 `recharts`、`@xyflow/react`、低频 center panel 做明确代码分割。
- 动态导入只出现在代码分割或重资产加载场景，并在代码旁说明原因。

### `knowledge` 设计

`knowledge` 采用“路由级 lazy + 重型组件局部 lazy”的组合。

`KnowledgeRoutes` 保持现有路由语义。首屏高频页面可以保留同步导入；低频页面改为 lazy registry：

- `ChatLabPage`
- `AgentFlowPage`
- `ObservabilityPage`
- `EvalsPage`
- Settings 子页
- 账号、用户、异常页等低频页面

`AgentFlowCanvas` 带有 `@xyflow/react`，即使 `AgentFlowPage` 已 lazy，也应继续作为重型画布局部 lazy。这样 toolbar、属性面板等轻量 UI 不被画布依赖绑定。

### `agent-admin` 设计

`agent-admin` 当前是 `DashboardPage + renderDashboardCenter` 的中心切换模式，不先重写路由。采用 center lazy registry：

```text
dashboard-center-content
  -> center loader registry
  -> lazy center boundary
  -> concrete center panel
```

优先 lazy 的中心：

- `runtime`
- `evals`
- `knowledge-governance`
- `workflow-lab`
- `company-agents`
- `archive`

图表密集区再拆成 chart section lazy，例如 runtime analytics 图表和 evals 图表。进入 runtime center 时，不应立即加载所有图表代码。

### 错误边界

每个 lazy route 或 lazy center 使用轻量 `Suspense` 和 error boundary：

```text
LazyBoundary
  loading: skeleton / loading state
  error: 模块加载失败提示 + 重试按钮
```

加载失败不能空吞。错误提示至少说明“模块加载失败，请刷新或重试”，并通过 retry key 触发重新加载。

### 成功标准

- 首屏入口不再静态引入所有低频页面。
- 图表和 flow canvas 只在对应页面或面板激活时加载。
- `knowledge` 与 `agent-admin` 类型检查、构建和相关 render 测试通过。

## 阶段 2：`knowledge` 数据请求治理

### 范围

- `apps/frontend/knowledge/src/hooks/*`
- `apps/frontend/knowledge/src/api/*`

### 目标

- 把手写 `loading / error / reload / requestIdRef / mountedRef` 的列表和详情查询迁到 React Query。
- 建立统一 query keys、staleTime、错误语义和 invalidation 规则。
- mutation 后用 query invalidation 或受控 optimistic update，不再手写串联 reload。

### Query 边界

新增或整理 `knowledge/src/api/knowledge-query.ts`，作为唯一 query key 与 query option 落点：

```text
knowledge-query.ts
  queryKeys
  queryOptions
  mutation invalidation helpers
```

建议 query key：

- `knowledgeQueryKeys.dashboardOverview()`
- `knowledgeQueryKeys.knowledgeBases()`
- `knowledgeQueryKeys.knowledgeBase(knowledgeBaseId)`
- `knowledgeQueryKeys.documents({ knowledgeBaseId })`
- `knowledgeQueryKeys.document(documentId)`
- `knowledgeQueryKeys.observabilityMetrics()`
- `knowledgeQueryKeys.traces()`
- `knowledgeQueryKeys.trace(traceId)`
- `knowledgeQueryKeys.evalDatasets()`
- `knowledgeQueryKeys.evalRuns()`
- `knowledgeQueryKeys.evalRunComparison({ baselineRunId, candidateRunId })`
- `knowledgeQueryKeys.workspaceUsers()`
- `knowledgeQueryKeys.settingsModelProviders()`
- `knowledgeQueryKeys.settingsApiKeys()`
- `knowledgeQueryKeys.settingsStorage()`
- `knowledgeQueryKeys.settingsSecurity()`
- `knowledgeQueryKeys.chatAssistantConfig()`

### Hook 兼容 facade

现有 hooks 继续作为页面 facade：

```text
useKnowledgeDocuments()
  -> useQuery(documents)
  -> useMutation(upload/delete/reprocess)
  -> invalidate documents query
  -> 返回旧结构 { loading, error, documents, reload, ... }
```

第一阶段 query 化不强迫页面组件直接消费 `useQuery`，避免 UI 与数据层一起大改。

### Observability 数据流

`useKnowledgeObservability` 拆成两个查询层：

1. metrics + traces 并发查询。
2. trace detail 单独 query，由 selected trace id 驱动。

如果已有 selected trace id，trace detail 可以独立请求，不必总是等待 traces 完成后才开始。没有 selected trace id 时，首个 trace detail 仍依赖 traces 结果。

### 成功标准

- 重复挂载同一数据源时请求可去重。
- 页面切换时保留合理缓存，不出现明显重复 loading。
- mutation 后相关列表和详情能刷新。
- hook 外部返回结构兼容原页面用法。

## 阶段 3：重渲染与热路径治理

### 范围

- `apps/frontend/agent-chat`
- `apps/frontend/agent-admin`
- 少量 `apps/frontend/knowledge`

### 目标

- 消除依赖整个对象的 memo，例如 `props.chat` 或 `chat` 整体依赖。
- 把高频派生数据改为具体字段依赖或稳定 selector。
- 对高频事件流的 `filter().map()`、重复 sort、重复查找建立小型 projection helper。

### `agent-chat` 设计

不改变聊天主链路语义。优先把派生函数改成接收明确字段：

```text
buildThoughtItems({ checkpoint, events, messages })
buildQuickActionChips({ activeSession, checkpoint, isRequesting })
```

`useChatSession` 暂不大改底层 bridge。可在返回前稳定一层 view model；如果某些 actions 不能轻易稳定，不强行用 memo 包装。调用方优先依赖具体字段，而不是依赖整个 facade。

必须保持：

- 发送后立即出现用户消息与 assistant 思考占位。
- stream 手动关闭不触发 fallback。
- 会话完成后停止轮询。
- 历史会话切换只初始化加载一次。
- 最终答复和来源引用不重复。

### `agent-admin` 设计

`useAdminDashboard` 保留当前 refresh action 的 dedup 和 throttle，但减少重复 effect 触发。将“页面变化”和“过滤器变化”收敛成一个 refresh intent：

```text
refreshIntent = { page, runtimeFilters, approvalFilters, evalFilters }
useEffect(refresh active center by intent)
```

这样避免 runtime 页同时被 page effect 和 runtime filter effect 命中。

### 热路径 helper

只处理已确认高频的数据投影，不新建泛化工具库。候选包括：

- `agent-chat` event card projection。
- `agent-chat` agent tool event projection。
- `agent-admin` connectors summary。
- `agent-admin` runtime overlay support。

每个 helper 用现有测试夹住。

### 成功标准

- memo 依赖更窄，不因 facade 对象变化而全量重算。
- 聊天主链路测试继续通过。
- 高频 projection helper 有最小单测。

## 阶段 4：小应用和基础设施清理

### 范围

- `apps/frontend/codex-chat`
- `apps/frontend/knowledge/src/api/token-storage.ts`
- P3 级别数组热路径

### 目标

- 拆分 `codex-chat-shell.tsx`，解决大文件和职责混杂。
- `knowledge` token storage 改为版本化单 key schema，并缓存一次读取结果，减少同步 storage 访问。
- 顺手收敛低优先级数组链式遍历问题。

### `codex-chat` 拆分设计

`codex-chat-shell.tsx` 当前同时承载事件解析、标题生成、会话 CRUD、stream 绑定、审批回复和布局渲染。目标是 shell 只装配。

建议结构：

```text
src/components/codex-chat-shell.tsx
src/components/codex-chat-layout.tsx
src/hooks/use-codex-chat-session.ts
src/runtime/codex-chat-events.ts
src/runtime/codex-chat-stream.ts
src/runtime/codex-chat-title.ts
src/runtime/codex-chat-message.ts
```

拆分顺序：

1. 搬纯函数：事件解析、标题 sanitize、message sync。
2. 抽 stream 管理 hook。
3. 抽 session actions：create、delete、rename、send、approve、reject。
4. shell 只接状态和渲染 layout。

成功标准：

- `codex-chat-shell.tsx` 降到 400 行以内。
- 纯函数都有测试。
- stream 行为和原 UI 行为保持一致。

### Token storage 设计

`knowledge` token storage 改成单 key 版本化结构：

```ts
const storedTokens = {
  version: 1,
  accessToken,
  refreshToken,
  accessTokenExpiresAt,
  refreshTokenExpiresAt
};
```

兼容读取旧 4-key 格式。读到旧格式后可以迁移写回新格式。损坏值清理并返回 unauthenticated。`AuthClient` 内部缓存当前 tokens，login、refresh、clear 时更新缓存，减少每次请求前多次同步读 storage。

### 成功标准

- 新格式可读写。
- 旧格式可读并可迁移。
- 损坏值安全清理。
- refresh token 过期继续触发原 `onAuthLost`。

## 测试与验证

### 阶段 1

- `knowledge`：补 route render 测试，确认 lazy 页面能进入。
- `agent-admin`：补 center 切换测试，确认 lazy center 能显示。
- 用构建产物确认重型模块拆 chunk。

建议命令：

```bash
pnpm --dir apps/frontend/knowledge typecheck
pnpm --dir apps/frontend/knowledge build
pnpm --dir apps/frontend/agent-admin typecheck
pnpm --dir apps/frontend/agent-admin build
```

### 阶段 2

- 为 `knowledge-query.ts` 补 query key 和 invalidation 单测。
- 修改现有 hook 测试，覆盖首次加载、成功映射、失败映射、mutation 后刷新、observability detail query。

建议命令：

```bash
pnpm --dir apps/frontend/knowledge typecheck
pnpm --dir apps/frontend/knowledge turbo:test:unit
pnpm --dir apps/frontend/knowledge build
```

### 阶段 3

- `agent-chat`：复用或补充 chat-home / use-chat-session 测试，确认主链路不退化。
- `agent-admin`：补 `useAdminDashboard` refresh intent 测试。
- projection helper 补纯函数测试。

建议命令：

```bash
pnpm --dir apps/frontend/agent-chat typecheck
pnpm --dir apps/frontend/agent-chat turbo:test:unit
pnpm --dir apps/frontend/agent-admin typecheck
pnpm --dir apps/frontend/agent-admin turbo:test:unit
```

### 阶段 4

- `codex-chat`：事件解析、title sanitize、message sync 纯函数测试。
- `knowledge`：token storage 新旧格式、损坏清理、过期判断测试。

建议命令：

```bash
pnpm --dir apps/frontend/codex-chat typecheck
pnpm --dir apps/frontend/codex-chat build
pnpm --dir apps/frontend/knowledge turbo:test:unit
```

纯文档设计阶段至少执行：

```bash
pnpm check:docs
```

## 回滚策略

- 阶段 1：lazy registry 可退回静态 import，不影响 API 和数据层。
- 阶段 2：保留 hook 外部接口，Query 化出问题时可以单 hook 回退。
- 阶段 3：projection helper 和 memo 依赖调整按小块提交，出现行为退化时回退对应页面或 hook。
- 阶段 4：`codex-chat` 先搬纯函数，再抽 stream hook。stream 异常时只回退 stream hook。token storage 保留旧格式读取，必要时可以继续写旧格式直到验证稳定。

## 建议交付顺序

1. `knowledge` 路由 lazy + `agent-admin` center lazy。
2. `agent-admin` 图表与 `knowledge` flow canvas 延迟加载。
3. `knowledge-query.ts` 与 dashboard/documents hooks。
4. `knowledge` observability/evals/governance hooks。
5. `agent-chat` memo 依赖和 projection helper。
6. `agent-admin` refresh intent 收敛。
7. `codex-chat-shell` 拆分。
8. `knowledge` token storage 与 P3 热路径清理。

该顺序保证每一步都有可验证收益，也避免把聊天主链路和后台治理台刷新主链路同时搅动。

## 设计自检

- 本设计没有改变后端 API 契约，不需要先新增接口文档。
- 每个阶段有明确范围、验证命令和回滚点。
- 动态导入只用于代码分割、低频页面和重型浏览器模块，符合前端规范例外条件。
- `agent-chat` 主链路被明确标记为不改变语义。
- `knowledge` hooks 以兼容 facade 迁移，避免页面和数据层同阶段大改。
