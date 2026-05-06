import { renderToStaticMarkup } from 'react-dom/server';
import type * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { KnowledgeGovernanceFlowCanvas } from '../../../src/pages/knowledge-governance/knowledge-governance-flow-canvas';
import type { KnowledgeGovernanceProjection } from '../../../src/pages/knowledge-governance/knowledge-governance-types';

vi.mock('@xyflow/react', () => ({
  Background: () => <div data-testid="react-flow-background" />,
  Controls: () => <div data-testid="react-flow-controls" />,
  ReactFlow: ({ children }: { children?: React.ReactNode }) => <div data-testid="react-flow">{children}</div>
}));

const projection: KnowledgeGovernanceProjection = {
  summary: {
    knowledgeBaseCount: 2,
    documentCount: 42,
    readyDocumentCount: 40,
    failedJobCount: 0,
    warningCount: 1
  },
  providerHealth: [
    {
      provider: 'vector',
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
      indexedDocumentCount: 24,
      failedDocumentCount: 0
    }
  ],
  retrievalDiagnostics: [
    {
      id: 'diag-live-agent',
      query: '公司直播专员政策证据',
      retrievalMode: 'hybrid',
      hitCount: 6,
      totalCount: 8,
      failedRetrieverCount: 0
    }
  ],
  agentUsage: [
    {
      agentId: 'company-live-specialist',
      agentLabel: '公司直播专员',
      knowledgeBaseIds: ['kb-live'],
      recentRunCount: 9,
      evidenceCount: 15
    }
  ],
  updatedAt: '2026-05-04T08:30:00.000Z'
};

describe('KnowledgeGovernanceFlowCanvas', () => {
  it('renders ingestion, indexing, diagnostics, evidence, and agent nodes for SSR', () => {
    const html = renderToStaticMarkup(<KnowledgeGovernanceFlowCanvas projection={projection} />);

    expect(html).toContain('用户上传');
    expect(html).toContain('索引');
    expect(html).toContain('检索诊断');
    expect(html).toContain('证据');
    expect(html).toContain('公司直播专员');
  });
});
