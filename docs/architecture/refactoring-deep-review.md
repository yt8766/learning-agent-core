# 架构深度评审与重构计划

状态：current
文档类型：architecture
适用范围：agents/、packages/、apps/ 全系统架构
最后核对：2026-04-28

---

## 0. 文档说明

本文档基于对全仓库代码的逐目录审查，识别出 12 个架构问题，并对每个问题给出：

- 当前状态（问题描述）
- 重构目标（应该变成什么样）
- 精确到文件的改动清单（新增/修改/删除/移动）
- 期望的验证方式

### 优先级定义

| 级别 | 含义                                                             |
| ---- | ---------------------------------------------------------------- |
| P0   | 影响系统演进方向、导致代码重复或混乱扩展、每次新功能都会放大问题 |
| P1   | 包职责越界、具体结构问题、不修会持续累积债                       |
| P2   | 结构一致性问题、轻微偏差、影响可读性                             |

---

## 1. [P0] data-report 内两套并行流程形成身份危机

### 1.1 问题描述

`agents/data-report/src/flows/` 下同时存在两套流程，做的是同一件事（"生成一份报表"）的两种实现：

| 流程目录                  | 实现方式                     | graph 入口                         | 主要消费者                                |
| ------------------------- | ---------------------------- | ---------------------------------- | ----------------------------------------- |
| `flows/data-report/`      | LLM 生成 React/Sandpack 代码 | `graphs/data-report.graph.ts`      | `sandpack-agent.ts` 直接调用沙盒运行时    |
| `flows/data-report-json/` | LLM 生成结构化 JSON schema   | `graphs/data-report-json.graph.ts` | `flows/report-bundle/generate/runtime.ts` |

两套流程共存导致：

- 新功能不知道该扩展哪条路径
- 维护两套完全不同的 nodes/prompts/schemas
- `sandpack-agent.ts` 在流程层直接调用运行时沙盒，违反了 Agent/Executor 分层
- `flows/data-report/nodes/` 下有 22 个节点（`app-gen-node`, `component-node`, `dependency-node`, `hooks-node` 等），全是 React 代码生成语义，与 JSON 路径无关

### 1.2 用户提议的解读

用户提议把 `data-report-json` 做成独立 sub-Agent——这个感觉是对的。`data-report-json` 在事实上已经是独立 sub-Agent（有自己的 graph、独立的 nodes/prompts/schemas、`executeDataReportJsonGraph` 入口），缺的只是明确宣告它是未来方向。

### 1.3 重构目标

1. **明确选择 JSON 路径作为未来方向**，Sandpack/代码生成路径进入维护模式或废弃
2. **`data-report-json` 提升为一等公民**，不再是 `flows/` 下的匿名子目录
3. **`sandpack-agent.ts` 中的运行时调用**移入 `runtime/` 层，flows/ 只保留纯 AI 推理节点
4. 如果 Sandpack 路径确定废弃，`flows/data-report/` 整体归档

### 1.4 文件改动清单

**阶段 A：JSON 路径提升**

```
# 新增
agents/data-report/src/graphs/data-report-json.graph.ts      ← 已存在，保持不变（主图）
agents/data-report/src/flows/data-report-json/               ← 已存在，是核心流程，不需要搬移

# 修改
agents/data-report/src/index.ts
  → 确保 executeDataReportJsonGraph 是主要 export
  → data-report（sandpack）相关 export 移入单独的 legacy/ 子路径或加注释标记

# 新增（运行时分离）
agents/data-report/src/runtime/sandpack-runtime.ts
  → 承接 sandpack-agent.ts 中的沙盒调用逻辑
  → flows/data-report/sandpack-agent.ts 改为只调用 sandpack-runtime.ts 接口，不直接内联运行时
```

**阶段 B：Sandpack 路径废弃（如决策废弃）**

```
# 删除
agents/data-report/src/flows/data-report/            ← 整个目录（22 个节点 + prompts + schemas）
agents/data-report/src/graphs/data-report.graph.ts   ← Sandpack graph

# 修改
agents/data-report/src/index.ts
  → 移除所有 data-report（sandpack）相关 export

packages/report-kit/src/contracts/data-report-facade.ts
  → 检查是否有对 Sandpack 路径 types 的引用，移除或迁移

# 更新文档
docs/architecture/refactoring-deep-review.md（本文档）
```

### 1.5 验证

```bash
pnpm exec tsc -p agents/data-report/tsconfig.json --noEmit
pnpm exec vitest run --config vitest.config.js agents/data-report/test
```

