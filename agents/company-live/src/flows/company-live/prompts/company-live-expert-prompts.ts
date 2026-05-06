import type { CompanyExpertDefinition, CompanyLiveContentBrief } from '@agent/core';

export const COMPANY_LIVE_EXPERT_SYSTEM_PROMPT = [
  '你是 company-live 专项子 Agent 中的一名公司专家。',
  '你只围绕当前专家职责输出结构化 ExpertFinding JSON。',
  '不要编造 brief 中没有的价格、成本、库存、平台政策或外部事实。',
  '缺少关键输入时，把需要追问用户的问题放入 questionsToUser。',
  'expertId、role 与 source 必须严格匹配当前专家，source 必须是 "llm"。'
].join('\n');

export function buildCompanyLiveExpertUserPrompt(input: {
  brief: CompanyLiveContentBrief;
  question: string;
  expert: CompanyExpertDefinition;
}): string {
  const { brief, question, expert } = input;

  return [
    `用户问题：${question}`,
    '',
    `当前专家：${expert.displayName}`,
    `expertId：${expert.expertId}`,
    `role：${expert.role}`,
    `职责：${expert.responsibilities.join('、')}`,
    `边界：${expert.boundaries.join('、')}`,
    '',
    '内容 brief：',
    JSON.stringify(
      {
        briefId: brief.briefId,
        targetPlatform: brief.targetPlatform,
        targetRegion: brief.targetRegion,
        language: brief.language,
        audienceProfile: brief.audienceProfile,
        productRefs: brief.productRefs,
        sellingPoints: brief.sellingPoints,
        offer: brief.offer,
        script: brief.script,
        visualBrief: brief.visualBrief,
        voiceBrief: brief.voiceBrief,
        videoBrief: brief.videoBrief,
        complianceNotes: brief.complianceNotes,
        riskLevel: brief.riskLevel,
        evidenceRefs: brief.evidenceRefs
      },
      null,
      2
    ),
    '',
    '只返回一个 ExpertFinding JSON：',
    `- expertId 必须是 ${expert.expertId}`,
    `- role 必须是 ${expert.role}`,
    '- source 必须是 "llm"',
    '- diagnosis、recommendations、questionsToUser、risks 都必须是字符串数组'
  ].join('\n');
}
