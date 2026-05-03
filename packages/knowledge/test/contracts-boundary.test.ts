import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  CitationSchema,
  HybridKnowledgeSearchProductionConfigSchema,
  DocumentSchema,
  KnowledgeChunkSchema,
  PostRetrievalDiagnosticsSchema,
  KnowledgeSourceRecordSchema,
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

  it('keeps retrieval and runtime source records aligned for supported source types', () => {
    const supportedSourceTypes = [
      'workspace-docs',
      'repo-docs',
      'connector-manifest',
      'catalog-sync',
      'user-upload',
      'web-curated'
    ] as const;

    for (const sourceType of supportedSourceTypes) {
      expect(
        KnowledgeSourceSchema.parse({
          id: `source-${sourceType}`,
          sourceType,
          uri: `/knowledge/${sourceType}`,
          title: sourceType,
          trustClass: 'internal',
          updatedAt: '2026-04-30T00:00:00.000Z'
        }).sourceType
      ).toBe(sourceType);

      expect(
        KnowledgeSourceRecordSchema.parse({
          id: `record-${sourceType}`,
          store: 'cangjing',
          sourceType,
          uri: `/knowledge/${sourceType}`,
          title: sourceType,
          trustClass: 'internal',
          createdAt: '2026-04-30T00:00:00.000Z',
          updatedAt: '2026-04-30T00:00:00.000Z'
        }).sourceType
      ).toBe(sourceType);
    }

    expect(() =>
      KnowledgeSourceSchema.parse({
        id: 'source-agent-skill',
        sourceType: 'agent-skill',
        uri: '/skills/example',
        title: 'Agent Skill',
        trustClass: 'internal',
        updatedAt: '2026-04-30T00:00:00.000Z'
      })
    ).toThrow();
    expect(() =>
      KnowledgeSourceRecordSchema.parse({
        id: 'record-agent-skill',
        store: 'cangjing',
        sourceType: 'agent-skill',
        uri: '/skills/example',
        title: 'Agent Skill',
        trustClass: 'internal',
        createdAt: '2026-04-30T00:00:00.000Z',
        updatedAt: '2026-04-30T00:00:00.000Z'
      })
    ).toThrow();
  });

  it('parses small-to-big chunk metadata fields and keeps metadata JSON-safe', () => {
    const chunk = KnowledgeChunkSchema.parse({
      id: 'chunk-1',
      sourceId: 'source-1',
      documentId: 'doc-1',
      chunkIndex: 0,
      content: 'Small-to-big context',
      searchable: true,
      metadata: {
        parentId: 'parent-1',
        prevChunkId: 'chunk-0',
        nextChunkId: 'chunk-2',
        sectionId: 'section-1',
        sectionTitle: 'Architecture',
        docType: 'guide',
        status: 'active',
        allowedRoles: ['engineer'],
        extra: { nested: ['json-safe', 1, true, null] }
      },
      updatedAt: '2026-04-30T00:00:00.000Z'
    });

    expect(chunk.metadata).toMatchObject({
      parentId: 'parent-1',
      prevChunkId: 'chunk-0',
      nextChunkId: 'chunk-2',
      sectionId: 'section-1',
      sectionTitle: 'Architecture'
    });
    expect(() =>
      KnowledgeChunkSchema.parse({
        ...chunk,
        metadata: {
          invalid: new Date('2026-04-30T00:00:00.000Z')
        }
      })
    ).toThrow(/JSON-safe metadata value/);
  });

  it('parses the minimal production contract for hybrid knowledge search configuration', () => {
    const config = HybridKnowledgeSearchProductionConfigSchema.parse({
      mode: 'hybrid',
      keyword: {
        opensearch: {
          index: {
            name: 'knowledge_chunks',
            idField: 'chunkId',
            textField: 'content',
            metadataField: 'metadata'
          },
          client: {
            clientRef: 'runtime-opensearch-client',
            endpoint: 'https://opensearch.internal',
            requestTimeoutMs: 1500
          }
        }
      },
      vector: {
        chroma: {
          collection: {
            name: 'knowledge_chunks',
            embeddingDimension: 1024,
            idField: 'chunkId',
            documentField: 'content',
            metadataField: 'metadata'
          },
          client: {
            clientRef: 'runtime-chroma-client',
            endpoint: 'http://chroma.internal:8000',
            tenant: 'default_tenant',
            database: 'default_database',
            requestTimeoutMs: 1500
          }
        }
      },
      diagnostics: {
        enabled: true,
        includeProviderTimings: true,
        includeProviderHealth: true,
        redactClientEndpoints: true
      },
      health: {
        enabled: true,
        checkOnStartup: false,
        timeoutMs: 1000,
        degradedAfterConsecutiveFailures: 2
      }
    });

    expect(config.mode).toBe('hybrid');
    expect(config.keyword?.opensearch.index.textField).toBe('content');
    expect(config.vector?.chroma.collection.embeddingDimension).toBe(1024);
    expect(config.diagnostics?.includeProviderHealth).toBe(true);
    expect(config.health?.degradedAfterConsecutiveFailures).toBe(2);

    expect(() =>
      HybridKnowledgeSearchProductionConfigSchema.parse({
        mode: 'keyword-only',
        vector: config.vector
      })
    ).toThrow(/keyword-only mode requires keyword OpenSearch configuration/);
    expect(() =>
      HybridKnowledgeSearchProductionConfigSchema.parse({
        mode: 'vector-only',
        keyword: config.keyword
      })
    ).toThrow(/vector-only mode requires vector Chroma configuration/);
  });

  it('parses post-retrieval diagnostics without requiring third-party error objects', () => {
    const diagnostics = PostRetrievalDiagnosticsSchema.parse({
      filtering: {
        enabled: true,
        beforeCount: 4,
        afterCount: 3,
        droppedCount: 1,
        maskedCount: 0,
        reasons: {
          'low-score': 1
        }
      },
      ranking: {
        enabled: true,
        strategy: 'deterministic-signals+semantic-rerank',
        scoredCount: 3,
        signals: ['retrieval-score', 'authority', 'semantic-rerank', 'alignment'],
        providerError: new Error('vendor-specific failure')
      },
      diversification: {
        enabled: true,
        strategy: 'source-parent-section-coverage',
        beforeCount: 3,
        afterCount: 2,
        maxPerSource: 2,
        maxPerParent: 1
      }
    });

    expect(diagnostics.ranking.strategy).toBe('deterministic-signals+semantic-rerank');
    expect(diagnostics.filtering.reasons).toEqual({ 'low-score': 1 });
    expect(diagnostics.ranking).not.toHaveProperty('providerError');
  });
});