---

## 2. [P0] `agents/data-report/src/types/` 双层类型树不同步

### 2.1 问题描述

`types/` 目录下存在两层结构，且两层内容不同步（已用 `diff` 证实）：

```
agents/data-report/src/types/
├── data-report-json-schema.ts     ← 只是 re-export from ./schemas/data-report-json-schema
├── data-report-json.ts            ← 只是 re-export from ./schemas/data-report-json
├── report-bundle.ts               ← 只是 re-export from ./schemas/report-bundle
├── data-report.ts                 ← 只是 re-export from ./schemas/data-report
├── schemas/
│   ├── data-report-json-schema.ts ← 实际 schema 定义（与根层内容不同！）
│   ├── data-report-json.ts        ← 实际类型定义
│   ├── report-bundle.ts           ← 实际 ReportBundle schema
│   └── data-report.ts             ← 实际 DataReport schema
└── index.ts
```

问题：`types/data-report-json-schema.ts` 和 `types/schemas/data-report-json-schema.ts` 内容不同——前者 re-export 后者，但两者都有定义，调用方 import 路径不一致时会引用到不同版本。

### 2.2 重构目标

消除中间 re-export 层，调用方直接从 `types/schemas/` import，或向上通过 `flows/data-report-json/schemas/` 的 barrel 使用。

### 2.3 文件改动清单

```
# 删除（中间 re-export 层，全部无意义）
agents/data-report/src/types/data-report-json-schema.ts   ← 删除，或改为从 flows/data-report-json/schemas re-export
agents/data-report/src/types/data-report-json.ts          ← 删除，直接从 flows/ re-export
agents/data-report/src/types/report-bundle.ts             ← 删除
agents/data-report/src/types/data-report.ts               ← 删除

# 修改
agents/data-report/src/types/index.ts
  → 直接 re-export from './schemas/data-report-json-schema'
  → 直接 re-export from './schemas/data-report-json'
  → 直接 re-export from './schemas/report-bundle'
  → 直接 re-export from './schemas/data-report'

# 检查所有 import 路径
# 凡是 import from '../types/data-report-json-schema' 的地方，确认实际解析到哪个文件
agents/data-report/src/flows/data-report-json/schemas/report-page-schema.ts
agents/data-report/src/flows/data-report-json/nodes/*.ts
```

### 2.4 验证

```bash
pnpm exec tsc -p agents/data-report/tsconfig.json --noEmit
# 确认无 "Cannot find module" 或类型不匹配错误
```

---

## 3. [P0] `packages/platform-runtime` 硬依赖全部 Agent 实现包

### 3.1 问题描述

`packages/platform-runtime/package.json` 的 `dependencies` 中直接声明了：

```json
"@agent/agents-coder": "workspace:*",
"@agent/agents-data-report": "workspace:*",
"@agent/agents-intel-engine": "workspace:*",
"@agent/agents-reviewer": "workspace:*",
"@agent/agents-supervisor": "workspace:*"
```

这意味着：

- 任何 Agent 修改 API/包名，`platform-runtime` 必须同步修改
- 新增一个 Agent，必须修改 `platform-runtime`（本不该如此）
- `platform-runtime` 实质上是静态组装点，而不是动态注册中心

这正是 Phase 4 P4-1 任务要解决的问题，但目前尚未执行。

### 3.2 重构目标

`platform-runtime` 改为接受注入（依赖倒置），不直接 import 任何 Agent 实现：

```
当前：platform-runtime → 直接 import agents/coder, agents/data-report, ...
目标：platform-runtime.createRuntime(options: { agents: AgentDescriptor[] })
     backend/app.module.ts 成为唯一组装点
```

### 3.3 文件改动清单

**新增**

```
packages/core/src/contracts/agent-descriptor.schema.ts
  → 定义 AgentDescriptor 接口：{ agentId, capabilities, createGraphFn, ... }
  → 所有 agents 的 index.ts export 已有 domain descriptor，在此 schema 基础上标准化

packages/platform-runtime/src/registry/
├── agent-registry.ts
│   → AgentRegistry.register(descriptor: AgentDescriptor): void
│   → AgentRegistry.get(agentId: string): AgentDescriptor | undefined
│   → AgentRegistry.getAll(): AgentDescriptor[]
└── index.ts
```

**修改**

