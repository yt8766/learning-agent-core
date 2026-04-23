# Storage And Search

状态：current
文档类型：reference
适用范围：`packages/memory`、`data/memory`、`data/knowledge`
最后核对：2026-04-16

## 1. 这篇文档说明什么

本文档说明 `@agent/memory` 当前在仓库里的职责边界，以及 repository、search、vector、embeddings、governance 与本地数据目录之间的关系。

本文是“当前实现与近期收敛约束”文档；如果需要看长期蓝图与主动内存管理方向，优先阅读：

- [Agent Memory Architecture](/docs/memory/agent-memory-architecture.md)

## 2. 当前目录结构

`packages/memory/src` 当前主要分为：

- `src/repositories`
  - memory / rule / runtime-state / semantic-cache / profile / reflection / evidence-link 等持久化仓储实现与对外分组导出
- `src/search`
  - 统一搜索 contract、查询入口、memory path helper 与后续 ranking 收敛点
- `src/vector`
  - 向量索引与 knowledge vector 文档基础能力
- `src/embeddings`
  - embedding provider 相关适配
- `src/*.ts`
  - 当前只保留跨域复用的 governance / record helper，不再承载 repositories/search/vector/embeddings 的实现文件

当前已落地并已物理收敛到 `src/repositories/` 的文件包括：

- `memory-repository.ts`
  - 主 memory 持久化入口，负责 append / search / history / governance 协作
- `memory-event-repository.ts`
  - 记录 memory create/update/status/override/rollback 事件历史
- `rule-repository.ts`
  - 承载 rule 存储、检索与状态流转
- `runtime-state-repository.ts`
  - 承载 runtime 快照持久化
- `semantic-cache-repository.ts`
  - 承载语义缓存记录
- `user-profile.repository.ts`
  - 承载用户画像 patch/get 基础存储
- `reflection.repository.ts`
  - 承载可检索 reflection 记录
- `resolution-candidate.repository.ts`
  - 承载写入冲突后的决议候选
- `memory-evidence-link.repository.ts`
  - 承载 memory 与 evidence 的绑定

当前已物理收敛到其他子目录的文件包括：

- `src/search/memory-search-service.ts`
  - 统一 memory / rule 搜索入口
- `src/search/memory-scrubber-service.ts`
  - 记忆隔离与清洗校验入口
- `src/search/memory-paths.ts`
  - memory 相关 sibling path helper
- `src/vector/vector-index-repository.ts`
  - 向量索引主实现
- `src/vector/knowledge-vector-documents.ts`
  - knowledge 向量文档加载
- `src/embeddings/embedding-provider.ts`
  - embedding provider facade

## 3. 当前职责边界

`packages/memory` 负责：

- memory / rule / runtime-state repository
- vector index
- semantic cache
- 统一搜索 contract
- 检索重排与 query builder
- 记忆治理基础能力
- consolidation 基础能力
- memory event history
- profile / reflection / resolution candidate 本地存储

不负责：

- agent 主链编排
- delivery / review / research 流程控制
- app 层 controller / 页面状态

这些能力应继续留在 `packages/runtime`、对应 `agents/*` 宿主或 `apps/*`。

额外约束：

- 主动内存管理中的 `core_memory_append`、`core_memory_replace`、`archival_memory_search` 由 runtime / tool facade 暴露
- `packages/memory` 只提供底层存储、检索、排序、治理能力，不直接承载 agent 决策

## 4. `data/memory` 与 `data/knowledge`

- `data/memory`
  - 面向可复用沉淀，例如 memory / rule / 相关本地存储
- `data/knowledge`
  - 面向知识检索副产物，例如 catalog、sources、chunks、vectors、ingestion

简单理解：

- `memory` 更偏“沉淀后的复用知识与治理对象”
- `knowledge` 更偏“检索与索引过程中的原料和索引产物”

## 5. 搜索链路约束

当前检索层应继续围绕统一抽象收敛：

- `MemorySearchService`
  - 面向 runtime / session / ministries 提供统一 memory / rule 检索入口
- `VectorIndexRepository`
  - 作为向量库接入点
- `LocalVectorIndexRepository`
  - 当前默认本地实现

约束：

- 上层应优先调用统一搜索入口，不要在 app 层或 graph 外围各自直读底层仓储
- semantic cache 只是第一层，不替代后续向量检索
- 检索不应长期停留在“text + vector 去重”的被动模式
- 后续应逐步收敛为：
  - entity / scope 硬过滤
  - memoryType 定向过滤
  - rule 优先召回
  - 向量 / 全文 / 关系混合召回
  - `recency + importance + relevance` 公式化重排
  - override / disputed / stale 降权或剔除

