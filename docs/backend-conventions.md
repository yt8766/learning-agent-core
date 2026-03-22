# 后端规范

适用范围：

- `apps/backend/agent-server`
- `apps/worker`
- 与后端运行时直接相关的 `packages/*`

## 1. 技术边界

- 后端统一使用 `NestJS + TypeScript`
- 所有后端源码文件使用 `.ts`
- 应用层只通过 `@agent/*` 使用共享包
- 禁止应用层直连 `packages/*/src`
- 禁止应用层依赖其他应用的 `dist` 或 package 的 `build` 路径

## 2. 目录与模块规范

### `apps/backend/agent-server/src`

- `app/`：健康检查与轻量应用级信息
- `chat/`：会话、消息、SSE、恢复
- `tasks/`：内部执行观测与调试接口
- `approvals/`：审批接口
- `learning/`：学习确认与文档学习入口
- `memory/`：memory API 门面
- `rules/`：rules API 门面
- `skills/`：skills API 门面
- `runtime/`：后端运行时门面
- `logger/`：日志模块、filter、middleware、interceptor
- `common/`：跨模块复用的 Nest 通用层
  - `dto/`
  - `filters/`
  - `interceptors/`
  - `pipes/`
  - `decorators/`
  - `types/`

每个业务域默认包含：

- `*.module.ts`
- `*.controller.ts`
- `*.service.ts`

当规模需要时再增加：

- `dto/*.ts`
- `types/*.ts`
- `constants/*.ts`

### `apps/worker/src`

- `bootstrap/`：worker 启动装配
- `jobs/`：任务与学习任务入口
- `consumers/`：事件或队列消费
- `runtime/`：调用 `@agent/agent-core`
- `recovery/`：checkpoint 恢复
- `health/`：健康与运行状态

## 3. 分层规范

- `controller`：收发请求、参数转换、调用 service
- `service`：业务编排与领域逻辑入口
- `module`：只做依赖组织
- 复杂复用逻辑进入 `packages/*`
- `RuntimeService` 作为后端运行时门面

禁止：

- 在 `controller` 中写复杂编排逻辑
- 在 `module` 中写业务逻辑
- 将可复用逻辑散落在多个 Nest 模块中复制实现

## 4. API 规范

- 所有外部接口统一使用 `/api` 前缀
- 路由命名保持资源导向和稳定
- `chat sessions` 是主产品入口
- `tasks` 保留为内部执行、观测和调试接口
- DTO 命名以 `Dto` 结尾
- 请求和响应必须有明确类型

## 5. 日志规范

- 统一使用项目 logger 模块
- 启动日志风格保持接近官方 Nest 输出
- 请求日志必须包含 `requestId` 与 `traceId`
- 对 `password`、`token`、`authorization`、`secret`、`apiKey` 等字段做脱敏
- 请求、响应、异常、启动日志风格保持一致

## 6. Agent 与持久化规范

- `AgentOrchestrator` 负责任务执行与图编排
- `SessionCoordinator` 负责聊天会话、消息、事件和 checkpoint
- `session / task / approval / learning candidate` 必须支持恢复
- 高风险动作必须审批
- 学习产物先进入确认态，再写入长期存储

## 7. 本地数据目录规范

- 本地运行数据统一放在仓库根级 `data/`
- `data/` 与 `apps/`、`packages/` 同级
- 禁止把 memory、rules、skills、runtime state 等运行数据放进具体 app 目录
- 禁止新增 `apps/backend/agent-server/data` 这类应用内数据目录作为长期方案
- 后端读取和写入本地数据时，默认以仓库根级 `data/` 为准

推荐结构示例：

- `data/memory/`
- `data/runtime/`
- `data/skills/`
- `data/logs/`（如果后续决定统一日志目录）

## 8. 包引用规范

推荐：

- `@agent/shared`
- `@agent/agent-core`
- `@agent/memory`
- `@agent/tools`
- `@agent/skills`

禁止：

- `../../../../../packages/agent-core/src/...`
- `../build/...`
- `../dist/...`

## 9. 命名规范

- 文件名：`kebab-case`
- 类名：`PascalCase`
- DTO 文件：`*.dto.ts`
- 模块文件：`*.module.ts`
- 控制器文件：`*.controller.ts`
- 服务文件：`*.service.ts`

## 10. 后端检查建议

保留少量根级约束：

- 根级 `eslint.config.mjs`
- 根级 `prettier.config.js`
- 根级 `husky`
- 各 app/package 必要的 `tsconfig`

不要新增：

- 每个后端应用独立一套 ESLint
- 每个子目录独立一套 Prettier
- 大量重复脚本和重复检查配置