```
packages/platform-runtime/src/index.ts  (或 create-platform-runtime.ts)
  → 函数签名从隐式 import 改为：
    createPlatformRuntime(options: { agents?: AgentDescriptor[] }): PlatformRuntime
  → 内部从 AgentRegistry 读取已注册的 Agent，不再 import 具体实现

packages/platform-runtime/package.json
  → 删除所有 "@agent/agents-*" 依赖
  → 只保留 @agent/core, @agent/runtime, @agent/adapters, @agent/tools 等基础包

apps/backend/agent-server/src/app.module.ts（或 bootstrap.ts）
  → 成为唯一组装点
  → import 所有需要的 Agent descriptors
  → createPlatformRuntime({ agents: [supervisorDescriptor, coderDescriptor, ...] })
```

**删除**

```
packages/platform-runtime/src/ 中所有直接 import agent 实现的语句
```

### 3.4 验证

```bash
pnpm exec tsc -p packages/platform-runtime/tsconfig.json --noEmit
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
# 检查 platform-runtime 的 package.json 中 dependencies 不含任何 @agent/agents-*
```

---

## 4. [P1] `packages/adapters` 正在演变为 God Package

### 4.1 问题描述

当前 `packages/adapters/src/` 共 133 个文件，混合了以下完全不同性质的能力：

| 子目录/文件               | 职责                              | 问题                                     |
| ------------------------- | --------------------------------- | ---------------------------------------- |
| `chat/`, `embedding/`     | LLM 对话与向量嵌入                | 核心，合理                               |
| `routing/`, `resilience/` | 路由策略与重试                    | 与 LLM 紧密相关，合理                    |
| `media/minimax/`          | MiniMax 媒体 Provider             | 领域性太强，应在 adapters/media/ 子包    |
| `mcp/`                    | MCP 客户端                        | 与 MCP 工具链更相关，应在 tools 或独立包 |
| `langchain/`              | LangChain chunker/embedder/loader | 依赖具体第三方框架，应隔离               |
| `chroma/`                 | Chroma 向量数据库                 | 存储适配，不是"模型 adapter"             |
| `anthropic/`, `openai/`   | 特定提供商客户端                  | 合理                                     |

问题症状：

- 新接入一个 LLM 提供商 → 加到 adapters
- 新接入一个媒体平台 → 加到 adapters
- 新接入一个向量库 → 加到 adapters
- 最终 adapters 成为所有第三方接入的垃圾桶

### 4.2 重构目标

按"接入类型"拆分，而不是全部堆在 adapters：

```
packages/adapters/              → 保留：LLM provider 适配（chat/embedding/routing/resilience）
packages/adapters/src/media/    → 已存在，提取为独立子包 packages/media-adapters（中期目标）
packages/knowledge/src/         → langchain/chroma 等检索/存储适配应该在这里
packages/tools/src/             → MCP 相关迁入 tools/mcp（已有目录）
```

### 4.3 文件改动清单（渐进式，不强制一次完成）

**短期（当前可执行）**

```
# 移动：langchain 适配器
packages/adapters/src/langchain/chunker.ts
packages/adapters/src/langchain/embedder.ts
packages/adapters/src/langchain/loader.ts
  → 迁移目标：packages/knowledge/src/adapters/langchain/
  → packages/knowledge/package.json 已依赖 @agent/adapters，可直接使用其 EmbeddingProvider

# 移动：chroma 适配器
packages/adapters/src/chroma/chroma-store.ts
  → 迁移目标：packages/knowledge/src/adapters/chroma/chroma-store.ts

# 保留不动（核心）
packages/adapters/src/chat/
packages/adapters/src/embedding/
packages/adapters/src/routing/
packages/adapters/src/resilience/
packages/adapters/src/anthropic/
packages/adapters/src/openai/
packages/adapters/src/minimax/ (LLM，不是媒体)
packages/adapters/src/media/minimax/ (媒体，中期提取为独立包)
```

**中期（media adapters 独立）**

```
# 新建包
packages/media-adapters/
├── package.json  → name: @agent/media-adapters
├── src/minimax/  ← 从 packages/adapters/src/media/minimax/ 迁入
└── src/index.ts

# 修改
packages/runtime/package.json
  → @agent/adapters → @agent/media-adapters（只为媒体能力）
packages/platform-runtime/package.json
  → 同上
```

### 4.4 验证

```bash
pnpm exec tsc -p packages/knowledge/tsconfig.json --noEmit
pnpm exec tsc -p packages/adapters/tsconfig.json --noEmit
pnpm exec vitest run --config vitest.config.js packages/adapters/test packages/knowledge/test
```

