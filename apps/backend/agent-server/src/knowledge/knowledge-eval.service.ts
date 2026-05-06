import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import {
  KNOWLEDGE_EVAL_DEFAULT_CREATED_BY,
  KNOWLEDGE_EVAL_DEFAULT_TENANT_ID,
  type CreateKnowledgeEvalDatasetInput,
  type KnowledgeEvalComparison,
  type KnowledgeEvalJudge,
  type KnowledgeEvalJudgeInput,
  type KnowledgeEvalRunner,
  type KnowledgeEvalRunnerAnswerInput,
  type KnowledgeEvalRunnerAnswer,
  type RunKnowledgeEvalDatasetInput
} from './interfaces/knowledge-eval.types';
import type {
  KnowledgeEvalDatasetCaseRecord,
  KnowledgeEvalDatasetRecord,
  KnowledgeEvalGenerationMetrics,
  KnowledgeEvalResultRecord,
  KnowledgeEvalRunRecord
} from './interfaces/knowledge-records.types';
import { KNOWLEDGE_RAG_DEFAULT_TOP_K } from './interfaces/knowledge-rag.types';
import {
  calculateRetrievalMetrics,
  compareMetricAverages,
  flattenSummary,
  intersectionSize,
  overlapRatio,
  roundMetric,
  score,
  summarizeResults,
  tokenize
} from './knowledge-eval.metrics';
import { KnowledgeRagService } from './knowledge-rag.service';
import type { KnowledgeRepository, KnowledgeRepositoryListResult } from './repositories/knowledge.repository';

export interface KnowledgeEvalServiceDeps {
  repo: KnowledgeRepository;
  runner?: KnowledgeEvalRunner;
  judge?: KnowledgeEvalJudge;
  clock?: () => string;
}

@Injectable()
export class KnowledgeEvalService {
  private nextId = 1;
  private readonly repo: KnowledgeRepository;
  private readonly runner: KnowledgeEvalRunner;
  private readonly judge: KnowledgeEvalJudge;
  private readonly clock: () => string;

  constructor(deps: KnowledgeEvalServiceDeps) {
    this.repo = deps.repo;
    this.runner = deps.runner ?? new RagKnowledgeEvalRunner(this.repo);
    this.judge = deps.judge ?? new DeterministicKnowledgeEvalJudge();
    this.clock = deps.clock ?? (() => new Date().toISOString());
  }

  async createDataset(input: CreateKnowledgeEvalDatasetInput): Promise<KnowledgeEvalDatasetRecord> {
    const name = input.name?.trim();
    if (!name) {
      throw new BadRequestException('knowledge eval dataset name is required');
    }
    if (!Array.isArray(input.cases) || input.cases.length === 0) {
      throw new BadRequestException('knowledge eval dataset cases are required');
    }

    return this.repo.createEvalDataset({
      id: this.createId('dataset'),
      tenantId: input.tenantId ?? KNOWLEDGE_EVAL_DEFAULT_TENANT_ID,
      name,
      tags: input.tags ?? [],
      cases: input.cases.map((testCase, index) => ({
        id: testCase.id ?? this.createId(`case_${index + 1}`),
        question: testCase.question,
        expectedChunkIds: testCase.expectedChunkIds ?? [],
        referenceAnswer: testCase.referenceAnswer ?? '',
        metadata: testCase.metadata
      })),
      createdBy: input.createdBy ?? KNOWLEDGE_EVAL_DEFAULT_CREATED_BY,
      createdAt: this.clock(),
      updatedAt: this.clock()
    });
  }

  async listDatasets(query: { tenantId: string }): Promise<KnowledgeRepositoryListResult<KnowledgeEvalDatasetRecord>> {
    return page((await this.repo.listEvalDatasets(query)).items);
  }

  async runDataset(input: RunKnowledgeEvalDatasetInput): Promise<KnowledgeEvalRunRecord> {
    const tenantId = input.tenantId ?? KNOWLEDGE_EVAL_DEFAULT_TENANT_ID;
    const createdBy = input.createdBy ?? KNOWLEDGE_EVAL_DEFAULT_CREATED_BY;
    const dataset = await this.repo.getEvalDataset({ tenantId, id: input.datasetId });
    if (!dataset) {
      throw new NotFoundException('knowledge eval dataset not found');
    }

    const run: KnowledgeEvalRunRecord = await this.repo.createEvalRun({
      id: this.createId('run'),
      tenantId,
      datasetId: dataset.id,
      knowledgeBaseId: input.knowledgeBaseId,
      status: 'running',
      createdBy,
      createdAt: this.clock(),
      updatedAt: this.clock()
    });

    const results: KnowledgeEvalResultRecord[] = [];
    const errors: string[] = [];
    for (const testCase of dataset.cases) {
      try {
        results.push(await this.runCase({ tenantId, knowledgeBaseId: input.knowledgeBaseId, runId: run.id, testCase }));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'knowledge eval case failed';
        errors.push(message);
        results.push(await this.createFailedCaseResult({ tenantId, runId: run.id, testCase, errorMessage: message }));
      }
    }

    const summary = summarizeResults(results);
    return this.repo.updateEvalRun({
      ...run,
      status: errors.length > 0 ? 'failed' : 'succeeded',
      summary,
      metrics: flattenSummary(summary),
      errorMessage: errors[0],
      updatedAt: this.clock()
    });
  }

  async listRuns(query: { tenantId: string; datasetId?: string }) {
    return page((await this.repo.listEvalRuns(query)).items);
  }

  async getRun(query: { tenantId: string; id: string }): Promise<KnowledgeEvalRunRecord> {
    const run = await this.repo.getEvalRun(query);
    if (!run) {
      throw new NotFoundException('knowledge eval run not found');
    }
    return run;
  }

