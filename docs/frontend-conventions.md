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

## 8. 前端检查建议

保留：

- 根级 `eslint.config.mjs`
- 根级 `prettier.config.js`
- 根级 `husky`

不要新增：

- 每个前端应用单独一套 ESLint
- 每个应用单独一套 Prettier
- 大量 UI 规则脚本化配置
