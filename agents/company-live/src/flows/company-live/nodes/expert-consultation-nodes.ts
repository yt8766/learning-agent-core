import type { ILLMProvider } from '@agent/core';
import {
  CompanyExpertConsultationSchema,
  CompanyLiveContentBriefSchema,
  ExpertFindingSchema,
  type CompanyExpertDefinition,
  type CompanyExpertId,
  type CompanyLiveContentBrief,
  type ExpertFinding
} from '@agent/core';
import { generateObjectWithRetry, type LlmProvider } from '@agent/adapters';

import { companyLiveExpertDefinitions } from '../expert-definitions';
import {
  COMPANY_LIVE_EXPERT_SYSTEM_PROMPT,
  buildCompanyLiveExpertUserPrompt
} from '../prompts/company-live-expert-prompts';
import { buildCompanyLiveFallbackFinding } from './expert-fallbacks';
import { routeCompanyLiveExperts } from './expert-router-node';

export interface CompanyLiveExpertConsultInput {
  brief: CompanyLiveContentBrief;
  question: string;
  llm?: Pick<ILLMProvider, 'isConfigured' | 'generateObject'>;
  onExpertFallback?: (event: { expertId: CompanyExpertId; reason: CompanyLiveExpertFallbackReason }) => void;
  now?: () => Date;
}

type CompanyLiveExpertFallbackReason = 'llm_not_configured' | 'llm_error' | 'schema_invalid' | 'expert_mismatch';

const expertDefinitionById = new Map<CompanyExpertId, CompanyExpertDefinition>(
  companyLiveExpertDefinitions.map(definition => [definition.expertId, definition])
);

function getExpertDefinition(expertId: CompanyExpertId): CompanyExpertDefinition {
  const definition = expertDefinitionById.get(expertId);
  if (!definition) {
    throw new Error(`Missing company live expert definition for ${expertId}`);
  }

  return definition;
}

async function runExpertFinding(input: {
  brief: CompanyLiveContentBrief;
  question: string;
  expert: CompanyExpertDefinition;
  llm?: Pick<ILLMProvider, 'isConfigured' | 'generateObject'>;
  onExpertFallback?: (event: { expertId: CompanyExpertId; reason: CompanyLiveExpertFallbackReason }) => void;
}): Promise<ExpertFinding> {
  const fallback = (reason: CompanyLiveExpertFallbackReason) => {
    input.onExpertFallback?.({
      expertId: input.expert.expertId,
      reason
    });

    return buildCompanyLiveFallbackFinding({
      brief: input.brief,
      question: input.question,
      expert: input.expert
    });
  };

  if (!input.llm?.isConfigured()) {
    return fallback('llm_not_configured');
  }

  try {
    const finding = await generateObjectWithRetry({
      llm: input.llm as LlmProvider,
      messages: [
        { role: 'system', content: COMPANY_LIVE_EXPERT_SYSTEM_PROMPT },
        {
          role: 'user',
          content: buildCompanyLiveExpertUserPrompt({
            brief: input.brief,
            question: input.question,
            expert: input.expert
          })
        }
      ],
      schema: ExpertFindingSchema,
      options: {
        role: 'research',
        temperature: 0.2,
        maxTokens: 900
      },
      contractName: 'company-live-expert-finding',
      contractVersion: '2026-05-02'
    });

    if (finding.expertId !== input.expert.expertId || finding.role !== input.expert.role || finding.source !== 'llm') {
      return fallback('expert_mismatch');
    }

    return finding;
  } catch (error) {
    return fallback(isSchemaInvalidError(error) ? 'schema_invalid' : 'llm_error');
  }
}

function isSchemaInvalidError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /zod|schema|json|object|parse|validation|invalid input|expected/i.test(message);
}

