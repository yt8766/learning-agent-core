# 依赖安装与声明策略

状态：current
文档类型：guide
适用范围：workspace 根包、`apps/*`、`packages/*`、`agents/*`
最后核对：2026-04-15

本文件把“依赖该装在哪”沉淀为仓库级规则，供后续 AI 和开发者在新增依赖时直接复用。

核心结论先看这一句：

- 开发工具装根目录，业务运行时依赖由实际使用它的 app/package 显式声明
- `tsup`、`vitest` 这类 workspace 工具链默认只允许放根目录，不在子包重复声明

相关约束来源：

- [AGENTS.md](/Users/dev/Desktop/learning-agent-core/AGENTS.md)
- [项目规范总览](/Users/dev/Desktop/learning-agent-core/docs/project-conventions.md)
- [Packages 分层与依赖约定](/Users/dev/Desktop/learning-agent-core/docs/package-architecture-guidelines.md)
- [Packages 目录说明](/Users/dev/Desktop/learning-agent-core/docs/packages-overview.md)

## 1. 总原则

默认遵循三条规则：

- 谁在运行时使用，谁声明依赖
- 只有工作空间级工具和根脚本实际使用的依赖，才允许放到仓库根 `package.json`
- 不要依赖 workspace 链接带来的“隐式可用”，每个包的 `package.json` 都必须能独立描述自己的真实依赖

这意味着：

- `typescript`、`eslint`、`prettier`、`vitest`、`tsup`、`turbo` 这类 workspace 级开发工具，优先放根目录
- 某个 app 或 package 真正执行时要用到的库，必须声明在它自己的 `package.json`
- 不能依赖 pnpm 的链接结果“刚好能用”就省略声明
- 子包脚本直接调用根工作空间里的 `tsup`、`vitest` 是允许的，不需要在各自 `package.json` 再重复声明

## 2. 根目录允许安装什么

仓库根 `package.json` 不是业务运行时依赖的兜底区，只应承载下面两类内容。

### 2.1 Workspace 级开发工具

典型例子：

- `typescript`
- `eslint`
- `prettier`
- `vitest`
- `tsup`
- `turbo`
- `husky`
- 各类 `@types/*`

安装方式：

```bash
pnpm add -Dw <pkg>
```

示例：

```bash
pnpm add -Dw typescript vitest eslint prettier turbo
```

### 2.2 仅供根级脚本直接使用的运行时依赖

当前仓库根目录存在 `scripts/*`、根级构建脚本和统一检查命令，因此少量依赖即使是“运行时库”，也可以留在根目录，但前提是它们服务的是根脚本，而不是某个 app 或 package 的真实运行。

当前仓库根包目前不保留这类运行时依赖；如果未来新增，也只能在“根脚本直接使用”的前提下放在这里。

允许放根目录的判断标准：

- 该依赖由根级 `scripts/*`、根级构建命令或统一校验命令直接使用
- 它不是为了替代子包自身的依赖声明

不允许的情况：

- `apps/backend/agent-server` 在运行时用到 `zod`，但只装在根目录
- `packages/tools` 用到 `fs-extra`，却依赖根目录透传
- 某个前端 app 编译能过，只是因为依赖被 workspace 链接到了根目录

补充理解：

- 根目录不是“大家都用所以先装这里”的公共兜底区
- “多个子包都会用到”不等于“应该装根目录”
- `pnpm` 会去重物理存储，所以运行时依赖分别声明不会显著浪费磁盘空间

## 3. 子包必须安装什么

`apps/*`、`packages/*`、`agents/*` 中，只要源码直接 `import` 某个库，就默认要在当前包里声明。

典型包括：

- `zod`
- `fs-extra`
- `openai`
- `lodash-es`
- `react`
- `@nestjs/*`
- `langchain` / `@langchain/*`

即使多个包都会用到，也要分别声明。pnpm 会去重物理存储，不需要为了“省空间”把运行时依赖强行集中到根目录。

安装方式：

```bash
pnpm --dir <package-path> add <pkg>
```

示例：

```bash
pnpm --dir packages/tools add fs-extra zod
pnpm --dir apps/backend/agent-server add @nestjs/config
pnpm --dir apps/frontend/agent-chat add react-markdown
pnpm --dir agents/data-report add zod
```

如果是子包开发依赖：

```bash
pnpm --dir <package-path> add -D <pkg>
```

补充：

- `tsup`、`vitest`、`typescript`、`eslint` 这类 workspace 共用工具链，不走这条命令，改用根目录 `pnpm add -Dw <pkg>`

