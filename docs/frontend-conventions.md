# 前端规范

状态：current
适用范围：前端工程规范
最后核对：2026-04-14

适用范围：

- `apps/frontend/agent-chat`
- `apps/frontend/agent-admin`

## 1. 技术边界

- 前端统一使用 `React + TypeScript`
- 组件文件使用 `.tsx`
- 非视图逻辑使用 `.ts`
- 样式默认使用 `.css`
- 不为每个前端应用重复维护一套独立格式化配置
- 前端依赖默认使用静态 `import`，例如 `import { Badge } from '@/components/ui/badge';`

路径别名约束：

- `apps/frontend/agent-chat/src` 与 `apps/frontend/agent-admin/src` 下的手写源码，跨目录引用统一使用 `@/...`
- 例如：
  - `@/hooks/use-chat-session`
  - `@/features/runtime-panel/chat-runtime-drawer`
  - `@/components/ui/button`
- 禁止继续新增这类“指回本应用 `src/`”的相对路径：
  - `../../hooks/use-chat-session`
  - `../../../src/features/runtime-panel/chat-runtime-drawer`
- 允许保留相对路径的场景仅限：
  - 同目录或近邻目录内的局部文件组织，且不跨回 `src` 根语义
  - 非 `src` 根别名覆盖范围外的文件，例如测试 fixtures 之间的局部相对引用
- 测试文件只要引用的是本应用 `src/` 内容，也应统一使用 `@/...`，不要写 `../../../src/...`

动态导入约束：

- 一般不允许使用 `import('xxx')`、`import('xxx').then(...)` 这类动态导入
- 只有在明确的代码分割、浏览器专属重资产加载、或运行时环境隔离场景下才允许动态导入
- 若确需动态导入，必须在代码旁用简短注释说明原因，不能把动态导入当成常规写法
- 通用 UI、业务组件、图表库、Mermaid、表单、状态模块等默认都应使用顶层静态导入
- 不要为了规避类型、懒得整理依赖或临时消除报错而引入动态导入

## 2. 应用定位

- `agent-chat`：主聊天入口
- `agent-admin`：观测与运维控制台

禁止：

- 将聊天和运维台职责混在同一页面树中
- 在运维台中承载主聊天体验

## 3. 目录规范

### `agent-chat/src`

- `app/`：应用壳层
- `api/`：HTTP / SSE 封装
- `components/`：可复用 UI
- `components/chat-message-cards/`：聊天消息卡片与消息内交互组件
- `hooks/`：轮询、订阅与会话驱动逻辑
- `hooks/chat-session/`：会话格式化与会话相关派生逻辑
- `store/`：前端状态管理
- `types/`：前端本地类型
- `lib/`：轻量工具与适配函数
- `assets/`：静态资源
- `styles/`：全局与页面样式
- `pages/`：页面级入口
  - `chat-home/`
  - `session-detail/`
- `features/`：业务块
  - `chat/`
  - `session-list/`
  - `chat-thread/`
  - `event-timeline/`
  - `approvals/`
  - `learning/`
  - `agent-status/`
  - `runtime-panel/`
  - `report-schema/`

### `agent-admin/src`

- `app/`：应用壳层
- `api/`：请求封装
- `components/`：可复用 UI
- `components/ui/`：基础 UI 组件
- `hooks/`：轮询与状态逻辑
- `hooks/admin-dashboard/`：后台面板状态编排
- `store/`：前端状态管理
- `types/`、`types/admin/`：前端本地类型与 admin 聚合类型
- `assets/`：静态资源
- `styles/`：样式资源
- `pages/`：页面级入口
  - `dashboard/`
  - `tasks/`
  - `approvals/`
  - `skills/`
  - `rules/`
- `features/`：业务块
  - `task-traces/`
  - `approvals-center/`
  - `skill-lab/`
  - `skill-sources-center/`
  - `rules-browser/`
  - `runtime-overview/`
  - `learning-center/`
  - `evidence-center/`
  - `connectors-center/`
  - `evals-center/`
  - `archive-center/`
  - `company-agents/`

