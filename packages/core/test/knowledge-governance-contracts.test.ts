import { describe, expect, it } from 'vitest';

import { KnowledgeGovernanceProjectionSchema } from '../src/contracts/knowledge-service';

describe('Knowledge governance contracts', () => {
  it('parses the agent-admin governance projection', () => {
    const parsed = KnowledgeGovernanceProjectionSchema.parse({
      summary: {
        knowledgeBaseCount: 3,
        documentCount: 48,
        readyDocumentCount: 44,
        failedJobCount: 2,
        warningCount: 1
      },
      providerHealth: [
        {
          provider: 'embedding',
          status: 'ok',
          warningCount: 0
        },
        {
          provider: 'vector',
          status: 'degraded',
          warningCount: 1,
          reason: 'Index lag above governance threshold'
        }
      ],
      ingestionSources: [
        {
          id: 'src-handbook',
          label: 'Employee Handbook',
          sourceType: 'document',
          status: 'active',
          indexedDocumentCount: 32,
          failedDocumentCount: 1
        }
      ],
      retrievalDiagnostics: [
        {
          id: 'diag-live',
          query: 'company live handbook policy',
          retrievalMode: 'hybrid',
          hitCount: 8,
          totalCount: 10,
          failedRetrieverCount: 0
        }
      ],
      agentUsage: [
        {
          agentId: 'company-live',
          agentLabel: 'Company Live Agent',
          knowledgeBaseIds: ['kb-handbook', 'kb-policy'],
          recentRunCount: 12,
          evidenceCount: 18
        }
      ],
      updatedAt: '2026-05-04T08:30:00.000Z'
    });

    expect(parsed.summary.knowledgeBaseCount).toBe(3);
    expect(parsed.agentUsage[0]?.agentId).toBe('company-live');
  });

  it('strips raw provider payloads from governance projections', () => {
    const parsed = KnowledgeGovernanceProjectionSchema.parse({
      summary: {
        knowledgeBaseCount: 1,
        documentCount: 2,
        readyDocumentCount: 2,
        failedJobCount: 0,
        warningCount: 0
      },
      providerHealth: [
        {
          provider: 'embedding',
          status: 'ok',
          warningCount: 0,
          vendor: {
            response: 'raw-provider-payload'
          }
        }
      ],
      ingestionSources: [
        {
          id: 'src-upload',
          label: 'User Upload',
          sourceType: 'user-upload',
          status: 'active',
          indexedDocumentCount: 2,
          failedDocumentCount: 0,
          credential: 'secret-token'
        }
      ],
      retrievalDiagnostics: [
        {
          id: 'diag-latest',
          query: 'policy',
          retrievalMode: 'hybrid',
          hitCount: 2,
          totalCount: 2,
          failedRetrieverCount: 0,
          raw: {
            vectorScores: [0.99]
          }
        }
      ],
      agentUsage: [
        {
          agentId: 'company-live',
          agentLabel: 'Company Live Agent',
          knowledgeBaseIds: ['kb-policy'],
          recentRunCount: 1,
          evidenceCount: 2,
          secret: 'should-not-pass'
        }
      ],
      updatedAt: '2026-05-04T08:30:00.000Z',
      raw: {
        vendorTrace: 'should-not-pass'
      }
    });

    expect(parsed).not.toHaveProperty('raw');
    expect(parsed.providerHealth[0]).not.toHaveProperty('vendor');
    expect(parsed.ingestionSources[0]).not.toHaveProperty('credential');
    expect(parsed.retrievalDiagnostics[0]).not.toHaveProperty('raw');
    expect(parsed.agentUsage[0]).not.toHaveProperty('secret');
  });
});
