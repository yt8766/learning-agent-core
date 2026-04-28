import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  CitationSchema,
  DocumentSchema,
  KnowledgeSourceSchema,
  RetrievalRequestSchema,
  inferTrustClass,
  isCitationEvidenceSource,
  mergeEvidence
} from '../src/contracts';

describe('@agent/knowledge contracts boundary', () => {
  it('hosts retrieval, indexing, and evidence contracts locally', () => {
    expect(RetrievalRequestSchema.parse({ query: 'agent contracts' }).query).toBe('agent contracts');
    expect(
      KnowledgeSourceSchema.parse({
        id: 'source-1',
        sourceType: 'repo-docs',
        uri: 'docs/architecture.md',
        title: 'Architecture',
        trustClass: 'internal',
        updatedAt: '2026-04-27T00:00:00.000Z'
      }).trustClass
    ).toBe('internal');
    expect(
      CitationSchema.parse({
        sourceId: 'source-1',
        chunkId: 'chunk-1',
        title: 'Architecture',
        uri: 'docs/architecture.md',
        sourceType: 'repo-docs',
        trustClass: 'internal'
      }).chunkId
    ).toBe('chunk-1');
    expect(DocumentSchema.parse({ id: 'doc-1', content: 'hello', metadata: {} }).id).toBe('doc-1');

    const evidence = {
      id: 'evidence-1',
      taskId: 'task-1',
      sourceType: 'web' as const,
      sourceUrl: 'https://openai.com/docs',
      summary: 'Official docs',
      trustClass: inferTrustClass('https://openai.com/docs'),
      createdAt: '2026-04-27T00:00:00.000Z'
    };

    expect(isCitationEvidenceSource(evidence)).toBe(true);
    expect(mergeEvidence([evidence], [evidence])).toHaveLength(1);
  });

  it('does not rely on the removed core knowledge host', () => {
    expect(existsSync(resolve(__dirname, '../../core/src/knowledge'))).toBe(false);
  });
});