---

## 5. [P1] `packages/report-kit/src/blueprints/` 存放了真实业务 UI 组件

### 5.1 问题描述

`packages/report-kit/src/blueprints/bonus-center-data/` 包含：

- 完整的 React 组件树（图表、指标卡、表格，约 80+ 文件）
- 这是某个具体产品（积分中心数据看板）的 UI 实现
- 不是"蓝图模板"，而是已实例化的业务 UI

这导致 `report-kit` 依赖 React 和业务数据结构，使其无法作为纯服务端包使用。

### 5.2 重构目标

`report-kit` 只保留：

- 确定性蓝图定义（blueprint metadata，不含 React 组件）
- 组装/编译/scaffold 逻辑
- 面向后端的 contracts/facades

具体 React UI 组件应该在：

- `apps/frontend/agent-chat/src/features/reports/blueprints/` 或
- 专属业务包 `packages/blueprints/` 或
- 直接在前端 app 内

### 5.3 文件改动清单

```
# 移动
packages/report-kit/src/blueprints/bonus-center-data/
  → 目标：apps/frontend/agent-chat/src/blueprints/bonus-center-data/
    或     packages/blueprints/src/bonus-center-data/（如果多个前端 app 共享）

# 修改
packages/report-kit/src/blueprints/data-report-blueprint.ts
  → 只保留 blueprint 的元数据定义（id, name, capabilities, routeConfig）
  → 删除对 React 组件的直接 import

packages/report-kit/src/blueprints/index.ts
  → 只 export blueprint 注册表（不含 React 组件）

packages/report-kit/package.json
  → 检查并移除 React 相关依赖（如 react, react-dom, @ant-design/charts）
```

### 5.4 验证

```bash
pnpm exec tsc -p packages/report-kit/tsconfig.json --noEmit
# 确认 report-kit 不再依赖 React
pnpm --filter @agent/report-kit build:lib
```

---

## 6. [P1] `report-bundle` 组装逻辑位置错误

### 6.1 问题描述

`agents/data-report/src/flows/report-bundle/` 做的事是：

```ts
// report-bundle/generate/runtime.ts 核心逻辑约 40 行：
const jsonResult = await executeDataReportJsonGraph(input);
return ReportBundleSchema.parse({
  version: 'report-bundle.v1',
  kind: 'report-bundle',
  meta: { bundleId, title, mode: 'single-document' },
  documents: [jsonResult.schema]
});
```

这不是 AI 推理流程，而是纯粹的组装/格式转换逻辑。放在 `flows/` 目录下是语义错误——`flows/` 应该包含 LLM 驱动的多节点推理链。

### 6.2 重构目标

`report-bundle` 组装逻辑迁入 `packages/report-kit/src/assembly/`（已有 `data-report-assembly.ts`，同层）。

### 6.3 文件改动清单

```
# 新增
packages/report-kit/src/assembly/report-bundle-assembly.ts
  → 承接 flows/report-bundle/generate/runtime.ts 的组装逻辑
  → export buildReportBundle(jsonResult: DataReportJsonGenerateResult): ReportBundle

packages/report-kit/src/assembly/report-bundle-edit.ts
  → 承接 flows/report-bundle/edit/report-bundle-edit-flow.ts 的编辑逻辑

# 修改
packages/report-kit/src/assembly/index.ts
  → export { buildReportBundle } from './report-bundle-assembly'
  → export { editReportBundle } from './report-bundle-edit'

# 删除
agents/data-report/src/flows/report-bundle/              ← 整个目录删除
agents/data-report/src/flows/report-bundle/generate/runtime.ts
agents/data-report/src/flows/report-bundle/edit/report-bundle-edit-flow.ts

# 修改（更新调用方）
agents/data-report/src/index.ts
  → 凡是 export 了 report-bundle 内容的，改为从 @agent/report-kit 引用

packages/report-kit/package.json
  → 确认依赖 @agent/agents-data-report（需要 DataReportJsonGenerateResult 类型）
  → 或者 DataReportJsonGenerateResult 在 @agent/core 中定义，直接从 core 依赖
```

### 6.4 验证

```bash
pnpm exec tsc -p packages/report-kit/tsconfig.json --noEmit
pnpm exec tsc -p agents/data-report/tsconfig.json --noEmit
pnpm exec vitest run --config vitest.config.js packages/report-kit/test agents/data-report/test
```

