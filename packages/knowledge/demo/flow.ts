import {
  DefaultKnowledgeSearchService,
  InMemoryKnowledgeChunkRepository,
  InMemoryKnowledgeSourceRepository
} from '../src/index.js';

async function main() {
  const sourceRepository = new InMemoryKnowledgeSourceRepository();
  const chunkRepository = new InMemoryKnowledgeChunkRepository();

  await sourceRepository.upsert({
    id: 'source-runtime',
    sourceType: 'repo-docs',
    uri: '/docs/runtime.md',
    title: 'Runtime Guide',
    trustClass: 'internal',
    updatedAt: '2026-04-19T00:00:00.000Z'
  });

  await chunkRepository.upsert({
    id: 'chunk-runtime-1',
    sourceId: 'source-runtime',
    documentId: 'runtime-doc',
    chunkIndex: 0,
    content: 'Runtime center combines approvals, recent runs, and observability summaries.',
    searchable: true,
    updatedAt: '2026-04-19T00:00:00.000Z'
  });

  const service = new DefaultKnowledgeSearchService(sourceRepository, chunkRepository);
  const result = await service.search({
    query: 'runtime approvals observability',
    allowedSourceTypes: ['repo-docs'],
    limit: 3
  });

  console.log(
    JSON.stringify(
      {
        total: result.total,
        firstHit: result.hits[0]
          ? {
              chunkId: result.hits[0].chunkId,
              title: result.hits[0].citation.title,
              score: result.hits[0].score
            }
          : null
      },
      null,
      2
    )
  );
}

void main();
