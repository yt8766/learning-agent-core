# Knowledge Ant Design Pro UI

状态：current
文档类型：reference
适用范围：`apps/frontend/knowledge`
最后核对：2026-05-01

`apps/frontend/knowledge` 是独立的知识库治理控制台。当前前端采用 Ant Design 组件体系实现 Ant Design Pro 风格的信息架构，但不引入完整 Pro 脚手架，避免把轻量 Vite 应用迁成另一套运行时。顶部栏、左侧栏与 Welcome 首页参考 `https://preview.pro.ant.design/welcome/` 的结构和交互：白色固定顶栏、浅色固定侧栏、右侧内容独立滚动、圆形侧栏收起按钮、`ProUser` 头像入口与 Welcome Cheatsheet 内容。壳层品牌和导航已按 knowledge 项目语义替换，不再展示 Ant Design Pro 模板菜单与顶部工具图标。

## 当前入口

- 应用入口：`apps/frontend/knowledge/src/app/App.tsx`
- Pro 风格壳层：`apps/frontend/knowledge/src/app/layout/app-shell.tsx`
- 账号设置页：`apps/frontend/knowledge/src/pages/account/account-settings-page.tsx`
- 账号状态：`apps/frontend/knowledge/src/pages/account/account-store.ts`
- 聊天请求 hook：`apps/frontend/knowledge/src/hooks/use-knowledge-chat.ts`
- 前端 API client：`apps/frontend/knowledge/src/api/knowledge-api-client.ts`
- 全局样式：`apps/frontend/knowledge/src/styles/knowledge-pro.css`
- 构建分包：`apps/frontend/knowledge/vite.config.ts`
- mock 数据：`apps/frontend/knowledge/src/api/mock-data.ts`
- clone 研究资料：`docs/research/preview-pro-ant-design/`
- clone 截图：`docs/design-references/preview-pro-ant-design/`

## 页面结构

- 顶部栏：全宽白色固定 header，包含 `Knowledge 知识库控制台` 项目品牌与 `ProUser` 操作区；顶部不再放置文档、源码、语言三个模板图标。
- 左侧栏：浅色固定侧栏，导航使用项目真实视图：`总览`、`知识库`、`文档`、`对话实验室`、`观测中心`、`评测中心`、`设置`。
- 折叠按钮：侧栏右侧的圆形按钮可点击收起和展开，展开宽度为 `256px`，收起宽度为 `72px`，按钮无独立触发器栏。
- 滚动模型：`Header` 与 `Sider` 固定，应用根容器禁止整体滚动，只允许右侧 `Content` 区域滚动。
- 路由：使用 `react-router-dom`。当前页面路径包括 `/`、`/knowledge-bases`、`/documents`、`/chat-lab`、`/observability`、`/evals`、`/settings`、`/account/settings`、`/exception/403`、`/exception/404`、`/exception/500`，未知路径进入 404；异常路径不映射为侧栏选中态。
- 用户菜单：`ProUser` hover 后只展示 `个人设置` 与 `退出登录`；个人设置进入 `/account/settings`，退出登录触发当前登录态清理。
- `总览`：展示 knowledge 项目自身的 `Knowledge 运行总览`，覆盖知识库空间、已治理文档、检索命中率、对话实验、文档摄取、检索质量、链路状态、观测中心、评测中心与治理策略；顶部通过 `echarts-for-react` 展示 `检索质量趋势` 和 `文档摄取趋势`，不再使用 Ant Design Pro 官方示例内容。
- `知识库`：用 `Table` 管理知识库状态、标签、文档数、chunk 数和最新评测分。
- `文档`：用 `Table` 展示文档来源、处理状态、分块和向量化进度，并保留命中片段预览。
- `对话实验室`：使用 `@ant-design/x` 的 `Conversations`、`Welcome`、`Bubble.List` 和 `Sender` 实现 RAG 问答验证台；使用 `@ant-design/x-sdk` 维护会话列表，使用 `@ant-design/x-markdown` 展示大模型返回的 Markdown。
- `观测中心`：用 `Statistic` 与 `Timeline` 展示 trace、延迟、命中、引用和阶段耗时。
- `评测中心`：用 `Card`、`Table`、`Progress` 展示评测集和运行记录。
- `设置`：用 `Form`、`Select`、`Input`、`Switch` 展示默认向量库与治理策略。
- `个人设置`：用 `Form`、`Upload`、`Avatar` 与 `Input.Password` 提供头像、名称与密码修改入口；头像与名称通过 `zustand` 本地状态同步到顶部 `ProUser`。