---

## 7. [P1] `packages/templates` 职责与 P2-3 完成状态

### 7.1 当前状态（已部分完成）

检查 `packages/templates/src/` 当前目录：

```
src/contracts/template-definitions.ts
src/registries/frontend-template-registry.ts
src/registries/scaffold-template-registry.ts
src/scaffolds/agent-basic/        ← Agent 脚手架模板
src/scaffolds/package-lib/        ← Package 脚手架模板
src/index.ts
```

P2-3 计划的 `templates/src/reports/` 迁移目标已经不存在了——说明之前已经完成或根本没有 `reports/` 目录。`templates` 现在职责清晰：只放脚手架类模板。

### 7.2 剩余问题

`src/registries/frontend-template-registry.ts` — "前端模板注册"这个概念值得确认：

- 它注册的是什么？是 report-kit 的 blueprints 还是脚手架起点？
- 如果它包含了对具体报表蓝图的注册，应迁入 `packages/report-kit`

### 7.3 文件改动清单

```
# 检查并可能修改
packages/templates/src/registries/frontend-template-registry.ts
  → 如果注册的是报表蓝图 → 迁入 packages/report-kit/src/blueprints/
  → 如果注册的是代码脚手架起点 → 保留原地，语义正确

# 如果发现还有 templates/src/reports/ 残留
  → 迁入 packages/report-kit/src/blueprints/
  → 删除原目录
```

---

## 8. [P2] `agents/image` 和 `agents/video` 的 `package.json` types 路径错误

### 8.1 问题描述

```json
// agents/image/package.json（错误）
"types": "build/types/index.d.ts"

// agents/audio/package.json（正确，作为参照）
"types": "build/types/agents/audio/src/index.d.ts"
```

同样的错误出现在 `agents/image/package.json` 和 `agents/video/package.json` 的 `types` 字段及 `exports["."].import.types`、`exports["."].require.types`。

这在构建时会导致 TypeScript 消费方找不到正确的类型声明文件。

### 8.2 文件改动清单

**`agents/image/package.json`**

```json
// 修改前
"types": "build/types/index.d.ts",
"exports": {
  ".": {
    "import": {
      "types": "./build/types/index.d.ts",
      ...
    },
    "require": {
      "types": "./build/types/index.d.ts",
      ...
    }
  }
}

// 修改后
"types": "build/types/agents/image/src/index.d.ts",
"exports": {
  ".": {
    "import": {
      "types": "./build/types/agents/image/src/index.d.ts",
      ...
    },
    "require": {
      "types": "./build/types/agents/image/src/index.d.ts",
      ...
    }
  }
}
```

**`agents/video/package.json`** — 同上，将路径改为 `build/types/agents/video/src/index.d.ts`

### 8.3 验证

```bash
pnpm exec tsc -p agents/image/tsconfig.json --noEmit
pnpm exec tsc -p agents/video/tsconfig.json --noEmit
pnpm build:lib --filter @agent/agents-image --filter @agent/agents-video
# 确认 build/types/agents/image/src/index.d.ts 生成正确
```

---

## 9. [P2] MiniMax Provider 未声明 `implements <Interface>`

### 9.1 问题描述

四个 MiniMax media provider 类都没有声明 `implements`:

```ts
// 现状（packages/adapters/src/media/minimax/）
export class MiniMaxAudioProvider {       // 应为 implements AudioProvider
export class MiniMaxImageProvider {       // 应为 implements ImageProvider
export class MiniMaxVideoProvider {       // 应为 implements VideoProvider
export class MiniMaxMusicProvider {       // 应为 implements MusicProvider
```

TypeScript 结构化类型系统不会因此报错（只要 shape 匹配），但缺少 `implements` 声明意味着：

- 编译器不会主动提示接口方法缺失
- 新增接口方法时，Provider 类不会得到"未实现"报错
- 消费方无法通过类型强制确保 Provider 符合接口

### 9.2 文件改动清单

```
# 修改
packages/adapters/src/media/minimax/minimax-audio-provider.ts
  → export class MiniMaxAudioProvider implements AudioProvider {
  → 添加 import type { AudioProvider } from '@agent/runtime'

packages/adapters/src/media/minimax/minimax-image-provider.ts
  → export class MiniMaxImageProvider implements ImageProvider {
  → 添加 import type { ImageProvider } from '@agent/runtime'

packages/adapters/src/media/minimax/minimax-video-provider.ts
  → export class MiniMaxVideoProvider implements VideoProvider {
  → 添加 import type { VideoProvider } from '@agent/runtime'

packages/adapters/src/media/minimax/minimax-music-provider.ts
  → export class MiniMaxMusicProvider implements MusicProvider {
  → 添加 import type { MusicProvider } from '@agent/runtime'
```

