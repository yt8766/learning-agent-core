# Agent Memory Architecture

状态：current
文档类型：architecture
适用范围：`packages/core`、`packages/memory`、`packages/runtime`、`agents/supervisor`、`apps/backend/agent-server`、`apps/frontend/agent-chat`、`apps/frontend/agent-admin`
最后核对：2026-04-16

## 1. 目标与范围

本文定义本仓库“大模型记忆系统”的长期演进方向。目标不是给聊天补一个临时 RAG，而是为 `Human / Supervisor / 六部` 自治体系提供一套：

- 可解释
- 可检索
- 可沉淀
- 可纠错
- 可治理
- 可按实体隔离

的长期记忆系统。

本文描述的是目标架构与当前仓库的收敛路径，不是某个单文件 API 说明。实现时必须同时遵守：

- [README](/README.md)
- [项目规范总览](/docs/conventions/project-conventions.md)
- [架构总览](/docs/architecture/ARCHITECTURE.md)
- [Storage And Search](/docs/packages/memory/storage-and-search.md)

## 2. 设计原则

### 2.1 记忆按语义分层，不按存储技术分层

长期至少区分以下 5 类记忆：

- 会话记忆：当前 thread 里短期复用的上下文
- 用户记忆：用户画像、偏好、执行风格、长期禁忌
- 任务记忆：某类任务的成功路径、失败坑点、恢复点
- 知识记忆：代码、文档、外部资料、已验证事实
- 反思记忆：执行后提炼出的经验、失败模式、策略建议

不要把这些内容长期混在“一张 memory 表 + metadata JSON”里，也不要把它们统一塞进一个向量库后交给 Top-K 决定命运。

### 2.2 记忆必须证据驱动

- `Evidence` 回答“这条信息从哪来”
- `Memory` 回答“这条信息以后值不值得复用”
- `Profile` 回答“这个用户通常希望怎样被服务”
- `Rule` 回答“以后必须遵守什么”
- `Reflection` 回答“系统从一次执行里学到了什么”

长期记忆默认应带：

- `sourceEvidenceIds`
- `sourceType`
- `confidence`
- `importance`
- `derivedBy`
- `lastVerifiedAt`
- `verificationStatus`

没有来源约束的记忆，不应直接升为长期可复用知识。

### 2.3 学习默认不是自动生效

写入链路固定分为：

1. `Observation`
2. `Candidate`
3. `Scoring`
4. `Decision`
5. `Consolidation`

也就是先观察、再抽取候选、再打分和治理，最后才决定丢弃、短期缓存、长期激活、升为规则、还是进入审批池。

### 2.4 Prompt 只承载核心内存，不承载全部内存

本仓库不采用“每次任务启动时把所有相关记忆 Top-K 拼进 Prompt”的单一路线。长期默认采用：

- `Core Memory`
  - 常驻 Prompt
  - 只放用户画像核心切片、当前任务约束、当前会话必需状态
  - 必须严格控长，默认不超过约 `2000` tokens
- `Archival Memory`
  - 存在 `packages/memory` 管辖的 repository / vector / search / governance 体系中
  - 默认不进入 Prompt
  - 只能通过显式检索或工具调用按需读取

这层分级存储是运行时架构要求，不是优化建议。

## 3. 当前仓库现状

当前仓库已经具备记忆系统的一阶段基础：

- `packages/memory`
  - 已有 `memoryRepository`、`ruleRepository`、`vectorIndexRepository`、`MemorySearchService`
- `packages/runtime`
  - 已有 `LearningFlow`、`learning.graph.ts`、任务后 learning candidate 生成与确认能力
- `apps/backend/agent-server`
  - 已有 `memory`、`evidence`、`learning` API 与 runtime center 聚合
- `apps/frontend/agent-admin`
  - 已有 `Learning Center`、`Evidence Center`
- `apps/frontend/agent-chat`
  - 已有 learning summary、evidence card 等前台呈现

