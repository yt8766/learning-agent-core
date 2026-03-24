# 前端规范

适用范围：

- `apps/frontend/agent-chat`
- `apps/frontend/agent-admin`

## 1. 技术边界

- 前端统一使用 `React + TypeScript`
- 组件文件使用 `.tsx`
- 非视图逻辑使用 `.ts`
- 样式默认使用 `.css`
- 不为每个前端应用重复维护一套独立格式化配置

## 2. 应用定位

- `agent-chat`：主聊天入口
- `agent-admin`：观测与运维控制台

禁止：

- 将聊天和运维台职责混在同一页面树中
- 在运维台中承载主聊天体验

## 3. 目录规范

### `agent-chat/src`

- `app/`：应用壳层
- `pages/`：页面级入口
  - `chat-home/`
  - `session-detail/`
- `features/`：业务块
  - `session-list/`
  - `chat-thread/`
  - `event-timeline/`
  - `approvals/`
  - `learning/`
  - `agent-status/`
- `components/`：可复用 UI
- `api/`：HTTP / SSE 封装
- `hooks/`：轮询与订阅逻辑
- `store/`：前端状态管理
- `types/`：前端本地类型
- `assets/`：静态资源
- `styles/`：全局与页面样式

### `agent-admin/src`

- `app/`：应用壳层
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
  - `rules-browser/`
  - `runtime-overview/`
- `components/`：可复用 UI
- `api/`：请求封装
- `hooks/`：轮询与状态逻辑
- `store/`：前端状态管理
- `types/`：前端本地类型
- `styles/`：样式资源

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

- 根级 `eslint.config.mjs`
- 根级 `prettier.config.js`
- 根级 `husky`

不要新增：

- 每个前端应用单独一套 ESLint
- 每个应用单独一套 Prettier
- 大量 UI 规则脚本化配置