当前已实现的基础能力：

- `FileMemoryRepository.searchStructured`
  - 支持 `scopeContext / entityContext / memoryTypes / includeReflections`
- `DefaultMemorySearchService`
  - 保留旧 `search(query, limit)` 兼容入口
  - 新增结构化 `search(request)` 入口
- 本地 ranking 现在已纳入：
  - recency
  - importance
  - evidenceWeight
  - adoptionWeight
  - scopeWeight
  - stale / disputed 降权

## 6. 主动内存管理与包边界

`packages/memory` 支持的是“主动内存管理”的底层能力，但不直接实现 Agent 的操作系统语义。

边界应理解为：

- `packages/runtime`
  - 负责 Core Memory 维护
  - 负责何时触发 archival 检索
  - 负责 correction override 运行时闭环
- `packages/memory`
  - 负责 Archival Memory 的存储、搜索、排序、治理与归并

因此，后续即使引入：

- `archival_memory_search`
- `memory_override`
- `profile_patch`

也应通过 runtime facade 或 tool 层对外暴露，而不是让上层直接操作 repository。

当前已提供的底层治理动作包括：

- `listEvents`
- `getHistory`
- `recordFeedback`
- `override`
- `rollback`
- `getProfile`
- `patchProfile`
- `listResolutionCandidates`
- `resolveResolutionCandidate`

这些动作目前先通过 repository / runtime facade 暴露，后续再继续收敛为更稳定的 runtime tool / backend module 接口。

## 7. 当前 runtime 接线状态

截至 `2026-04-16`，runtime 侧已经开始从“被动 Top-K 注入”向“结构化记忆调用”收敛：

- `packages/runtime/src/session/session-coordinator-thinking-context.ts`
  - 会话上下文优先按 `scope + entity + memoryType` 拉取结构化记忆
  - 仅把 core-like memory、rules 与最多 `2` 条 reflection 注入上下文
- `packages/runtime/src/graphs/main/lifecycle/main-graph-lifecycle-governance.ts`
  - 创建任务时会把结构化 memory / rule / reflection 命中结果转成 evidence
  - failure pattern 会以可审计 evidence 形式进入主链，而不是只留在隐式 prompt
- `packages/runtime/src/flows/learning/learning-flow.ts`
  - hydrate 阶段改为优先复用结构化记忆检索结果，避免 learning 只依赖旧的 query-only 搜索
- `agents/supervisor/src/flows/ministries/hubu-search-ministry.ts`
  - 户部研究改为优先走结构化 memory 检索
  - 研究阶段命中的 failure pattern / reflection 会进入 research evidence，而不是只参与模型私有上下文
- `apps/frontend/agent-chat/src/pages/chat-home/chat-home-mission-control.tsx`
  - 聊天前台已经可以对本轮实际采用的 memory reuse 发送 `adopted / dismissed / corrected` 反馈
  - 当前只对真正命中的 memory evidence 生效，rule reuse 暂不直接写反馈
  - `Forget this` 会把当前命中的长期记忆覆写为 session-scope ignore 语义，并同步记录 `dismissed`，让用户可以只在本轮忽略它
  - `记错了` 现在会触发会话级 override，允许用户用一句替代表述立即覆写当前会话的记忆使用结果
  - `仅本会话` 允许用户把当前命中的 memory 复制为 session-scope override，只在本轮沿用，不污染长期记忆
  - 当 lifecycle reuse evidence 带有 ranking `reason / score` 时，mission control 会直接显示“采用原因”，把 entity/scope/relevance 命中理由透给前台，而不是只展示一条模糊的 summary
- `apps/frontend/agent-chat/src/pages/chat-home/chat-home-workbench-section-renders.tsx`
  - workbench 的 `参考内容` 区现在也会对 memory/rule reuse evidence 展示 `reason / score / scope / related entities`
  - 这部分解释直接来自 runtime reuse evidence 的 `detail` 字段，不再由前端自行猜测命中原因
- `apps/frontend/agent-chat/src/components/chat-message-cards/evidence-card.tsx`
  - 聊天主线程里的 `EvidenceCard` 与 inline source 也会显示 memory/rule reuse 的 `reason / score / scope / related entities`
  - 因此用户在主线程与 workbench 里看到的是同一套解释语义，不会出现一个能解释、一个只能看摘要的割裂体验
- `apps/frontend/agent-admin/src/features/learning-center/memory-resolution-queue-card.tsx`
  - Learning Center 已新增独立的 memory resolution queue 卡片
  - 管理员可以直接接受或驳回 `ResolutionCandidateRecord`，并内联查看 challenger / incumbent 的当前快照、最近事件与 usage metrics
