import { describe, expect, it } from 'vitest';

import { knowledgeQueryKeys, KNOWLEDGE_QUERY_STALE_TIME_MS } from '../src/api/knowledge-query';

describe('knowledgeQueryKeys', () => {
  it('has correct stale time', () => {
    expect(KNOWLEDGE_QUERY_STALE_TIME_MS).toBe(30_000);
  });

  it('root key', () => {
    expect(knowledgeQueryKeys.root()).toEqual(['knowledge']);
  });

  it('dashboard key', () => {
    expect(knowledgeQueryKeys.dashboard()).toEqual(['knowledge', 'dashboard']);
  });

  it('knowledgeBases key', () => {
    expect(knowledgeQueryKeys.knowledgeBases()).toEqual(['knowledge', 'knowledge-bases']);
  });

  it('documents key with no params', () => {
    expect(knowledgeQueryKeys.documents()).toEqual(['knowledge', 'documents', {}]);
  });

  it('documents key with knowledgeBaseId', () => {
    expect(knowledgeQueryKeys.documents({ knowledgeBaseId: 'kb-1' })).toEqual([
      'knowledge',
      'documents',
      { knowledgeBaseId: 'kb-1' }
    ]);
  });

  it('documents key with empty knowledgeBaseId', () => {
    expect(knowledgeQueryKeys.documents({ knowledgeBaseId: '' })).toEqual(['knowledge', 'documents', {}]);
  });

  it('trace key', () => {
    expect(knowledgeQueryKeys.trace('trace-1')).toEqual(['knowledge', 'observability', 'trace', 'trace-1']);
  });

  it('evalRunComparison key', () => {
    expect(
      knowledgeQueryKeys.evalRunComparison({
        baselineRunId: 'run-b',
        candidateRunId: 'run-c'
      })
    ).toEqual(['knowledge', 'evals', 'run-comparison', { baselineRunId: 'run-b', candidateRunId: 'run-c' }]);
  });
});