## 4. 结合本仓库的决策规则

新增依赖前，按下面顺序判断。

### 4.1 它是不是整个 workspace 共用的开发工具

如果是 lint、format、typecheck、test、build、commit hook 相关工具，装根目录。

示例：

- `eslint-plugin-*`
- `prettier-plugin-*`
- `vitest`
- `typescript`

本仓库额外约束：

- `tsup`、`vitest` 默认由根 `package.json` 统一声明、升级和锁版本
- 不要因为子包里写了 `build:transpile: tsup` 或 `test: pnpm --dir ../.. exec vitest ...`，就把这两个依赖再装进子包
- 如无明确版本隔离或实验性需求，子包禁止重复声明 `tsup`、`vitest`

### 4.2 它是不是只被根级脚本使用

如果只被仓库根的 `scripts/*`、根级命令、统一质量检查使用，可以装根目录。

示例场景：

- 根级构建脚本读写文件，需要 `fs-extra`
- 根级脚本解析配置或结构化数据，需要 `zod`

### 4.3 它是不是某个 app 或 package 的真实运行时依赖

如果答案是“是”，必须装到对应 app、package 或 agent。

示例场景：

- `packages/memory` 内部使用向量库 SDK
- `packages/tools` 内部使用 `fs-extra`
- `apps/backend/agent-server` 使用 Nest 扩展包
- `apps/frontend/agent-chat` 使用新的 UI 或 markdown 渲染库
- `agents/supervisor` 或 `agents/data-report` 内部使用结构化 schema、提示词模板或第三方 SDK

### 4.4 它是不是跨多个子包复用的业务能力

不要因为“多个地方都用”就装到根目录。应该让每个实际使用方各自声明，或者把能力收敛到共享包后由共享包负责声明。

优先级：

1. 先让实际使用包各自声明依赖
2. 如果已经形成稳定共享能力，再把实现抽到合适的 `@agent/*` 包
3. 由该共享包声明自己的运行时依赖

## 5. 与包分层规则一起理解

安装位置不只和“谁在用”有关，也和“代码应该放在哪个包”有关。

例如：

- 新增 provider 适配能力，优先考虑 `packages/adapters` 或 `packages/model`
- 新增 memory 或向量检索能力，优先考虑 `packages/memory`
- 新增工具执行或 sandbox 能力，优先考虑 `packages/tools`
- 新增 graph、flow、session、governance 编排能力，优先考虑 `packages/runtime` 或对应 `agents/*`

先决定代码归属，再在归属包内安装依赖，不要先把依赖装到根目录，再围绕依赖位置反推模块设计。

## 6. 标准命令

### 根目录开发依赖

```bash
pnpm add -Dw <pkg>
```

### 根目录脚本依赖

```bash
pnpm add -w <pkg>
```

### 子包运行时依赖

```bash
pnpm --dir <package-path> add <pkg>
```

### Agent 包运行时依赖

```bash
pnpm --dir agents/<agent-name> add <pkg>
```

### 子包开发依赖

```bash
pnpm --dir <package-path> add -D <pkg>
```

仓库明确禁止：

- 使用 `npm install`、`yarn add`
- 把 `.pnpm-store` 放进仓库
- 依赖其他包或根目录的隐式依赖而不声明

## 7. PR 前自检清单

新增依赖后，至少自检以下问题：

- 这个依赖是否声明在真正使用它的包里
- 如果装在根目录，它是否确实只服务于 workspace 工具或根脚本
- 是否错误地把 app/package 运行时依赖装到了根目录
- 是否可以通过已有 `@agent/*` 包复用，而不是再引入一份新能力
- 是否需要同步更新对应模块文档

如果改动涉及 `packages/*`，优先补做：

```bash
pnpm build:lib
pnpm exec tsc -p packages/shared/tsconfig.json --noEmit
pnpm exec tsc -p packages/runtime/tsconfig.json --noEmit
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

再按实际触达范围补充对应 app、package 或 agent 的类型检查。

## 8. 给后续 AI 的简版结论

后续 AI 在这个仓库新增依赖时，默认这样做：

- 工具链依赖：装根目录，用 `pnpm add -Dw`
- 根脚本专用依赖：装根目录，用 `pnpm add -w`
- app/package/agent 真实运行时依赖：装到对应目录，用 `pnpm --dir <pkg> add`
- `tsup`、`vitest`：默认只放根目录，不在子包重复声明
- 不要把“多个包都会用”当成装根目录的理由
- 不要依赖 workspace 链接带来的隐式可用性
