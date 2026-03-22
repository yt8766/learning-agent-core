# 项目 TODO

基于 2026-03-23 当前仓库状态整理。

## 当前判断依据

- 根仓库当前已具备基础测试体系，现阶段可以先在稳定基线上继续补功能闭环和工程收口。
- `apps/worker/src` 目前除了 `main.ts` 外，`bootstrap / consumers / jobs / recovery / runtime / health` 基本仍是占位目录。
- `apps/backend/agent-server/README.md` 仍是 Nest 默认模板，服务级文档还没有收口到项目真实形态。
- `apps/frontend/agent-chat` 与 `apps/frontend/agent-admin` 已经接上真实 API，但会话观测、恢复链路、SSE 稳定性和联调体验仍可继续补强。
- `docs/agent-core-structure-report.md` 已经明确了 `agent-core` 的下一步推荐结构。
- `docs/frontend-backend-integration.md` 已经给出了前后端链路说明，但与当前实际接口实现仍存在差异，后续需要统一。

## P0：先补运行闭环

- [ ] 完成 `worker` 的真实异步执行链路
  - 目标目录：`apps/worker/src/consumers`、`apps/worker/src/jobs`、`apps/worker/src/recovery`、`apps/worker/src/runtime`
  - 目标结果：不再只做 `preview_task` 启动演示，而是能真正消费任务、执行学习任务、处理恢复流程
- [ ] 把文档学习任务接成完整异步流程
  - 让后端现有的 `createDocumentLearningJob` 不只负责建任务，还能由 worker 执行、更新状态、落盘结果、处理失败重试
- [ ] 打通恢复与失败重试闭环
  - 让 `recoverSession`、任务重试、checkpoint 恢复覆盖真实异常中断场景，而不只是停留在 API 能调用
- [ ] 明确后台任务状态机
  - 统一 queued、running、waiting_approval、failed、completed 等状态在 backend、worker、admin 中的含义和流转规则

## P1：补强核心能力

- [ ] 继续整理 `agent-core` 结构
  - 参考：`docs/agent-core-structure-report.md`
  - 目标结构：`adapters / flows / graphs / shared / utils / runtime / session`
  - 把当前按角色分散的逻辑，逐步迁移到按业务流组织
- [ ] 拆清聊天流、审批流、学习流
  - 避免所有能力继续堆在统一 orchestrator 中，后续新增能力时更容易扩展和测试
- [ ] 明确 LLM / tools / memory 的适配边界
  - 补 provider 切换、异常处理、降级策略、配置校验和调用边界
- [ ] 补统一的运行时上下文约束
  - 让 graph、session、tool execution、approval、learning 共享明确的上下文模型，减少隐式状态

## P1：前后端联调体验继续收口

- [ ] 给 `agent-admin` 增加会话观测视角
  - 当前更偏任务追踪，后续建议补 chat session 维度的排查页
- [ ] 补任务、会话、审批、学习确认之间的联动展示
  - 在 admin 侧可以快速从任务跳到审批，从审批跳到会话，从会话定位当前运行态
- [ ] 优化 SSE 断线重连与状态同步策略
  - 当前聊天页已做事件增量更新，下一步建议补断线恢复、回放边界、重复事件去重和异常提示
- [ ] 统一前端路由与页面落地
  - `agent-admin` 中已有多个 `pages/*` 占位目录，适合继续补齐独立页面，而不只是 dashboard 聚合视图
- [ ] 梳理聊天页的 session 切换体验
  - 明确切换会话、恢复会话、重进页面后的激活逻辑，减少当前对隐式 cookie 状态的依赖

## P1：工程化与文档收口

- [ ] 替换后端默认 README
  - 文件：`apps/backend/agent-server/README.md`
  - 写清楚启动方式、环境变量、接口说明、日志目录、数据目录和调试方法
- [ ] 增加一份真正可执行的本地联调指南
  - 覆盖根仓库启动顺序、backend、agent-chat、agent-admin、worker、`.env` 配置和常见问题
- [ ] 补部署与运行配置说明
  - 尤其是 cookie/session、跨域、日志目录、`data/*` 持久化策略
