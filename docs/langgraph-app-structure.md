# LangGraph 应用结构规范

本规范只保留当前项目真正需要的部分，用于约束 `apps/*` 与 `packages/*` 中涉及 LangGraph、运行时编排和测试组织的目录结构。

目标：

- Graph 入口清晰
- 多 Graph / 子图可维护
- 共享能力集中复用
- 测试目录统一，不再与 `src/` 混放

## 1. 适用范围

适用于：

- `packages/agent-core`
- `apps/backend/agent-server`
- `apps/worker`

前端不直接承载 LangGraph graph，但也应遵守同样的“源码目录 + 同级 test 目录”原则。

## 2. 当前项目推荐结构

### `packages/agent-core`

```text
packages/agent-core/
├─ src/
│  ├─ adapters/
│  ├─ flows/
│  ├─ graphs/
│  ├─ governance/
│  ├─ runtime/
│  ├─ session/
│  ├─ shared/
│  ├─ utils/
│  ├─ workflows/
│  ├─ types/
│  └─ index.ts
├─ test/
│  ├─ graphs/
│  ├─ flows/
│  ├─ session/
│  ├─ runtime/
│  ├─ workflows/
│  ├─ shared/
│  └─ fixtures/
├─ package.json
└─ README.md
```

约束：

- `graphs/` 只放 graph 定义、编译入口、子图组装
- `flows/` 只放节点、prompt、schema、局部 flow 工具
- `shared/` 放跨 graph 复用的事件映射、prompt 片段、schema、常量
- `utils/` 放无副作用、可稳定复用的纯函数工具，例如 parser、formatter、matcher、normalizer、轻量 mapper
- `session/` 放 checkpoint、事件持久化、恢复与压缩
- 测试统一放 `packages/agent-core/test/`，不要继续在 `src/` 下新增 `*.test.ts` 或 `*.int-spec.ts`

`shared/` 与 `utils/` 的区别：

- `shared/`
  - 放带明确领域语义的共享资产
  - 例如：prompt、schema、事件映射、跨流程协议
- `utils/`
  - 放不带强业务身份的通用函数
  - 例如：字符串规整、数组分组、时间格式化、稳定排序、轻量解析

禁止：

- 把 service、repository、runtime bridge、tool executor 放进 `utils/`
- 把某个 flow 私有的 helper 提前抽成全局 `utils/`
- 用 `utils/` 代替 `shared/` 承载协议、prompt、schema

### `apps/backend/agent-server`

```text
apps/backend/agent-server/
├─ src/
│  ├─ chat/
│  ├─ runtime/
│  ├─ platform/
│  ├─ approvals/
│  ├─ skills/
│  ├─ connectors/
│  └─ main.ts
├─ test/
│  ├─ chat/
│  ├─ runtime/
│  ├─ platform/
│  ├─ approvals/
│  ├─ integration/
│  └─ fixtures/
├─ package.json
└─ README.md
```

约束：

- `src/` 只放运行代码
- `test/` 统一承载 service/controller/integration 测试
- `test/integration/` 用于 SSE、checkpoint、runtime center、approval recovery 这类跨模块协同测试

### `apps/worker`

```text
apps/worker/
├─ src/
│  ├─ jobs/
│  ├─ runtime/
│  ├─ recovery/
│  └─ main.ts
├─ test/
│  ├─ jobs/
│  ├─ runtime/
│  ├─ recovery/
│  └─ fixtures/
├─ package.json
└─ README.md
```

### `apps/frontend/agent-chat`

```text
apps/frontend/agent-chat/
├─ src/
│  ├─ components/
│  ├─ features/
│  ├─ hooks/
│  ├─ pages/
│  ├─ styles/
│  └─ types/
├─ test/
│  ├─ components/
│  ├─ features/
│  ├─ hooks/
│  ├─ pages/
│  └─ fixtures/
├─ package.json
└─ README.md
```

### `apps/frontend/agent-admin`

```text
apps/frontend/agent-admin/
├─ src/
│  ├─ components/
│  ├─ features/
│  ├─ hooks/
│  ├─ pages/
│  └─ types/
├─ test/
│  ├─ components/
│  ├─ features/
│  ├─ hooks/
│  ├─ pages/
│  └─ fixtures/
├─ package.json
└─ README.md
```

## 3. Graph 入口约束

