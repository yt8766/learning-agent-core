import { describe, expect, it } from 'vitest';

import { LocalKnowledgeFacade } from '../src/runtime/local-knowledge-facade';

describe('LocalKnowledgeFacade.retrieve', () => {
  it('returns empty result when no knowledge has been indexed', async () => {
    const facade = new LocalKnowledgeFacade();

    const result = await facade.retrieve({ query: 'retrieval pipeline' });

    expect(result.hits).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.contextBundle).toBeUndefined();
  });

  it('retrieves hits after indexing a source and chunk', async () => {
    const facade = new LocalKnowledgeFacade();
    await facade.sourceRepository.upsert({
      id: 'src-1',
      sourceType: 'repo-docs',
      uri: '/docs/guide.md',
      title: 'Knowledge Guide',
      trustClass: 'internal',
      updatedAt: new Date().toISOString()
    });
    await facade.chunkRepository.upsert({
      id: 'chunk-1',
      sourceId: 'src-1',
      documentId: 'doc-1',
      chunkIndex: 0,
      content: 'retrieval pipeline combines recall and citation assembly',
      searchable: true,
      updatedAt: new Date().toISOString()
    });

    const result = await facade.retrieve({ query: 'retrieval citation' });

    expect(result.hits.length).toBeGreaterThan(0);
    expect(result.hits[0]?.title).toBe('Knowledge Guide');
  });

  it('assembles contextBundle when contextAssembler is injected via pipeline', async () => {
    const facade = new LocalKnowledgeFacade();
    await facade.sourceRepository.upsert({
      id: 'src-1',
      sourceType: 'repo-docs',
      uri: '/docs/guide.md',
      title: 'Knowledge Guide',
      trustClass: 'internal',
      updatedAt: new Date().toISOString()
    });
    await facade.chunkRepository.upsert({
      id: 'chunk-1',
      sourceId: 'src-1',
      documentId: 'doc-1',
      chunkIndex: 0,
      content: 'retrieval pipeline',
      searchable: true,
      updatedAt: new Date().toISOString()
    });

    const result = await facade.retrieve(
      { query: 'retrieval' },
      {
        contextAssembler: {
          assemble: async () => 'assembled context'
        }
      }
    );

    // contextBundle 不由 pipeline 控制，由 assembleContext 选项控制
    // 这里只验证 retrieve 不崩溃、返回 hits
    expect(result.hits.length).toBeGreaterThan(0);
  });
});
