# Company Live Experts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

状态：snapshot
文档类型：plan
适用范围：`packages/core`、`agents/company-live`、`apps/backend/agent-server`、`apps/frontend/agent-admin`
最后核对：2026-05-02

**Goal:** Build a company-live expert consultation system with 10 company experts, 6 core LLM-capable experts, structured consultation output, backend API access, and a minimal Admin display.

**Architecture:** Stable JSON contracts live in `packages/core`; company expert routing, prompts, fallbacks, and consultation graph live in `agents/company-live`; `apps/backend/agent-server` exposes a thin consult endpoint through `RuntimeCompanyLiveFacade`; `agent-admin` calls the endpoint and renders expert findings without coupling to graph internals.

**Tech Stack:** TypeScript, zod/v4 contracts, Vitest, NestJS controller/service, React, existing `ILLMProvider.generateObject`, existing `generateObjectWithRetry` helper pattern.

---

## Source Spec

Design spec: `docs/superpowers/specs/2026-05-02-company-live-experts-design.md`

## File Structure

- Create `packages/core/src/contracts/media/company-live-experts.schema.ts`: stable schemas and inferred types for expert IDs, expert definitions, findings, consultation result, conflicts, actions, and business plan patch.
- Modify `packages/core/src/contracts/media/index.ts`: export the expert consultation contract.
- Modify `packages/core/test/media-contracts.test.ts`: schema parse and compatibility tests.
- Create `agents/company-live/src/flows/company-live/expert-definitions.ts`: 10 expert definitions, first-version core expert list, deterministic keyword routing metadata.
- Create `agents/company-live/src/flows/company-live/prompts/company-live-expert-prompts.ts`: shared prompt builder and per-expert role instructions.
- Create `agents/company-live/src/flows/company-live/nodes/expert-router-node.ts`: deterministic router with full-consultation override.
- Create `agents/company-live/src/flows/company-live/nodes/expert-fallbacks.ts`: deterministic findings for all 10 experts, with richer outputs for the 6 core experts.
- Create `agents/company-live/src/flows/company-live/nodes/expert-consultation-nodes.ts`: intake, expert execution, synthesis, and business plan patch helpers.
- Create `agents/company-live/src/graphs/company-live-experts.graph.ts`: `consultCompanyLiveExperts(...)` graph facade.
- Modify `agents/company-live/src/index.ts`: export expert graph, definitions, and types.
- Create `agents/company-live/test/company-live-experts-contract.test.ts`: agent-level contract and definition tests.
- Create `agents/company-live/test/company-live-experts-router.test.ts`: routing tests.
- Create `agents/company-live/test/company-live-experts-graph.test.ts`: fallback graph and LLM recovery tests.
- Modify `apps/backend/agent-server/src/company-live/company-live.dto.ts`: parse expert consult request.
- Modify `apps/backend/agent-server/src/company-live/company-live.service.ts`: expose `consultExperts(...)`.
- Modify `apps/backend/agent-server/src/company-live/company-live.controller.ts`: add `POST /company-live/experts/consult`.
- Modify `apps/backend/agent-server/src/runtime/core/runtime-company-live-facade.ts`: call `consultCompanyLiveExperts(...)`.
- Modify backend tests under `apps/backend/agent-server/test/company-live/`.
- Modify `apps/frontend/agent-admin/src/api/company-live.api.ts`: add `consultCompanyLiveExperts(...)`.
- Create `apps/frontend/agent-admin/src/pages/company-agents/company-live-expert-consult-form.tsx`: minimal expert consult form.
- Create `apps/frontend/agent-admin/src/pages/company-agents/company-live-expert-consult-result.tsx`: render selected experts, findings, missing inputs, conflicts, next actions.
- Modify `apps/frontend/agent-admin/src/pages/company-agents/company-agents-panel.tsx`: add expert consult section above media generation.
- Modify `apps/frontend/agent-admin/test/api/admin-api-company-live.test.ts`: API client test.
- Create `docs/contracts/api/company-live-experts-consult.md`: backend contract reference.
- Modify `docs/architecture/media-provider-boundary-and-company-live-workflow.md`: record current expert-system boundary.
- Modify or create `docs/apps/frontend/agent-admin/company-live-experts.md`: Admin display notes.

---

### Task 1: Core Expert Consultation Contract

**Files:**

- Create: `packages/core/src/contracts/media/company-live-experts.schema.ts`
- Modify: `packages/core/src/contracts/media/index.ts`
- Modify: `packages/core/test/media-contracts.test.ts`

- [ ] **Step 1: Write failing schema tests**

Add these imports to `packages/core/test/media-contracts.test.ts`:

```ts
import {
  CompanyExpertConsultationSchema,
  CompanyExpertDefinitionSchema,
  ExpertFindingSchema
} from '../src/contracts/media/company-live-experts.schema';
```

Add this test block:

```ts
describe('company-live expert consultation contracts', () => {
  it('parses a company expert definition', () => {
    const definition = CompanyExpertDefinitionSchema.parse({
      expertId: 'productAgent',
      displayName: '产品专家',
      role: 'product',
      phase: 'core',
      responsibilities: ['商品定位', '用户体验'],
      boundaries: ['不审批预算'],
      keywords: ['商品', '卖点']
    });

    expect(definition.expertId).toBe('productAgent');
  });

  it('parses an expert finding', () => {
    const finding = ExpertFindingSchema.parse({
      expertId: 'riskAgent',
      role: 'risk',
      summary: '存在平台合规风险。',
      diagnosis: ['话术中包含未经证据支持的功效表达。'],
      recommendations: ['删除绝对化功效承诺。'],
      questionsToUser: ['是否有第三方检测报告？'],
      risks: ['可能触发平台审核。'],
      confidence: 0.72,
      source: 'fallback'
    });

    expect(finding.source).toBe('fallback');
  });

  it('parses a company expert consultation result', () => {
    const consultation = CompanyExpertConsultationSchema.parse({
      consultationId: 'consult-brief-1-001',
      briefId: 'brief-1',
      userQuestion: '这个项目缺什么？',
      selectedExperts: ['productAgent', 'operationsAgent', 'contentAgent'],
      expertFindings: [
        {
          expertId: 'productAgent',
          role: 'product',
          summary: '产品定位需要更清楚。',
          diagnosis: ['目标用户和购买理由仍偏泛。'],
          recommendations: ['补充核心用户画像。'],
          questionsToUser: ['主推 SKU 是哪一个？'],
          risks: ['卖点分散会降低转化。'],
          confidence: 0.66,
          source: 'fallback'
        }
      ],
      missingInputs: ['商品成本', '库存'],
      conflicts: [
        {
          conflictId: 'conflict-discount-margin',
          summary: '增长折扣与毛利护栏存在冲突。',
          expertIds: ['growthAgent', 'financeAgent'],
          resolutionHint: '先补成本和目标毛利，再确认折扣。'
        }
      ],
      nextActions: [
        {
          actionId: 'action-fill-cost',
          ownerExpertId: 'financeAgent',
          label: '补充商品成本和折扣边界',
          priority: 'high'
        }
      ],
      businessPlanPatch: {
        briefId: 'brief-1',
        updates: [
          {
            path: 'finance.missingInputs',
            value: ['商品成本', '物流成本'],
            reason: '财务专家无法在缺少成本时判断 ROI。'
          }
        ]
      },
      createdAt: '2026-05-02T00:00:00.000Z'
    });

    expect(consultation.selectedExperts).toContain('productAgent');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/media-contracts.test.ts
```

