import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { KnowledgeEvalCase, KnowledgeEvalRunResult } from '@agent/knowledge';

export interface KnowledgeEvalAnswerer {
  answer(input: { question: string }): Promise<{
    id: string;
    citations: Array<{ chunkId: string; documentId: string }>;
    traceId?: string;
  }>;
}

export interface KnowledgeEvalRunProjection {
  id: string;
  datasetId: string;
  status: 'completed' | 'failed' | 'partial';
  results: KnowledgeEvalRunResult[];
  failedCases: Array<{ caseId: string; code: string; message: string }>;
}

@Injectable()
export class KnowledgeEvalService {
  constructor(private readonly answerer: KnowledgeEvalAnswerer) {}

  async runDataset(input: { datasetId: string; cases: KnowledgeEvalCase[] }): Promise<KnowledgeEvalRunProjection> {
    const runId = `eval_run_${randomUUID()}`;
    const results: KnowledgeEvalRunResult[] = [];
    const failedCases: KnowledgeEvalRunProjection['failedCases'] = [];

    for (const evalCase of input.cases) {
      try {
        const answer = await this.answerer.answer({ question: evalCase.question });
        const expectedChunkIds = new Set<string>(evalCase.expectedChunkIds ?? []);
        const citedChunkIds = new Set(answer.citations.map(citation => citation.chunkId));
        const matched = [...expectedChunkIds].filter(chunkId => citedChunkIds.has(chunkId)).length;
        const recallAtK = expectedChunkIds.size > 0 ? matched / expectedChunkIds.size : undefined;
        const citationAccuracy = answer.citations.length > 0 ? matched / answer.citations.length : 0;

        results.push({
          runId,
          caseId: evalCase.id,
          answerId: answer.id,
          metrics: {
            recallAtK,
            citationAccuracy,
            answerRelevance: recallAtK
          },
          traceId: answer.traceId
        });
      } catch (error) {
        failedCases.push({
          caseId: evalCase.id,
          code: 'knowledge_eval_run_failed',
          message: error instanceof Error ? error.message : 'Eval case failed.'
        });
      }
    }

    return {
      id: runId,
      datasetId: input.datasetId,
      status: failedCases.length === 0 ? 'completed' : results.length > 0 ? 'partial' : 'failed',
      results,
      failedCases
    };
  }

  compareRuns(input: { baselineRunId?: string; candidateRunId?: string }) {
    return {
      baselineRunId: input.baselineRunId ?? '',
      candidateRunId: input.candidateRunId ?? '',
      totalScoreDelta: 0,
      retrievalScoreDelta: 0,
      generationScoreDelta: 0,
      perMetricDelta: {}
    };
  }
}
