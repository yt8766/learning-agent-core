# JavaScript / TypeScript 代码风格规范

状态：current
文档类型：convention
适用范围：全仓手写源码（`.ts`、`.tsx`、`.js`、`.mjs`）
最后核对：2026-05-03

## 1. 外部参考

本仓库的代码风格建立在两份业界主流指南之上：

- [Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html)（Google 已建议迁移到 [TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)）
- [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)（TypeScript 变体参见 [eslint-config-airbnb-typescript](https://github.com/iamturns/eslint-config-airbnb-typescript)）

两份指南覆盖了命名、变量声明、控制结构、模块化、注释、异步处理等基本面。团队编写新代码时应以这两份指南为默认参考；当指南之间存在分歧时，以本文档与仓库工具链为准。

## 2. 权威顺序

当外部指南与仓库配置冲突时，优先级从高到低为：

1. [AGENTS.md](/AGENTS.md) 中的硬性工程约束
2. 仓库 [eslint.config.js](/eslint.config.js)、[prettier.config.js](/prettier.config.js)、各 `tsconfig*.json` 的实际规则
3. [前端规范](/docs/conventions/frontend-conventions.md)、[后端规范](/docs/conventions/backend-conventions.md) 等仓库级文档
4. 本文档对 Google / Airbnb 的引用摘要
5. Google / Airbnb 原文

也就是说：工具链报错以工具链为准，不因为"Airbnb 没有这条"而关闭规则；同样，工具链没有覆盖的良好实践仍以本文档和外部指南为补充。

## 3. 核心约定

### 3.1 TypeScript 优先

本项目是 TypeScript 仓库。所有新增手写源码默认使用 `.ts` / `.tsx`。

- 优先让编译器推导类型，避免冗余类型注解。
- 减少 `any` 使用。当前 ESLint 对 `@typescript-eslint/no-explicit-any` 为 `off`（历史原因），但新代码应优先使用具体类型、`unknown` 或泛型约束。
- 稳定公共 contract 必须 schema-first（`zod` schema + `z.infer`），详见 [project-conventions.md](/docs/conventions/project-conventions.md)。

### 3.2 变量与常量

参考：[Airbnb §2 References](https://github.com/airbnb/javascript#references)、[Google §5.1](https://google.github.io/styleguide/jsguide.html#features-local-variable-declarations)

- 默认使用 `const`。只在确需重新赋值时使用 `let`。禁止 `var`。
- 一次声明一个变量，不要用逗号合并多个声明。

### 3.3 命名

参考：[Airbnb §23 Naming Conventions](https://github.com/airbnb/javascript#naming-conventions)、[Google §6.1–6.2](https://google.github.io/styleguide/jsguide.html#naming-rules-common-to-all-identifiers)

| 目标                     | 风格                                 | 示例                         |
| ------------------------ | ------------------------------------ | ---------------------------- |
| 局部变量、函数、方法     | `camelCase`                          | `fetchUserProfile`           |
| 类、接口、类型别名、枚举 | `PascalCase`                         | `ChatSession`                |
| 常量（模块级不可变值）   | `UPPER_SNAKE_CASE`                   | `MAX_RETRY_COUNT`            |
| 文件名                   | `kebab-case`                         | `chat-session.ts`            |
| React 组件文件           | `kebab-case`（导出名 `PascalCase`）  | `chat-home-sidebar.tsx`      |
| 布尔变量/属性            | `is` / `has` / `should` / `can` 前缀 | `isLoading`、`hasPermission` |

避免单字符变量名，除了常规循环索引（`i`、`j`）和极短的回调参数（`(x) => x * 2`）。

### 3.4 函数

参考：[Airbnb §7 Functions](https://github.com/airbnb/javascript#functions)、[Google §5.5](https://google.github.io/styleguide/jsguide.html#features-functions)

- 优先使用箭头函数，尤其是回调和内联函数。
- 保持函数短小、单一职责。如果一个函数超过 40 行，考虑拆分。
- 参数数量超过 3 个时，优先使用 options 对象（对象解构），便于扩展与阅读。
- 不要在参数上做副作用式的变更（mutate）。

### 3.5 对象与数组

参考：[Airbnb §3 Objects](https://github.com/airbnb/javascript#objects)、[Airbnb §4 Arrays](https://github.com/airbnb/javascript#arrays)

- 使用字面量创建对象和数组，不要使用 `new Object()` / `new Array()`。
- 优先使用扩展运算符（`...`）进行浅拷贝和合并。
- 对象属性使用简写（shorthand）。
- 解构赋值优先于逐个属性读取。

### 3.6 模块与导入

参考：[Airbnb §10 Modules](https://github.com/airbnb/javascript#modules)、[Google §3.4](https://google.github.io/styleguide/jsguide.html#es-modules)

- 使用 ES Module（`import` / `export`），不要使用 `require` / `module.exports`。
- 默认使用命名导出（named export）；避免 default export（与 Google 指南一致）。
- 导入分组顺序：外部库 → `@agent/*` 包 → 应用内部（`@/...`）→ 相对路径，组间空行分隔。
- 动态导入、路径别名、深层导入限制等见 [前端规范](/docs/conventions/frontend-conventions.md)。

### 3.7 字符串

参考：[Airbnb §6 Strings](https://github.com/airbnb/javascript#strings)、[Google §5.3](https://google.github.io/styleguide/jsguide.html#features-string-literals)

- 默认使用单引号（与 Prettier `singleQuote: true` 对齐）。
- 需要插值时使用模板字符串（`` ` ``），不要用字符串拼接。
- 不要在字符串中使用不必要的转义。

### 3.8 相等比较

参考：[Airbnb §15 Comparison Operators](https://github.com/airbnb/javascript#comparison--operators)、[Google §5.10](https://google.github.io/styleguide/jsguide.html#features-equality-checks)

- 始终使用 `===` 和 `!==`，不要使用 `==` 和 `!=`。
- 对 `null` / `undefined` 的合并判断，优先使用 `??`；需要"falsy 兜底"时才用 `||`。

### 3.9 控制结构

参考：[Airbnb §16 Blocks](https://github.com/airbnb/javascript#blocks)、[Google §5.6](https://google.github.io/styleguide/jsguide.html#features-control-structures)

- `if`、`for`、`while` 等必须使用花括号，即使只有一行。
- 优先 early return 减少嵌套深度。
- `switch` 中每个 `case` 分支必须有 `break`、`return` 或明确的 fall-through 注释。

### 3.10 异步与错误处理

参考：[Airbnb §25 Async](https://github.com/airbnb/javascript#async-await)

- 优先使用 `async / await` 而非原始 `.then()` 链。
- `try / catch` 中 `catch` 块不允许为空。必须至少记录日志、映射为用户可见状态或写明降级理由。详见 [前端规范 §4 try/catch 规范](/docs/conventions/frontend-conventions.md)。
- 不要用 `try / catch` 包裹 `interrupt()` 调用，详见 [Runtime Interrupts](/docs/packages/runtime/runtime-interrupts.md)。

### 3.11 注释

参考：[Airbnb §18 Comments](https://github.com/airbnb/javascript#comments)、[Google §7](https://google.github.io/styleguide/jsguide.html#jsdoc)

- 只在代码本身无法表达意图时写注释。
- 不要写「将 x 赋给 y」这类复述代码逻辑的注释。
- `TODO` 注释必须附带上下文：谁、为什么、何时移除或完成。
- JSDoc 仅在公共 API、复杂泛型签名或需要工具提示的场景下使用；内部 helper 不强制 JSDoc。
- 工具方法若承担跨边界转换、兼容兜底、缓存 key、重试、脱敏、排序/去重或事件投影语义，应补一段短注释说明调用契约、不可破坏语义或常见误用；注释面向 AI/维护者理解边界，不复述实现步骤。

### 3.12 类

参考：[Airbnb §9 Classes](https://github.com/airbnb/javascript#classes--constructors)、[Google §5.4](https://google.github.io/styleguide/jsguide.html#features-classes)

- 优先使用函数式 / 组合式设计（plain objects + functions）。
- 当确需类时：使用 `class` 语法、不直接修改 `prototype`；遵循 single responsibility。

## 4. 格式化

格式化由 Prettier 统一处理，不需要人工关注。当前关键配置：

| 选项            | 值        |
| --------------- | --------- |
| `printWidth`    | 120       |
| `singleQuote`   | `true`    |
| `trailingComma` | `'none'`  |
| `arrowParens`   | `'avoid'` |
| `endOfLine`     | `'lf'`    |

不要在代码审查中讨论格式问题——运行 `pnpm lint:prettier` 即可。

## 5. 交叉引用

- 前端特有约定（Hooks、useEffect、组件规范、路径别名等）→ [前端规范](/docs/conventions/frontend-conventions.md)
- React / Next.js 编写、审查与重构必须使用的性能规范 →
  [vercel-react-best-practices](/.agents/skills/vercel-react-best-practices/SKILL.md)
- 后端特有约定（controller/service 职责、HTTP 装配等）→ [后端规范](/docs/conventions/backend-conventions.md)
- 样式约定（Tailwind / Sass 分层）→ [样式规范](/docs/conventions/styling-conventions.md)
- 测试约定 → [测试规范](/docs/conventions/test-conventions.md)
- 包分层与依赖 → [包架构指南](/docs/conventions/package-architecture-guidelines.md)
