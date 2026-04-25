# Daily Tech Intelligence Briefing Design

状态：current
文档类型：integration
适用范围：daily tech intelligence briefing integration
最后核对：2026-04-23

本主题主文档：

- 本文为每日技术情报简报的跨模块集成设计入口
- 具体后端 briefing 模块边界继续以 [后端 Runtime Module Notes](/docs/backend/runtime-module-notes.md) 为准

本文只覆盖：

- 每日技术情报的信息分类、获取流程、MiniMax MCP 使用边界与本地存储设计
- 后续实现时的后端、admin、chat、Evidence 与 Learning 分工
- 不覆盖具体代码实现、接口字段最终定稿或数据库迁移方案

## 1. 这篇文档解决什么问题

本文定义“每日技术情报简报”的目标架构与分阶段落地方案，用于每天自动获取并整理：

- 前端技术新信息：React、Next.js、Vite、Vue、TypeScript、浏览器与工程工具。
- 前端安全信息：axios、Apifox、npm 依赖、source map、token 暴露、浏览器安全公告。
- AI 模型与平台信息：OpenAI、Anthropic、Google、Mistral、DeepSeek、Qwen、Hugging Face 等模型发布、API 能力、价格和上下文变化。
- AI 工程框架信息：Vercel AI SDK、LangChain、LangGraph、MCP SDK 等高价值变更。
- AI 开发工具安全信息：Claude Code、Cursor、MCP、AI coding agent、workspace trust、源码/凭据泄露、prompt injection 工具链风险。

这个能力不是普通新闻订阅，也不是独立爬虫。它应作为当前开发自治系统里的情报链路，按“户部检索、刑部安全审查、礼部交付整理”的语义运行：

- 户部：拉取 feed、官方公告、安全 advisory，并通过 MiniMax `web_search` MCP 补充发现遗漏事件。
- 刑部：做可信度、影响面、严重级别、修复状态和误报风险判断。
- 礼部：生成可读日报、保留 Evidence、压缩噪音，并把结果交给 Runtime / Evidence / Learning 中心。

## 2. 当前真实实现

仓库已有一条可复用的 `daily-tech-briefing` 后端链路，不应另起炉灶：

- `apps/backend/agent-server/src/runtime/briefings/runtime-tech-briefing.service.ts`
  - 当前作为 briefing orchestration facade，负责分类循环、抓取和投递编排。
- `apps/backend/agent-server/src/runtime/briefings/runtime-tech-briefing-category-collector.ts`
  - 当前负责 feed、安全页、NVD 与 MCP supplemental search 的分类抓取入口。
- `apps/backend/agent-server/src/runtime/briefings/runtime-tech-briefing-category-processor.ts`
  - 当前负责同轮合并、跨轮去重、分类限流、audit record 与 final status。
- `apps/backend/agent-server/src/runtime/briefings/runtime-tech-briefing-schedule.ts`
  - 当前负责 category schedule、adaptive interval、lookback days 和 cron 计算。
- `apps/backend/agent-server/src/runtime/briefings/runtime-tech-briefing-storage.ts`
  - 当前把 schedules、runs、history、feedback、schedule state 写入仓库根级 `data/runtime/*`。
- `apps/backend/agent-server/src/runtime/briefings/runtime-tech-briefing.types.ts`
  - 当前定义 `TechBriefingCategory`、`TechBriefingItem`、run record、schedule record 等本地类型。
- `apps/backend/agent-server/src/runtime/briefings/runtime-tech-briefing-mcp-search-policy.ts`
  - 当前承载 MCP supplemental search 的查询词、补充来源白名单与来源 metadata 映射。
  - 新增 MiniMax `web_search` 这类搜索供应商时，应继续映射到项目内稳定搜索能力，不要把供应商返回结构直接穿透到 briefing 主链。

当前已有分类：

- `frontend-security`
- `general-security`
- `devtool-security`
- `ai-tech`
- `frontend-tech`
- `backend-tech`
- `cloud-infra-tech`

当前已经接入的本地存储文件包括：

```text
data/runtime/briefings/daily-tech-briefing-runs.json
data/runtime/briefings/daily-tech-briefing-history.json
data/runtime/briefings/daily-tech-briefing-schedule-state.json
data/runtime/briefings/daily-tech-briefing-feedback.json
data/runtime/briefings/raw/<yyyy-mm-dd>-<category>.json
data/runtime/schedules/daily-tech-briefing-<category>.json
```

