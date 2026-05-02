import { describe, expect, it } from 'vitest';

import { KnowledgeController } from '../../src/knowledge/knowledge.controller';
import { KnowledgeEvalService } from '../../src/knowledge/knowledge-eval.service';
import { KnowledgeService } from '../../src/knowledge/knowledge.service';
import { InMemoryKnowledgeRepository } from '../../src/knowledge/repositories/knowledge-memory.repository';
import { evalNow as now, resultRecord, runRecord } from './knowledge-eval.helpers';

describe('KnowledgeEvalService', () => {
  it('creates a dataset and runs cases with retrieval and deterministic judge metrics', async () => {
    const repo = new InMemoryKnowledgeRepository();
    const service = new KnowledgeEvalService({ repo, clock: () => now });

    await repo.createChunk({
      id: 'chunk-alpha',
      tenantId: 'tenant-1',
      knowledgeBaseId: 'kb-eval',
      documentId: 'doc-alpha',
      text: 'Alpha retrieval answer explains the canonical evaluation path.',
      createdAt: now,
      updatedAt: now
    });
    await repo.createChunk({
      id: 'chunk-beta',
      tenantId: 'tenant-1',
      knowledgeBaseId: 'kb-eval',
      documentId: 'doc-beta',
      text: 'Beta source adds a second supporting source.',
      createdAt: now,
      updatedAt: now
    });

    const dataset = await service.createDataset({
      tenantId: 'tenant-1',
      createdBy: 'user-1',
      name: 'Evaluation dataset',
      tags: ['eval'],
      cases: [
        {
          id: 'case-alpha',
          question: 'Alpha retrieval answer',
          expectedChunkIds: ['chunk-alpha', 'chunk-beta'],
          referenceAnswer: 'Alpha retrieval answer'
        }
      ]
    });
    const run = await service.runDataset({
      tenantId: 'tenant-1',
      createdBy: 'user-1',
      datasetId: dataset.id,
      knowledgeBaseId: 'kb-eval'
    });
    const results = await service.listRunResults({ tenantId: 'tenant-1', runId: run.id });

    expect(dataset).toMatchObject({
      tenantId: 'tenant-1',
      name: 'Evaluation dataset',
      tags: ['eval'],
      cases: [{ id: 'case-alpha', question: 'Alpha retrieval answer' }],
      createdBy: 'user-1',
      createdAt: now,
      updatedAt: now
    });
    expect(run).toMatchObject({
      tenantId: 'tenant-1',
      datasetId: dataset.id,
      knowledgeBaseId: 'kb-eval',
      status: 'succeeded',
      summary: {
        caseCount: 1,
        completedCaseCount: 1,
        failedCaseCount: 0
      }
    });
    expect(run.summary?.retrievalScore).toBe(0.875);
    expect(run.summary?.generationScore).toBe(1);
    expect(run.summary?.totalScore).toBe(0.9375);
    expect(results.items).toHaveLength(1);
    expect(results.items[0]).toMatchObject({
      runId: run.id,
      caseId: 'case-alpha',
      status: 'succeeded',
      question: 'Alpha retrieval answer',
      actualAnswer: expect.stringContaining('Alpha retrieval answer'),
      retrievedChunkIds: ['chunk-alpha'],
      retrievalMetrics: {
        recallAtK: 0.5,
        precisionAtK: 1,
        mrr: 1,
        ndcg: 1
      },
      generationMetrics: {
        faithfulness: 1,
        answerRelevance: 1,
        citationAccuracy: 1
      }
    });
    expect(results.items[0]?.traceId).toBeTypeOf('string');
    expect(Number.isNaN(run.summary.totalScore)).toBe(false);
  });

  it('keeps empty expected and retrieved metrics finite', async () => {
    const repo = new InMemoryKnowledgeRepository();
    const service = new KnowledgeEvalService({ repo, clock: () => now });

    const dataset = await service.createDataset({
      tenantId: 'tenant-1',
      createdBy: 'user-1',
      name: 'Empty retrieval dataset',
      cases: [{ id: 'case-empty', question: 'unmatched question', expectedChunkIds: [], referenceAnswer: '' }]
    });
    const run = await service.runDataset({
      tenantId: 'tenant-1',
      createdBy: 'user-1',
      datasetId: dataset.id,
      knowledgeBaseId: 'kb-empty'
    });
    const results = await service.listRunResults({ tenantId: 'tenant-1', runId: run.id });

    expect(results.items[0]).toMatchObject({
      retrievedChunkIds: [],
      retrievalMetrics: {
        recallAtK: 0,
        precisionAtK: 0,
        mrr: 0,
        ndcg: 0
      },
      generationMetrics: {
        faithfulness: 0,
        answerRelevance: 0,
        citationAccuracy: 0
      }
    });
    expect(Object.values(results.items[0]!.retrievalMetrics).every(value => Number.isFinite(value))).toBe(true);
    expect(Object.values(results.items[0]!.generationMetrics).every(value => Number.isFinite(value))).toBe(true);
    expect(Number.isNaN(run.summary.totalScore)).toBe(false);
  });

  it('lists datasets, runs, and results by tenant without leakage', async () => {
    const repo = new InMemoryKnowledgeRepository();
    const service = new KnowledgeEvalService({ repo, clock: () => now });

    const tenantDataset = await service.createDataset({
      tenantId: 'tenant-1',
      createdBy: 'user-1',
      name: 'Tenant 1 dataset',
      cases: [{ id: 'case-1', question: 'same question', expectedChunkIds: [], referenceAnswer: '' }]
    });
    const otherTenantDataset = await service.createDataset({
      tenantId: 'tenant-2',
      createdBy: 'user-2',
      name: 'Tenant 2 dataset',
      cases: [{ id: 'case-2', question: 'same question', expectedChunkIds: [], referenceAnswer: '' }]
    });

    const tenantRun = await service.runDataset({
      tenantId: 'tenant-1',
      createdBy: 'user-1',
      datasetId: tenantDataset.id
    });
    await service.runDataset({
      tenantId: 'tenant-2',
      createdBy: 'user-2',
      datasetId: otherTenantDataset.id
    });

    await expect(service.listDatasets({ tenantId: 'tenant-1' })).resolves.toMatchObject({
      items: [{ name: 'Tenant 1 dataset' }],
      total: 1
    });
    await expect(service.listRuns({ tenantId: 'tenant-1' })).resolves.toMatchObject({
      items: [{ id: tenantRun.id, tenantId: 'tenant-1' }],
      total: 1
    });
    await expect(service.listRunResults({ tenantId: 'tenant-1', runId: tenantRun.id })).resolves.toMatchObject({
      items: [{ runId: tenantRun.id, caseId: 'case-1' }],
      total: 1
    });
    await expect(service.listRunResults({ tenantId: 'tenant-2', runId: tenantRun.id })).rejects.toThrow(
      'knowledge eval run not found'
    );
  });

  it('uses replaceable runner and judge for every case and records failed case summaries', async () => {
    const repo = new InMemoryKnowledgeRepository();
    const answeredQuestions: string[] = [];
    const judgedCases: string[] = [];
    const service = new KnowledgeEvalService({
      repo,
      clock: () => now,
      runner: {
        async answerCase(input) {
          answeredQuestions.push(input.question);
          if (input.question === 'case fails') {
            throw new Error('runner failed for case');
          }
          return {
            actualAnswer: `answer for ${input.question}`,
            retrievedChunkIds: ['chunk-a'],
            citations: [{ chunkId: 'chunk-a' }],
            traceId: `trace-${input.question}`
          };
        }
      },
      judge: {
        async judge(input) {
          judgedCases.push(input.case.id);
          return { faithfulness: 0.8, answerRelevance: 0.7, citationAccuracy: 0.6 };
        }
      }
    });

    const dataset = await service.createDataset({
      tenantId: 'tenant-1',
      name: 'Custom runner dataset',
      cases: [
        { id: 'case-ok', question: 'case succeeds', expectedChunkIds: ['chunk-a'], referenceAnswer: 'answer' },
        { id: 'case-fail', question: 'case fails', expectedChunkIds: ['chunk-b'], referenceAnswer: 'answer' }
      ]
    });

    const run = await service.runDataset({ tenantId: 'tenant-1', datasetId: dataset.id });
    const results = await service.listRunResults({ tenantId: 'tenant-1', runId: run.id });

    expect(answeredQuestions).toEqual(['case succeeds', 'case fails']);
    expect(judgedCases).toEqual(['case-ok']);
    expect(run).toMatchObject({
      status: 'failed',
      errorMessage: 'runner failed for case',
      summary: {
        caseCount: 2,
        completedCaseCount: 1,
        failedCaseCount: 1,
        retrievalScore: 1,
        generationScore: 0.7,
        totalScore: 0.85
      }
    });
    expect(results.items).toMatchObject([
      {
        caseId: 'case-ok',
        status: 'succeeded',
        actualAnswer: 'answer for case succeeds',
        traceId: 'trace-case succeeds'
      },
      {
        caseId: 'case-fail',
        status: 'failed',
        actualAnswer: '',
        errorMessage: 'runner failed for case',
        retrievalMetrics: { recallAtK: 0, precisionAtK: 0, mrr: 0, ndcg: 0 },
        generationMetrics: { faithfulness: 0, answerRelevance: 0, citationAccuracy: 0 }
      }
    ]);
  });

  it('rejects result listing for missing runs', async () => {
    const service = new KnowledgeEvalService({ repo: new InMemoryKnowledgeRepository(), clock: () => now });

    await expect(service.listRunResults({ tenantId: 'tenant-1', runId: 'missing-run' })).rejects.toThrow(
      'knowledge eval run not found'
    );
  });

  it('compares runs and returns total, retrieval, generation, and per-metric deltas', async () => {
    const repo = new InMemoryKnowledgeRepository();
    const service = new KnowledgeEvalService({ repo, clock: () => now });
    const dataset = await service.createDataset({
      tenantId: 'tenant-1',
      createdBy: 'user-1',
      name: 'Compare dataset',
      cases: [{ id: 'case-compare', question: 'compare question', expectedChunkIds: [], referenceAnswer: '' }]
    });

    const baseline = await repo.createEvalRun(
      runRecord(dataset.id, 'baseline', { totalScore: 0.5, retrievalScore: 0.4, generationScore: 0.6 })
    );
    const candidate = await repo.createEvalRun(
      runRecord(dataset.id, 'candidate', { totalScore: 0.8, retrievalScore: 0.7, generationScore: 0.9 })
    );
    await repo.createEvalResult(
      resultRecord(baseline.id, 'baseline-result', { recallAtK: 0.25, precisionAtK: 0.5 }, { faithfulness: 0.5 })
    );
    await repo.createEvalResult(
      resultRecord(candidate.id, 'candidate-result', { recallAtK: 0.75, precisionAtK: 0.5 }, { faithfulness: 1 })
    );

    await expect(
      service.compareRuns({ tenantId: 'tenant-1', baselineRunId: baseline.id, candidateRunId: candidate.id })
    ).resolves.toMatchObject({
      baselineRunId: baseline.id,
      candidateRunId: candidate.id,
      totalScoreDelta: 0.3,
      retrievalScoreDelta: 0.3,
      generationScoreDelta: 0.3,
      perMetricDelta: {
        recallAtK: 0.5,
        precisionAtK: 0,
        faithfulness: 0.5
      }
    });
  });
});

