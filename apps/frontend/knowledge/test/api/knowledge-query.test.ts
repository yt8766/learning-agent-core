import { describe, expect, it } from 'vitest';

import { KNOWLEDGE_QUERY_STALE_TIME_MS, knowledgeQueryKeys } from '@/api/knowledge-query';

describe('knowledgeQueryKeys', () => {
  it('builds stable root and dashboard keys', () => {
    expect(knowledgeQueryKeys.root()).toEqual(['knowledge']);
    expect(knowledgeQueryKeys.dashboard()).toEqual(['knowledge', 'dashboard']);
    expect(knowledgeQueryKeys.knowledgeBases()).toEqual(['knowledge', 'knowledge-bases']);
  });

  it('builds document list keys with normalized filters', () => {
    expect(knowledgeQueryKeys.documents({ knowledgeBaseId: 'kb-1' })).toEqual([
      'knowledge',
      'documents',
      { knowledgeBaseId: 'kb-1' }
    ]);
    expect(knowledgeQueryKeys.documents({})).toEqual(['knowledge', 'documents', {}]);
    expect(knowledgeQueryKeys.documents()).toEqual(['knowledge', 'documents', {}]);
  });

  it('builds observability trace keys', () => {
    expect(knowledgeQueryKeys.trace('trace-1')).toEqual(['knowledge', 'observability', 'trace', 'trace-1']);
  });

  it('builds stable eval run comparison keys', () => {
    expect(
      knowledgeQueryKeys.evalRunComparison({
        baselineRunId: 'run-a',
        candidateRunId: 'run-b'
      })
    ).toEqual([
      'knowledge',
      'evals',
      'run-comparison',
      {
        baselineRunId: 'run-a',
        candidateRunId: 'run-b'
      }
    ]);
  });

  it('uses the shared knowledge query stale time', () => {
    expect(KNOWLEDGE_QUERY_STALE_TIME_MS).toBe(30_000);
  });
});
