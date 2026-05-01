import { afterEach, describe, expect, it, vi } from 'vitest';

import type { KnowledgeSearchService, VectorSearchProvider } from '@agent/knowledge';

import {
  createRuntimeKnowledgeProviderFactory,
  createRuntimeKnowledgeSearchStatusWithHealth
} from '../../../src/runtime/core/runtime-knowledge-search-factory';

describe('runtime knowledge search status', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('checks vector provider health when building runtime search status with health', async () => {
    const vectorProvider: VectorSearchProvider = {
      searchSimilar: vi.fn(async () => []),
      healthCheck: vi.fn(async () => ({
        status: 'healthy',
        message: 'vector provider reachable'
      }))
    };
    const factory = createRuntimeKnowledgeProviderFactory({
      config: {
        retrievalMode: 'hybrid',
        vector: {
          enabled: true,
          providerId: 'health-test'
        }
      },
      settings: { workspaceRoot: '/tmp/workspace', knowledgeRoot: '/tmp/workspace/data/knowledge' },
      knowledgeVectorSearchProvider: vectorProvider
    });

    const status = await createRuntimeKnowledgeSearchStatusWithHealth(factory, '2026-05-01T00:00:00.000Z');

    expect(vectorProvider.healthCheck).toHaveBeenCalledTimes(1);
    expect(status.vectorProviderHealth).toEqual(
      expect.objectContaining({
        status: 'healthy',
        message: 'vector provider reachable'
      })
    );
  });

  it('caches vector provider health within the configured ttl', async () => {
    const vectorProvider: VectorSearchProvider = {
      searchSimilar: vi.fn(async () => []),
      healthCheck: vi.fn(async () => ({
        status: 'healthy',
        message: 'cached health'
      }))
    };
    const factory = createRuntimeKnowledgeProviderFactory({
      config: {
        retrievalMode: 'hybrid',
        vector: {
          enabled: true,
          providerId: 'cached-health'
        },
        health: {
          ttlMs: 1000
        }
      },
      settings: { workspaceRoot: '/tmp/workspace', knowledgeRoot: '/tmp/workspace/data/knowledge' },
      knowledgeVectorSearchProvider: vectorProvider
    });

    await createRuntimeKnowledgeSearchStatusWithHealth(factory, '2026-05-01T00:00:00.000Z');
    const cachedStatus = await createRuntimeKnowledgeSearchStatusWithHealth(factory, '2026-05-01T00:00:00.500Z');

    expect(vectorProvider.healthCheck).toHaveBeenCalledTimes(1);
    expect(cachedStatus.vectorProviderHealth).toEqual(
      expect.objectContaining({
        status: 'healthy',
        message: 'cached health',
        consecutiveFailures: 0
      })
    );
  });

  it('times out vector provider health and increments consecutive failures', async () => {
    vi.useFakeTimers();
    const vectorProvider: VectorSearchProvider = {
      searchSimilar: vi.fn(async () => []),
      healthCheck: vi.fn(() => new Promise(() => undefined))
    };
    const factory = createRuntimeKnowledgeProviderFactory({
      config: {
        retrievalMode: 'hybrid',
        vector: {
          enabled: true,
          providerId: 'timeout-health'
        },
        health: {
          ttlMs: 0,
          timeoutMs: 50
        }
      },
      settings: { workspaceRoot: '/tmp/workspace', knowledgeRoot: '/tmp/workspace/data/knowledge' },
      knowledgeVectorSearchProvider: vectorProvider
    });

    const firstStatusPromise = createRuntimeKnowledgeSearchStatusWithHealth(factory, '2026-05-01T00:00:01.000Z');
    await vi.advanceTimersByTimeAsync(50);
    const firstStatus = await firstStatusPromise;
    const secondStatusPromise = createRuntimeKnowledgeSearchStatusWithHealth(factory, '2026-05-01T00:00:02.000Z');
    await vi.advanceTimersByTimeAsync(50);
    const secondStatus = await secondStatusPromise;
    vi.useRealTimers();

    expect(vectorProvider.healthCheck).toHaveBeenCalledTimes(2);
    expect(firstStatus.vectorProviderHealth).toEqual(
      expect.objectContaining({
        status: 'degraded',
        message: 'Vector provider health check timed out after 50ms.',
        consecutiveFailures: 1
      })
    );
    expect(secondStatus.vectorProviderHealth).toEqual(
      expect.objectContaining({
        status: 'degraded',
        message: 'Vector provider health check timed out after 50ms.',
        consecutiveFailures: 2
      })
    );
  });

  it('waits for the configured consecutive failure threshold before marking health degraded', async () => {
    const vectorProvider: VectorSearchProvider = {
      searchSimilar: vi.fn(async () => []),
      healthCheck: vi.fn(async () => {
        throw new Error('temporary outage');
      })
    };
    const factory = createRuntimeKnowledgeProviderFactory({
      config: {
        retrievalMode: 'hybrid',
        vector: {
          enabled: true,
          providerId: 'threshold-health'
        },
        health: {
          ttlMs: 0,
          degradedAfterConsecutiveFailures: 2
        }
      },
      settings: { workspaceRoot: '/tmp/workspace', knowledgeRoot: '/tmp/workspace/data/knowledge' },
      knowledgeVectorSearchProvider: vectorProvider
    });

    const firstStatus = await createRuntimeKnowledgeSearchStatusWithHealth(factory, '2026-05-01T00:00:01.000Z');
    const secondStatus = await createRuntimeKnowledgeSearchStatusWithHealth(factory, '2026-05-01T00:00:02.000Z');

    expect(firstStatus.vectorProviderHealth).toEqual(
      expect.objectContaining({
        status: 'unknown',
        message: 'temporary outage',
        consecutiveFailures: 1
      })
    );
    expect(firstStatus.diagnostics).not.toContainEqual(
      expect.objectContaining({
        code: 'knowledge.vector_provider.health_degraded'
      })
    );
    expect(secondStatus.vectorProviderHealth).toEqual(
      expect.objectContaining({
        status: 'degraded',
        message: 'temporary outage',
        consecutiveFailures: 2
      })
    );
  });

  it('checks keyword provider health with the shared provider health cache', async () => {
    const keywordService: KnowledgeSearchService & {
      healthCheck: () => Promise<{ status: 'healthy'; message: string }>;
    } = {
      search: vi.fn(async () => ({
        hits: [],
        total: 0
      })),
      healthCheck: vi.fn(async () => ({
        status: 'healthy',
        message: 'keyword provider reachable'
      }))
    };
    const factory = createRuntimeKnowledgeProviderFactory({
      config: {
        retrievalMode: 'keyword-only',
        keyword: {
          providerId: 'opensearch'
        },
        health: {
          ttlMs: 1000,
          timeoutMs: 100
        }
      },
      settings: { workspaceRoot: '/tmp/workspace', knowledgeRoot: '/tmp/workspace/data/knowledge' },
      keywordSearchService: keywordService
    });

    const firstStatus = await createRuntimeKnowledgeSearchStatusWithHealth(factory, '2026-05-01T00:00:00.000Z');
    const secondStatus = await createRuntimeKnowledgeSearchStatusWithHealth(factory, '2026-05-01T00:00:01.000Z');

    expect(keywordService.healthCheck).toHaveBeenCalledTimes(1);
    expect(firstStatus.keywordProviderHealth).toEqual(
      expect.objectContaining({
        status: 'healthy',
        message: 'keyword provider reachable',
        consecutiveFailures: 0
      })
    );
    expect(secondStatus.keywordProviderHealth).toEqual(firstStatus.keywordProviderHealth);
  });

  it('marks vector provider health as degraded when the health check fails', async () => {
    const vectorProvider: VectorSearchProvider = {
      searchSimilar: vi.fn(async () => []),
      healthCheck: vi.fn(async () => {
        throw new Error('connection refused');
      })
    };
    const factory = createRuntimeKnowledgeProviderFactory({
      config: {
        retrievalMode: 'hybrid',
        vector: {
          enabled: true,
          providerId: 'health-test'
        }
      },
      settings: { workspaceRoot: '/tmp/workspace', knowledgeRoot: '/tmp/workspace/data/knowledge' },
      knowledgeVectorSearchProvider: vectorProvider
    });

    const status = await createRuntimeKnowledgeSearchStatusWithHealth(factory, '2026-05-01T00:00:00.000Z');

    expect(status.vectorProviderHealth).toEqual(
      expect.objectContaining({
        status: 'degraded',
        message: 'connection refused'
      })
    );
    expect(status.diagnostics).toContainEqual({
      code: 'knowledge.vector_provider.health_degraded',
      severity: 'warning',
      message: 'connection refused'
    });
  });
});