建议在 `features/*` 下继续按职责细分：

- `components/`：仅负责视图片段
- `hooks/`：仅负责状态和异步编排
- `adapters/`：仅负责 DTO 到 ViewModel 转换
- `constants/`：仅负责标签、枚举、映射和静态配置
- `types.ts`：仅负责该 feature 私有类型

## 4. 状态与数据规范

- API 调用统一封装
- SSE、轮询、订阅逻辑集中管理
- 每个异步动作必须有 `loading / success / error` 状态
- 页面状态和服务端状态要明确区分
- 不要把请求逻辑散落到多个无关组件中

### `try` / `catch` 规范

禁止：

- 空 `catch`：如 `catch {}`、`catch (_e) {}` 且块内无任何语句（仅空白不算有效处理）
- 在 `catch` 内只做无意义的 `// no-op` 却不说明业务理由（与“空吞异常”等价）

要求 `catch` 至少满足其一：

- 记录日志或上报（含 `console` 的 debug/info，或项目统一 logger），或
- 将错误映射为 UI 状态 / `toast` / 返回值，让用户或调用方可知失败原因，或
- 明确的降级分支（例如忽略损坏的本地缓存并复位默认值），并配有简短注释说明为何安全忽略

原则：异常要么可观测，要么在注释中写清“为何在此收窄影响面”；禁止无声失败。

### `useEffect` / 副作用规范

- `useEffect` 默认只做三类事情：
  - 订阅与退订
  - 定时器与清理
  - 当明确依赖变化时触发一次异步同步
- 每个 `useEffect` 都必须能回答两个问题：
  - 它被什么依赖触发
  - 它在什么条件下停止
- 禁止在 `useEffect` 中无条件调用会反过来修改其依赖的 `setState`
- 禁止把新对象、内联函数、`Date.now()`、`Math.random()` 这类不稳定值直接放进依赖数组
- 如果 effect 需要“一次性信号”，必须在消费后立刻清空，不能让旧信号残留到下一轮渲染
- 轮询、SSE fallback、checkpoint refresh 这类副作用必须显式定义停止条件，例如：
  - 会话不再是 `running`
  - 组件卸载
  - 会话 id 变化
  - 已切回主链路订阅
- 禁止多个 effect 对同一资源重复建链；同一类资源连接只能有一个 owner
- 页面切换、会话切换、tab 切换后，不得继续保留上一上下文的轮询、流连接或定时器
- effect 里发请求时，优先先做 `shouldRun` 判定，再进入异步逻辑，避免“先发请求再判断”
- 对 `messages / events / checkpoint / sessions` 这类高频资源：
  - 需要区分初始化加载、手动刷新、运行中同步、fallback 轮询
  - 不能让一次状态恢复同时触发两套以上同步链路
- 对聊天发送链路：
  - `display` 和 `payload` 必须分离
  - slash workflow 命令只能进入接口 `payload`，不能污染用户聊天记录展示
  - 当模式开关已决定 `/browse /review /qa /ship` 时，必须先剥离输入框里残留的同类命令前缀，禁止出现 `/browse /browse ...`
- 对流式链路：
  - 必须区分“手动关闭 stream”和“真正异常断流”
  - 手动关闭或会话切换导致的 `EventSource.close()` 不能触发 fallback 轮询
  - 只有确认会话仍处于 `running` 时，才允许进入 `messages / events / checkpoint` 兜底同步
- 对乐观 UI：
  - 发送消息后，用户消息、assistant 占位、思考态必须先本地出现，再等待后端回写
  - 后续详情同步不得立即覆盖或清空这批乐观状态，除非服务端已经回写了对应正式消息