添加后，如果 TypeScript 报"未实现某方法"，则需要补齐 stub 方法（抛出 `Error('Not implemented')` 或返回 `Promise.resolve(...)` 骨架）。

### 9.3 验证

```bash
pnpm exec tsc -p packages/adapters/tsconfig.json --noEmit
# 确认无 "Class ... incorrectly implements interface ..." 错误
# 此后若接口新增方法，此处会自动报错提醒实现
```

---

## 10. [P2] 前端两个 App 没有共享 UI 组件库

### 10.1 问题描述

`apps/frontend/agent-chat/` 和 `apps/frontend/agent-admin/` 各自维护独立的 UI 组件目录：

```
agent-chat/src/components/
agent-admin/src/components/ui/
```

当前仓库没有任何 `packages/ui` 或 `packages/design-system` 共享包。两个 App 如果使用了相同的 UI 框架（如 antd / shadcn），则会出现：

- Button/Modal/Table 等基础组件各自封装一遍
- 主题/颜色 token 在两个地方分别维护
- 一个 App 修复了某个 bug，另一个 App 不能直接受益

### 10.2 重构目标

提取共享 UI 层，但要注意两个前端的定位差异：

- `agent-chat` = 操作型界面（聊天、审批、ThoughtChain）
- `agent-admin` = 治理型界面（Runtime、Approvals Center、Learning Center）

两者的基础 UI 组件（Button、Card、Modal、Table、Badge、Tag、Form）是可以共享的。

### 10.3 文件改动清单

**方案 A：轻量共享（推荐，短期可执行）**

```
# 新增（minimal package manifest，按 AGENTS.md 规范先立包）
packages/ui/
└── package.json
    → name: @agent/ui
    → 依赖：react, antd（或 shadcn）
    → 职责：基础原子 UI 组件 + 主题 token

# 新增（第一批迁入）
packages/ui/src/
├── components/
│   ├── button.tsx
│   ├── card.tsx
│   ├── badge.tsx
│   └── index.ts
├── theme/
│   └── tokens.ts        ← 颜色/字体/间距 token
└── index.ts

# 修改（两个 App 引用新包）
apps/frontend/agent-chat/package.json
  → 添加 "@agent/ui": "workspace:*"
apps/frontend/agent-admin/package.json
  → 添加 "@agent/ui": "workspace:*"
```

**方案 B：仅统一主题 token（保守）**

两个 App 各自保留组件，但从同一个地方导入主题配置：

```
packages/ui/src/theme/tokens.ts  ← 只放 token，不放组件
```

### 10.4 验证

```bash
pnpm exec tsc -p apps/frontend/agent-chat/tsconfig.app.json --noEmit
pnpm exec tsc -p apps/frontend/agent-admin/tsconfig.app.json --noEmit
```

---

## 11. [P2] `packages/memory` 和 `packages/knowledge` 的检索层边界

### 11.1 问题描述与调查结果

- `packages/knowledge` 已在 `package.json` 中声明 `"@agent/memory": "workspace:*"` 依赖
- `knowledge/src/contracts/indexing/contracts/vector-store.ts` 自定义了 `VectorStore` 接口
- `memory/src/embeddings/embedding-provider.ts` 也定义了 `EmbeddingProvider`

两者是**层次关系**，不是重复关系：

- `memory` = 运行时工作记忆（存储对话历史、学习记录、reflection）
- `knowledge` = 外部知识库 RAG（向量检索、文档加载、分片）

目前层次关系已经正确——`knowledge` 依赖 `memory` 的向量能力，而不是反向。

### 11.2 剩余确认点

需要确认的是：`knowledge` 的 `VectorStore` 接口与 `adapters/chroma/chroma-store.ts` 是否已经正确对接——如果 chroma 实现了 `knowledge` 的 `VectorStore` 接口（而不是另起一套），则边界是干净的。

### 11.3 文件改动清单

```
# 检查
packages/adapters/src/chroma/chroma-store.ts
  → 确认它 implements packages/knowledge/src/contracts/indexing/contracts/vector-store.ts 的 VectorStore

# 如果未 implements
packages/adapters/src/chroma/chroma-store.ts
  → 添加 implements VectorStore（来自 @agent/knowledge）
  → 或：按问题 4 中的方案，将 chroma-store 迁入 packages/knowledge/src/adapters/chroma/，就不再是跨包 implements
```