但当前实现仍以“被动搜索 + 结果拼接”为主，和长期目标相比还有这些缺口：

- `MemoryRecord` 仍偏扁平，缺少语义分层与 schema-first 的长期 contract
- 检索层仍以 text + vector 去重为主，尚未形成公式化重排
- 运行时缺少主动内存读写工具
- 记忆与实体锚点的绑定不够强
- 冲突决议更多偏后台治理，缺少会话内即时 override
- 用户画像仍未独立为一等长期模型

后续改动应在保留现有可用性的前提下向本文收敛，不要回退成“纯 summary + 向量库”方案。

## 4. 长期分层架构

长期推荐分为 6 层：

### 4.1 Contracts 层

负责稳定 schema、DTO、event、payload contract。

落位：

- `packages/core/src/memory/`

至少应收口：

- `MemoryRecord`
- `MemoryRuleRecord`
- `UserProfileRecord`
- `ReflectionRecord`
- `LearningCandidateRecord`
- `MemoryEvidenceLinkRecord`
- `MemoryEntityLinkRecord`
- `MemoryOverrideRecord`
- `MemorySearchRequest`
- `MemorySearchResult`

要求：

- 默认 schema-first
- 类型通过 `z.infer` 推导
- 历史上的 `packages/shared` 只承担过 compat re-export 或前端展示组合；当前这类职责应落到真实宿主本地

### 4.2 Storage 层

负责持久化和索引，不负责 runtime 编排。

落位：

- `packages/memory/src/repositories/`
- `packages/memory/src/vector/`
- `packages/memory/src/embeddings/`
- `packages/memory/src/search/`
- `packages/memory/src/governance/`
- `packages/memory/src/consolidation/`

职责：

- 结构化 repository
- 向量索引
- 全文检索
- 规则索引
- 记忆合并、过期、争议、归档
- 隐私清洗与敏感字段擦除

### 4.3 Retrieval 层

负责多路召回、硬过滤、重排、压缩和结果解释。

长期默认链路：

1. 先按 `entity` 与 `scope` 做硬过滤
2. 再按 `memoryType` 做任务导向过滤
3. 强规则和高优先级约束优先返回
4. 再做向量/全文/关系召回
5. 最后做多维重排、压缩和去重

### 4.4 Learning 层

负责把执行结果转成候选记忆，并决定升级、降级或丢弃。

落位：

- `packages/runtime/src/flows/memory/`
- `packages/runtime/src/graphs/memory-learning.graph.ts`

职责：

- 观察任务与审批过程
- 抽取候选记忆
- 反思成功/失败模式
- 生成 candidate / reflection / override 建议
- 交由治理层判定是否生效

### 4.5 Governance 层

负责治理与可控性，不让记忆系统变成黑箱。

职责：

- approve / reject
- invalidate / retire / archive
- stale / disputed / superseded 标记
- merge / split / freeze
- 审计、来源解释、纠错与回滚

治理台默认落位：

- `agent-admin` 的 `Memory Center`
- `Learning Center`
- `Evidence Center`
- `Profile Center`

### 4.6 Runtime Integration 层

负责把记忆系统真正接到 Supervisor / 六部 / chat / admin 主链里。

包括：

- 规划前加载核心画像与规则
- 执行中按需触发 archival 检索
- 运行后产出 reflection 与 learning candidate
- 冲突时触发即时 override
- 前台展示“为什么使用了这条记忆”

## 5. 主动内存管理

### 5.1 从被动召回升级为主动读写

长期默认不再采用单纯的：

1. 任务开始
2. 检索相关记忆
3. Top-K 塞入 Prompt
4. 模型开始执行

而是升级为带“操作系统语义”的主动内存管理：

- Core Memory
  - 常驻、短、小、强约束
- Archival Memory
  - 海量、慢速、默认离线
- Active Memory Tools
  - 由 Agent 自己决定何时读写

### 5.2 Core Memory 组成

Core Memory 只保留任务成功所必需的高价值信息：

