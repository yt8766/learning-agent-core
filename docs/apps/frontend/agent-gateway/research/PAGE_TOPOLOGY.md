# Agent Gateway Management Clone Topology

状态：current
文档类型：spec
适用范围：`apps/frontend/agent-gateway`
最后核对：2026-05-10

参考入口：`http://localhost:8317/management.html#/`、`/config`、`/auth-files`、`/ai-providers`、`/oauth`、`/quota`、`/system`，源码参考 `/Users/dev/Desktop/Cli-Proxy-API-Management-Center`。

## 页面骨架

- 固定左侧导航：白色浮层、浅灰边框、图标 + 文案，当前只暴露 `仪表盘`、`配置面板`、`AI提供商`、`认证文件`、`OAuth登录`、`配额管理`、`中心信息`。
- 顶部观测条：sticky header，展示 `Agent Gateway Console`、观测时间和 runtime badge。
- 内容区：每个管理页面统一使用纯白 page header + 白底卡片/表格主体，视觉为纯白背景、浅灰分割线和轻阴影。
- 交互模型：页面切换由 `react-router-dom` URL 驱动；页面内按钮保留现有 callback props，不在前端持有 vendor raw payload。

## 页面顺序

1. 仪表盘：运行总览、四项统计、连接/路由/代理边界。
2. 配置面板：`config.yaml` raw editor、diff、save、reload。
3. AI 提供商：Gemini、Codex、Claude、Vertex、OpenAI 兼容、Ampcode 桥接。
4. 认证文件：批量操作、记录修补、浏览控制。
5. OAuth 登录：Codex/Claude/Antigravity/Kimi 授权登录、callback 或 device code、status polling、policy shortcut。
6. 配额管理：策略编辑表单和 quota table。
7. 管理中心信息：版本、链接、请求日志、本地登录态清理和模型分组。

## 响应式

- > = 1040px：仪表盘 4 列统计，provider/OAuth 2 列卡片，信息区 3 列。
- < 1040px：主体卡片降为 2 列。
- < 700px：hero、统计、卡片、信息区全部单列，状态胶囊撑满宽度。
