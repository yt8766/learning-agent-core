# Company Live Experts Design

状态：snapshot
文档类型：plan
适用范围：`agents/company-live`、`packages/core`、`apps/backend/agent-server`、`apps/frontend/agent-admin`
最后核对：2026-05-02

## 1. 背景

当前 `company-live` 已有 `growthAgent`、`operationsAgent`、`riskAgent`、`productAgent`、`financeAgent`、`supportAgent`、`contentAgent`、`intelligenceAgent` 八个业务节点，但它们主要是顺序 pipeline 中的 trace 占位：每个节点只写入简短摘要，不具备独立专家身份、对话能力、结构化诊断或跨专家会诊能力。

本设计将 `company-live` 从“业务节点前置的媒体生成流水线”升级为“公司专家咨询与会诊系统”。专家系统可以围绕跨境直播项目回答问题、发现缺口、提出追问、识别冲突，并把稳定结论沉淀为业务计划 patch。媒体生成继续存在，但不再是专家咨询的唯一入口。

## 2. 目标

- 定义一组接近真实公司职能分工的 `CompanyExpert` 专家。
- 第一版实现 6 个核心专家的 LLM prompt、schema、fallback 与结构化发现。
- 支持用户针对 company-live 项目进行单专家咨询和多专家会诊。
- 由 `companyExpertSupervisor` 负责路由、汇总、冲突识别和行动建议。
- 输出稳定 `CompanyExpertConsultation`，可被后端、前端、测试和后续 graph 消费。
- 生成 `businessPlanPatch`，但不直接覆盖已有业务计划。
- LLM 不可用或输出不合 schema 时仍能返回可演示的 fallback 结果。

## 3. 非目标

- 第一版不接真实 MiniMax、后台轮询、资产持久化或媒体中心。
- 第一版不把专家系统做成通用 runtime agent registry。
- 第一版不要求 10 个专家全部具备深度 LLM 逻辑。
- 第一版不自动把专家建议写成最终事实，业务计划更新需要显式确认或后续流程接管。
- 第一版不默认每个问题都运行全员圆桌，除非用户明确要求。

## 4. 专家模型

### 4.1 完整专家集合

`productAgent`：产品专家。负责商品定位、用户体验、卖点包装、购买路径、留存。判断这个产品适不适合卖、用户为什么买、体验哪里会掉链子。

`operationsAgent`：运营专家。负责直播排期、主播协作、场控流程、活动节奏、执行 SOP。判断这场直播能不能稳定跑起来。

`contentAgent`：内容专家。负责直播脚本、短视频素材、话术、本地化表达、视觉方向。判断怎么讲用户才愿意听、愿意买。

`growthAgent`：增长专家。负责 GMV、转化率、拉新、复购、区域增长策略。判断这一场怎么带增长，增长目标是否清楚。

`marketingAgent`：市场营销专家。负责投放、Campaign、达人合作、品牌表达、渠道策略。它看市场打法和获客方式，不替代增长指标拆解。

`intelligenceAgent`：市场情报专家。负责竞品、平台政策、区域趋势、用户偏好、达人生态。判断外部环境现在发生了什么。

`riskAgent`：风控合规专家。负责违规话术、平台封禁、欺诈、退款风险、审批审计。判断哪些事不能做，哪些事要先审批。

`financeAgent`：财务专家。负责毛利、折扣、预算、ROI、结算、现金流。判断这场直播赚不赚钱，预算边界在哪里。

`supportAgent`：客服售后专家。负责用户问题、投诉、退货退款、售后话术、服务承诺。判断卖出去之后会不会出问题。

`supplyAgent`：供应链履约专家。负责库存、备货、发货、物流时效、缺货风险。判断卖爆之后能不能交付。

### 4.2 第一版核心专家

第一版做深 6 个核心专家：

- `productAgent`
- `operationsAgent`
- `contentAgent`
- `growthAgent`
- `riskAgent`
- `financeAgent`

第二批先保留定义和路由扩展点：

- `marketingAgent`
- `intelligenceAgent`
- `supportAgent`
- `supplyAgent`