- [ ] 建立配置与启动健康检查
  - 启动前校验 LLM key、必填环境变量、数据目录可写性、前后端 API 地址、worker 依赖项
- [ ] 统一日志与错误输出规范
  - 让 backend、worker、frontend 在本地和后续部署环境中都有一致的错误定位方式

## P1：测试与质量补齐

- [ ] 增加后端 e2e 测试
  - 重点覆盖：聊天会话创建、SSE 推流、审批、学习确认、恢复
- [ ] 增加前端关键链路测试
  - 至少覆盖：聊天消息流式拼接、审批操作、admin 任务详情联动
- [ ] 增加异常场景测试
  - 包括模型不可用、工具审批拒绝、会话恢复失败、学习任务失败
- [ ] 增加接口契约测试
  - 校验 chat/admin API 返回结构、shared types、SSE event type 与前端消费逻辑的一致性
- [ ] 建立回归校验清单
  - 每次改动聊天链路、事件模型、审批机制时，都有固定的验证场景可回放

## P2：文档与实现对齐

- [ ] 对齐前后端对接文档与当前接口实现
  - 当前 `docs/frontend-backend-integration.md` 中描述的是 `sessions/:id/*` 风格接口
  - 当前 `apps/backend/agent-server/src/chat/chat.controller.ts` 实际主用的是基于 cookie 的 `/chat/messages`、`/chat/events`、`/chat/checkpoint`、`/chat/stream`
- [ ] 决定是“统一文档到现实现状”还是“统一实现到目标 REST 形态”
  - 避免后续前后端继续按两套接口理解开发
- [ ] 补接口版本和演进说明
  - 明确哪些接口是当前稳定入口，哪些属于后续准备收敛的过渡形态

## P2：会话标识策略优化

- [ ] 保留当前 cookie 方案的同时，补显式 `sessionId` 能力
  - 支撑多标签页并行会话、admin 跳转具体 session、外部客户端接入
- [ ] 梳理 session 选择优先级
  - 明确 query、body、cookie、本地状态之间的优先级与回退规则
- [ ] 评估无状态接口方向
  - 为后续更标准的 API 设计和第三方接入预留空间

## P2：数据治理与运行安全

- [ ] 制定 `data/*` 目录下的结构约束
  - 区分 memory、rules、runtime state、session、logs、learning results 的存储边界
- [ ] 增加历史数据清理与留存策略
  - 明确本地调试数据、长期保留数据、可清理缓存的范围
- [ ] 区分开发数据与正式数据
  - 避免联调过程中互相污染运行状态和历史记录
- [ ] 增加日志脱敏与敏感信息处理
  - 包括 token、用户输入、外部工具调用结果等内容的裁剪与隐藏规则

## P2：观测与评估能力

- [ ] 为任务和会话补更清晰的指标与日志聚合
  - 例如任务耗时、节点耗时、审批等待时长、失败原因分类
- [ ] 把 `packages/evals` 接成真正可跑的评估入口
  - 支撑回归评估、结果对比、prompt 或流程改动前后的效果验证
- [ ] 增加复盘视图
  - 能从一次任务或会话中快速还原：计划、执行、审批、失败点、最终输出

## 分阶段里程碑

### 第一阶段：跑通闭环

- 完成 worker 真实消费能力
- 打通学习任务执行、恢复、失败重试
- 确保 backend、worker、admin 能基于统一任务状态协同工作

### 第二阶段：收口主链路

- 稳定 SSE、会话恢复、审批流和运行态同步
- 对齐前后端对接文档与真实接口
- 建立配置校验、健康检查和基础联调文档

### 第三阶段：提升可维护性

- 重构 `agent-core` 结构
- 补契约测试、e2e、异常回归用例
- 扩展 admin 观测、评估体系、数据治理和运行安全能力

## 建议执行顺序

1. 先做 `worker` 与学习任务的真实闭环
2. 再补恢复、重试、SSE 稳定性和会话联动
3. 然后整理 `agent-core` 结构，避免后续继续堆复杂度
4. 接着统一文档、接口说明、配置校验和本地联调流程
5. 最后扩展 admin 观测、评估体系、数据治理和运行安全能力