Expected: fail because `company-live-experts.schema` does not exist.

- [ ] **Step 3: Add expert consultation schemas**

Create `packages/core/src/contracts/media/company-live-experts.schema.ts`:

```ts
import { z } from 'zod/v4';

export const CompanyExpertIdSchema = z.enum([
  'productAgent',
  'operationsAgent',
  'contentAgent',
  'growthAgent',
  'marketingAgent',
  'intelligenceAgent',
  'riskAgent',
  'financeAgent',
  'supportAgent',
  'supplyAgent'
]);

export const CompanyExpertRoleSchema = z.enum([
  'product',
  'operations',
  'content',
  'growth',
  'marketing',
  'intelligence',
  'risk',
  'finance',
  'support',
  'supply'
]);

export const CompanyExpertDefinitionSchema = z.object({
  expertId: CompanyExpertIdSchema,
  displayName: z.string().min(1),
  role: CompanyExpertRoleSchema,
  phase: z.enum(['core', 'reserved']),
  responsibilities: z.array(z.string().min(1)).min(1),
  boundaries: z.array(z.string().min(1)).min(1),
  keywords: z.array(z.string().min(1)).min(1)
});

export const ExpertFindingSchema = z.object({
  expertId: CompanyExpertIdSchema,
  role: CompanyExpertRoleSchema,
  summary: z.string().min(1),
  diagnosis: z.array(z.string().min(1)),
  recommendations: z.array(z.string().min(1)),
  questionsToUser: z.array(z.string().min(1)),
  risks: z.array(z.string().min(1)),
  confidence: z.number().min(0).max(1),
  source: z.enum(['llm', 'fallback'])
});

export const CompanyExpertConflictSchema = z.object({
  conflictId: z.string().min(1),
  summary: z.string().min(1),
  expertIds: z.array(CompanyExpertIdSchema).min(2),
  resolutionHint: z.string().min(1)
});

export const CompanyExpertNextActionSchema = z.object({
  actionId: z.string().min(1),
  ownerExpertId: CompanyExpertIdSchema,
  label: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high'])
});

export const CompanyLiveBusinessPlanPatchSchema = z.object({
  briefId: z.string().min(1),
  updates: z.array(
    z.object({
      path: z.string().min(1),
      value: z.unknown(),
      reason: z.string().min(1)
    })
  )
});

export const CompanyExpertConsultationSchema = z.object({
  consultationId: z.string().min(1),
  briefId: z.string().min(1),
  userQuestion: z.string().min(1),
  selectedExperts: z.array(CompanyExpertIdSchema).min(1),
  expertFindings: z.array(ExpertFindingSchema).min(1),
  missingInputs: z.array(z.string().min(1)),
  conflicts: z.array(CompanyExpertConflictSchema),
  nextActions: z.array(CompanyExpertNextActionSchema),
  businessPlanPatch: CompanyLiveBusinessPlanPatchSchema,
  createdAt: z.string().datetime()
});

export type CompanyExpertId = z.infer<typeof CompanyExpertIdSchema>;
export type CompanyExpertRole = z.infer<typeof CompanyExpertRoleSchema>;
export type CompanyExpertDefinition = z.infer<typeof CompanyExpertDefinitionSchema>;
export type ExpertFinding = z.infer<typeof ExpertFindingSchema>;
export type CompanyExpertConflict = z.infer<typeof CompanyExpertConflictSchema>;
export type CompanyExpertNextAction = z.infer<typeof CompanyExpertNextActionSchema>;
export type CompanyLiveBusinessPlanPatch = z.infer<typeof CompanyLiveBusinessPlanPatchSchema>;
export type CompanyExpertConsultation = z.infer<typeof CompanyExpertConsultationSchema>;
```

- [ ] **Step 4: Export schemas**

Add to `packages/core/src/contracts/media/index.ts`:

```ts
export * from './company-live-experts.schema';
```

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/media-contracts.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/contracts/media/company-live-experts.schema.ts packages/core/src/contracts/media/index.ts packages/core/test/media-contracts.test.ts
git commit -m "feat: add company live expert contracts"
```

---

### Task 2: Expert Definitions And Router

**Files:**

- Create: `agents/company-live/src/flows/company-live/expert-definitions.ts`
- Create: `agents/company-live/src/flows/company-live/nodes/expert-router-node.ts`
- Create: `agents/company-live/test/company-live-experts-contract.test.ts`
- Create: `agents/company-live/test/company-live-experts-router.test.ts`
- Modify: `agents/company-live/src/index.ts`

- [ ] **Step 1: Write failing definition tests**

Create `agents/company-live/test/company-live-experts-contract.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { companyLiveCoreExpertIds, companyLiveExpertDefinitions } from '../src';

describe('company-live expert definitions', () => {
  it('defines the 10 company experts', () => {
    expect(companyLiveExpertDefinitions).toHaveLength(10);
    expect(companyLiveExpertDefinitions.map(expert => expert.expertId)).toEqual([
      'productAgent',
      'operationsAgent',
      'contentAgent',
      'growthAgent',
      'marketingAgent',
      'intelligenceAgent',
      'riskAgent',
      'financeAgent',
      'supportAgent',
      'supplyAgent'
    ]);
  });

  it('marks 6 core experts for the first version', () => {
    expect(companyLiveCoreExpertIds).toEqual([
      'productAgent',
      'operationsAgent',
      'contentAgent',
      'growthAgent',
      'riskAgent',
      'financeAgent'
    ]);
  });
});
```

- [ ] **Step 2: Write failing router tests**

Create `agents/company-live/test/company-live-experts-router.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { routeCompanyLiveExperts } from '../src';