---

## 12. [P2] 关于 `data-report-json` 作为独立 sub-Agent 的时机判断

### 12.1 用户提议的完整评估

用户提议将 `data-report-json` 和 `report-bundle` 都做成"独立 sub-Agent，提供接口供实现"。

**`data-report-json` 的现状**：

- 已经是事实上的 sub-Agent（独立 graph、独立节点树、独立 `executeDataReportJsonGraph` 入口）
- 接口已经稳定：`DataReportJsonGenerateInput` / `DataReportJsonGenerateResult`
- 当前唯一消费者是 `flows/report-bundle/`

**何时应该提取为独立包**：

- 当第二个 Agent 需要调用它时（如 intel-engine 需要生成 JSON 报表）
- 当它的模型策略需要独立演进时
- 当它需要独立部署或独立版本控制时

**当前不提取的理由**：

- 提取会增加跨包依赖（`agents/data-report` → `agents/data-report-json`，还是 `packages/json-report-generator`？）
- 目前只有一个消费者，过早提取是浪费
- 正确的做法是：把 `DataReportJsonGenerateInput/Result` schema 迁入 `packages/core`，这样其他 Agent 可以依赖 contract 而不依赖实现

**建议的正确抽象**：

```
# 迁入 packages/core（让 contract 可共享）
packages/core/src/contracts/data-report-json/
├── generate.schema.ts    ← DataReportJsonGenerateInput/Result schema
└── index.ts

# agents/data-report 保持提供实现
agents/data-report/src/flows/data-report-json/  ← 实现不变
agents/data-report/src/index.ts
  → export { executeDataReportJsonGraph } from './graphs/data-report-json.graph'
  → export type { DataReportJsonGenerateInput, DataReportJsonGenerateResult } from '@agent/core'
```

这样：未来若 intel-engine 需要调用 JSON 报表生成，它 import contract from `@agent/core`，通过 runtime 注入 `executeDataReportJsonGraph` 实现，完全解耦。

---

## 13. 执行优先级与依赖关系

```
P0 优先（影响系统扩展）
├── 问题 3：platform-runtime 解耦（即 Phase 4 P4-1）
├── 问题 1：data-report 两套流程决策（决定后续演进方向）
└── 问题 2：data-report 类型树清理（影响所有 flows 正确性）

P1 次优（包职责越界）
├── 问题 6：report-bundle 迁入 report-kit（依赖问题 1 方向确定后执行）
├── 问题 5：report-kit/blueprints 清理（可独立执行）
└── 问题 4：adapters 拆分（渐进执行，先 langchain/chroma）

P2 随时可做（结构一致性）
├── 问题 8：image/video package.json types 修复（立即修复，10 分钟内完成）
├── 问题 9：MiniMax implements 声明（立即修复，30 分钟内完成）
├── 问题 10：共享 UI 包（立包 manifest 先行，实现渐进）
├── 问题 11：chroma implements VectorStore 确认（检查即可）
└── 问题 12：data-report-json contract 迁入 core（可作为问题 1 的配套执行）
```

### 依赖关系图

```
问题 8（types 修复）           → 可立即执行，无依赖
问题 9（implements 声明）      → 可立即执行，无依赖
问题 2（类型树清理）           → 可立即执行，无依赖
问题 1（流程方向决策）         → 需要产品决策（Sandpack 是否废弃）
问题 6（report-bundle 迁移）   → 依赖问题 1 确认方向
问题 5（blueprints 清理）      → 可立即执行，与问题 6 独立
问题 3（platform-runtime 解耦）→ 需要定义 AgentDescriptor schema，然后修改 backend
问题 4（adapters 拆分）        → 渐进执行，langchain/chroma 先行
问题 10（共享 UI）             → 先立 package.json，实现按需补
```

---

## 14. 文件改动汇总表