`raw/` 当前用于保存 MCP supplemental search 原始结果，供后续误报追溯与分类策略回放。展示给 admin/chat 的数据仍必须使用 `TechBriefingItem` 归一化结果，不能直接依赖 raw payload；如果下游需要在 digest / alert 中显示证据链，也应输出项目内归一化的 evidence summary / source refs，而不是把 raw payload 直接透传到交付层。

现有 MCP 补充搜索已经通过 `mcpClientManager` 的稳定能力边界调用：

```ts
await mcpClientManager.invokeTool('webSearchPrime', {
  taskId: `briefing-${category}-${now.getTime()}`,
  toolName: 'webSearchPrime',
  intent: ActionIntent.CALL_EXTERNAL_API,
  input: {
    query,
    goal: `Collect latest ${category} briefing updates`,
    freshnessHint: category.includes('security') ? 'urgent' : 'recent'
  },
  requestedBy: 'agent'
});
```

如果实际 MiniMax MCP 暴露的工具名是 `minimax.web_search`，不要把该名称直接扩散到 briefing 主链；应在 connector/capability 层映射成项目内部稳定能力，例如 `webSearchPrime`。

## 3. 边界与约束

### 3.1 分类模型

面向用户的产品分类建议收敛为 5 类，内部可继续映射到现有 `TechBriefingCategory`：

| 产品分类        | 内部分类建议                          | 主要内容                                                 |
| --------------- | ------------------------------------- | -------------------------------------------------------- |
| 前端技术        | `frontend-tech`                       | React、Next.js、Vite、Vue、TypeScript、Chrome、MDN       |
| 前端安全        | `frontend-security`                   | axios、Apifox、npm、source map、token、浏览器安全        |
| AI 模型与平台   | `ai-tech` + `contentKind=release`     | 新模型、新 API、价格、上下文、多模态、工具调用           |
| AI 工程框架     | `ai-tech` + `topicTags=framework/sdk` | LangChain、LangGraph、Vercel AI SDK、MCP SDK             |
| AI 开发工具安全 | `devtool-security`                    | Claude Code、Cursor、MCP、workspace trust、源码/凭据泄露 |

后续如果代码层需要更强类型，可以扩展 `TechBriefingCategory`，新增：

- `ai-model-release`
- `ai-engineering`
- `ai-devtool-security`

但第一阶段建议先复用现有 `ai-tech` 与 `devtool-security`，通过 `contentKind`、`topicTags`、`impactScenarioTags` 和排序策略区分，避免过早破坏现有 admin/API 兼容。

### 3.2 信息源优先级

来源按可信度分层：

| 层级                | 来源类型                                                                                            | 处理策略                                     |
| ------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| 官方安全公告        | NVD、GitHub Advisory、GitLab Advisory、官方 security page                                           | 可进入 `confirmed`，安全类优先展示           |
| 官方发布            | OpenAI、Anthropic、Google AI、Mistral、DeepSeek/Qwen、React、Vite、TypeScript 等官方 blog/changelog | 可进入 `confirmed`，用于模型和技术发布       |
| 权威技术媒体        | Simon Willison、Latent Space、Hacker News 高分讨论等                                                | 默认 `likely` 或 `watch`，需要交叉验证       |
| MCP web search 结果 | MiniMax `web_search` 返回的搜索结果                                                                 | 只能作为发现入口，必须归一化和降噪后才能入库 |
| 社区讨论            | Reddit、HN 普通帖子、社媒转述                                                                       | 默认 `watch`，不能单独判定为已确认事故       |

### 3.3 MiniMax `web_search` MCP 使用边界

MiniMax `web_search` MCP 只负责“补充发现”，不负责最终事实判定。

默认查询建议：

```text
frontend-security:
axios security advisory npm vulnerability latest
Apifox security incident vulnerability latest
frontend npm package vulnerability source map leak token exposure

frontend-tech:
React Next.js Vite TypeScript browser release latest
Chrome DevTools frontend update latest

ai-model-release:
OpenAI Anthropic Google DeepSeek Qwen Mistral new model release latest
LLM model release context window multimodal pricing latest

ai-engineering:
Vercel AI SDK LangGraph LangChain MCP SDK release latest

ai-devtool-security:
Claude Code security incident source code leak credential leak latest
Cursor MCP security advisory path traversal prompt injection latest
AI coding tool security vulnerability latest
```

MCP 返回结果进入主链前必须经过：

