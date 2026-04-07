import { describe, expect, it } from 'vitest';

import { LocalKnowledgeSearchService } from '../../src/runtime/local-knowledge-search-service';

describe('LocalKnowledgeSearchService', () => {
  it('maps knowledge vector hits back to the existing hit shape', async () => {
    const service = new LocalKnowledgeSearchService(
      {
        knowledgeRoot: '/tmp/knowledge-root'
      } as any,
      {
        search: async () => [
          {
            id: 'chunk-1',
            namespace: 'knowledge',
            score: 0.98,
            metadata: {
              chunkId: 'chunk-1',
              documentId: 'doc-1',
              sourceId: 'source-1',
              uri: 'docs/ARCHITECTURE.md',
              title: 'Architecture',
              sourceType: 'repo-docs',
              content: 'runtime architecture knowledge flow'
            }
          }
        ]
      } as any
    );

    await expect(service.search('runtime architecture', 5)).resolves.toEqual([
      expect.objectContaining({
        chunkId: 'chunk-1',
        documentId: 'doc-1',
        sourceId: 'source-1',
        uri: 'docs/ARCHITECTURE.md',
        title: 'Architecture',
        sourceType: 'repo-docs',
        content: 'runtime architecture knowledge flow',
        score: 0.98
      })
    ]);
  });
});