- 当前用户画像核心片段
- 当前任务约束
- 当前 session 的关键中断、恢复状态
- 必须立即遵守的 rule / approval policy

它不能演变成第二个超长 summary 区。任何不影响当下执行的历史经验，都应留在 Archival Memory。

### 5.3 Active Memory Tools

运行时应为 Agent 暴露至少三类系统级工具：

- `core_memory_append`
  - 追加短期核心约束或当前页签状态
- `core_memory_replace`
  - 在上下文换页时替换 Core Memory 片段，避免无限膨胀
- `archival_memory_search`
  - 显式检索历史记忆、反思、规则、程序经验

后续可扩展：

- `memory_override`
- `memory_mark_disputed`
- `profile_patch`

但这类能力仍应通过稳定 facade 暴露，不应让 app 层直接拼 repository。

### 5.4 为什么不靠无限上下文

本仓库不把“扩大上下文窗口”视为长期解法，原因包括：

- 存在 `Lost in the Middle`
- token 成本会持续放大
- 核心约束容易被历史噪音稀释
- 无法替代治理、纠错和实体隔离

精准、按需、可解释的主动内存管理，优先级高于暴力全量投喂。

## 6. 检索与重排策略

### 6.1 检索不是纯向量召回

长期默认采用混合检索：

- 结构化过滤
- 规则优先召回
- 关键词检索
- 向量召回
- 图关系召回
- 压缩与去重

### 6.2 三维打分公式

`memory-ranking.service.ts` 应收敛为显式公式化重排，而不是只靠数据库返回顺序。

推荐基础公式：

`Score = α * Recency + β * Importance + γ * Relevance`

其中：

- `Recency`
  - 采用指数衰减，例如 `exp(-k * age)`
  - 让最近变化的偏好和上下文更容易浮到前面
- `Importance`
  - 写入时打基础分
  - 表示这条记忆对长期执行策略的重要程度
- `Relevance`
  - 当前 query / task / entity 对该记忆的语义相关度

在工程实现中还应继续叠加这些校正项：

- `evidenceWeight`
- `verificationWeight`
- `reuseWeight`
- `scopeWeight`
- `overridePenalty`
- `stalePenalty`

### 6.3 遗忘曲线要求

近期性不应只是 `updatedAt desc`。长期应显式建模时间衰减：

- 闲聊型、偏低重要度记忆应快速衰减
- 高重要度规则和用户长期禁忌应缓慢衰减
- 已验证、强约束、强实体绑定的记忆应优先保持稳定

### 6.4 为什么不能只靠向量库分数

纯向量分数没有：

- 时间流逝概念
- 重要性概念
- 实体隔离概念
- 覆写优先级概念

因此它只能作为 `Relevance` 的一个分量，不能充当完整排序逻辑。

## 7. 实体绑定与硬隔离

### 7.1 记忆必须绑定实体

仅有 `scopeType=user|task|workspace` 还不够。长期每条记忆都应能绑定到具体实体锚点。

建议字段：

- `relatedEntities: Array<{ entityType: 'user' | 'project' | 'repo' | 'workspace' | 'tool' | 'connector'; entityId: string; relation?: string }>`

常见实体包括：

- 用户 ID
- 项目 ID
- 仓库 URL / repo slug
- workspace root
- 特定 tool / connector / environment

### 7.2 检索顺序

实体绑定不是提示词辅助信息，而是检索阶段的硬过滤条件。默认顺序：

1. 先做 `Entity Match`
2. 再做 `scope` / `memoryType` 过滤
3. 再做向量和全文召回
4. 再做重排

### 7.3 为什么不能只把实体写进 content

把“这是 A 项目的规则”仅写进 `content` 再交给模型自己区分，不足以避免：

- 跨项目污染
- 相似描述混淆
- 用户偏好在多个 repo 之间串用
- 对抗性 prompt 或模糊 query 造成误召回

工程上应优先使用硬过滤，再让模型做软理解。

