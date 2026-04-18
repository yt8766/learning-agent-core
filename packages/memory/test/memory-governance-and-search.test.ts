import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { EmbeddingProvider } from '@agent/memory';
import {
  DefaultMemorySearchService,
  FileMemoryRepository,
  LocalVectorIndexRepository,
  shouldReindexMemory
} from '@agent/memory';
import type { MemoryRecord, RuleRecord } from '@agent/core';

describe('governed memory repository and structured search', () => {
  let tempDir = '';

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = '';
    }
  });

  it('records feedback, override, rollback, and event history for memories', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'memory-governance-'));
    const repository = new FileMemoryRepository(join(tempDir, 'records.jsonl'));

    await repository.append({
      id: 'memory-1',
      type: 'preference',
      memoryType: 'preference',
      scopeType: 'workspace',
      summary: 'Auto commit is allowed',
      content: 'Commit changes automatically after edits.',
      tags: ['repo:project-a', 'workspace:project-a'],
      relatedEntities: [{ entityType: 'repo', entityId: 'project-a' }],
      createdAt: '2026-04-16T00:00:00.000Z'
    });

    const feedback = await repository.recordFeedback?.('memory-1', 'adopted', '2026-04-16T01:00:00.000Z');
    const overridden = await repository.override?.(
      'memory-1',
      {
        summary: 'Auto commit is forbidden',
        content: 'Never commit without explicit human approval.',
        tags: ['repo:project-a', 'workspace:project-a'],
        relatedEntities: [{ entityType: 'repo', entityId: 'project-a' }],
        memoryType: 'constraint',
        scopeType: 'workspace'
      },
      'user corrected preference',
      'agent-chat-user'
    );
    const rolledBack = overridden?.replacement
      ? await repository.rollback?.(overridden.replacement.id, 1, 'agent-admin-user')
      : undefined;
    const history = overridden?.replacement ? await repository.getHistory?.(overridden.replacement.id) : undefined;
    const resolutionCandidates = await repository.listResolutionCandidates?.();

    expect(feedback?.usageMetrics?.adoptedCount).toBe(1);
    expect(feedback?.lastUsedAt).toBe('2026-04-16T01:00:00.000Z');
    expect(overridden?.previous?.status).toBe('disputed');
    expect(overridden?.replacement.overrideFor).toBe('memory-1');
    expect(history?.events.map(event => event.type)).toEqual(
      expect.arrayContaining(['memory.created', 'memory.override_applied', 'memory.rollback_applied'])
    );
    expect(rolledBack?.version).toBeGreaterThan(1);
    expect(resolutionCandidates?.[0]).toMatchObject({
      incumbentId: 'memory-1',
      suggestedAction: 'supersede_existing'
    });
  });

  it('supports structured search with scope and entity filtering and modern score reasons', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'memory-structured-search-'));
    const repository = new FileMemoryRepository(join(tempDir, 'records.jsonl'));

    await repository.append({
      id: 'memory-constraint',
      type: 'constraint',
      memoryType: 'constraint',
      scopeType: 'workspace',
      summary: 'Workspace requires manual deploy approval',
      content: 'Never auto deploy in project A.',
      tags: ['repo:project-a', 'workspace:project-a', 'deploy'],
      relatedEntities: [{ entityType: 'repo', entityId: 'project-a' }],
      sourceEvidenceIds: ['evidence-1'],
      importance: 10,
      confidence: 0.95,
      createdAt: '2026-04-16T00:00:00.000Z'
    });
    await repository.append({
      id: 'memory-other-repo',
      type: 'constraint',
      memoryType: 'constraint',
      scopeType: 'workspace',
      summary: 'Workspace B allows auto deploy',
      content: 'Auto deploy in project B.',
      tags: ['repo:project-b', 'workspace:project-b', 'deploy'],
      relatedEntities: [{ entityType: 'repo', entityId: 'project-b' }],
      importance: 6,
      confidence: 0.8,
      createdAt: '2026-04-16T00:00:00.000Z'
    });

    await repository.patchProfile?.(
      'user-1',
      {
        communicationStyle: 'concise',
        doNotDo: ['auto-commit']
      },
      'agent-chat-user'
    );

    const result = await repository.searchStructured?.({
      query: 'manual deploy approval',
      scopeContext: {
        actorRole: 'agent-chat-user',
        scopeType: 'workspace',
        allowedScopeTypes: ['session', 'user', 'workspace']
      },
      entityContext: [{ entityType: 'repo', entityId: 'project-a' }],
      memoryTypes: ['constraint'],
      includeRules: true,
      includeReflections: true,
      limit: 5
    });

    expect(result?.coreMemories).toHaveLength(1);
    expect(result?.coreMemories[0]?.id).toBe('memory-constraint');
    expect(result?.archivalMemories).toHaveLength(0);
    expect(result?.reasons[0]?.reason).toContain('entity matched');
  });

  it('infers memory type, scope type, and related entities for structured search when legacy records omit them', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'memory-structured-search-legacy-'));
    const repository = new FileMemoryRepository(join(tempDir, 'records.jsonl'));

    await writeFile(
      join(tempDir, 'records.jsonl'),
      JSON.stringify({
        id: 'legacy-memory-constraint',
        type: 'constraint',
        summary: 'Workspace still requires manual deploy approval',
        content: 'Never auto deploy in project A.',
        tags: ['repo:project-a', 'workspace:project-a', 'deploy'],
        createdAt: '2026-04-16T00:00:00.000Z'
      }),
      'utf8'
    );

    const result = await repository.searchStructured?.({
      query: 'manual deploy approval',
      scopeContext: {
        actorRole: 'agent-chat-user',
        scopeType: 'workspace',
        allowedScopeTypes: ['session', 'user', 'task', 'workspace']
      },
      entityContext: [{ entityType: 'repo', entityId: 'project-a' }],
      memoryTypes: ['constraint'],
      includeRules: true,
      includeReflections: true,
      limit: 5
    });

    expect(result?.coreMemories).toHaveLength(1);
    expect(result?.coreMemories[0]).toMatchObject({
      id: 'legacy-memory-constraint',
      memoryType: 'constraint',
      scopeType: 'workspace'
    });
    expect(result?.reasons[0]?.reason).toContain('entity matched');
  });

  it('skips re-embedding when only non-semantic fields change', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'memory-vector-incremental-'));
    const memory: MemoryRecord = {
      id: 'memory-1',
      type: 'constraint',
      memoryType: 'constraint',
      summary: 'Manual deploy only',
      content: 'Never auto deploy.',
      tags: ['deploy'],
      createdAt: '2026-04-16T00:00:00.000Z',
      status: 'active',
      version: 1
    };
    const memoryRepository = {
      append: async () => undefined,
      list: async () => [memory],
      search: async () => [memory],
      searchStructured: async () => ({
        coreMemories: [memory],
        archivalMemories: [],
        rules: [],
        reflections: [],
        reasons: []
      }),
      getById: async () => memory,
      quarantine: async () => undefined,
      invalidate: async () => undefined,
      supersede: async () => undefined,
      retire: async () => undefined,
      restore: async () => undefined
    };
    const ruleRepository = {
      append: async () => undefined,
      list: async () => [] as RuleRecord[],
      search: async () => [] as RuleRecord[],
      getById: async () => undefined,
      invalidate: async () => undefined,
      supersede: async () => undefined,
      retire: async () => undefined,
      restore: async () => undefined
    };
    const embeddingProvider: EmbeddingProvider = {
      embedQuery: vi.fn(async text => toEmbedding(text)),
      embedDocuments: vi.fn(async texts => texts.map(text => toEmbedding(text)))
    };
    const repo = new LocalVectorIndexRepository(memoryRepository as any, ruleRepository as any, embeddingProvider, {
      filePath: join(tempDir, 'vector-index.json'),
      loadKnowledgeDocuments: async () => []
    });

    await repo.upsertMemory(memory);
    await repo.upsertMemory({
      ...memory,
      version: 2,
      usageMetrics: {
        retrievedCount: 1,
        injectedCount: 1,
        adoptedCount: 1,
        dismissedCount: 0,
        correctedCount: 0
      }
    });

    const snapshot = JSON.parse(await readFile(join(tempDir, 'vector-index.json'), 'utf8')) as {
      records: Array<{ sourceHash: string }>;
    };

    expect(embeddingProvider.embedQuery).toHaveBeenCalledTimes(1);
    expect(snapshot.records[0]?.sourceHash).toBeDefined();
    expect(
      shouldReindexMemory(memory, {
        ...memory,
        version: 2,
        usageMetrics: {
          retrievedCount: 1,
          injectedCount: 1,
          adoptedCount: 1,
          dismissedCount: 0,
          correctedCount: 0
        }
      })
    ).toBe(false);
    expect(shouldReindexMemory(memory, { ...memory, content: 'Never auto deploy in production.' })).toBe(true);
  });
});

function toEmbedding(text: string) {
  const normalized = text.toLowerCase();
  return [
    normalized.includes('manual') ? 1 : 0,
    normalized.includes('deploy') ? 1 : 0,
    normalized.includes('approval') ? 1 : 0,
    normalized.includes('auto') ? 1 : 0
  ];
}