describe('KnowledgeService eval routing', () => {
  it('keeps fixture fallback when no repository or eval service is available', () => {
    const service = new KnowledgeService();

    expect(service.listEvalDatasets().items[0]?.id).toBe('dataset_1');
    expect(service.listEvalRuns().items[0]?.id).toBe('run_1');
    expect(service.getEvalRun('run_1').id).toBe('run_1');
    expect(service.listEvalRunResults('run_1').items[0]?.id).toBe('result_1');
  });

  it('uses server tenant and creator defaults for public eval APIs', async () => {
    const repo = new InMemoryKnowledgeRepository();
    const service = new KnowledgeService(repo);

    const dataset = await service.createEvalDataset({
      tenantId: 'tenant-evil',
      createdBy: 'user-evil',
      name: 'Spoofed dataset',
      cases: [{ id: 'case-safe', question: 'safe question', expectedChunkIds: [], referenceAnswer: '' }]
    });
    const run = await service.createEvalRun({
      tenantId: 'tenant-evil',
      createdBy: 'user-evil',
      datasetId: dataset.id
    });

    expect(dataset).toMatchObject({ tenantId: 'ws_1', createdBy: 'user_demo' });
    expect(run).toMatchObject({ tenantId: 'ws_1', createdBy: 'user_demo' });
    await expect(repo.listEvalDatasets({ tenantId: 'tenant-evil' })).resolves.toMatchObject({ items: [] });
    await expect(repo.listEvalRuns({ tenantId: 'tenant-evil' })).resolves.toMatchObject({ items: [] });
  });

  it('keeps evals alias endpoints wired to the same service methods', async () => {
    const repo = new InMemoryKnowledgeRepository();
    const service = new KnowledgeService(repo);
    const controller = new KnowledgeController(service, {} as never);

    const dataset = await controller.createEvalDatasetAlias({
      name: 'Alias dataset',
      cases: [{ id: 'case-alias', question: 'alias question', expectedChunkIds: [], referenceAnswer: '' }]
    });
    const run = await controller.createEvalRunAlias({ datasetId: dataset.id });

    await expect(controller.listEvalDatasetsAlias()).resolves.toMatchObject({ items: [{ id: dataset.id }] });
    await expect(controller.listEvalRunsAlias()).resolves.toMatchObject({ items: [{ id: run.id }] });
    await expect(controller.getEvalRunAlias(run.id)).resolves.toMatchObject({ id: run.id });
    await expect(controller.listEvalRunResultsAlias(run.id)).resolves.toMatchObject({
      items: [{ runId: run.id, caseId: 'case-alias' }]
    });
  });
});