  async listRunResults(query: { tenantId: string; runId: string }) {
    await this.getRun({ tenantId: query.tenantId, id: query.runId });
    return page((await this.repo.listEvalResults(query)).items);
  }

  async compareRuns(input: {
    tenantId: string;
    baselineRunId: string;
    candidateRunId: string;
  }): Promise<KnowledgeEvalComparison> {
    const [baseline, candidate] = await Promise.all([
      this.getRun({ tenantId: input.tenantId, id: input.baselineRunId }),
      this.getRun({ tenantId: input.tenantId, id: input.candidateRunId })
    ]);
    const [baselineResults, candidateResults] = await Promise.all([
      this.listRunResults({ tenantId: input.tenantId, runId: baseline.id }),
      this.listRunResults({ tenantId: input.tenantId, runId: candidate.id })
    ]);

    return {
      baselineRunId: baseline.id,
      candidateRunId: candidate.id,
      totalScoreDelta: roundMetric(score(candidate.summary?.totalScore) - score(baseline.summary?.totalScore)),
      retrievalScoreDelta: roundMetric(
        score(candidate.summary?.retrievalScore) - score(baseline.summary?.retrievalScore)
      ),
      generationScoreDelta: roundMetric(
        score(candidate.summary?.generationScore) - score(baseline.summary?.generationScore)
      ),
      perMetricDelta: compareMetricAverages(baselineResults.items, candidateResults.items)
    };
  }

  private async runCase(input: {
    tenantId: string;
    knowledgeBaseId?: string;
    runId: string;
    testCase: KnowledgeEvalDatasetCaseRecord;
  }): Promise<KnowledgeEvalResultRecord> {
    const answer = await this.runner.answerCase({
      tenantId: input.tenantId,
      knowledgeBaseId: input.knowledgeBaseId,
      question: input.testCase.question
    });
    const retrievalMetrics = calculateRetrievalMetrics({
      expectedChunkIds: input.testCase.expectedChunkIds,
      retrievedChunkIds: answer.retrievedChunkIds
    });
    const generationMetrics = await this.judge.judge({
      case: input.testCase,
      actualAnswer: answer.actualAnswer,
      citations: answer.citations,
      retrievedChunkIds: answer.retrievedChunkIds
    });

    return this.repo.createEvalResult({
      id: this.createId('result'),
      tenantId: input.tenantId,
      runId: input.runId,
      caseId: input.testCase.id,
      status: 'succeeded',
      question: input.testCase.question,
      actualAnswer: answer.actualAnswer,
      retrievedChunkIds: answer.retrievedChunkIds,
      citations: answer.citations,
      retrievalMetrics,
      generationMetrics,
      traceId: answer.traceId,
      createdAt: this.clock(),
      updatedAt: this.clock()
    });
  }

  private async createFailedCaseResult(input: {
    tenantId: string;
    runId: string;
    testCase: KnowledgeEvalDatasetCaseRecord;
    errorMessage: string;
  }): Promise<KnowledgeEvalResultRecord> {
    return this.repo.createEvalResult({
      id: this.createId('result'),
      tenantId: input.tenantId,
      runId: input.runId,
      caseId: input.testCase.id,
      status: 'failed',
      question: input.testCase.question,
      actualAnswer: '',
      retrievedChunkIds: [],
      citations: [],
      retrievalMetrics: calculateRetrievalMetrics({
        expectedChunkIds: input.testCase.expectedChunkIds,
        retrievedChunkIds: []
      }),
      generationMetrics: {
        faithfulness: 0,
        answerRelevance: 0,
        citationAccuracy: 0
      },
      errorMessage: input.errorMessage,
      createdAt: this.clock(),
      updatedAt: this.clock()
    });
  }

  private createId(prefix: string): string {
    const value = this.nextId;
    this.nextId += 1;
    return `${prefix}_${value}`;
  }
}

class RagKnowledgeEvalRunner implements KnowledgeEvalRunner {
  private readonly rag: KnowledgeRagService;

  constructor(repo: KnowledgeRepository) {
    this.rag = new KnowledgeRagService({ repo });
  }

  async answerCase(input: KnowledgeEvalRunnerAnswerInput): Promise<KnowledgeEvalRunnerAnswer> {
    const result = await this.rag.answer({
      tenantId: input.tenantId,
      knowledgeBaseId: input.knowledgeBaseId,
      message: input.question,
      topK: KNOWLEDGE_RAG_DEFAULT_TOP_K
    });

    return {
      actualAnswer: result.answer,
      retrievedChunkIds: result.retrieval.matches.map(match => match.chunkId),
      citations: result.citations,
      traceId: result.traceId
    };
  }
}

class DeterministicKnowledgeEvalJudge implements KnowledgeEvalJudge {
  async judge(input: KnowledgeEvalJudgeInput): Promise<KnowledgeEvalGenerationMetrics> {
    const reference = tokenize(input.case.referenceAnswer);
    const answer = tokenize(input.actualAnswer);
    const expected = new Set(input.case.expectedChunkIds);
    const cited = new Set(input.retrievedChunkIds);

    return {
      faithfulness: reference.length === 0 ? 0 : overlapRatio(reference, answer),
      answerRelevance: reference.length === 0 ? 0 : overlapRatio(reference, answer),
      citationAccuracy:
        expected.size === 0 || cited.size === 0 ? 0 : roundMetric(intersectionSize(expected, cited) / cited.size)
    };
  }
}

function page<T>(items: readonly T[]): KnowledgeRepositoryListResult<T> {
  return { items: [...items], total: items.length, page: 1, pageSize: 20 };
}