function collectMissingInputs(input: { brief: CompanyLiveContentBrief; selectedExperts: CompanyExpertId[] }): string[] {
  const missingInputs = new Set<string>();

  if (input.selectedExperts.includes('financeAgent')) {
    missingInputs.add('商品成本');
    missingInputs.add('售价');
    missingInputs.add('投放预算');
  }

  if (input.selectedExperts.includes('operationsAgent')) {
    missingInputs.add('直播排期');
  }

  if (input.selectedExperts.includes('growthAgent')) {
    missingInputs.add('目标 GMV');
  }

  if (input.selectedExperts.includes('riskAgent') && !input.brief.complianceNotes?.length) {
    missingInputs.add('合规禁用词');
  }

  return [...missingInputs];
}

function buildConflicts(selectedExperts: CompanyExpertId[]) {
  if (selectedExperts.includes('growthAgent') && selectedExperts.includes('financeAgent')) {
    return [
      {
        conflictId: 'growth-finance-discount-roi',
        summary: '增长可能希望提高福利强度，财务需要先确认折扣后的毛利和 ROI 临界点。',
        expertIds: ['growthAgent', 'financeAgent'] satisfies CompanyExpertId[],
        resolutionHint: '先补商品成本、售价和预算，再确定福利档位。'
      }
    ];
  }

  return [];
}

function buildNextActions(selectedExperts: CompanyExpertId[]) {
  const actions = [];

  if (selectedExperts.includes('financeAgent')) {
    actions.push({
      actionId: 'collect-cost-and-roi-inputs',
      ownerExpertId: 'financeAgent' as const,
      label: '补齐商品成本、售价、佣金和预算后计算 ROI 临界点',
      priority: 'high' as const
    });
  }

  if (selectedExperts.includes('contentAgent')) {
    actions.push({
      actionId: 'draft-script-and-risk-review',
      ownerExpertId: 'contentAgent' as const,
      label: selectedExperts.includes('riskAgent')
        ? '输出脚本初稿并同步风控复核禁用表达'
        : '输出脚本初稿并依据禁用词/合规清单自查表达',
      priority: 'medium' as const
    });
  }

  if (selectedExperts.includes('operationsAgent')) {
    actions.push({
      actionId: 'prepare-live-sop',
      ownerExpertId: 'operationsAgent' as const,
      label: '整理直播排期、主播分工和场控 SOP',
      priority: 'medium' as const
    });
  }

  return actions;
}

function buildBusinessPlanPatch(input: {
  brief: CompanyLiveContentBrief;
  selectedExperts: CompanyExpertId[];
  missingInputs: string[];
}) {
  return {
    briefId: input.brief.briefId,
    updates: [
      {
        path: 'expertConsultation.selectedExperts',
        value: input.selectedExperts,
        reason: '记录本轮 company-live 专家会诊的实际参与专家。'
      },
      {
        path: 'expertConsultation.missingInputs',
        value: input.missingInputs,
        reason: '为后续业务计划补齐关键输入。'
      }
    ]
  };
}

export async function runCompanyLiveExpertConsultation(input: CompanyLiveExpertConsultInput) {
  const brief = CompanyLiveContentBriefSchema.parse(input.brief);
  const question = input.question.trim();
  if (!question) {
    throw new Error('company-live expert consultation requires a non-empty question');
  }

  const selectedExperts = routeCompanyLiveExperts(question);
  const createdAt = (input.now?.() ?? new Date()).toISOString();
  const expertFindings = await Promise.all(
    selectedExperts.map(expertId =>
      runExpertFinding({
        brief,
        question,
        expert: getExpertDefinition(expertId),
        llm: input.llm,
        onExpertFallback: input.onExpertFallback
      })
    )
  );
  const missingInputs = collectMissingInputs({ brief, selectedExperts });

  return CompanyExpertConsultationSchema.parse({
    consultationId: `company-live-experts-${brief.briefId}-${createdAt}`,
    briefId: brief.briefId,
    userQuestion: question,
    selectedExperts,
    expertFindings,
    missingInputs,
    conflicts: buildConflicts(selectedExperts),
    nextActions: buildNextActions(selectedExperts),
    businessPlanPatch: buildBusinessPlanPatch({
      brief,
      selectedExperts,
      missingInputs
    }),
    createdAt
  });
}