- `apps/frontend/agent-admin/src/features/learning-center/memory-governance-tools-card.tsx`
  - Learning Center 已新增 profile lookup / patch 与 memory history lookup 工具卡
  - 当前可直接查询并更新用户画像、查看最近 memory 事件链、usage metrics、从历史事件版本一键回滚 memory，并对当前 memory 做 admin override
- `apps/frontend/agent-admin/src/features/learning-center/memory-browser-card.tsx`
  - Learning Center 现在还提供长期记忆浏览器，可通过结构化 `memory/search` 直接查看 active/stale/disputed/archived memory
  - 浏览器会展示 score / reason / verification / usage 指标，并可直接切换到选中 memory 的快照、事件链和 evidence link 视图
  - 常用状态迁移如 `失效 / 恢复 / 归档` 已直接挂到结果行，admin 不必先跳转到其他治理卡片
  - 当前还支持按 `constraint / preference / procedure / failure-pattern` 过滤，便于分别治理约束、偏好、经验与失败模式
  - `Memory Feedback Insight` 会对当前搜索结果里的 usageMetrics 做 adopted / dismissed / corrected 聚合，便于快速判断这批长期记忆的实际采纳效果
  - 当前已支持 version compare，可对比同一 memory 的两个版本快照，并显示 current version 与 latest event
- `apps/frontend/agent-admin/src/features/learning-center/memory-center-panel.tsx`
  - `Memory Center` 已从 Learning 内嵌工具提升为独立 center，整合 Usage Insight 与治理浏览器
- `apps/frontend/agent-admin/src/features/learning-center/profile-center-panel.tsx`
  - `Profile Center` 已作为独立 center 提供 profile lookup / patch，并显示 actor 与更新时间
- `apps/frontend/agent-admin/src/api/admin-api-governance.ts`
  - 当前已提供 `GET /memory/insights/usage` 与 `GET /memory/:id/compare/:leftVersion/:rightVersion` 的前端调用封装
- `packages/runtime/src/memory/active-memory-tools.ts`
  - runtime 已显式导出 `core_memory_append`、`core_memory_replace`、`archival_memory_search` 对应 facade
  - session / lifecycle / learning / supervisor-hubu 的结构化检索入口已优先改为 `archival_memory_search` 风格调用，而不是各处直接拼 `memorySearchService.search(...)`
- `apps/frontend/agent-admin/src/features/learning-center/memory-insight-card.tsx`
  - admin 侧 memory 快照、事件链与 usage metrics 展示已收敛为共享组件
  - resolution queue 与 governance tools 现在共用同一套 memory 详情视图，已可显示 verificationStatus、evidence 数量、lastVerifiedAt，并按需加载具体 evidence links
- `apps/frontend/agent-admin/src/features/evidence-center/evidence-center-panel.tsx`
  - admin 侧 Evidence Center 现在会读取 `Memory Insight` 写入的 evidence id 高亮上下文
  - 来自 memory 的 sourceEvidenceIds 会通过 `sessionStorage` 一跳带到 `#/evidence`，并在 Evidence Center 中优先排序、打上 `memory linked` 标记，支持手动清除高亮
- `apps/frontend/agent-chat/src/pages/chat-home/chat-memory-chips.tsx`
  - chat 前台已把本轮实际采用的 memory / rule / reflection 收敛成正式 `Memory Chips`
  - 每条命中项都会在 mission control 下方给出 `Why this memory was used` 文案，显示 reason / score / scope / relatedEntities
- `apps/frontend/agent-chat/src/pages/chat-home/chat-memory-feedback-strip.tsx`
  - `Update preference` 仅对 `memoryType=preference` 开放，并优先从 `relatedEntities` 中提取 user 锚点后走 `profile_patch`
  - 如果无法从 summary / tags 自动推断 profile 字段，前台会要求显式使用 `field: value` 格式，避免把偏好错误写入画像

这意味着当前主链已经具备：

- reflection 在 planning / lifecycle 预热阶段参与上下文构建
- entity / scope 过滤开始在 runtime 侧真实生效
- 记忆使用原因可以从 evidence / search reason 继续往 `agent-chat` 与 `agent-admin` 解释层传递

## 8. 继续阅读

- [memory 文档目录](/docs/memory/README.md)
- [Agent Memory Architecture](/docs/memory/agent-memory-architecture.md)
- [目录地图](/docs/repo-directory-overview.md)
- [Runtime State Machine](/docs/runtime/runtime-state-machine.md)
