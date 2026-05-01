import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import fs from 'fs-extra';
import type { MemoryScrubberValidator } from '@agent/memory';
import { listKnowledgeArtifacts } from '@agent/knowledge';

import { RuntimeKnowledgeService } from '../../../src/runtime/services/runtime-knowledge.service';

describe('RuntimeKnowledgeService', () => {
  const createService = (options?: { workspaceRoot?: string; knowledgeRoot?: string }) => {
    const memoryRepository = {
      search: vi.fn(async () => [{ id: 'memory-1' }]),
      list: vi.fn(async () => [{ id: 'memory-1' }]),
      getById: vi.fn(async (id: string) => (id === 'memory-1' ? { id } : undefined)),
      invalidate: vi.fn(async (id: string, reason: string) =>
        id === 'memory-1' ? { id, status: 'invalidated', invalidationReason: reason } : undefined
      ),
      supersede: vi.fn(async (id: string, replacementId: string, reason: string) =>
        id === 'memory-1'
          ? { id, status: 'superseded', supersededById: replacementId, invalidationReason: reason }
          : undefined
      ),
      restore: vi.fn(async (id: string) => (id === 'memory-1' ? { id, status: 'active' } : undefined)),
      retire: vi.fn(async (id: string, reason: string) =>
        id === 'memory-1' ? { id, status: 'retired', invalidationReason: reason } : undefined
      ),
      quarantine: vi.fn(
        async (
          id: string,
          reason: string,
          evidenceRefs?: string[],
          category?: string,
          detail?: string,
          restoreSuggestion?: string
        ) =>
          id === 'memory-1'
            ? {
                id,
                quarantined: true,
                quarantineReason: reason,
                quarantineCategory: category,
                quarantineReasonDetail: detail,
                quarantineRestoreSuggestion: restoreSuggestion,
                quarantineEvidenceRefs: evidenceRefs
              }
            : undefined
      )
    };
    const ruleRepository = {
      invalidate: vi.fn(async (id: string, reason: string) =>
        id === 'rule-1' ? { id, status: 'invalidated', invalidationReason: reason } : undefined
      ),
      supersede: vi.fn(async (id: string, replacementId: string, reason: string) =>
        id === 'rule-1'
          ? { id, status: 'superseded', supersededById: replacementId, invalidationReason: reason }
          : undefined
      ),
      restore: vi.fn(async (id: string) => (id === 'rule-1' ? { id, status: 'active' } : undefined)),
      retire: vi.fn(async (id: string, reason: string) =>
        id === 'rule-1' ? { id, status: 'retired', invalidationReason: reason } : undefined
      )
    };
    const orchestrator = {
      listRules: vi.fn(() => [{ id: 'rule-1' }])
    };
    const vectorIndexRepository = {
      upsertKnowledge: vi.fn(async () => undefined)
    };
    let runtimeStateSnapshot = {
      crossCheckEvidence: []
    };
    const runtimeStateRepository = {
      load: vi.fn(async () => runtimeStateSnapshot),
      save: vi.fn(async (snapshot: typeof runtimeStateSnapshot) => {
        runtimeStateSnapshot = snapshot;
      })
    };
    const wenyuanFacade = {
      searchMemory: vi.fn(async (query: string, limit = 10) => memoryRepository.search(query, limit)),
      listMemories: vi.fn(async () => memoryRepository.list()),
      getMemory: vi.fn(async (memoryId: string) => memoryRepository.getById(memoryId)),
      invalidateMemory: vi.fn(async (memoryId: string, reason: string) =>
        memoryRepository.invalidate(memoryId, reason)
      ),
      supersedeMemory: vi.fn(async (memoryId: string, replacementId: string, reason: string) =>
        memoryRepository.supersede(memoryId, replacementId, reason)
      ),
      restoreMemory: vi.fn(async (memoryId: string) => memoryRepository.restore(memoryId)),
      retireMemory: vi.fn(async (memoryId: string, reason: string) => memoryRepository.retire(memoryId, reason)),
      quarantineMemory: vi.fn(async (memoryId: string, reason: string, evidenceRefs?: string[]) =>
        memoryRepository.quarantine(memoryId, reason, evidenceRefs)
      ),
      getMemoryRepository: vi.fn(() => memoryRepository),
      listCrossCheckEvidence: vi.fn(async (memoryId?: string) => {
        const evidence = runtimeStateSnapshot.crossCheckEvidence ?? [];
        return memoryId ? evidence.filter(item => item.memoryId === memoryId) : evidence;
      })
    };

    return {
      service: new RuntimeKnowledgeService(() => ({
        wenyuanFacade: wenyuanFacade as any,
        ruleRepository,
        orchestrator,
        runtimeStateRepository,
        settings: {
          workspaceRoot: options?.workspaceRoot ?? '/tmp/workspace',
          knowledgeRoot: options?.knowledgeRoot ?? '/tmp/workspace/knowledge'
        },
        vectorIndexRepository
      })),
      memoryRepository,
      ruleRepository,
      orchestrator,
      vectorIndexRepository,
      runtimeStateRepository
    };
  };

  it('处理 memory 与 rule 的正常读写', async () => {
    const { service, orchestrator, memoryRepository, ruleRepository } = createService();

    expect(await service.searchMemory({ query: 'agent' })).toEqual([{ id: 'memory-1' }]);
    expect(await service.getMemory('memory-1')).toEqual({ id: 'memory-1' });
    expect(await service.invalidateMemory('memory-1', { reason: 'stale' })).toEqual({
      id: 'memory-1',
      status: 'invalidated',
      invalidationReason: 'stale'
    });
    expect(await service.supersedeMemory('memory-1', { replacementId: 'memory-2', reason: 'newer' })).toEqual({
      id: 'memory-1',
      status: 'superseded',
      supersededById: 'memory-2',
      invalidationReason: 'newer'
    });
    expect(await service.restoreMemory('memory-1')).toEqual({ id: 'memory-1', status: 'active' });
    expect(await service.retireMemory('memory-1', { reason: 'cleanup' })).toEqual({
      id: 'memory-1',
      status: 'retired',
      invalidationReason: 'cleanup'
    });
    expect(await service.listMemories()).toEqual([{ id: 'memory-1' }]);
    expect(await service.quarantineMemory('memory-1', 'bad-memory', ['e1'])).toEqual({
      id: 'memory-1',
      quarantined: true,
      quarantineReason: 'bad-memory',
      quarantineEvidenceRefs: ['e1']
    });
    expect(service.listRules()).toEqual([{ id: 'rule-1' }]);
    expect(await service.invalidateRule('rule-1', { reason: 'conflict' })).toEqual({
      id: 'rule-1',
      status: 'invalidated',
      invalidationReason: 'conflict'
    });
    expect(await service.supersedeRule('rule-1', { replacementId: 'rule-2', reason: 'updated' })).toEqual({
      id: 'rule-1',
      status: 'superseded',
      supersededById: 'rule-2',
      invalidationReason: 'updated'
    });
    expect(await service.restoreRule('rule-1')).toEqual({ id: 'rule-1', status: 'active' });
    expect(await service.retireRule('rule-1', { reason: 'cleanup' })).toEqual({
      id: 'rule-1',
      status: 'retired',
      invalidationReason: 'cleanup'
    });

    expect(memoryRepository.search).toHaveBeenCalledWith('agent', 10);
    expect(memoryRepository.list).toHaveBeenCalledTimes(1);
    expect(orchestrator.listRules).toHaveBeenCalledTimes(1);
    expect(ruleRepository.supersede).toHaveBeenCalledWith('rule-1', 'rule-2', 'updated');
  });

  it('可创建 memory scrubber 并复用 repository', async () => {
    const { service, memoryRepository } = createService();
    const validator: MemoryScrubberValidator = {
      validate: vi.fn(async () => null)
    };

    const scrubber = service.createMemoryScrubber(validator);
    await scrubber.scrubRecent(5);

    expect(memoryRepository.list).toHaveBeenCalled();
    expect(validator.validate).toHaveBeenCalled();
  });

  it('可记录并读取 cross-check EvidenceRecord', async () => {
    const { service, runtimeStateRepository } = createService();
    const records = [
      {
        id: 'official-rule:1',
        taskId: 'memory:memory-1',
        sourceId: 'official-rule:1',
        sourceType: 'official_rule',
        trustClass: 'official',
        summary: '官方规则冲突',
        detail: { reason: 'demo' },
        createdAt: '2026-03-28T00:00:00.000Z',
        fetchedAt: '2026-03-28T00:00:00.000Z'
      }
    ];

    await expect(service.recordCrossCheckEvidence('memory-1', records as any)).resolves.toEqual(records);
    await expect(service.listCrossCheckEvidence('memory-1')).resolves.toEqual([
      {
        memoryId: 'memory-1',
        record: records[0]
      }
    ]);
    expect(runtimeStateRepository.save).toHaveBeenCalledTimes(1);
  });

  it('可调度生产来源 ingestion 并写入统一 knowledge 边界', async () => {
    const { service, vectorIndexRepository } = createService();

    const result = await service.ingestKnowledgeSources([
      {
        sourceId: 'upload-1',
        sourceType: 'user-upload',
        uri: '/uploads/policy.md',
        title: 'Uploaded Policy',
        trustClass: 'internal',
        content: 'uploaded policy for runtime approval',
        metadata: {
          docType: 'uploaded-policy',
          status: 'active'
        }
      }
    ]);

    expect(result).toMatchObject({
      loadedDocumentCount: 1,
      sourceCount: 1,
      indexedDocumentCount: 1,
      chunkCount: 1
    });
    expect(vectorIndexRepository.upsertKnowledge).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceId: 'upload-1',
        sourceType: 'user-upload',
        title: 'Uploaded Policy'
      })
    );
  });

  it('可从 workspace 内真实上传文件构造 user-upload payload 并写入 knowledge 边界', async () => {
    const workspaceRoot = await fs.mkdtemp(join(tmpdir(), 'runtime-user-upload-'));
    try {
      await fs.ensureDir(join(workspaceRoot, 'uploads'));
      await fs.writeFile(join(workspaceRoot, 'uploads', 'policy.md'), 'uploaded file policy content', 'utf8');
      const { service, vectorIndexRepository } = createService({
        workspaceRoot,
        knowledgeRoot: join(workspaceRoot, 'data', 'knowledge')
      });

      const result = await service.ingestUserUploadSource({
        uploadId: 'upload-file-1',
        filePath: 'uploads/policy.md',
        uploadedBy: 'admin@example.com',
        allowedRoles: ['admin'],
        mimeType: 'text/markdown',
        metadata: {
          status: 'active'
        }
      });

      expect(result).toMatchObject({
        sourceCount: 1,
        chunkCount: 1,
        embeddedChunkCount: 1
      });
      expect(vectorIndexRepository.upsertKnowledge).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceId: 'upload-file-1',
          sourceType: 'user-upload',
          uri: 'upload://upload-file-1/policy.md',
          title: 'policy.md',
          content: 'uploaded file policy content'
        })
      );
      await expect(
        listKnowledgeArtifacts({
          workspaceRoot,
          knowledgeRoot: join(workspaceRoot, 'data', 'knowledge')
        } as never)
      ).resolves.toMatchObject({
        chunks: [
          expect.objectContaining({
            sourceId: 'upload-file-1',
            metadata: expect.objectContaining({
              docType: 'user-upload',
              status: 'active',
              originalFilename: 'policy.md',
              uploadedBy: 'admin@example.com',
              allowedRoles: ['admin'],
              mimeType: 'text/markdown'
            })
          })
        ]
      });
    } finally {
      await fs.remove(workspaceRoot);
    }
  });

  it('拒绝读取 workspace 外的 user upload 文件路径', async () => {
    const workspaceRoot = await fs.mkdtemp(join(tmpdir(), 'runtime-user-upload-workspace-'));
    const outsideRoot = await fs.mkdtemp(join(tmpdir(), 'runtime-user-upload-outside-'));
    try {
      const outsideFile = join(outsideRoot, 'secret.md');
      await fs.writeFile(outsideFile, 'outside workspace content', 'utf8');
      const { service, vectorIndexRepository } = createService({
        workspaceRoot,
        knowledgeRoot: join(workspaceRoot, 'data', 'knowledge')
      });

      await expect(
        service.ingestUserUploadSource({
          uploadId: 'upload-outside',
          filePath: outsideFile
        })
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'knowledge_user_upload_path_outside_workspace'
        })
      });
      expect(vectorIndexRepository.upsertKnowledge).not.toHaveBeenCalled();
    } finally {
      await fs.remove(workspaceRoot);
      await fs.remove(outsideRoot);
    }
  });

  it('可将已同步 catalog entries 构造成 catalog-sync payload 并写入 knowledge 边界', async () => {
    const { service, vectorIndexRepository } = createService();

    const result = await service.ingestCatalogSyncSources([
      {
        catalogId: 'service-runtime',
        title: 'Runtime Service',
        content: 'runtime service owner and SLA',
        uri: 'catalog://services/runtime',
        version: 'v2',
        owner: 'runtime-team',
        metadata: {
          status: 'active',
          tier: 'gold'
        }
      }
    ]);

    expect(result).toMatchObject({
      sourceCount: 1,
      chunkCount: 1,
      embeddedChunkCount: 1
    });
    expect(vectorIndexRepository.upsertKnowledge).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceId: 'catalog-service-runtime',
        sourceType: 'catalog-sync',
        uri: 'catalog://services/runtime',
        title: 'Runtime Service',
        content: 'runtime service owner and SLA'
      })
    );
  });

  it('对缺失 memory/rule 抛出 NotFoundException', async () => {
    const { service } = createService();

    await expect(service.getMemory('missing-memory')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.invalidateRule('missing-rule', { reason: 'x' })).rejects.toBeInstanceOf(NotFoundException);
  });
});