当前项目不是通用 LangSmith demo，而是多 Agent 运行时，所以只保留对本项目有价值的要求：

- Graph 入口必须清晰可定位
- 一个 graph / 子图应有明确的编译入口或工厂函数
- 不要把 graph 定义散落到 controller、service、hook 里
- 应用层负责路由、暴露和运行管理，不在应用层拼 graph 业务细节

当前推荐：

- 主图与子图入口放在 `packages/agent-core/src/graphs/`
- app 层只依赖 `@agent/agent-core` 暴露出来的 graph/runtime facade

## 4. 多 Graph / 子图约束

当前项目是多 Graph / 多子图系统，但不需要把每条 graph 都拆成独立 package。

推荐做法：

- 主执行图、direct-reply 图、planning 图、interrupt 图都留在 `packages/agent-core/src/graphs/`
- 共享节点逻辑放 `flows/`
- 共享事件映射、prompt、schema 放 `shared/`

禁止：

- Graph 之间相互直接嵌套调用业务 service 来绕过 graph 边界
- 在 app 层重新拼一套与 `agent-core` 平行的 graph 结构

## 4.1 `zod` 与 `Annotation` 职责边界

在当前项目里，这两个概念不要混用：

- `zod`
  - 负责“数据格式正确性”
  - 用于约束模型输出、结构化结果、schema parse、字段合法性
  - 典型位置：
    - `shared/schemas/*`
    - `flows/*/schemas/*`
    - `utils/schemas/*`
- `Annotation`
  - 负责“图状态如何存储和合并”
  - 用于定义 LangGraph state 中每个字段如何进入图、如何在节点之间传递、如何在多步执行中累积
  - 典型位置：
    - `graphs/chat.graph.ts`
    - `graphs/main-route.graph.ts`
    - `graphs/recovery.graph.ts`
    - `graphs/learning.graph.ts`

判断规则：

- 如果你在解决“模型返回的数据是否合格”，优先想 `zod`
- 如果你在解决“这个字段在 graph 里怎么挂、怎么传、怎么 merge”，优先想 `Annotation`

禁止：

- 用 `Annotation` 代替 `zod` 做字段值合法性校验
- 用 `zod` 代替 `Annotation` 表达图状态累积/合并语义

## 5. 测试目录硬约束

从本规范开始，测试目录统一收敛为“每个项目一个同级 `test/` 目录”：

- `packages/agent-core/test`
- `apps/backend/agent-server/test`
- `apps/worker/test`
- `apps/frontend/agent-chat/test`
- `apps/frontend/agent-admin/test`

规则：

- `src/` 下不再新增新的 `*.test.ts`、`*.spec.ts`、`*.int-spec.ts`
- 旧测试允许逐步迁移，不要求一次性全仓搬迁
- 新增测试必须优先写到各自项目的 `test/` 目录
- `test/fixtures/` 统一承载样本、mock state、mock event、mock tool 数据
- 兼容期内允许根级 `vitest` 同时发现 `src/` 与 `test/`；清理阶段再按项目逐步收紧到只认 `test/`

## 6. LangGraph 测试组织建议

按当前项目需求，推荐：

- graph 级测试：`test/graphs/`
- 节点 / flow 测试：`test/flows/`
- session / checkpoint / interrupt 测试：`test/session/`
- runtime / service / facade 测试：`test/runtime/`
- 前端消息流 / SSE / checkpoint 测试：各前端项目 `test/hooks/` 或 `test/features/`

命名建议：

- 单元测试：`*.test.ts`
- 集成测试：`*.int-spec.ts`
- React 测试：`*.test.tsx` / `*.int-spec.tsx`

## 7. 渐进迁移原则

当前仓库仍有大量测试与源码混放，这是历史状态，允许渐进迁移。

执行规则：

- 新文件按新规范放到 `test/`
- 修改旧测试时，优先就近迁移到对应 `test/` 目录
- 不要求为了一次小修把整个目录全部搬完
- 当某个模块被连续改动时，再成批迁移其测试
- 当前优先批次为：
  - `packages/agent-core`
  - `apps/frontend/agent-chat`
- 路径迁移优先保持镜像：
  - `src/graphs/main/foo.test.ts -> test/graphs/main/foo.test.ts`
  - `src/hooks/bar.int-spec.ts -> test/hooks/bar.int-spec.ts`
