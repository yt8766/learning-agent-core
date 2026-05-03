# 样式规范

状态：current
文档类型：convention
适用范围：全部前端应用（`agent-chat`、`agent-admin`、`knowledge`）
最后核对：2026-05-03

## 1. 总原则：Tailwind 优先，Sass 作为最后手段

所有前端应用的样式方案遵循同一优先级：

| 优先级 | 手段                                                          | 适用场景                                                                                                                           |
| ------ | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 默认   | Tailwind utility classes + `tailwind-merge` 合并              | 布局、间距、排版、颜色、响应式、`dark` / `data-*` 变体                                                                             |
| 次选   | Tailwind `@theme` / `@utility` / `@layer` 或极小范围 CSS 片段 | 设计 token 定义、无法用单条 utility 表达的少量规则                                                                                 |
| 最后   | Sass（`.scss`）                                               | 仅当 Tailwind 确实无法表达时：重度嵌套的第三方主题覆盖文件、无法用 `@theme` 合理建模的全局范式、必须与既有 SCSS 资产衔接的过渡代码 |

如果一个样式需求可以用 Tailwind utility 解决，就不要写 `.scss` 或自定义 CSS class。

## 2. 各应用现状与演进

### 2.1 `agent-admin`

- 已接入 Tailwind v4（`@tailwindcss/vite` + `tailwind-merge`）。
- UI 组件层基于 shadcn/ui，自带 Tailwind 变量与 utility。
- 样式入口：`src/styles/index.css`（`@import 'tailwindcss'` + `@import 'shadcn/tailwind.css'`）。
- **规范**：继续以 Tailwind 为主。不要在组件中用大块手写 CSS class 兜底。

### 2.2 `agent-chat`

- 当前样式体系以 Sass（`.scss`）为主，共 13 个 `.scss` 文件。
- 尚未接入 Tailwind。
- **规范**：
  - 新功能、新页面、新组件默认使用 Tailwind utility。后续需为 `agent-chat` 补齐 Tailwind v4 + `@tailwindcss/vite` 工程接入（与 `agent-admin` 对齐版本），以便新代码落地。
  - 存量 `.scss` 允许渐进迁移，不要求单 PR 内全部改写。当触及某个 `.scss` 文件做功能修改时，优先顺手将改动区域迁移到 Tailwind。
  - 新增 `.scss` 文件需要说明为什么 Tailwind 无法满足需求。

### 2.3 `knowledge`

- 当前使用 Ant Design 组件库，样式入口为手写 `knowledge-pro.css`（约 700+ 行）。
- 尚未接入 Tailwind。
- **规范**：
  - Ant Design 负责组件观感（按钮、表单、表格、菜单等），不要用 Tailwind 覆盖 antd 组件内部样式。
  - 页面壳层、自定义布局、间距、排版、响应式、业务卡片等优先使用 Tailwind utility。
  - 与 Ant Design 共存注意事项：
    - Tailwind v4 的 Preflight（CSS reset）会影响 antd 基础样式。接入时应通过 `@layer` 优先级或 Tailwind v4 的 `preflight: false` 配置禁用 Preflight，让 antd 自身的 reset 生效。
    - antd 的 CSS 注入顺序（`ConfigProvider` + 全局 CSS）应保持在 Tailwind `@layer base` 之后，确保 antd 组件样式不被 Tailwind base 覆盖。
  - 存量 `knowledge-pro.css` 允许渐进迁移。新增布局/组件优先 Tailwind。

## 3. 编写规则

### 3.1 class 命名

- Tailwind：直接在 JSX 上写 utility class，不要为了 "看着整洁" 把 utility 挪到 CSS 文件再用自定义 class name 引用。
- 当 utility 列表太长影响可读性时：
  - 优先拆分为子组件。
  - 其次使用 `tailwind-merge` + `clsx` 在变量中组合。
  - 最后才考虑用 `@apply` 提取到 CSS 层（尽量少用）。

### 3.2 Sass 使用约束

- 禁止在新代码中引入 Sass 嵌套超过 3 层。
- 禁止使用 Sass `@extend`（会产生难以预测的选择器膨胀）。
- Sass 变量（`$var`）不要与 Tailwind `@theme` token 重复定义同一设计值。迁移时优先收敛到 Tailwind `@theme`。
- Sass mixin 仅用于 Tailwind 确实无法覆盖的场景（如复杂的 `:nth-child` 组合、`@supports` 分支等）。

### 3.3 文件与结构

- 样式文件不超过 400 行。超过时按页面区块或 feature 拆分。
- Tailwind 为主的应用中，`src/styles/` 目录应尽量薄：只放全局 token、Tailwind 入口和少量无法内联的全局规则。
- 不要创建 `*.module.css` / `*.module.scss`（CSS Modules）。仓库统一用 Tailwind utility 或全局 class 管理作用域。

### 3.4 颜色与 token

- 设计 token（颜色、圆角、字号、间距）优先定义在 Tailwind `@theme` 中，便于在 utility 中直接使用。
- 不要在组件中硬编码 `#hex` 色值或 `px` 魔法数字。使用 Tailwind 的语义化 token 或自定义 token。

### 3.5 响应式

- 使用 Tailwind 断点前缀（`sm:`、`md:`、`lg:` 等），不要在 CSS 中手写 `@media` 查询。
- 移动端优先：默认写移动端样式，用断点前缀逐步覆盖大屏。

### 3.6 暗色模式

- 使用 Tailwind `dark:` 变体，不要在 CSS 中手写 `@media (prefers-color-scheme: dark)` 或 `.dark` 选择器。
- 配合 `@theme` 中的语义色变量，让亮色/暗色切换只需要在根层切换 class 或 `data-theme`。

## 4. Lint 与格式化

- 根级 Prettier 已覆盖 `.css` 和 `.scss` 格式化。
- 后续可选接入 `prettier-plugin-tailwindcss` 实现 class 排序一致化——目前不强制，团队按需启用。

## 5. 交叉引用

- 前端通用约定 → [前端规范](/docs/conventions/frontend-conventions.md)
- JS/TS 代码风格 → [JS/TS 代码风格规范](/docs/conventions/javascript-typescript-style.md)
- 包架构与依赖 → [包架构指南](/docs/conventions/package-architecture-guidelines.md)