## 8. 实时冲突决议与覆写

### 8.1 冲突必须分“后台归并”和“会话内即时修正”

后台 `consolidation` 负责：

- merge
- dedupe
- stale / disputed 清理
- 周期性质量收敛

但用户在当前会话中的强纠正，不能等后台批处理。

### 8.2 Correction Override Node

当运行时检测到用户显式纠正，例如：

- “你记错了”
- “以后不要这样做”
- “这条偏好已经失效”
- “这个规则只适用于另一个项目”

应立即触发高优先级 override 流程：

1. 旧记忆立刻标记为 `disputed`、`superseded` 或设置即时 `expiresAt`
2. 新建一条 replacement memory / rule / profile patch
3. 建立 `overrideFor` / `supersedes` 关系
4. 将结果同步写入当前 Core Memory，确保当前回合立刻生效

### 8.3 运行时要求

这类 override 必须是同步生效的 runtime 行为，而不是纯后台治理。

建议 runtime 入口：

- `packages/runtime/src/flows/memory/nodes/correction-override.node.ts`
- `packages/runtime/src/graphs/memory-retrieval.graph.ts`
- `agent-chat` 的显式 “Update preference / Forget this / Session only” 操作

### 8.4 为什么不能新旧记忆并存等待模型自己选

如果“自动提交代码”和“禁止自动提交代码”同时被召回，模型只会：

- 随机择一
- 陷入犹豫
- 反复追问用户

这会直接伤害用户对记忆系统的信任。冲突项必须有显式优先级与 override 关系。

## 9. 数据模型收敛方向

### 9.1 `packages/core` 应成为唯一主 contract 宿主

后续记忆相关稳定 contract 默认放到：

- `packages/core/src/memory/schemas/*`
- `packages/core/src/memory/index.ts`

历史上的 `packages/shared` 只承担 compat re-export 或前端展示组合，不再作为长期主定义；当前请以 `packages/core + 宿主本地 facade` 为准。

### 9.2 建议核心模型

建议至少收口以下对象：

- `MemoryRecord`
  - 通用长期记忆
- `UserProfileRecord`
  - 用户画像
- `ReflectionRecord`
  - 一次执行的反思与经验提炼
- `LearningCandidateRecord`
  - 进入治理前的候选池
- `MemoryRuleRecord`
  - 强约束规则化记忆
- `MemoryEvidenceLinkRecord`
  - 记忆与证据绑定
- `MemoryEntityLinkRecord`
  - 记忆与实体锚点绑定
- `MemoryOverrideRecord`
  - 冲突覆写链路

### 9.3 `MemoryRecord` 长期字段建议

在当前 `MemoryRecord` 基础上，逐步补齐：

- `scopeType`
- `memoryType`
- `title`
- `summary`
- `content`
- `tags`
- `relatedEntities`
- `importance`
- `confidence`
- `freshnessScore`
- `sourceEvidenceIds`
- `sourceTaskId`
- `sourceSessionId`
- `verificationStatus`
- `lastVerifiedAt`
- `lastUsedAt`
- `expiresAt`
- `status`
  - `candidate | active | stale | disputed | superseded | archived`
- `overrideFor`

当前仓库已有 `status`、`supersededById`、`quarantined` 等字段，可视作迁移前置基础，但仍不足以表达长期语义。

## 10. 推荐目录蓝图

### 10.1 `packages/core`

```text
packages/core/src/memory/
  schemas/
    memory-record.schema.ts
    user-profile-record.schema.ts
    reflection-record.schema.ts
    learning-candidate-record.schema.ts
    memory-rule-record.schema.ts
    memory-evidence-link.schema.ts
    memory-entity-link.schema.ts
    memory-override-record.schema.ts
  index.ts
```

### 10.2 `packages/memory`