选择 6 个核心专家作为第一版，是为了先覆盖 company-live 的主链闭环：能不能卖、怎么播、怎么讲、怎么增长、能不能合规、赚不赚钱。

## 5. 职责边界

`productAgent` 输入商品、用户、平台、区域、卖点、已有客服或风险反馈；输出产品定位、核心购买理由、体验风险、漏斗问题、需要补的商品信息。它不负责投放预算，也不直接写完整脚本。

`operationsAgent` 输入直播目标、主播、排期、平台、活动机制、风险限制；输出直播 SOP、场控节奏、排期建议、异常处理、执行缺口。它不判断毛利，也不替代风控审批。

`contentAgent` 输入商品卖点、目标人群、本地语言、风险禁区、运营节奏；输出直播话术方向、脚本结构、短视频 hook、视觉素材 brief、声音素材 brief。它不得绕过 `riskAgent` 的禁用话术，不承诺未经证据支持的功效。

`growthAgent` 输入目标市场、GMV 或转化目标、渠道、内容方案、预算约束；输出增长目标拆解、转化杠杆、区域增长策略、实验建议。它不直接批准折扣和预算，只提出增长假设。

`riskAgent` 输入商品、平台、区域、话术、售后承诺、证据引用；输出禁用 claim、disclaimer、审批要求、风险等级、审计备注。它的高风险结论优先级高于内容和增长建议。

`financeAgent` 输入价格、折扣、成本、预算、佣金、物流和退款假设；输出毛利风险、ROI 假设、预算护栏、结算风险、财务缺口。缺少成本或价格数据时必须写入缺失输入，不能假装完成测算。

## 6. 稳定数据结构

新增稳定产物 `CompanyExpertConsultation`，表示一次公司专家会诊：

- `consultationId`：本次会诊 ID。
- `briefId`：关联的 company-live 项目。
- `userQuestion`：用户问题。
- `selectedExperts`：本次参与专家。
- `expertFindings`：每个专家的结构化意见。
- `missingInputs`：项目还缺的信息。
- `conflicts`：专家意见之间的冲突。
- `nextActions`：下一步行动清单。
- `businessPlanPatch`：可沉淀到 `CompanyLiveBusinessPlan` 的增量更新。
- `createdAt`：创建时间。

每个 `expertFinding` 包含：

- `expertId`
- `role`
- `summary`
- `diagnosis`
- `recommendations`
- `questionsToUser`
- `risks`
- `confidence`
- `source`：`llm` 或 `fallback`

`businessPlanPatch` 只表达“建议更新”，不直接覆盖原计划。需要自动写入时，应由后续确认流程或明确的 plan apply 节点处理。

## 7. Graph 流程

第一版新增或重构为以下语义流程：

1. `intakeNode`：解析用户问题、项目 brief、已有上下文和历史计划。
2. `expertRouterNode`：选择 1 到 4 个专家；用户明确要求全员会诊时可选择 6 个核心专家。
3. `expertNodes`：按选中的专家逐个执行。第一版可串行执行，但 trace 语义仍表示多专家会诊。
4. `synthesisNode`：汇总专家意见，识别缺失输入、专家冲突和下一步行动。
5. `businessPlanPatchNode`：把可沉淀内容整理为 `businessPlanPatch`。
6. `mediaHandoffNode`：仅当用户明确要生成素材或进入生成阶段时，才把内容、风险、运营结论转成 media brief。

现有媒体生成节点可以继续保留，但专家咨询不应被强制绑定到 audio/image/video/bundle pipeline。

## 8. 专家选择规则

第一版 `expertRouterNode` 采用确定性规则，可保留 LLM router 扩展点：

- 提到“脚本、话术、短视频、素材、本地化”选择 `contentAgent`。
- 提到“风险、合规、违规、封禁、退款、审计”选择 `riskAgent`。
- 提到“利润、预算、ROI、毛利、折扣”选择 `financeAgent`。
- 提到“转化、GMV、增长、复购、拉新”选择 `growthAgent`。
- 提到“主播、排期、场控、直播间、SOP”选择 `operationsAgent`。
- 提到“商品、卖点、体验、漏斗、用户为什么买”选择 `productAgent`。