- URL 规范化。
- 标题清洗。
- 发布时间解析。
- 来源域名分级。
- `contentFingerprint` 计算。
- 与同轮、跨轮历史去重。
- 至少一次 category relevance 判断。

安全类结果如果缺少官方确认，应明确标记为 `watch`，交付文案也必须写成“观察中”，不能写成“已确认漏洞”。

### 3.4 本地存储

短期继续使用本地 JSON，路径固定在仓库根级 `data/runtime/briefings`。建议补充原始证据目录：

```text
data/runtime/briefings/
├─ daily-tech-briefing-runs.json
├─ daily-tech-briefing-history.json
├─ daily-tech-briefing-schedule-state.json
├─ daily-tech-briefing-feedback.json
└─ raw/
   ├─ 2026-04-23-frontend-security.json
   ├─ 2026-04-23-ai-tech.json
   └─ 2026-04-23-devtool-security.json
```

`raw/` 目录用于保存：

- 原始 RSS/feed item。
- 原始 official page 摘要。
- MiniMax `web_search` 原始结果。
- 被过滤但可能需要追溯的候选。

raw 记录不能直接作为前端展示 contract，展示仍应使用 `TechBriefingItem` 归一化结果。

### 3.5 标准化记录

每条情报最终应落成 `TechBriefingItem`，并尽量补齐：

- `category`
- `title`
- `url`
- `publishedAt`
- `sourceName`
- `sourceGroup`
- `authorityTier`
- `contentKind`
- `summary`
- `confidence`
- `relevanceReason`
- `technicalityScore`
- `crossVerified`
- `affectedVersions`
- `fixedVersions`
- `recommendedAction`
- `priorityCode`
- `relevanceLevel`
- `fixConfidence`
- `impactScenarioTags`
- `recommendedNextStep`

安全类必须重点补：

- `displaySeverity`
- `affectedVersions`
- `fixedVersions`
- `fixConfidence`
- `priorityCode`
- `actionSteps`

AI 模型类必须重点补：

- 模型名。
- 发布主体。
- 能力变化。
- API/价格/上下文变化。
- 对当前项目是否有试用价值。

### 3.6 去重与交叉验证

同轮去重：

- 同 URL 去重。
- 标题归一化后去重。
- `contentFingerprint` 相同去重。
- 同一 CVE/GHSA/advisory 合并。

跨轮去重：

- 读取 `daily-tech-briefing-history.json`。
- `duplicateWindowDays` 内无实质变化不重复展示。
- 如果出现修复版本、官方确认、严重性升级或主动利用信号，可以作为 `update` 重新展示。

交叉验证建议分三档：

| 状态        | 条件                                         | 展示策略                     |
| ----------- | -------------------------------------------- | ---------------------------- |
| `confirmed` | 官方公告、CVE/GHSA、官方 release/changelog   | 可作为事实陈述               |
| `likely`    | 权威媒体 + 官方 issue/commit/maintainer 线索 | 说明“多源指向”，保留判断依据 |
| `watch`     | 只有社区讨论或搜索结果                       | 明确标注观察中，不做定论     |

### 3.7 评分策略

排序建议按以下信号加权：

```text
score =
  authorityScore
+ severityScore
+ freshnessScore
+ relevanceScore
+ crossVerifiedScore
+ userPreferenceScore
- duplicatePenalty
- lowSignalPenalty
```

安全类优先级：

- `P0`：已确认 RCE、凭据泄露、供应链投毒、主动利用。
- `P1`：高危漏洞、有修复版本、影响常用依赖或工具。
- `P2`：中低危、配置风险、需要观察的事件。

AI 模型类优先级：

- 新旗舰模型、上下文窗口变化、多模态能力、工具调用能力、价格变化优先。
- 普通 SDK 小版本、纯观点文章、社区讨论降权。

### 3.8 日报输出结构

日报默认结构：

```text
# 每日技术情报

## 今日必须关注
- P0/P1 安全事件
- 新模型或 API 重大变化

## 前端安全
- axios / Apifox / npm / 浏览器安全

## AI 模型与平台
- 新模型、API、价格、上下文、能力变化

## AI 工程与工具安全
- Claude Code、Cursor、MCP、LangChain/LangGraph/AI SDK 重要变化

## 前端技术
- React、Next.js、Vite、TypeScript、Chrome 等

## 建议动作
- 需要立刻检查
- 可以本周评估
- 仅观察
```

每条 item 展示字段：

- 标题。
- 来源与时间。
- 可信度。
- 为什么重要。
- 影响范围。
- 建议动作。
- 原始链接。

