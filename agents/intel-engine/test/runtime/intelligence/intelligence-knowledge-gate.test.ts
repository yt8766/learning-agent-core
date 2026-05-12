import { describe, expect, it } from 'vitest';

import { decideIntelligenceKnowledgeCandidate } from '../../../src/runtime/intelligence';

const baseSignal = {
  id: 'sig_1',
  title: 'React 20 migration guide',
  summary: 'Official migration guide for breaking changes.',
  priority: 'P1' as const,
  confidence: 'high' as const,
  status: 'confirmed' as const
};

describe('decideIntelligenceKnowledgeCandidate', () => {
  it('promotes official breaking frontend releases to knowledge candidates', () => {
    const decision = decideIntelligenceKnowledgeCandidate({
      signal: { ...baseSignal, channel: 'frontend-tech' },
      sourceGroups: ['official']
    });

    expect(decision).toMatchObject({
      candidateType: 'knowledge',
      decision: 'candidate',
      ttlDays: 365
    });
  });

  it('turns skills into review-only skill cards', () => {
    const decision = decideIntelligenceKnowledgeCandidate({
      signal: {
        ...baseSignal,
        channel: 'skills-agent-tools',
        title: 'New GitHub PR review skill',
        summary: 'A reusable agent skill for reviewing pull requests.'
      },
      sourceGroups: ['authority']
    });

    expect(decision).toMatchObject({
      candidateType: 'skill_card',
      decision: 'needs_review'
    });
  });

  it('rejects community-only ordinary posts', () => {
    const decision = decideIntelligenceKnowledgeCandidate({
      signal: {
        ...baseSignal,
        channel: 'frontend-tech',
        title: 'Someone likes a new CSS trick',
        summary: 'A community post without official confirmation.'
      },
      sourceGroups: ['community']
    });

    expect(decision).toMatchObject({
      candidateType: 'evidence_only',
      decision: 'rejected'
    });
  });

  it('keeps community-only security keywords out of knowledge candidates', () => {
    const decision = decideIntelligenceKnowledgeCandidate({
      signal: {
        ...baseSignal,
        channel: 'ai-security',
        title: 'Community report mentions a new CVE vulnerability',
        summary: 'A forum post claims a coding agent leak without official confirmation.'
      },
      sourceGroups: ['community']
    });

    expect(decision).toMatchObject({
      candidateType: 'evidence_only',
      decision: 'rejected'
    });
  });
});