没有明显关键词时，默认选择 `productAgent`、`operationsAgent`、`contentAgent`。

用户说“会诊、专家们、整体看看、缺什么”时，默认选择 6 个核心专家。

自动路由最多选择 4 个专家；用户明确要求全员会诊时可以超过 4 个。

## 9. Prompt 与 Schema 落位

`agents/company-live/src/flows/company-live/prompts/` 放专家系统 prompt 和上下文 formatter。

`agents/company-live/src/flows/company-live/schemas/` 放专家节点内部 LLM 输出 schema。稳定 JSON contract 应同步沉淀到 `packages/core`，并通过 zod schema 推导类型。

`agents/company-live/src/flows/company-live/nodes/` 放 intake、router、专家节点、synthesis、business plan patch、media handoff 节点。

`agents/company-live/src/graphs/company-live.graph.ts` 只做 wiring，不内联长 prompt、schema 或模型输出解析。

## 10. 错误处理

LLM 未配置或 `generateObject` 不可用时，专家节点返回确定性 fallback，结构完整，`source: "fallback"`，`confidence` 降低。

LLM 输出不符合 schema 时重试一次；仍失败则 fallback，并在 trace 中记录恢复原因。

专家冲突不自动抹平，由 `synthesisNode` 写入 `conflicts`。

`riskAgent` 判断需要审批时，最终 synthesis 必须把人工审批写入 `nextActions`。

缺少价格、成本、库存、证据等关键输入时，专家必须写入 `missingInputs`，不能补造数据。

## 11. 测试策略

第一版至少补齐：

- core schema parse：`CompanyExpertConsultationSchema`、`ExpertFindingSchema`。
- router 单测：不同问题能选到正确专家。
- fallback 单测：没有 LLM 时仍能返回完整会诊结果。
- graph 单测：会诊顺序包含 intake、router、expert findings、synthesis、business plan patch。
- contract 单测：新增 consultation result 不破坏既有 `company-live` 生成结果 parse。
- 后端 facade/controller 最小测试：能发起专家咨询并返回结构化结果。
- 文档检查：接口文档更新后执行 `pnpm check:docs`。

如果实现阶段触达前端展示，还需要补最小组件或 API 客户端测试，证明 `expertFindings`、`missingInputs`、`conflicts`、`nextActions` 可展示。

## 12. 文档更新

实现阶段需要新增或更新：

- `docs/contracts/api/company-live-experts-consult.md`
- `docs/architecture/media-provider-boundary-and-company-live-workflow.md`
- `docs/apps/frontend/agent-admin/` 下的专家展示说明，前提是触达 Admin 页面。

本 spec 是 brainstorming 设计入口，后续实现计划应引用本文。

## 13. MVP 完成条件

- company-live 有 10 个专家定义。
- 6 个核心专家有 prompt、schema、fallback。
- 用户问题能路由到合适专家。
- 会诊结果结构化返回。
- 会诊能列出缺失信息、冲突和下一步行动。
- 会诊能生成 `businessPlanPatch`。
- 专家咨询不依赖真实媒体生成也能单独运行。
- LLM 不可用时仍可 demo。
- 文档、测试、接口契约同步。

## 14. 推荐实施顺序

1. 在 `packages/core` 定义专家、会诊、finding、business plan patch schema。
2. 在 `agents/company-live` 增加专家定义、prompt、schema、fallback builder 和 router。
3. 新增专家咨询 graph/facade，保持媒体生成 graph 可独立运行。
4. 在 `apps/backend/agent-server` 增加专家咨询接口或 workflow facade。
5. 更新 Admin 最小展示，让用户看到专家选择、专家发现、冲突和下一步行动。
6. 补齐文档、测试与验证命令。

## 15. 待用户确认

本设计已确认采用“10 专家组织模型，第一版做深 6 个核心专家”。实现计划开始前，用户仍需 review 本文件，确认专家集合、第一版边界和数据结构符合预期。