当前 `知识库`、`文档`、`对话实验室`、`观测中心` 与 `评测中心` 页面已通过 `KnowledgeApiProvider` 接入前端 API client；mock 模式仍通过同一 provider 注入，不再在页面内直接实例化 mock client 或直接读取 mock 数据。前端请求层默认使用 `axios@1.13.6`，页面请求状态通过 `@tanstack/react-query` 管理。

- `异常页`：`apps/frontend/knowledge/src/pages/exceptions` 提供 `ForbiddenPage`、`NotFoundPage`、`ServerErrorPage` 与共用 `ExceptionPage`，按 Ant Design Pro 异常页结构展示左侧插画、右侧状态码/说明/主按钮，并已接入 `/exception/403`、`/exception/404`、`/exception/500`。异常页只在显式异常路由、未知路径或后续错误边界触发时显示，不出现在左侧栏菜单和顶部用户菜单中。

## 异常页资源

- 插画资源固定放在 `apps/frontend/knowledge/public/pro-exception-assets/`，当前包含 `403.svg`、`404.svg`、`500.svg`。
- 组件通过 `/pro-exception-assets/<status>.svg` 引用静态资源，不引入额外运行时依赖，也不从页面组件内动态下载远端资源。
- 异常页样式只使用 `knowledge-pro.css` 中的 `.knowledge-pro-exception*` class，确保可直接嵌入当前固定 Header/Sider 的内容区，也可被后续路由单独作为整页内容挂载。

## 依赖边界

`knowledge` 前端直接依赖：

- `antd`
- `@ant-design/icons`
- `@ant-design/x`
- `@ant-design/x-markdown`
- `@ant-design/x-sdk`
- `echarts`
- `echarts-for-react`
- `react-router-dom`
- `zustand`
- `@tanstack/react-query`
- `axios@1.13.6`

这些依赖只用于 `knowledge` 前端 UI、路由、会话状态与请求边界。后端协议、知识库 contract、mock API client 和 `packages/knowledge` 运行时边界不因本 UI 改造发生变化。

## 后续约束

- 新增 knowledge 页面时优先复用 `PageSection` 与 Ant Design 基础组件。
- 壳层视觉以 Ant Design Pro Welcome 预览页为参考，但导航语义必须保持 knowledge 项目自身结构；修改顶部栏或侧栏时，必须保留项目品牌、`ProUser`、浅色菜单、右侧圆形折叠按钮、固定 Header/Sider 和右侧内容独立滚动。
- 对话类能力优先使用 `@ant-design/x`，不要退回手写 textarea + button。
- 大模型回答 Markdown 必须通过 `@ant-design/x-markdown` 渲染；会话列表、活跃会话和后续请求编排优先复用 `@ant-design/x-sdk`。
- 页面请求优先通过 `@tanstack/react-query` 封装状态，通过 `axios` 进入 `KnowledgeApiClient`；测试或 mock 场景仍可向 client 注入兼容 fetcher。
- 文档列表等分页接口在进入 React state 前必须先校验 `items` 数组，避免 dev server fallback、代理错误或非 JSON 响应被当成成功数据后触发页面白屏。
- 路由必须通过 `react-router-dom` 表达真实 URL，不要再用只有内存状态的页面切换代替路径变化。
- 异常页属于错误状态展示，不属于业务导航；不要把 `403/404/500` 加入左侧栏、菜单 key 映射或隐藏可访问导航文本。
- 用户资料这类前端局部状态优先进入 `zustand` store，不要散落到壳层组件本地状态。
- 前端静态导入仍是默认规则；只有明确需要代码分割或浏览器专属重资产时才使用动态导入。当前 `ChatLabPage` 使用顶层静态导入接入 `@ant-design/x` 组件。
- `vite.config.ts` 复用与 `agent-chat` 同类的 vendor manual chunks，避免 Ant Design 与 React 依赖全部进入首屏业务 chunk。
- 后续新增真实 API 字段、页面动作或批量工作流时，先更新接口文档和 schema，再扩展 provider client 与页面 hook。

## 验证

常规改动优先运行：

```bash
pnpm --dir apps/frontend/knowledge test
pnpm --dir apps/frontend/knowledge typecheck
pnpm --dir apps/frontend/knowledge build
pnpm check:docs
```
