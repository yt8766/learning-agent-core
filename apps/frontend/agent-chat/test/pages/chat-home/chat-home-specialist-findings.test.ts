import { describe, expect, it } from 'vitest';

import { normalizeSpecialistFinding } from '@/pages/chat-home/chat-home-specialist-findings';

describe('normalizeSpecialistFinding', () => {
  it('会解析完整 JSON summary', () => {
    const finding = normalizeSpecialistFinding({
      specialistId: 'risk-compliance',
      role: 'support',
      contractVersion: 'specialist-finding.v1',
      source: 'critique',
      stage: 'review',
      domain: 'risk-compliance',
      summary:
        '{"summary":"存在奖池击穿风险","riskLevel":"high","blockingIssues":["JackPot 同向押注套利"],"suggestions":["加赔付上限"],"confidence":0.88}'
    } as never);

    expect(finding.summary).toBe('存在奖池击穿风险');
    expect(finding.riskLevel).toBe('high');
    expect(finding.contractVersion).toBe('specialist-finding.v1');
    expect(finding.source).toBe('critique');
    expect(finding.stage).toBe('review');
    expect(finding.blockingIssues).toEqual(['JackPot 同向押注套利']);
    expect(finding.suggestions).toEqual(['加赔付上限']);
    expect(finding.confidence).toBe(0.88);
  });

  it('会对损坏 JSON 做优雅降级', () => {
    const finding = normalizeSpecialistFinding({
      specialistId: 'risk-compliance',
      role: 'support',
      contractVersion: 'specialist-finding.v1',
      source: 'critique',
      stage: 'review',
      domain: 'risk-compliance',
      summary: '{"summary":"存在风险","blockingIssues":["未闭合"',
      suggestions: ['保守推进']
    } as never);

    expect(finding.degraded).toBe(true);
    expect(finding.fallbackMessage).toContain('格式异常');
    expect(finding.suggestions).toEqual(['保守推进']);
  });
});
