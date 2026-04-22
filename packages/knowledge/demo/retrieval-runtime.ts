/**
 * Demo：knowledge retrieval runtime 最小闭环
 *
 * 演示三阶段流程：
 *   query normalization → retrieval → post-process + context assembly
 *
 * 运行：pnpm --dir packages/knowledge exec tsx demo/retrieval-runtime.ts
 */

import { LocalKnowledgeFacade } from '../src/runtime/local-knowledge-facade';
import { runKnowledgeRetrieval } from '../src/runtime/pipeline/run-knowledge-retrieval';

async function main(): Promise<void> {
  // 准备内存知识库
  const facade = new LocalKnowledgeFacade();

  await facade.sourceRepository.upsert({
    id: 'src-1',
    sourceType: 'repo-docs',
    uri: '/docs/retrieval-runtime.md',
    title: 'Retrieval Runtime Guide',
    trustClass: 'internal',
    updatedAt: new Date().toISOString()
  });

  await facade.chunkRepository.upsert({
    id: 'chunk-1',
    sourceId: 'src-1',
    documentId: 'doc-1',
    chunkIndex: 0,
    content: 'The knowledge retrieval runtime chains query normalization, recall and post-processing.',
    searchable: true,
    updatedAt: new Date().toISOString()
  });

  await facade.chunkRepository.upsert({
    id: 'chunk-2',
    sourceId: 'src-1',
    documentId: 'doc-1',
    chunkIndex: 1,
    content: 'Context assembly produces a prompt-ready citation bundle for the agent runtime.',
    searchable: true,
    updatedAt: new Date().toISOString()
  });

  // 直接使用 facade.retrieve（走默认 pipeline）
  console.log('=== facade.retrieve ===');
  const simpleResult = await facade.retrieve({ query: 'query normalization recall' });
  console.log(`Hits: ${simpleResult.total}`);
  simpleResult.hits.forEach(h => console.log(` - [${h.score.toFixed(3)}] ${h.title}: ${h.content.slice(0, 60)}...`));

  // 使用 runKnowledgeRetrieval 并开启 context assembly + diagnostics
  console.log('\n=== runKnowledgeRetrieval (with context + diagnostics) ===');
  const fullResult = await runKnowledgeRetrieval({
    request: { query: 'context assembly citation bundle' },
    searchService: facade.searchService,
    assembleContext: true,
    includeDiagnostics: true
  });

  console.log(`Hits after post-processing: ${fullResult.total}`);
  console.log(`\nContext bundle:\n${fullResult.contextBundle}`);
  console.log('\nDiagnostics:', fullResult.diagnostics);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