```text
packages/memory/src/
  repositories/
    memory-record.repository.ts
    user-profile.repository.ts
    reflection.repository.ts
    learning-candidate.repository.ts
    memory-rule.repository.ts
    memory-evidence-link.repository.ts
    memory-entity-link.repository.ts
    memory-override.repository.ts
  search/
    memory-retrieval.service.ts
    memory-ranking.service.ts
    memory-query-builder.ts
  vector/
    vector-index.repository.ts
  embeddings/
    embedding-provider.ts
  consolidation/
    memory-consolidation.service.ts
  governance/
    memory-retention.service.ts
    memory-staleness.service.ts
    memory-merge.service.ts
    memory-override.service.ts
  scrubbing/
    memory-privacy-scrubber.ts
  index.ts
```

### 10.3 `packages/runtime`

```text
packages/runtime/src/graphs/
  memory-learning.graph.ts
  memory-retrieval.graph.ts

packages/runtime/src/flows/memory/
  nodes/
    load-core-memory-context.node.ts
    load-user-profile.node.ts
    archival-memory-search.node.ts
    correction-override.node.ts
    extract-learning-candidates.node.ts
    consolidate-memory.node.ts
  prompts/
    reflection.prompt.ts
  schemas/
    reflection.schema.ts
```

### 10.4 `apps/backend/agent-server`

```text
apps/backend/agent-server/src/modules/memory/
  controllers/
    memory.controller.ts
    profile.controller.ts
    learning-candidates.controller.ts
  services/
    memory-query.service.ts
    memory-admin.service.ts
    profile-admin.service.ts
  dto/
```

### 10.5 `apps/frontend/agent-admin`

```text
apps/frontend/agent-admin/src/features/
  memory-center/
  learning-center/
  evidence-center/
  profile-center/
```

### 10.6 `apps/frontend/agent-chat`

```text
apps/frontend/agent-chat/src/features/memory/
  memory-chip.tsx
  memory-reason-card.tsx
  profile-preference-editor.tsx
```

## 11. 演进顺序

### 阶段 1：先做可用

- Core / Archival 基础分层
- `UserProfileRecord`
- `LearningCandidateRecord`
- runtime 侧核心偏好和约束读取
- `archival_memory_search` 最小可用版

目标：

- 系统开始“记得住”
- 但不会因为全量塞 Prompt 而失控

### 阶段 2：再做可治理

- `MemoryEvidenceLinkRecord`
- candidate approve / reject
- stale / disputed / archived 状态
- admin 侧可编辑、归档、撤销

目标：

- 学习沉淀不再是黑箱

### 阶段 3：再做主动学习与重排

- reflection flow
- 公式化重排
- 遗忘曲线
- procedure / failure pattern 升级

目标：

- 系统积累经验，而不是只存资料

### 阶段 4：最后做高级画像与策略记忆

- approval preference
- tool preference
- risk profile
- team / project profile
- planner 侧策略记忆接入
- correction override runtime 闭环

目标：

- 记忆开始真正参与自治决策

## 12. 落地约束

### 12.1 对 `packages/memory` 的约束

`packages/memory` 继续只承载：

- repository
- search / ranking
- vector / embeddings
- governance / consolidation 基础能力

不要把：

- Supervisor prompt
- runtime 主链编排
- app controller glue

放回 `packages/memory`。

### 12.2 对 runtime 的约束

主动内存管理、override、learning flow 都属于 runtime / graph / flow 语义，应放在：

- `packages/runtime`
- `agents/supervisor`

而不是 app service 里。

### 12.3 对前端的约束

前台和后台都不应把记忆系统做成“一个搜索框 + 一坨 JSON”。

- `agent-chat`
  - 强调被用到的记忆、使用原因、临时覆盖和忘记动作
- `agent-admin`
  - 强调治理、证据、审批、冲突、画像、状态迁移

## 13. 一句话结论

本仓库的长期记忆系统，核心目标不是“让模型记住更多”，而是：

**让系统只记住值得记住的东西，并且知道为什么记住、什么时候该忘、绑定到哪个实体、谁可以改、如何即时覆写、以及它在当前任务里为什么被调用。**
