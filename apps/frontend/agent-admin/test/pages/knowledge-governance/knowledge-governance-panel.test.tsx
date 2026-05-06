import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { KnowledgeGovernancePanel } from '../../../src/pages/knowledge-governance/knowledge-governance-panel';
import type { KnowledgeGovernanceProjection } from '../../../src/pages/knowledge-governance/knowledge-governance-types';

const projection: KnowledgeGovernanceProjection = {
  summary: {
    knowledgeBaseCount: 3,
    documentCount: 42,
    readyDocumentCount: 39,
    failedJobCount: 1,
    warningCount: 2
  },
  providerHealth: [
    {
      provider: 'embedding',
      status: 'ok',
      warningCount: 0
    }
  ],
  ingestionSources: [
    {
      id: 'src-user-upload',
      label: '用户上传',
      sourceType: 'user-upload',
      status: 'active',
      indexedDocumentCount: 31,
      failedDocumentCount: 1
    }
  ],
  retrievalDiagnostics: [
    {
      id: 'diag-live-agent',
      query: '公司直播政策',
      retrievalMode: 'hybrid',
      hitCount: 8,
      totalCount: 10,
      failedRetrieverCount: 0
    }
  ],
  agentUsage: [
    {
      agentId: 'company-live-specialist',
      agentLabel: '公司直播专员',
      knowledgeBaseIds: ['kb-live', 'kb-policy'],
      recentRunCount: 12,
      evidenceCount: 18
    }
  ],
  updatedAt: '2026-05-04T08:30:00.000Z'
};

describe('KnowledgeGovernancePanel', () => {
  it('renders the governance summary, ingestion source, and agent usage for SSR', () => {
    const html = renderToStaticMarkup(<KnowledgeGovernancePanel projection={projection} loading={false} />);

    expect(html).toContain('知识治理');
    expect(html).toContain('知识库');
    expect(html).toContain('42');
    expect(html).toContain('用户上传');
    expect(html).toContain('公司直播专员');
  });
});
