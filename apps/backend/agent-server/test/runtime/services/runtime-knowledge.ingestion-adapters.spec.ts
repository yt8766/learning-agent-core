import { describe, expect, it, vi } from 'vitest';

import { runRuntimeWebCuratedIngestionJob } from '../../../src/runtime/domain/knowledge/runtime-web-curated-ingestion-job';
import { RuntimeKnowledgeService } from '../../../src/runtime/services/runtime-knowledge.service';

describe('RuntimeKnowledgeService source ingestion adapters', () => {
  const createService = () => {
    const vectorIndexRepository = {
      upsertKnowledge: vi.fn(async () => undefined)
    };
    const service = new RuntimeKnowledgeService(() => ({
      wenyuanFacade: {} as never,
      ruleRepository: {} as never,
      orchestrator: {} as never,
      runtimeStateRepository: {} as never,
      settings: {
        workspaceRoot: '/tmp/workspace',
        knowledgeRoot: '/tmp/workspace/knowledge'
      },
      vectorIndexRepository
    }));
    return {
      service,
      vectorIndexRepository
    };
  };

  it('可将 curated web 产物构造成 web-curated payload 并写入 knowledge 边界', async () => {
    const { service, vectorIndexRepository } = createService();

    const result = await service.ingestWebCuratedSources([
      {
        sourceId: 'web-runtime-runbook',
        url: 'https://example.com/runtime-runbook',
        title: 'Runtime Runbook',
        content: 'curated runtime runbook content',
        curatedBy: 'research-team',
        metadata: {
          status: 'active',
          capturedAt: '2026-05-01T00:00:00.000Z'
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
        sourceId: 'web-runtime-runbook',
        sourceType: 'web-curated',
        uri: 'https://example.com/runtime-runbook',
        title: 'Runtime Runbook',
        content: 'curated runtime runbook content'
      })
    );
  });

  it('可将 connector 同步产物构造成 connector-manifest payload 并写入 knowledge 边界', async () => {
    const { service, vectorIndexRepository } = createService();

    const result = await service.ingestConnectorSyncSources([
      {
        connectorId: 'github',
        documentId: 'repo-readme',
        title: 'Repository README',
        content: 'repository readme from connector sync',
        uri: 'connector://github/repo-readme',
        capabilityId: 'github.repo.read',
        metadata: {
          status: 'active',
          repository: 'learning-agent-core'
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
        sourceId: 'connector-github-repo-readme',
        sourceType: 'connector-manifest',
        uri: 'connector://github/repo-readme',
        title: 'Repository README',
        content: 'repository readme from connector sync'
      })
    );
  });

  it('通过 web curated job 拉取并清洗 URL 产物后进入现有 ingestion adapter', async () => {
    const fetchUrl = vi.fn(async () => ({
      title: 'Fetched Runtime Runbook',
      content: '<main>Runtime runbook from curated URL</main>',
      capturedAt: '2026-05-01T00:00:00.000Z'
    }));
    const ingestWebCuratedSources = vi.fn(async () => ({
      sourceCount: 1,
      chunkCount: 1,
      embeddedChunkCount: 1
    }));

    const result = await runRuntimeWebCuratedIngestionJob(
      {
        sources: [
          {
            sourceId: 'web-runtime-runbook',
            url: 'https://example.com/runtime-runbook',
            curatedBy: 'research-team',
            metadata: {
              status: 'active'
            }
          }
        ]
      },
      {
        fetchUrl,
        ingestWebCuratedSources,
        trustPolicy: ({ url }) => (url.hostname === 'example.com' ? 'official' : 'curated')
      }
    );

    expect(result).toMatchObject({
      sourceCount: 1,
      chunkCount: 1,
      embeddedChunkCount: 1
    });
    expect(fetchUrl).toHaveBeenCalledWith(new URL('https://example.com/runtime-runbook'));
    expect(ingestWebCuratedSources).toHaveBeenCalledWith([
      expect.objectContaining({
        sourceId: 'web-runtime-runbook',
        trustClass: 'official',
        url: 'https://example.com/runtime-runbook',
        title: 'Fetched Runtime Runbook',
        content: 'Runtime runbook from curated URL',
        curatedBy: 'research-team',
        metadata: expect.objectContaining({
          status: 'active',
          capturedAt: '2026-05-01T00:00:00.000Z',
          sourceUrl: 'https://example.com/runtime-runbook'
        })
      })
    ]);
  });
});