### 3.9 调度策略

默认调度：

- `frontend-security`：每 4 小时，热事件时可缩短到 2 小时。
- `devtool-security`：每 4 小时，热事件时可缩短到 2 小时。
- `ai-tech`：每天 1 次，模型发布高峰可缩短到 12 小时。
- `frontend-tech`：每天 1 次。

现有 `nextBriefingScheduleState(...)` 已支持 hot streak 和 cooldown 语义，后续实现应复用这条 adaptive interval 机制，不要在 service 里另写定时分支。

### 3.10 前后端职责

后端：

- 负责源抓取、MCP 补充搜索、证据归一化、去重、排序、落盘和投递。
- 后端 controller/service 只暴露 briefing run、force-run、feedback、status 等窄接口。
- 不在 controller 内直接拼搜索流程或 MiniMax 请求。

`agent-admin`：

- 展示 briefing runs。
- 展示来源、可信度、分类、P0/P1/P2、推荐动作。
- 提供 force run。
- 提供 helpful / not helpful feedback。
- 后续可提供关注关键词和忽略来源配置。

`agent-chat`：

- 只在用户询问或系统主动提醒时展示简报卡片。
- 不承担治理配置。

### 3.11 分阶段落地

第一阶段：本地日报闭环。

- 复用现有 `runtime/briefings`。
- 补充 axios、Apifox、Claude Code、Cursor、MCP、OpenAI、Anthropic、Google AI、DeepSeek/Qwen 等源。
- 接入 MiniMax `web_search` MCP 到现有 `webSearchPrime` 能力边界。
- 保存 run/history/feedback 到 `data/runtime/briefings`。

第二阶段：证据与安全可信度。

- 增加 `raw/` 原始证据落盘。
- 增加 `confirmed / likely / watch` 可信度投影。
- 安全类强制补齐 affected/fixed/recommended action。
- 完善跨轮 update 识别。

第三阶段：反馈与个性化。

- admin 支持 helpful / not helpful。
- 排序使用 feedback 影响 source 和 reason tag 权重。
- 支持关注关键词：`axios`、`apifox`、`claude code`、`mcp`、`OpenAI` 等。
- 支持忽略低价值来源。

第四阶段：Agent 化。

- 户部节点负责检索与 evidence 汇总。
- 刑部节点负责安全可信度、影响面和风险分级。
- 礼部节点负责日报整理。
- Evidence Center 展示原始证据。
- Learning Center 沉淀用户偏好和高价值来源。

## 4. 验证与回归风险

纯设计文档改动至少执行：

```bash
pnpm check:docs
```

后续实现代码时，必须按 [验证体系规范](/docs/evals/verification-system-guidelines.md) 补齐五层验证。建议最小测试覆盖：

- `Spec`：新增或修改 `TechBriefingItem` / run record / raw evidence schema 时，补 parse 回归。
- `Unit`：MCP search result -> normalized item、category classifier、dedupe、cross verification、ranking。
- `Demo`：用 fixture 跑一次每日简报生成，确认本地 run/history/raw 文件可生成。
- `Integration`：force run API -> collector -> processor -> storage -> admin query。
- `Type`：至少跑后端 `tsc --noEmit`，涉及共享包则跑 `pnpm build:lib`。

主要回归风险：

- MCP 搜索结果误报，被日报写成已确认事实。
- 安全事件重复推送，造成告警疲劳。
- 普通 AI SDK 小版本淹没真正模型发布。
- MiniMax 工具名或返回结构穿透业务层，后续更换搜索供应商困难。
- raw evidence 与展示 contract 混用，导致前端依赖未清洗数据。
- 定时任务过密，触发外部 API 限流或成本不可控。

必须保留的行为：

- 官方 advisory 优先。
- 搜索结果只作为补充发现。
- 安全类不确定事件必须标注 `watch`。
- 本地存储默认位于仓库根级 `data/runtime/briefings`。
- admin 治理面负责配置和反馈，agent-chat 只负责必要时展示。

## 5. 继续阅读

- [架构总览](/docs/ARCHITECTURE.md)
- [项目规范总览](/docs/project-conventions.md)
- [后端 Runtime Module Notes](/docs/backend/runtime-module-notes.md)
- [API 文档目录](/docs/api/README.md)
- [前后端集成链路](/docs/integration/frontend-backend-integration.md)
- [验证体系规范](/docs/evals/verification-system-guidelines.md)
- [Runtime API](/docs/api/runtime.md)
