# LLM Gateway UI Hydration Notes

状态：current
文档类型：note
适用范围：`apps/llm-gateway`
最后核对：2026-04-25

## 1. 当前结论

`apps/llm-gateway/src/components/app-sidebar.tsx` 必须保持为 Client Component。该 sidebar 使用 `SidebarMenuButton asChild` 组合 Radix Slot、`<a>` 菜单项和图标组件；如果把这个组合留在 Server Component 边界内，Next.js 首屏 HTML 与客户端 hydration 时的 Slot 克隆结果可能不一致，浏览器会报 React hydration mismatch。

当前修复点：

- `app-sidebar.tsx` 顶部保留 `'use client';`
- `apps/llm-gateway/test/app-sidebar-hydration.test.ts` 固定校验该边界，并校验 `ui/sidebar.tsx` 使用 Tailwind v4 可编译的 `w-[var(--sidebar-width)]` / `w-[var(--sidebar-width-icon)]` / `max-w-[var(--skeleton-width)]`
- `apps/llm-gateway/test/home-page.test.tsx` 与 `apps/llm-gateway/test/admin-page-auth-gate.test.tsx` 继续覆盖基于黑白 dashboard-01 改造后的 LLM Gateway 首页 SSR 静态结构、浅灰细边和弱阴影样式

## 2. 后续改动约束

- 不要移除 `app-sidebar.tsx` 的 `'use client';`
- 新增基于 Radix Slot `asChild` 的 sidebar 菜单组合时，优先放在同一个 client 边界内
- 管理员侧边栏的导航语义应与 `agent-admin` 的中文治理台一致，并结合大模型网关真实领域能力：`运行中枢`、`模型中枢`、`服务商中枢`、`凭证中枢`、`日志与成本`、`连接器与策略`、`审批中枢`、`证据中心`。右侧内容区按中心挂载 shadcn 页面组合，不要把 `/admin` 首屏退回旧表单控制台。
- 侧栏页脚账号菜单必须保留退出登录入口；该入口只触发后台 auth logout 与本地 token 清理，不在菜单、提示消息或日志中渲染 access token、refresh token、API key、provider credential 等 secret。
- 桌面端 sidebar 是 fixed 面板 + spacer/gap 组合；不要把 `w-[var(--sidebar-width)]` 回退成 `w-[--sidebar-width]`，后者在 Tailwind v4 会生成无效 CSS 并导致左侧栏遮挡主内容
- 首页视觉按黑白 dashboard-01 收敛，主要外框、sidebar、card、chart 和 table 边界使用浅灰细边，禁止显式 `border-black`，默认关闭重阴影
- 如果未来补 DOM hydration 测试，需要先引入 `jsdom` 或 `happy-dom`，再用 `renderToString` + `hydrateRoot` 捕获 `console.error` 中的 hydration mismatch
- `SidebarMenuSkeleton` 仍包含 `Math.random()`，目前不在首页初始 sidebar 渲染路径；如果未来把 skeleton 放进 SSR 首屏，必须改成由调用方传入稳定宽度或使用 deterministic fallback

## 3. 验证入口

聚焦验证：

```bash
pnpm exec vitest run --config vitest.config.js apps/llm-gateway/test/app-sidebar-hydration.test.ts apps/llm-gateway/test/home-page.test.tsx apps/llm-gateway/test/admin-page-auth-gate.test.tsx
pnpm --dir apps/llm-gateway typecheck
```

涉及文档变更时：

```bash
pnpm check:docs
```