- 每次更改聊天主链路时，必须保持已有功能语义不退化，至少回归确认：
  - 发送消息后立即出现用户消息与思考占位
  - 同会话续聊直接重连 stream，不先触发详情三连
  - 历史会话切换只做一次初始化详情加载
  - 会话完成后不再继续轮询 `messages / events / checkpoint`
  - 最终答复与来源引用不会重复展示同一份信息

推荐模式：

- 先用 `useMemo` / 派生变量收敛 `shouldRun`
- 再在 effect 中只根据 `shouldRun + stable id` 建立副作用
- effect 内创建的轮询、流、订阅、定时器必须在 `return` 中清理
- effect 如果会触发请求，优先拆成：
  - 条件判断
  - 请求函数
  - 资源清理函数

出现以下现象时，默认先检查 effect 设计：

- 切换会话后接口自动连发
- SSE 断开后 fallback 轮询停不下来
- 一次用户操作触发多次 `messages / events / checkpoint`
- 手动结束后仍持续刷新详情
- 组件没有可见变化，但网络面板持续出现 `304`

## 5. 页面规范

### `agent-chat`

- 左侧：会话列表
- 中间：对话区
- 右侧：事件流、Agent 状态、审批、学习确认
- 风格偏向聊天产品 + LangSmith 风格可观测性

### `agent-admin`

- 任务观测
- 审批中心
- 技能实验区
- 规则浏览
- 系统运行信息

## 6. 文案规范

- 用户文案默认中文
- 代码标识、类型名、变量名保留英文
- 按钮与菜单避免中英混用
- 错误提示优先给用户可操作信息，而不是纯技术堆栈

## 7. 组件规范

- 页面级组件负责布局和页面编排
- 复用组件保持单一职责
- 不要在基础组件里耦合业务 API
- 复杂数据逻辑优先抽到 hooks 或 api 层

补充硬性规则：

- `apps/frontend/*/src` 下手写源码文件单文件不得超过 400 行
- 超过 400 行，必须拆分组件、hooks、adapters、constants 或 types
- 页面文件只负责页面装配，不承载大段映射常量、复杂异步编排和大量内联视图块
- hooks 只负责状态与数据编排，不要同时承载文案映射、组件渲染和大段常量表
- `types.ts` 只放类型定义，不要混入请求逻辑和运行逻辑
- `constants.ts` 只放静态映射，不要混入副作用和业务流程
- hooks 中的 `useEffect` 必须避免形成自激循环；每条 effect 都要有明确触发条件、停止条件和清理逻辑

建议拆分优先级：

1. 先拆页面中的大块视图区域
2. 再拆 hooks 中的流式订阅、请求动作、派生数据
3. 再拆常量映射和 adapter
4. 最后整理 feature 私有类型

当前已超过 400 行的前端文件应优先整改：

- `apps/frontend/agent-chat/src/pages/chat-home/chat-home-page.tsx`
- `apps/frontend/agent-chat/src/hooks/use-chat-session.ts`
- `apps/frontend/agent-admin/src/hooks/use-admin-dashboard.ts`
- `apps/frontend/agent-admin/src/features/runtime-overview/runtime-overview-panel.tsx`
- `apps/frontend/agent-admin/src/types/admin.ts`

补充建议：

- 一个文件最多承担一种主职责：页面装配、业务展示、状态编排、数据适配、类型声明、常量映射
- 一个组件不要直接管理多类异步资源；如果同时处理 `sessions / messages / events / checkpoint`，应拆成容器组件和展示组件
- 大型标签映射、事件映射、风险映射统一提取到 `constants/` 或 `mappers/`
- CSS 文件同样建议不超过 400 行，超过后按页面区块或 feature 拆分

## 8. 前端检查建议

保留：

- 根级 `eslint.config.js`
- 根级 `prettier.config.js`
- 根级 `husky`

不要新增：

- 每个前端应用单独一套 ESLint
- 每个应用单独一套 Prettier
- 大量 UI 规则脚本化配置
