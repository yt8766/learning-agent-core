/**
 * Demo: LangChain indexing default chain
 * 演示如何使用 LangChain adapter 完成 load → chunk → embed 流程
 */
import { LangChainLoaderAdapter, LangChainChunkerAdapter, LangChainEmbedderAdapter } from '../src/langchain/index';
import { createMarkdownDirectoryLoader } from '../src/langchain/loaders/markdown-directory-loader';
import { createRecursiveTextSplitterChunker } from '../src/langchain/chunkers/text-splitters';

async function main() {
  // 1. 使用 markdown directory loader（加载不存在目录时会返回空）
  const loaderInner = createMarkdownDirectoryLoader('./docs');
  const loader = new LangChainLoaderAdapter(loaderInner);
  const documents = await loader.load();
  console.log(`✓ Loaded ${documents.length} documents`);

  if (documents.length === 0) {
    console.log('  (no markdown files found in ./docs — run from project root or adjust path)');
    console.log('  Demo: simulating with mock document');

    const mockDoc = {
      id: 'demo-doc',
      content: '# Introduction\n\nThis is a demo document.\n\n## Section\n\nWith multiple sections.',
      metadata: { source: 'demo' }
    };

    // 2. Chunk
    const splitter = await createRecursiveTextSplitterChunker({ chunkSize: 50, chunkOverlap: 10 });
    const chunker = new LangChainChunkerAdapter(splitter);
    const chunks = await chunker.chunk(mockDoc);
    console.log(`✓ Created ${chunks.length} chunks:`);
    for (const c of chunks) {
      console.log(`  [${c.chunkIndex}] "${c.content.slice(0, 40)}..."`);
    }

    // 3. Embed (mock — no real embedder without API key)
    const mockEmbedder = {
      embedDocuments: async (texts: string[]) =>
        texts.map(() =>
          Array(3)
            .fill(0)
            .map(() => Math.random())
        )
    };
    const embedder = new LangChainEmbedderAdapter(mockEmbedder as any);
    const vectors = await embedder.embed(chunks);
    console.log(`✓ Generated ${vectors.length} vectors (dim=${vectors[0]?.values.length ?? 0})`);
    return;
  }

  // Real flow
  const splitter = await createRecursiveTextSplitterChunker({ chunkSize: 500, chunkOverlap: 100 });
  const chunker = new LangChainChunkerAdapter(splitter);
  let totalChunks = 0;
  for (const doc of documents.slice(0, 3)) {
    const chunks = await chunker.chunk(doc);
    totalChunks += chunks.length;
    console.log(`  ${doc.id}: ${chunks.length} chunks`);
  }
  console.log(`✓ Total chunks: ${totalChunks}`);
}

main().catch(err => {
  console.error('Demo error:', err);
  process.exit(1);
});
