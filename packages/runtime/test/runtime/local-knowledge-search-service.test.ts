import { describe, expect, it, vi } from 'vitest';

import { LocalKnowledgeSearchService } from '../../src/runtime/local-knowledge-search-service';

function makeSettings(overrides: Record<string, any> = {}) {
  return {
    knowledgeRoot: '/default/root',
    ...overrides
  } as any;
}

function makeVectorIndexRepo(overrides: Record<string, any> = {}) {
  return {
    search: vi.fn().mockResolvedValue([]),
    ...overrides
  } as any;
}

describe('LocalKnowledgeSearchService', () => {
  describe('search', () => {
    it('returns empty array for blank query', async () => {
      const service = new LocalKnowledgeSearchService(makeSettings(), makeVectorIndexRepo());
      expect(await service.search('')).toEqual([]);
      expect(await service.search('   ')).toEqual([]);
    });

    it('returns hits with full metadata', async () => {
      const repo = makeVectorIndexRepo({
        search: vi.fn().mockResolvedValue([
          {
            id: 'hit-1',
            score: 0.95,
            metadata: {
              chunkId: 'chunk-1',
              documentId: 'doc-1',
              sourceId: 'src-1',
              uri: '/path/to/file',
              title: 'Test Document',
              sourceType: 'repo-docs',
              content: 'Hello world'
            }
          }
        ])
      });
      const service = new LocalKnowledgeSearchService(makeSettings(), repo);

      const result = await service.search('test query', 5);
      expect(result).toHaveLength(1);
      expect(result[0].chunkId).toBe('chunk-1');
      expect(result[0].documentId).toBe('doc-1');
      expect(result[0].sourceId).toBe('src-1');
      expect(result[0].uri).toBe('/path/to/file');
      expect(result[0].title).toBe('Test Document');
      expect(result[0].sourceType).toBe('repo-docs');
      expect(result[0].content).toBe('Hello world');
      expect(result[0].score).toBe(0.95);
    });

    it('uses fallback values when metadata fields are missing but content exists', async () => {
      const repo = makeVectorIndexRepo({
        search: vi.fn().mockResolvedValue([
          {
            id: 'hit-1',
            score: 0.8,
            metadata: { content: 'some content' }
          }
        ])
      });
      const settings = makeSettings({ knowledgeRoot: '/knowledge/root' });
      const service = new LocalKnowledgeSearchService(settings, repo);

      const result = await service.search('query');
      expect(result).toHaveLength(1);
      expect(result[0].chunkId).toBe('hit-1');
      expect(result[0].documentId).toBe('hit-1');
      expect(result[0].sourceId).toBe('hit-1');
      expect(result[0].uri).toBe('/knowledge/root');
      expect(result[0].title).toBe('/knowledge/root');
      expect(result[0].sourceType).toBe('repo-docs');
      expect(result[0].content).toBe('some content');
    });

    it('filters out hits without content', async () => {
      const repo = makeVectorIndexRepo({
        search: vi.fn().mockResolvedValue([
          { id: 'hit-1', score: 0.9, metadata: { content: 'valid content' } },
          { id: 'hit-2', score: 0.8, metadata: { content: '' } },
          { id: 'hit-3', score: 0.7, metadata: {} }
        ])
      });
      const service = new LocalKnowledgeSearchService(makeSettings(), repo);

      const result = await service.search('query');
      expect(result).toHaveLength(1);
      expect(result[0].chunkId).toBe('hit-1');
    });

    it('passes limit to vector index search', async () => {
      const repo = makeVectorIndexRepo();
      const service = new LocalKnowledgeSearchService(makeSettings(), repo);
      await service.search('query', 10);
      expect(repo.search).toHaveBeenCalledWith('query', 10, 'knowledge');
    });

    it('uses default limit of 5', async () => {
      const repo = makeVectorIndexRepo();
      const service = new LocalKnowledgeSearchService(makeSettings(), repo);
      await service.search('query');
      expect(repo.search).toHaveBeenCalledWith('query', 5, 'knowledge');
    });

    it('handles null metadata', async () => {
      const repo = makeVectorIndexRepo({
        search: vi.fn().mockResolvedValue([{ id: 'hit-1', score: 0.9, metadata: null }])
      });
      const settings = makeSettings({ knowledgeRoot: '/kb' });
      const service = new LocalKnowledgeSearchService(settings, repo);

      const result = await service.search('query');
      expect(result).toHaveLength(0); // empty content filtered out
    });
  });
});