| 问题 | 操作 | 文件路径                                                        | 说明                                                                                 |
| ---- | ---- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| P8   | 修改 | `agents/image/package.json`                                     | types 路径从 `build/types/index.d.ts` 改为 `build/types/agents/image/src/index.d.ts` |
| P8   | 修改 | `agents/video/package.json`                                     | types 路径从 `build/types/index.d.ts` 改为 `build/types/agents/video/src/index.d.ts` |
| P9   | 修改 | `packages/adapters/src/media/minimax/minimax-audio-provider.ts` | 添加 `implements AudioProvider`                                                      |
| P9   | 修改 | `packages/adapters/src/media/minimax/minimax-image-provider.ts` | 添加 `implements ImageProvider`                                                      |
| P9   | 修改 | `packages/adapters/src/media/minimax/minimax-video-provider.ts` | 添加 `implements VideoProvider`                                                      |
| P9   | 修改 | `packages/adapters/src/media/minimax/minimax-music-provider.ts` | 添加 `implements MusicProvider`                                                      |
| P2   | 修改 | `agents/data-report/src/types/index.ts`                         | 直接 re-export from `./schemas/*`，删除中间层文件                                    |
| P2   | 删除 | `agents/data-report/src/types/data-report-json-schema.ts`       | 中间 re-export 层，无意义                                                            |
| P2   | 删除 | `agents/data-report/src/types/data-report-json.ts`              | 同上                                                                                 |
| P2   | 删除 | `agents/data-report/src/types/report-bundle.ts`                 | 同上                                                                                 |
| P2   | 删除 | `agents/data-report/src/types/data-report.ts`                   | 同上                                                                                 |
| P3   | 新增 | `packages/core/src/contracts/agent-descriptor.schema.ts`        | AgentDescriptor schema（注入接口）                                                   |
| P3   | 新增 | `packages/platform-runtime/src/registry/agent-registry.ts`      | 运行时注册表                                                                         |
| P3   | 修改 | `packages/platform-runtime/src/index.ts`                        | 接受 AgentDescriptor[] 注入                                                          |
| P3   | 修改 | `packages/platform-runtime/package.json`                        | 删除所有 @agent/agents-\* 依赖                                                       |
| P3   | 修改 | `apps/backend/agent-server/src/app.module.ts`                   | 成为唯一组装点                                                                       |
| P5   | 移动 | `packages/report-kit/src/blueprints/bonus-center-data/`         | 迁入前端 app 或独立业务包                                                            |
| P6   | 新增 | `packages/report-kit/src/assembly/report-bundle-assembly.ts`    | 承接 flows/report-bundle/generate/                                                   |
| P6   | 新增 | `packages/report-kit/src/assembly/report-bundle-edit.ts`        | 承接 flows/report-bundle/edit/                                                       |
| P6   | 删除 | `agents/data-report/src/flows/report-bundle/`                   | 整个目录                                                                             |
| P4   | 移动 | `packages/adapters/src/langchain/`                              | 迁入 packages/knowledge/src/adapters/langchain/                                      |
| P4   | 移动 | `packages/adapters/src/chroma/`                                 | 迁入 packages/knowledge/src/adapters/chroma/                                         |
| P10  | 新增 | `packages/ui/package.json`                                      | 新建共享 UI 包 manifest                                                              |
| P10  | 新增 | `packages/ui/src/theme/tokens.ts`                               | 主题 token                                                                           |
| P1   | 决策 | `agents/data-report/src/flows/data-report/`                     | Sandpack 路径废弃或维护模式                                                          |
| P1   | 修改 | `agents/data-report/src/flows/data-report/sandpack-agent.ts`    | 运行时调用移入 runtime/                                                              |

---

## 15. company-live 完成状态说明

media 计划 v1.0 对 company-live 的交付范围明确标注为：

> "真实 MiniMax 网络调用、后台轮询 worker、资产持久化、Admin 媒体中心和完整 CompanyLive 业务 graph 留到后续阶段。"

当前 company-live 的实现状态：

- ✅ `agents/company-live/src/flows/content/company-live-content-brief.ts` — 确定性 content brief → media request 转换
- ✅ `companyLiveDomainDescriptor` — composite 类型描述符（orchestrates: audio/image/video）
- ✅ 1 个测试通过
- ❌ LLM 驱动的业务 graph（待 Phase 2）
- ❌ 真实 MiniMax API 调用（待 Phase 2）
- ❌ 后台轮询 worker（待 Phase 2）
- ❌ 审批门（待 Phase 2）

company-live 按 v1.0 计划是**完成**的。

---

## 16. 相关文档索引

- [媒体提供商边界与 CompanyLive 工作流](./media-provider-boundary-and-company-live-workflow.md)
- Phase 2-4 详细重构计划已执行完成并删除，当前边界以各模块 README / ADR 为准
- [架构总览](./ARCHITECTURE.md)
