import { describe, expect, it } from 'vitest';

import {
  IntelligenceChannelSchema,
  IntelligenceKnowledgeCandidateSchema,
  IntelligenceOverviewProjectionSchema,
  IntelligenceSignalSchema
} from '../src/contracts/intelligence';

describe('intelligence contracts', () => {
  it('accepts the approved product channels and rejects runtime engineering', () => {
    expect(IntelligenceChannelSchema.options).toEqual([
      'frontend-tech',
      'frontend-security',
      'llm-releases',
      'skills-agent-tools',
      'ai-security',
      'ai-product-platform'
    ]);
    expect(() => IntelligenceChannelSchema.parse('agent-rag-runtime-engineering')).toThrow();
  });

  it('parses an intelligence signal with source and candidate context', () => {
    const signal = IntelligenceSignalSchema.parse({
      id: 'sig_1',
      channel: 'llm-releases',
      title: 'MiniMax released a new model',
      summary: 'The release changes model selection for long-context workloads.',
      priority: 'P1',
      confidence: 'high',
      status: 'confirmed',
      firstSeenAt: '2026-05-10T01:00:00.000Z',
      lastSeenAt: '2026-05-10T01:00:00.000Z',
      sourceCount: 2,
      knowledgeDecision: 'candidate'
    });
    expect(signal.channel).toBe('llm-releases');
  });

  it('parses overview projections without provider raw payloads', () => {
    const projection = IntelligenceOverviewProjectionSchema.parse({
      generatedAt: '2026-05-10T02:00:00.000Z',
      channels: [
        {
          channel: 'ai-security',
          label: 'AI Security',
          lastRunAt: '2026-05-10T01:00:00.000Z',
          signalCount: 3,
          candidateCount: 1,
          failedQueryCount: 0
        }
      ],
      recentSignals: [
        {
          id: 'sig_1',
          channel: 'ai-security',
          title: 'Prompt injection advisory',
          summary: 'A confirmed advisory affects agent-facing product surfaces.',
          priority: 'P1',
          confidence: 'high',
          status: 'confirmed',
          firstSeenAt: '2026-05-10T01:00:00.000Z',
          lastSeenAt: '2026-05-10T01:00:00.000Z',
          sourceCount: 1,
          knowledgeDecision: 'candidate',
          rawPayload: { provider: 'minimax-cli' }
        }
      ],
      pendingCandidates: [
        {
          id: 'cand_1',
          signalId: 'sig_1',
          candidateType: 'evidence_only',
          decision: 'needs_review',
          decisionReason: 'Security signal needs human review before promotion.',
          reviewStatus: 'pending',
          createdAt: '2026-05-10T01:00:00.000Z',
          rawPayload: { provider: 'minimax-cli' }
        }
      ]
    });
    expect('rawPayload' in projection.recentSignals[0]!).toBe(false);
    expect('rawPayload' in projection.pendingCandidates[0]!).toBe(false);
  });

  it('parses skill-card candidates separately from knowledge candidates', () => {
    const candidate = IntelligenceKnowledgeCandidateSchema.parse({
      id: 'cand_1',
      signalId: 'sig_1',
      candidateType: 'skill_card',
      decision: 'needs_review',
      decisionReason: 'Agent tool candidate requires human approval before installation.',
      reviewStatus: 'pending',
      createdAt: '2026-05-10T01:00:00.000Z'
    });
    expect(candidate.candidateType).toBe('skill_card');
  });
});
