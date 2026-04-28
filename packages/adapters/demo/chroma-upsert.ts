/**
 * Demo: Chroma upsert
 * 演示如何构造 vectors 并 upsert 到 Chroma（无 Chroma 服务时跳过）
 */
import { ChromaVectorStoreAdapter } from '../src/chroma/stores/chroma-vector-store.adapter';
import type { Vector } from '@agent/knowledge';

async function main() {
  const vectors: Vector[] = [
    { id: 'v1', values: [0.1, 0.2, 0.3], metadata: { content: 'hello', source: 'demo' } },
    { id: 'v2', values: [0.4, 0.5, 0.6], metadata: { content: 'world', source: 'demo' } }
  ];

  const adapter = new ChromaVectorStoreAdapter({
    collectionName: 'demo-collection',
    clientOptions: { path: 'http://localhost:8000' }
  });

  console.log('Attempting to upsert to Chroma at http://localhost:8000 ...');
  try {
    await adapter.upsert(vectors);
    console.log(`✓ Upserted ${vectors.length} vectors to "demo-collection"`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const cause = err instanceof Error ? (err as any).cause : undefined;
    const causeMsg = cause instanceof Error ? cause.message : String(cause ?? '');
    const isConnErr =
      msg.includes('ECONNREFUSED') ||
      msg.includes('fetch failed') ||
      msg.includes('Failed to connect') ||
      causeMsg.includes('ECONNREFUSED') ||
      causeMsg.includes('fetch failed') ||
      causeMsg.includes('undefined');
    if (isConnErr) {
      console.log('⚠ Chroma service not running — skipping upsert (this is expected in CI)');
      console.log('  Start Chroma with: docker run -p 8000:8000 chromadb/chroma');
    } else {
      throw err;
    }
  }
}

main().catch(err => {
  console.error('Demo error:', err);
  process.exit(1);
});