describe('routeCompanyLiveExperts', () => {
  it('routes script and compliance questions to content and risk experts', () => {
    const selected = routeCompanyLiveExperts('脚本里有哪些合规风险，话术怎么改？');
    expect(selected).toEqual(['contentAgent', 'riskAgent']);
  });

  it('routes ROI and discount questions to finance and growth experts', () => {
    const selected = routeCompanyLiveExperts('这个折扣会不会影响 ROI，怎么提升 GMV？');
    expect(selected).toEqual(['financeAgent', 'growthAgent']);
  });

  it('routes broad consultation requests to the 6 core experts', () => {
    const selected = routeCompanyLiveExperts('让公司专家们整体会诊一下这个项目缺什么');
    expect(selected).toEqual([
      'productAgent',
      'operationsAgent',
      'contentAgent',
      'growthAgent',
      'riskAgent',
      'financeAgent'
    ]);
  });

  it('uses product, operations, and content when the question has no clear keyword', () => {
    const selected = routeCompanyLiveExperts('帮我看看这个项目');
    expect(selected).toEqual(['productAgent', 'operationsAgent', 'contentAgent']);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
pnpm exec vitest run --config vitest.config.js agents/company-live/test/company-live-experts-contract.test.ts agents/company-live/test/company-live-experts-router.test.ts
```

Expected: fail because exports and files do not exist.

- [ ] **Step 4: Add expert definitions**

Create `agents/company-live/src/flows/company-live/expert-definitions.ts`:

```ts
import type { CompanyExpertDefinition, CompanyExpertId } from '@agent/core';

export const companyLiveCoreExpertIds = [
  'productAgent',
  'operationsAgent',
  'contentAgent',
  'growthAgent',
  'riskAgent',
  'financeAgent'
] satisfies CompanyExpertId[];

export const companyLiveExpertDefinitions = [
  {
    expertId: 'productAgent',
    displayName: '产品专家',
    role: 'product',
    phase: 'core',
    responsibilities: ['商品定位', '用户体验', '卖点包装', '购买路径', '留存'],
    boundaries: ['不审批投放预算', '不直接编写完整直播脚本'],
    keywords: ['商品', '产品', '卖点', '体验', '漏斗', '用户为什么买']
  },
  {
    expertId: 'operationsAgent',
    displayName: '运营专家',
    role: 'operations',
    phase: 'core',
    responsibilities: ['直播排期', '主播协作', '场控流程', '活动节奏', '执行 SOP'],
    boundaries: ['不判断毛利', '不替代风控审批'],
    keywords: ['主播', '排期', '场控', '直播间', 'SOP', '运营']
  },
  {
    expertId: 'contentAgent',
    displayName: '内容专家',
    role: 'content',
    phase: 'core',
    responsibilities: ['直播脚本', '短视频素材', '话术', '本地化表达', '视觉方向'],
    boundaries: ['不得绕过风控禁用话术', '不承诺未经证据支持的功效'],
    keywords: ['脚本', '话术', '短视频', '素材', '本地化', '视觉']
  },
  {
    expertId: 'growthAgent',
    displayName: '增长专家',
    role: 'growth',
    phase: 'core',
    responsibilities: ['GMV', '转化率', '拉新', '复购', '区域增长策略'],
    boundaries: ['不批准折扣', '不批准预算'],
    keywords: ['转化', 'GMV', '增长', '复购', '拉新']
  },
  {
    expertId: 'marketingAgent',
    displayName: '市场营销专家',
    role: 'marketing',
    phase: 'reserved',
    responsibilities: ['投放', 'Campaign', '达人合作', '品牌表达', '渠道策略'],
    boundaries: ['不替代增长指标拆解'],
    keywords: ['投放', '达人', 'Campaign', '渠道', '品牌']
  },
  {
    expertId: 'intelligenceAgent',
    displayName: '市场情报专家',
    role: 'intelligence',
    phase: 'reserved',
    responsibilities: ['竞品', '平台政策', '区域趋势', '用户偏好', '达人生态'],
    boundaries: ['不编造外部事实', '缺少来源时必须说明'],
    keywords: ['竞品', '政策', '趋势', '达人生态', '市场情报']
  },
  {
    expertId: 'riskAgent',
    displayName: '风控合规专家',
    role: 'risk',
    phase: 'core',
    responsibilities: ['违规话术', '平台封禁', '欺诈', '退款风险', '审批审计'],
    boundaries: ['高风险结论优先于内容和增长建议'],
    keywords: ['风险', '合规', '违规', '封禁', '退款', '审计']
  },
  {
    expertId: 'financeAgent',
    displayName: '财务专家',
    role: 'finance',
    phase: 'core',
    responsibilities: ['毛利', '折扣', '预算', 'ROI', '结算', '现金流'],
    boundaries: ['缺少价格或成本时必须标记缺失输入'],
    keywords: ['利润', '预算', 'ROI', '毛利', '折扣', '结算']
  },
  {
    expertId: 'supportAgent',
    displayName: '客服售后专家',
    role: 'support',
    phase: 'reserved',
    responsibilities: ['用户问题', '投诉', '退货退款', '售后话术', '服务承诺'],
    boundaries: ['不承诺未确认的售后政策'],
    keywords: ['客服', '售后', '投诉', '退货', '用户问题']
  },
  {
    expertId: 'supplyAgent',
    displayName: '供应链履约专家',
    role: 'supply',
    phase: 'reserved',
    responsibilities: ['库存', '备货', '发货', '物流时效', '缺货风险'],
    boundaries: ['缺少库存和物流数据时必须标记缺失输入'],
    keywords: ['库存', '备货', '发货', '物流', '履约']
  }
] satisfies CompanyExpertDefinition[];
```

- [ ] **Step 5: Add router**

Create `agents/company-live/src/flows/company-live/nodes/expert-router-node.ts`:

```ts
import type { CompanyExpertId } from '@agent/core';

import { companyLiveCoreExpertIds } from '../expert-definitions';

const DEFAULT_EXPERTS = ['productAgent', 'operationsAgent', 'contentAgent'] satisfies CompanyExpertId[];

const ROUTING_RULES: Array<{ pattern: RegExp; experts: CompanyExpertId[] }> = [
  { pattern: /脚本|话术|短视频|素材|本地化|视觉/i, experts: ['contentAgent'] },
  { pattern: /风险|合规|违规|封禁|退款|审计/i, experts: ['riskAgent'] },
  { pattern: /利润|预算|ROI|毛利|折扣|结算/i, experts: ['financeAgent'] },
  { pattern: /转化|GMV|增长|复购|拉新/i, experts: ['growthAgent'] },
  { pattern: /主播|排期|场控|直播间|SOP|运营/i, experts: ['operationsAgent'] },
  { pattern: /商品|产品|卖点|体验|漏斗|用户为什么买/i, experts: ['productAgent'] }
];

export function routeCompanyLiveExperts(question: string): CompanyExpertId[] {
  const normalized = question.trim();
  if (/会诊|专家们|整体看看|缺什么/i.test(normalized)) {
    return [...companyLiveCoreExpertIds];
  }

  const selected: CompanyExpertId[] = [];
  for (const rule of ROUTING_RULES) {
    if (rule.pattern.test(normalized)) {
      for (const expertId of rule.experts) {
        if (!selected.includes(expertId)) selected.push(expertId);
      }
    }
  }

  return selected.length > 0 ? selected.slice(0, 4) : [...DEFAULT_EXPERTS];
}
```

- [ ] **Step 6: Export definitions and router**

Modify `agents/company-live/src/index.ts`:

```ts
export { companyLiveCoreExpertIds, companyLiveExpertDefinitions } from './flows/company-live/expert-definitions';
export { routeCompanyLiveExperts } from './flows/company-live/nodes/expert-router-node';
```

- [ ] **Step 7: Run tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js agents/company-live/test/company-live-experts-contract.test.ts agents/company-live/test/company-live-experts-router.test.ts
```

Expected: pass.

- [ ] **Step 8: Commit**

```bash
git add agents/company-live/src/flows/company-live/expert-definitions.ts agents/company-live/src/flows/company-live/nodes/expert-router-node.ts agents/company-live/src/index.ts agents/company-live/test/company-live-experts-contract.test.ts agents/company-live/test/company-live-experts-router.test.ts
git commit -m "feat: define company live experts"
```

---

### Task 3: Expert Consultation Graph With Fallback And LLM Recovery

**Files:**

- Create: `agents/company-live/src/flows/company-live/prompts/company-live-expert-prompts.ts`
- Create: `agents/company-live/src/flows/company-live/nodes/expert-fallbacks.ts`
- Create: `agents/company-live/src/flows/company-live/nodes/expert-consultation-nodes.ts`
- Create: `agents/company-live/src/graphs/company-live-experts.graph.ts`
- Modify: `agents/company-live/src/index.ts`
- Create: `agents/company-live/test/company-live-experts-graph.test.ts`

- [ ] **Step 1: Write failing graph tests**

Create `agents/company-live/test/company-live-experts-graph.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';

import { consultCompanyLiveExperts } from '../src';

const brief = {
  briefId: 'brief-experts-1',
  targetPlatform: 'TikTok',
  targetRegion: 'US',
  language: 'en-US',
  audienceProfile: 'US skincare shoppers',
  productRefs: ['sku-1'],
  sellingPoints: ['Fast glow'],
  riskLevel: 'medium' as const,
  createdAt: '2026-05-02T00:00:00.000Z'
};

describe('consultCompanyLiveExperts', () => {
  it('returns a structured fallback consultation without an LLM provider', async () => {
    const result = await consultCompanyLiveExperts({
      brief,
      question: '让公司专家们整体会诊一下这个项目缺什么'
    });

    expect(result.selectedExperts).toEqual([
      'productAgent',
      'operationsAgent',
      'contentAgent',
      'growthAgent',
      'riskAgent',
      'financeAgent'
    ]);
    expect(result.expertFindings).toHaveLength(6);
    expect(result.expertFindings.every(finding => finding.source === 'fallback')).toBe(true);
    expect(result.missingInputs).toContain('商品成本');
    expect(result.businessPlanPatch.briefId).toBe('brief-experts-1');
  });

  it('uses LLM expert output when generateObject returns a valid finding', async () => {
    const llm = {
      isConfigured: () => true,
      generateObject: vi.fn(async () => ({
        expertId: 'contentAgent',
        role: 'content',
        summary: '脚本需要更强的开场钩子。',
        diagnosis: ['前三秒没有明确利益点。'],
        recommendations: ['用用户痛点开场。'],
        questionsToUser: ['是否有真实用户评价？'],
        risks: ['夸大功效会触发合规风险。'],
        confidence: 0.81,
        source: 'llm'
      }))
    };

    const result = await consultCompanyLiveExperts({
      brief,
      question: '脚本怎么改？',
      llm
    });

    expect(result.selectedExperts).toEqual(['contentAgent']);
    expect(result.expertFindings[0]?.source).toBe('llm');
    expect(llm.generateObject).toHaveBeenCalled();
  });

  it('recovers with fallback when LLM generation fails', async () => {
    const llm = {
      isConfigured: () => true,
      generateObject: vi.fn(async () => {
        throw new Error('provider failed');
      })
    };

    const result = await consultCompanyLiveExperts({
      brief,
      question: '利润和 ROI 怎么看？',
      llm
    });

    expect(result.selectedExperts).toEqual(['financeAgent']);
    expect(result.expertFindings[0]?.source).toBe('fallback');
    expect(result.missingInputs).toContain('商品成本');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm exec vitest run --config vitest.config.js agents/company-live/test/company-live-experts-graph.test.ts
```

Expected: fail because `consultCompanyLiveExperts` does not exist.

- [ ] **Step 3: Add prompt builders**

Create `agents/company-live/src/flows/company-live/prompts/company-live-expert-prompts.ts`:

```ts
import type { CompanyLiveContentBrief } from '@agent/core';

import type { CompanyExpertDefinition } from '@agent/core';

export const COMPANY_LIVE_EXPERT_SYSTEM_PROMPT = [
  '你是 company-live 公司专家系统中的一个职能专家。',
  '必须只从自己的职责边界回答，不要替代其他专家审批。',
  '必须输出符合 ExpertFinding schema 的 JSON 对象。',
  '遇到缺失输入时写入 questionsToUser，不要编造事实。',
  '风控限制优先于增长和内容建议。'
].join('\n');

export function buildCompanyLiveExpertUserPrompt(params: {
  brief: CompanyLiveContentBrief;
  question: string;
  expert: CompanyExpertDefinition;
}) {
  return JSON.stringify(
    {
      expert: params.expert,
      question: params.question,
      brief: params.brief
    },
    null,
    2
  );
}
```

- [ ] **Step 4: Add fallback builders**

Create `agents/company-live/src/flows/company-live/nodes/expert-fallbacks.ts`:

```ts
import type { CompanyExpertDefinition, ExpertFinding, CompanyLiveContentBrief } from '@agent/core';

export function buildCompanyLiveFallbackFinding(params: {
  brief: CompanyLiveContentBrief;
  question: string;
  expert: CompanyExpertDefinition;
}): ExpertFinding {
  const { brief, expert } = params;
  const commonContext = `${brief.targetPlatform}/${brief.targetRegion}`;

  const byExpert: Record<string, Omit<ExpertFinding, 'expertId' | 'role' | 'source'>> = {
    productAgent: {
      summary: `产品专家已检查 ${commonContext} 项目的商品定位。`,
      diagnosis: ['目标用户、主推 SKU、核心购买理由需要更明确。'],
      recommendations: ['补充主推商品、核心使用场景和用户购买动机。'],
      questionsToUser: ['本场直播主推 SKU 是哪一个？', '最重要的用户痛点是什么？'],
      risks: ['卖点分散会削弱转化。'],
      confidence: 0.62
    },
    operationsAgent: {
      summary: `运营专家已检查 ${commonContext} 项目的直播执行条件。`,
      diagnosis: ['主播、排期、场控 SOP 和异常处理信息不足。'],
      recommendations: ['补充直播排期、主播职责和场控清单。'],
      questionsToUser: ['谁负责主播和场控？', '直播时长和排期是什么？'],
      risks: ['执行断点会影响直播间稳定性。'],
      confidence: 0.6
    },
    contentAgent: {
      summary: `内容专家已检查 ${commonContext} 项目的内容表达。`,
      diagnosis: ['脚本开场、短视频 hook、视觉和声音 brief 仍需具体化。'],
      recommendations: ['用用户痛点开场，并把卖点转成直播话术。'],
      questionsToUser: ['是否有用户评价或证据素材？'],
      risks: ['未经证据支持的功效表达会带来合规风险。'],
      confidence: 0.64
    },
    growthAgent: {
      summary: `增长专家已检查 ${commonContext} 项目的增长目标。`,
      diagnosis: ['GMV、转化率、拉新或复购目标还没有拆清楚。'],
      recommendations: ['明确本场直播唯一增长目标，并设置 2 个转化实验。'],
      questionsToUser: ['本场优先 GMV、拉新还是复购？'],
      risks: ['目标不聚焦会导致策略互相稀释。'],
      confidence: 0.61
    },
    riskAgent: {
      summary: `风控专家已检查 ${commonContext} 项目的合规风险。`,
      diagnosis: ['功效、退款承诺、平台政策证据需要补齐。'],
      recommendations: ['删除绝对化承诺，并补充必要 disclaimer。'],
      questionsToUser: ['是否有平台政策依据和商品证明材料？'],
      risks: ['违规话术可能触发平台审核或封禁。'],
      confidence: 0.66
    },
    financeAgent: {
      summary: `财务专家已检查 ${commonContext} 项目的财务条件。`,
      diagnosis: ['商品成本、物流成本、折扣边界和佣金信息缺失。'],
      recommendations: ['先补成本和目标毛利，再确认折扣策略。'],
      questionsToUser: ['商品成本、物流成本和目标毛利是多少？'],
      risks: ['折扣可能打穿毛利。'],
      confidence: 0.58
    }
  };

  const fallback = byExpert[expert.expertId] ?? {
    summary: `${expert.displayName} 已进行基础检查。`,
    diagnosis: ['该专家的深度逻辑尚未进入第一版核心范围。'],
    recommendations: ['先记录专家缺口，待该职能进入核心范围后深化。'],
    questionsToUser: ['这个职能是否需要纳入本次会诊？'],
    risks: ['当前结论只能作为轻量参考。'],
    confidence: 0.45
  };

  return {
    expertId: expert.expertId,
    role: expert.role,
    ...fallback,
    source: 'fallback'
  };
}
```

- [ ] **Step 5: Add consultation node helpers**

Create `agents/company-live/src/flows/company-live/nodes/expert-consultation-nodes.ts` with these exports:

```ts
import type {
  CompanyExpertConsultation,
  CompanyExpertDefinition,
  CompanyExpertId,
  CompanyLiveContentBrief,
  ExpertFinding,
  ILLMProvider
} from '@agent/core';
import { CompanyExpertConsultationSchema, ExpertFindingSchema } from '@agent/core';
import { generateObjectWithRetry } from '@agent/adapters';

import { companyLiveExpertDefinitions } from '../expert-definitions';
import {
  buildCompanyLiveExpertUserPrompt,
  COMPANY_LIVE_EXPERT_SYSTEM_PROMPT
} from '../prompts/company-live-expert-prompts';
import { buildCompanyLiveFallbackFinding } from './expert-fallbacks';
import { routeCompanyLiveExperts } from './expert-router-node';

export interface CompanyLiveExpertConsultInput {
  brief: CompanyLiveContentBrief;
  question: string;
  llm?: Pick<ILLMProvider, 'isConfigured' | 'generateObject'>;
  now?: () => Date;
}

function getExpert(expertId: CompanyExpertId): CompanyExpertDefinition {
  const expert = companyLiveExpertDefinitions.find(item => item.expertId === expertId);
  if (!expert) throw new Error(`Unknown company-live expert: ${expertId}`);
  return expert;
}

async function runExpert(params: {
  brief: CompanyLiveContentBrief;
  question: string;
  expert: CompanyExpertDefinition;
  llm?: Pick<ILLMProvider, 'isConfigured' | 'generateObject'>;
}): Promise<ExpertFinding> {
  if (!params.llm?.isConfigured() || typeof params.llm.generateObject !== 'function') {
    return buildCompanyLiveFallbackFinding(params);
  }

  try {
    return await generateObjectWithRetry({
      llm: params.llm,
      contractName: `company-live.expert.${params.expert.expertId}`,
      contractVersion: '1.0.0',
      schema: ExpertFindingSchema,
      messages: [
        { role: 'system', content: COMPANY_LIVE_EXPERT_SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildCompanyLiveExpertUserPrompt({
            brief: params.brief,
            question: params.question,
            expert: params.expert
          })
        }
      ],
      options: {
        role: 'manager',
        temperature: 0.1
      }
    });
  } catch {
    return buildCompanyLiveFallbackFinding(params);
  }
}

function collectMissingInputs(findings: ExpertFinding[]): string[] {
  const values = new Set<string>();
  for (const finding of findings) {
    for (const question of finding.questionsToUser) {
      if (/成本|库存|物流|证据|报告|SKU|排期|主播/.test(question)) values.add(question.replace(/[？?]$/, ''));
    }
  }
  if (findings.some(finding => finding.expertId === 'financeAgent')) values.add('商品成本');
  return [...values];
}

export async function runCompanyLiveExpertConsultation(
  input: CompanyLiveExpertConsultInput
): Promise<CompanyExpertConsultation> {
  const selectedExperts = routeCompanyLiveExperts(input.question);
  const expertFindings: ExpertFinding[] = [];

  for (const expertId of selectedExperts) {
    expertFindings.push(
      await runExpert({
        brief: input.brief,
        question: input.question,
        expert: getExpert(expertId),
        llm: input.llm
      })
    );
  }

  const createdAt = (input.now?.() ?? new Date()).toISOString();
  return CompanyExpertConsultationSchema.parse({
    consultationId: `consult-${input.brief.briefId}-${createdAt}`,
    briefId: input.brief.briefId,
    userQuestion: input.question,
    selectedExperts,
    expertFindings,
    missingInputs: collectMissingInputs(expertFindings),
    conflicts:
      selectedExperts.includes('growthAgent') && selectedExperts.includes('financeAgent')
        ? [
            {
              conflictId: 'conflict-growth-finance-discount',
              summary: '增长折扣建议需要先经过财务毛利护栏校验。',
              expertIds: ['growthAgent', 'financeAgent'],
              resolutionHint: '补充成本、目标毛利和预算后再确认折扣。'
            }
          ]
        : [],
    nextActions: expertFindings.map(finding => ({
      actionId: `action-${finding.expertId}`,
      ownerExpertId: finding.expertId,
      label: finding.recommendations[0] ?? finding.summary,
      priority: finding.expertId === 'riskAgent' || finding.expertId === 'financeAgent' ? 'high' : 'medium'
    })),
    businessPlanPatch: {
      briefId: input.brief.briefId,
      updates: expertFindings.map(finding => ({
        path: `experts.${finding.expertId}`,
        value: finding.summary,
        reason: finding.diagnosis[0] ?? finding.summary
      }))
    },
    createdAt
  });
}
```

- [ ] **Step 6: Add graph facade**

Create `agents/company-live/src/graphs/company-live-experts.graph.ts`:

```ts
import type { CompanyExpertConsultation } from '@agent/core';

import {
  type CompanyLiveExpertConsultInput,
  runCompanyLiveExpertConsultation
} from '../flows/company-live/nodes/expert-consultation-nodes';

export type CompanyLiveExpertConsultOptions = Omit<CompanyLiveExpertConsultInput, 'brief' | 'question'>;

export async function consultCompanyLiveExperts(
  input: CompanyLiveExpertConsultInput
): Promise<CompanyExpertConsultation> {
  return runCompanyLiveExpertConsultation(input);
}
```

- [ ] **Step 7: Export graph and types**

Modify `agents/company-live/src/index.ts`:

```ts
export { consultCompanyLiveExperts } from './graphs/company-live-experts.graph';
export type { CompanyLiveExpertConsultOptions } from './graphs/company-live-experts.graph';
export type { CompanyLiveExpertConsultInput } from './flows/company-live/nodes/expert-consultation-nodes';
```

- [ ] **Step 8: Run graph tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js agents/company-live/test/company-live-experts-graph.test.ts
```

Expected: pass.

- [ ] **Step 9: Run company-live package tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js agents/company-live/test
```

Expected: pass.

- [ ] **Step 10: Commit**

```bash
git add agents/company-live/src/flows/company-live/prompts/company-live-expert-prompts.ts agents/company-live/src/flows/company-live/nodes/expert-fallbacks.ts agents/company-live/src/flows/company-live/nodes/expert-consultation-nodes.ts agents/company-live/src/graphs/company-live-experts.graph.ts agents/company-live/src/index.ts agents/company-live/test/company-live-experts-graph.test.ts
git commit -m "feat: add company live expert consultation graph"
```

---

### Task 4: Backend Expert Consultation Endpoint

**Files:**

- Modify: `apps/backend/agent-server/src/company-live/company-live.dto.ts`
- Modify: `apps/backend/agent-server/src/company-live/company-live.controller.ts`
- Modify: `apps/backend/agent-server/src/company-live/company-live.service.ts`
- Modify: `apps/backend/agent-server/src/runtime/core/runtime-company-live-facade.ts`
- Modify: `apps/backend/agent-server/test/company-live/company-live.controller.spec.ts`
- Modify: `apps/backend/agent-server/test/company-live/company-live.service.spec.ts`

- [ ] **Step 1: Write failing controller test**

Add to `apps/backend/agent-server/test/company-live/company-live.controller.spec.ts`:

```ts
it('calls service.consultExperts with parsed brief and question', async () => {
  const consultResult = {
    consultationId: 'consult-1',
    briefId: 'brief-test-1',
    userQuestion: '这个项目缺什么？',
    selectedExperts: ['productAgent'],
    expertFindings: [
      {
        expertId: 'productAgent',
        role: 'product',
        summary: '需要明确主推 SKU。',
        diagnosis: [],
        recommendations: [],
        questionsToUser: [],
        risks: [],
        confidence: 0.6,
        source: 'fallback'
      }
    ],
    missingInputs: [],
    conflicts: [],
    nextActions: [],
    businessPlanPatch: { briefId: 'brief-test-1', updates: [] },
    createdAt: '2026-05-02T00:00:00.000Z'
  };
  const service = {
    generate: vi.fn(),
    consultExperts: vi.fn().mockResolvedValue(consultResult)
  } as unknown as CompanyLiveService;
  const controller = new CompanyLiveController(service);

  const result = await controller.consultExperts({
    question: '这个项目缺什么？',
    brief: stubFormBody
  });

  expect(service.consultExperts).toHaveBeenCalledWith(
    expect.objectContaining({ briefId: 'brief-test-1' }),
    '这个项目缺什么？'
  );
  expect(result).toEqual(consultResult);
});
```

- [ ] **Step 2: Run backend company-live tests to verify failure**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/company-live
```

Expected: fail because `consultExperts` controller method does not exist.

- [ ] **Step 3: Add DTO parser**

Modify `apps/backend/agent-server/src/company-live/company-live.dto.ts`:

```ts
import { z } from 'zod/v4';

export const CompanyLiveExpertConsultDtoSchema = z.object({
  question: z.string().min(1),
  brief: CompanyLiveGenerateDtoSchema
});

export type CompanyLiveExpertConsultDto = z.infer<typeof CompanyLiveExpertConsultDtoSchema>;

export function parseCompanyLiveExpertConsultDto(body: unknown) {
  const parsed = CompanyLiveExpertConsultDtoSchema.parse(body);
  return {
    question: parsed.question,
    brief: parseCompanyLiveGenerateDto(parsed.brief)
  };
}
```

Keep the existing generate DTO exports intact.

- [ ] **Step 4: Add facade method**

Modify `apps/backend/agent-server/src/runtime/core/runtime-company-live-facade.ts`:

```ts
import type { CompanyExpertConsultation, ILLMProvider } from '@agent/core';
import { consultCompanyLiveExperts } from '@agent/agents-company-live';

async consultExperts(params: {
  brief: CompanyLiveContentBrief;
  question: string;
  llm?: Pick<ILLMProvider, 'isConfigured' | 'generateObject'>;
}): Promise<CompanyExpertConsultation> {
  return consultCompanyLiveExperts(params);
}
```

- [ ] **Step 5: Add service method**

Modify `apps/backend/agent-server/src/company-live/company-live.service.ts`:

```ts
import type { CompanyExpertConsultation } from '@agent/core';

async consultExperts(dto: CompanyLiveGenerateDto, question: string): Promise<CompanyExpertConsultation> {
  return this.companyLiveFacade.consultExperts({ brief: dto, question });
}
```

- [ ] **Step 6: Add controller endpoint**

Modify `apps/backend/agent-server/src/company-live/company-live.controller.ts`:

```ts
import type { CompanyExpertConsultation } from '@agent/core';
import { parseCompanyLiveExpertConsultDto } from './company-live.dto';

@Post('experts/consult')
@HttpCode(HttpStatus.OK)
async consultExperts(@Body() body: unknown): Promise<CompanyExpertConsultation> {
  const parsed = parseCompanyLiveExpertConsultDto(body);
  return this.companyLiveService.consultExperts(parsed.brief, parsed.question);
}
```

- [ ] **Step 7: Run backend company-live tests**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/company-live
```

Expected: pass.

- [ ] **Step 8: Run backend typecheck**

Run:

```bash
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
```

Expected: pass.

- [ ] **Step 9: Commit**

```bash
git add apps/backend/agent-server/src/company-live/company-live.dto.ts apps/backend/agent-server/src/company-live/company-live.controller.ts apps/backend/agent-server/src/company-live/company-live.service.ts apps/backend/agent-server/src/runtime/core/runtime-company-live-facade.ts apps/backend/agent-server/test/company-live/company-live.controller.spec.ts apps/backend/agent-server/test/company-live/company-live.service.spec.ts
git commit -m "feat: expose company live expert consultation api"
```

---

### Task 5: Admin Expert Consultation UI

**Files:**

- Modify: `apps/frontend/agent-admin/src/api/company-live.api.ts`
- Create: `apps/frontend/agent-admin/src/pages/company-agents/company-live-expert-consult-form.tsx`
- Create: `apps/frontend/agent-admin/src/pages/company-agents/company-live-expert-consult-result.tsx`
- Modify: `apps/frontend/agent-admin/src/pages/company-agents/company-agents-panel.tsx`
- Modify: `apps/frontend/agent-admin/test/api/admin-api-company-live.test.ts`

- [ ] **Step 1: Write failing API test**

Add to `apps/frontend/agent-admin/test/api/admin-api-company-live.test.ts`:

```ts
import { consultCompanyLiveExperts } from '@/api/company-live.api';

it('calls POST /company-live/experts/consult with question and brief', async () => {
  const mockResult = {
    consultationId: 'consult-1',
    briefId: 'brief-1',
    userQuestion: '这个项目缺什么？',
    selectedExperts: ['productAgent'],
    expertFindings: [],
    missingInputs: [],
    conflicts: [],
    nextActions: [],
    businessPlanPatch: { briefId: 'brief-1', updates: [] },
    createdAt: '2026-05-02T00:00:00.000Z'
  };
  requestMock.mockResolvedValue(mockResult);

  const brief = {
    briefId: 'brief-1',
    targetPlatform: 'TikTok',
    script: 'Hello world',
    durationSeconds: 60,
    speakerVoiceId: 'voice-default',
    requestedBy: 'test-user'
  };

  const result = await consultCompanyLiveExperts({ question: '这个项目缺什么？', brief });

  expect(requestMock).toHaveBeenCalledWith(
    '/company-live/experts/consult',
    expect.objectContaining({ method: 'POST' })
  );
  expect(JSON.parse((requestMock.mock.calls[0]?.[1] as { body: string }).body)).toEqual({
    question: '这个项目缺什么？',
    brief
  });
  expect(result).toEqual(mockResult);
});
```

- [ ] **Step 2: Run API test to verify failure**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/frontend/agent-admin/test/api/admin-api-company-live.test.ts
```

Expected: fail because `consultCompanyLiveExperts` is not exported.

- [ ] **Step 3: Add API client**

Modify `apps/frontend/agent-admin/src/api/company-live.api.ts`:

```ts
import type { CompanyExpertConsultation } from '@agent/core';

export interface CompanyLiveExpertConsultRequest {
  question: string;
  brief: CompanyLiveGenerateBrief;
}

export async function consultCompanyLiveExperts(
  input: CompanyLiveExpertConsultRequest
): Promise<CompanyExpertConsultation> {
  return request<CompanyExpertConsultation>('/company-live/experts/consult', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}
```

- [ ] **Step 4: Add consult form**

Create `apps/frontend/agent-admin/src/pages/company-agents/company-live-expert-consult-form.tsx`:

```tsx
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import type { CompanyLiveGenerateBrief } from '@/api/company-live.api';

interface CompanyLiveExpertConsultFormProps {
  loading: boolean;
  onSubmit: (input: { question: string; brief: CompanyLiveGenerateBrief }) => void;
}

export function CompanyLiveExpertConsultForm({ loading, onSubmit }: CompanyLiveExpertConsultFormProps) {
  const [question, setQuestion] = useState('让公司专家们整体会诊一下这个项目缺什么');
  const [briefId, setBriefId] = useState('brief-expert-demo');
  const [targetPlatform, setTargetPlatform] = useState('TikTok');
  const [script, setScript] = useState('Show the product benefit, then explain the offer.');

  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-foreground">公司专家会诊</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <input
          className="rounded-md border px-3 py-2 text-sm"
          value={question}
          onChange={event => setQuestion(event.target.value)}
        />
        <div className="grid gap-2 md:grid-cols-3">
          <input
            className="rounded-md border px-3 py-2 text-sm"
            value={briefId}
            onChange={event => setBriefId(event.target.value)}
          />
          <input
            className="rounded-md border px-3 py-2 text-sm"
            value={targetPlatform}
            onChange={event => setTargetPlatform(event.target.value)}
          />
          <input
            className="rounded-md border px-3 py-2 text-sm"
            value={script}
            onChange={event => setScript(event.target.value)}
          />
        </div>
        <Button
          type="button"
          disabled={loading}
          onClick={() =>
            onSubmit({
              question,
              brief: {
                briefId,
                targetPlatform,
                script,
                durationSeconds: 60,
                speakerVoiceId: 'voice-default',
                requestedBy: 'agent-admin'
              }
            })
          }
        >
          {loading ? '会诊中' : '发起专家会诊'}
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Add result display**

Create `apps/frontend/agent-admin/src/pages/company-agents/company-live-expert-consult-result.tsx`:

```tsx
import type { CompanyExpertConsultation } from '@agent/core';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CompanyLiveExpertConsultResultProps {
  result: CompanyExpertConsultation;
}

export function CompanyLiveExpertConsultResult({ result }: CompanyLiveExpertConsultResultProps) {
  return (
    <Card className="border-border/70 bg-card/90 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-foreground">会诊结果</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          {result.selectedExperts.map(expertId => (
            <Badge key={expertId} variant="secondary">
              {expertId}
            </Badge>
          ))}
        </div>
        <div className="grid gap-3">
          {result.expertFindings.map(finding => (
            <article key={finding.expertId} className="rounded-md border border-border/70 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">{finding.expertId}</p>
                <Badge variant={finding.source === 'llm' ? 'success' : 'outline'}>{finding.source}</Badge>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{finding.summary}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {finding.recommendations.map(item => (
                  <li key={`${finding.expertId}-${item}`}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        {result.missingInputs.length ? (
          <p className="text-sm text-muted-foreground">缺失信息：{result.missingInputs.join('、')}</p>
        ) : null}
        {result.conflicts.length ? (
          <p className="text-sm text-muted-foreground">
            冲突：{result.conflicts.map(conflict => conflict.summary).join('；')}
          </p>
        ) : null}
        {result.nextActions.length ? (
          <p className="text-sm text-muted-foreground">
            下一步：{result.nextActions.map(action => action.label).join('；')}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 6: Wire panel state**

Modify `apps/frontend/agent-admin/src/pages/company-agents/company-agents-panel.tsx`:

```tsx
import type { CompanyExpertConsultation } from '@agent/core';
import { consultCompanyLiveExperts } from '@/api/company-live.api';
import { CompanyLiveExpertConsultForm } from './company-live-expert-consult-form';
import { CompanyLiveExpertConsultResult } from './company-live-expert-consult-result';

const [consultResult, setConsultResult] = useState<CompanyExpertConsultation | null>(null);
const [consultLoading, setConsultLoading] = useState(false);
const [consultError, setConsultError] = useState<string | null>(null);

async function handleConsult(input: Parameters<typeof consultCompanyLiveExperts>[0]) {
  setConsultLoading(true);
  setConsultError(null);
  setConsultResult(null);
  try {
    setConsultResult(await consultCompanyLiveExperts(input));
  } catch (err) {
    setConsultError(err instanceof Error ? err.message : '专家会诊失败');
  } finally {
    setConsultLoading(false);
  }
}
```

Render this before the media generation card:

```tsx
<CompanyLiveExpertConsultForm onSubmit={handleConsult} loading={consultLoading} />;
{
  consultError && <p className="text-sm text-destructive">{consultError}</p>;
}
{
  consultResult && <CompanyLiveExpertConsultResult result={consultResult} />;
}
```

- [ ] **Step 7: Run frontend API test**

Run:

```bash
pnpm exec vitest run --config vitest.config.js apps/frontend/agent-admin/test/api/admin-api-company-live.test.ts
```

Expected: pass.

- [ ] **Step 8: Run agent-admin typecheck**

Run:

```bash
pnpm exec tsc -p apps/frontend/agent-admin/tsconfig.app.json --noEmit
```

Expected: pass.

- [ ] **Step 9: Commit**

```bash
git add apps/frontend/agent-admin/src/api/company-live.api.ts apps/frontend/agent-admin/src/pages/company-agents/company-live-expert-consult-form.tsx apps/frontend/agent-admin/src/pages/company-agents/company-live-expert-consult-result.tsx apps/frontend/agent-admin/src/pages/company-agents/company-agents-panel.tsx apps/frontend/agent-admin/test/api/admin-api-company-live.test.ts
git commit -m "feat: add company live expert consult ui"
```

---

### Task 6: Docs And Verification

**Files:**

- Create: `docs/contracts/api/company-live-experts-consult.md`
- Modify: `docs/architecture/media-provider-boundary-and-company-live-workflow.md`
- Create: `docs/apps/frontend/agent-admin/company-live-experts.md`

- [ ] **Step 1: Add API contract document**

Create `docs/contracts/api/company-live-experts-consult.md`:

````md
# Company Live Experts Consult API

状态：current
文档类型：reference
适用范围：`agents/company-live`、`apps/backend/agent-server`、`apps/frontend/agent-admin`
最后核对：2026-05-02

路径：`POST /api/company-live/experts/consult`

## 接口目的

接收 company-live 项目 brief 和用户问题，路由到公司专家，返回结构化 `CompanyExpertConsultation`。

## 请求体

```json
{
  "question": "让公司专家们整体会诊一下这个项目缺什么",
  "brief": {
    "briefId": "brief-demo-1",
    "targetPlatform": "TikTok",
    "script": "Show the product benefit.",
    "durationSeconds": 60,
    "speakerVoiceId": "voice-default"
  }
}
```
````

## 响应

响应体为 `CompanyExpertConsultation`，schema 位于 `packages/core/src/contracts/media/company-live-experts.schema.ts`。

## 错误语义

- 请求体不符合 schema 时返回 400。
- graph 执行异常时返回 500。
- LLM 不可用不会导致失败，系统返回 `source: "fallback"` 的专家发现。

```

```

- [ ] **Step 2: Update architecture document**

Append a section to `docs/architecture/media-provider-boundary-and-company-live-workflow.md`:

```md
## 18. CompanyLive Experts Consultation

状态：current
最后核对：2026-05-02

`agents/company-live` 新增公司专家咨询边界：专家咨询先回答“项目缺什么、风险在哪、下一步怎么补”，并输出 `CompanyExpertConsultation`。媒体生成仍通过既有 audio/image/video provider 边界完成，但专家咨询不再强制绑定到媒体生成 pipeline。

第一版专家集合包含 10 个公司职能专家，其中 `productAgent`、`operationsAgent`、`contentAgent`、`growthAgent`、`riskAgent`、`financeAgent` 是核心专家。`marketingAgent`、`intelligenceAgent`、`supportAgent`、`supplyAgent` 先作为定义和路由扩展点保留。
```

- [ ] **Step 3: Add Admin doc**

Create `docs/apps/frontend/agent-admin/company-live-experts.md`:

```md
# Agent Admin Company Live Experts

状态：current
文档类型：guide
适用范围：`apps/frontend/agent-admin`
最后核对：2026-05-02

`company-agents` 页面提供 company-live 专家会诊入口。用户提交项目 brief 和问题后，前端调用 `POST /company-live/experts/consult`，展示参与专家、专家发现、缺失信息、冲突和下一步行动。

该页面只展示 `CompanyExpertConsultation` 稳定 contract，不读取 `agents/company-live` 内部 graph 状态。
```

- [ ] **Step 4: Run docs check**

Run:

```bash
pnpm check:docs
```

Expected: pass.

- [ ] **Step 5: Run affected verification**

Run these commands:

```bash
pnpm exec vitest run --config vitest.config.js packages/core/test/media-contracts.test.ts
pnpm exec vitest run --config vitest.config.js agents/company-live/test
pnpm exec vitest run --config vitest.config.js apps/backend/agent-server/test/company-live
pnpm exec vitest run --config vitest.config.js apps/frontend/agent-admin/test/api/admin-api-company-live.test.ts
pnpm exec tsc -p apps/backend/agent-server/tsconfig.json --noEmit
pnpm exec tsc -p apps/frontend/agent-admin/tsconfig.app.json --noEmit
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add docs/contracts/api/company-live-experts-consult.md docs/architecture/media-provider-boundary-and-company-live-workflow.md docs/apps/frontend/agent-admin/company-live-experts.md
git commit -m "docs: document company live experts"
```

---

## Self-Review

- Spec coverage: Tasks cover expert definitions, 6 core expert logic, router, consultation result, fallback behavior, backend endpoint, Admin display, docs, and verification.
- Placeholder scan: This plan uses concrete file paths, schemas, tests, commands, and expected outcomes. It does not use open-ended implementation placeholders.
- Type consistency: `CompanyExpertConsultation`, `ExpertFinding`, `CompanyExpertId`, `CompanyLiveBusinessPlanPatch`, `consultCompanyLiveExperts`, and `routeCompanyLiveExperts` are introduced before later tasks consume them.

## Execution Notes

- Do not use `git worktree`.
- Keep commits small and in task order.
- Do not stage unrelated worktree changes; this repository currently has unrelated local changes outside this plan.
- If a verification command fails because of unrelated existing red lights, record the failing command, error summary, and whether the affected files from this plan still passed their narrower tests.
