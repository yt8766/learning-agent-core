import { describe, expect, it } from 'vitest';

import { runProductionIngestionRuntimeCenterDemo } from '../demo/production-ingestion-runtime-center';

describe('production ingestion runtime center demo', () => {
  it('projects all audited source inputs through retrieval into an agent-admin runtime payload', async () => {
    const demo = await runProductionIngestionRuntimeCenterDemo();

    expect(demo.path).toEqual(['RuntimeHost', 'AgentRuntime', 'RuntimeCenter', 'agent-admin']);
    expect(demo.retrievalRequest).toMatchObject({
      query: 'production ingestion policy connector catalog upload curated skill',
      limit: 8,
      allowedSourceTypes: ['user-upload', 'connector-manifest', 'catalog-sync', 'web-curated', 'workspace-docs']
    });

    expect(demo.sourceAudit.map(item => item.source)).toEqual([
      'user upload',
      'connector sync',
      'catalog sync',
      'web curated',
      'agent skills'
    ]);
    expect(demo.sourceAudit.every(item => item.emitsUnifiedRetrieval)).toBe(true);
    expect(demo.sourceAudit.find(item => item.source === 'agent skills')).toMatchObject({
      sourceType: 'workspace-docs',
      docType: 'agent-skill',
      firstClassSourceType: false
    });

    expect(demo.retrievalHits.map(hit => hit.sourceType)).toEqual(
      expect.arrayContaining(['user-upload', 'connector-manifest', 'catalog-sync', 'web-curated', 'workspace-docs'])
    );
    expect(demo.retrievalHits.every(hit => hit.citation.sourceType === hit.sourceType)).toBe(true);

    expect(demo.agentAdminPayload.runtime.knowledgeOverview).toMatchObject({
      sourceCount: 5,
      chunkCount: 5,
      searchableDocumentCount: 5,
      blockedDocumentCount: 0
    });
    expect(demo.agentAdminPayload.runtime.knowledgeSearchStatus).toMatchObject({
      configuredMode: 'hybrid',
      effectiveMode: 'hybrid',
      vectorProviderId: 'fake-chroma',
      vectorConfigured: true,
      hybridEnabled: true
    });
    expect(demo.agentAdminPayload.runtime.knowledgeSearchLastDiagnostics).toMatchObject({
      query: demo.retrievalRequest.query,
      limit: 8,
      hitCount: 5,
      total: 5,
      diagnostics: {
        retrievalMode: 'hybrid',
        enabledRetrievers: ['keyword', 'vector'],
        failedRetrievers: [],
        fusionStrategy: 'rrf'
      }
    });
  });
});
