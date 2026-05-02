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
