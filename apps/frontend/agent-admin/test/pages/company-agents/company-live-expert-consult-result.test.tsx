import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, className, title }: any) => (
    <span className={`badge ${className ?? ''}`} data-variant={variant ?? ''} title={title}>
      {children}
    </span>
  )
}));

import { CompanyLiveExpertConsultResult } from '@/pages/company-agents/company-live-expert-consult-result';
import type { CompanyExpertConsultation } from '@agent/core';

function createResult(overrides: Partial<CompanyExpertConsultation> = {}): CompanyExpertConsultation {
  return {
    consultationId: 'consult-001',
    briefId: 'brief-001',
    userQuestion: 'How to improve conversion?',
    selectedExperts: ['marketingAgent', 'contentAgent'],
    expertFindings: [
      {
        expertId: 'marketingAgent',
        role: 'marketing',
        summary: 'Improve headline',
        confidence: 0.85,
        diagnosis: ['Weak CTA', 'No urgency'],
        recommendations: ['Add timer', 'Bold offer'],
        questionsToUser: [],
        risks: [],
        source: 'llm'
      }
    ],
    missingInputs: [],
    conflicts: [],
    nextActions: [],
    businessPlanPatch: {
      briefId: 'brief-001',
      updates: []
    },
    createdAt: '2026-05-10T10:00:00.000Z',
    ...overrides
  };
}

describe('CompanyLiveExpertConsultResult', () => {
  it('renders consultation id and user question', () => {
    const result = createResult();
    const html = renderToStaticMarkup(<CompanyLiveExpertConsultResult result={result} />);

    expect(html).toContain('consult-001');
    expect(html).toContain('How to improve conversion?');
    expect(html).toContain('专家会诊结果');
  });

  it('renders selected experts', () => {
    const result = createResult();
    const html = renderToStaticMarkup(<CompanyLiveExpertConsultResult result={result} />);

    expect(html).toContain('marketingAgent');
    expect(html).toContain('contentAgent');
  });

  it('renders expert findings with role and summary', () => {
    const result = createResult();
    const html = renderToStaticMarkup(<CompanyLiveExpertConsultResult result={result} />);

    expect(html).toContain('Expert Findings');
    expect(html).toContain('marketing');
    expect(html).toContain('Improve headline');
    expect(html).toContain('85%');
  });

  it('renders diagnosis items', () => {
    const result = createResult();
    const html = renderToStaticMarkup(<CompanyLiveExpertConsultResult result={result} />);

    expect(html).toContain('Weak CTA');
    expect(html).toContain('No urgency');
  });

  it('renders recommendation badges', () => {
    const result = createResult();
    const html = renderToStaticMarkup(<CompanyLiveExpertConsultResult result={result} />);

    expect(html).toContain('Add timer');
    expect(html).toContain('Bold offer');
  });

  it('renders empty state for missing inputs when empty', () => {
    const result = createResult({ missingInputs: [] });
    const html = renderToStaticMarkup(<CompanyLiveExpertConsultResult result={result} />);

    expect(html).toContain('缺失输入：暂无');
  });

  it('renders missing inputs when present', () => {
    const result = createResult({ missingInputs: ['budget info', 'target audience'] });
    const html = renderToStaticMarkup(<CompanyLiveExpertConsultResult result={result} />);

    expect(html).toContain('budget info');
    expect(html).toContain('target audience');
  });

  it('renders empty state for conflicts when empty', () => {
    const result = createResult({ conflicts: [] });
    const html = renderToStaticMarkup(<CompanyLiveExpertConsultResult result={result} />);

    expect(html).toContain('冲突：暂无');
  });

  it('renders conflicts when present', () => {
    const result = createResult({
      conflicts: [
        {
          conflictId: 'conflict-1',
          summary: 'Different approaches',
          resolutionHint: 'Use A/B test',
          expertIds: ['marketingAgent', 'contentAgent']
        }
      ]
    });
    const html = renderToStaticMarkup(<CompanyLiveExpertConsultResult result={result} />);

    expect(html).toContain('Different approaches');
    expect(html).toContain('Use A/B test');
  });

  it('renders empty state for next actions when empty', () => {
    const result = createResult({ nextActions: [] });
    const html = renderToStaticMarkup(<CompanyLiveExpertConsultResult result={result} />);

    expect(html).toContain('下一步：暂无');
  });

  it('renders next actions when present', () => {
    const result = createResult({
      nextActions: [
        { actionId: 'action-1', priority: 'high', label: 'Run A/B test', ownerExpertId: 'marketingAgent' },
        { actionId: 'action-2', priority: 'low', label: 'Update copy', ownerExpertId: 'contentAgent' }
      ]
    });
    const html = renderToStaticMarkup(<CompanyLiveExpertConsultResult result={result} />);

    expect(html).toContain('Run A/B test');
    expect(html).toContain('Update copy');
    expect(html).toContain('high');
    expect(html).toContain('low');
  });

  it('renders findings without diagnosis or recommendations', () => {
    const result = createResult({
      expertFindings: [
        {
          expertId: 'intelligenceAgent',
          role: 'intelligence',
          summary: 'Data analysis complete',
          confidence: 0.92,
          diagnosis: [],
          recommendations: [],
          questionsToUser: [],
          risks: [],
          source: 'llm'
        }
      ]
    });
    const html = renderToStaticMarkup(<CompanyLiveExpertConsultResult result={result} />);

    expect(html).toContain('Data analysis complete');
    expect(html).toContain('92%');
  });
});
