# Agent Gateway Management Clone Behaviors

状态：current
文档类型：spec
适用范围：`apps/frontend/agent-gateway`
最后核对：2026-05-10

## 已实现行为

- 导航：`NavLink`/button 双模式保持原有测试入口，router 环境下输出真实链接。
- Sticky shell：左侧导航和顶部观测条沿用当前 `GatewayWorkspace` 的 sticky 布局。
- Hover：导航项、命令按钮、信息按钮沿用 160ms 背景/边框/位移过渡。
- 仪表盘动效：`dashboard-background-orbs` 中两个 orb 使用 `dashboard-orb-float` 往返浮动；hero 使用 `dashboard-hero-enter`，watermark 使用 `dashboard-watermark-enter`，统计卡片使用 staggered `dashboard-card-enter`；连接状态点在 connecting 状态使用 `dashboard-pulse`。
- AI 提供商：`/ai-providers` 使用纵向 provider 大卡；每张卡顶部为参考项目 provider SVG + 标题 + 灰色添加按钮，内容区为虚线空状态；底部固定 `provider-floating-nav` 图标浮条，hover 时图标按钮上移 2px。
- 认证文件：`/auth-files` 使用参考项目的筛选 tag rail、filter controls、provider avatar 文件卡片和 sticky 批量操作条；文件卡片 hover 时轻微上移并增强阴影。
- OAuth 登录：`/oauth` 使用 provider 登录卡网格；展示 Codex/Claude/Antigravity/Kimi，初始态只展示说明和开始登录按钮，点击并拿到授权 URL 后才展开授权链接、复制/打开和状态提示区域；Codex/Claude/Antigravity 展示 Callback URL 手动提交，Kimi 展示 device authorization URL 和用户代码；底部 `oauth-policy-strip` 保留 policy 快捷入口。
- 配额管理：`/quota` 使用 provider section stack，每段都有 view mode toggle、刷新全部按钮、认证文件 quota card、进度条和重置时间；下方保留原始 quota table 与编辑面板。
- 中心信息：`/system` 使用 about card 居中 logo/title、四个信息 tile、quick links、模型标签列表和登录/请求日志操作卡；hover tile/link 时轻微上移。
- 配置面板：`useUnsavedChangesGuard(dirty)` 保持未保存变更拦截。
- 系统页：清理本地登录态仍只调用 `clearGatewayRefreshToken()` 或外部 callback，不触碰浏览器 profile、Cookie、IndexedDB 或站点缓存目录。

## 提取限制

`localhost:8317` 当前端口有服务监听，但 `curl` 对 `management.html` 没拿到可读 HTML。此次还原以参考项目源码、现有 agent-gateway 页面和已落地测试为主，没有保存浏览器截图。后续如需要像素级差异，应通过可用浏览器自动化补充 desktop/mobile screenshot。
