import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { KnowledgeIngestionController } from '../../src/platform/knowledge-ingestion.controller';

describe('KnowledgeIngestionController', () => {
  it('validates request payloads and delegates normalized sources to RuntimeKnowledgeService', async () => {
    const runtimeKnowledgeService = {
      ingestKnowledgeSources: vi.fn(async () => ({
        runId: 'knowledge-indexing-1',
        loadedDocumentCount: 1,
        sourceCount: 1,
        indexedDocumentCount: 1,
        skippedDocumentCount: 0,
        chunkCount: 1,
        embeddedChunkCount: 1,
        fulltextChunkCount: 1,
        warningCount: 0,
        warnings: []
      }))
    };
    const controller = new KnowledgeIngestionController(runtimeKnowledgeService as never);
    const payload = {
      payloads: [
        {
          sourceId: 'upload-1',
          sourceType: 'user-upload',
          uri: '/uploads/policy.md',
          title: 'Uploaded Policy',
          trustClass: 'internal',
          content: 'uploaded policy for runtime approval',
          metadata: {
            docType: 'uploaded-policy'
          }
        }
      ]
    };

    await expect(controller.ingestSources(payload)).resolves.toMatchObject({
      runId: 'knowledge-indexing-1',
      sourceCount: 1,
      embeddedChunkCount: 1
    });
    expect(runtimeKnowledgeService.ingestKnowledgeSources).toHaveBeenCalledWith(payload.payloads);
  });

  it('rejects empty source ingestion requests before calling runtime service', async () => {
    const runtimeKnowledgeService = {
      ingestKnowledgeSources: vi.fn()
    };
    const controller = new KnowledgeIngestionController(runtimeKnowledgeService as never);

    await expect(controller.ingestSources({ payloads: [] })).rejects.toBeInstanceOf(BadRequestException);
    expect(runtimeKnowledgeService.ingestKnowledgeSources).not.toHaveBeenCalled();
  });

  it('validates user upload requests and delegates file ingestion to RuntimeKnowledgeService', async () => {
    const runtimeKnowledgeService = {
      ingestUserUploadSource: vi.fn(async () => ({
        runId: 'knowledge-indexing-upload',
        sourceCount: 1,
        chunkCount: 1,
        embeddedChunkCount: 1
      }))
    };
    const controller = new KnowledgeIngestionController(runtimeKnowledgeService as never);
    const payload = {
      uploadId: 'upload-file-1',
      filePath: 'uploads/policy.md',
      uploadedBy: 'admin@example.com',
      allowedRoles: ['admin'],
      mimeType: 'text/markdown',
      metadata: {
        status: 'active'
      }
    };

    await expect(controller.ingestUserUpload(payload)).resolves.toMatchObject({
      runId: 'knowledge-indexing-upload',
      sourceCount: 1
    });
    expect(runtimeKnowledgeService.ingestUserUploadSource).toHaveBeenCalledWith(payload);
  });

  it('validates catalog sync requests and delegates entries to RuntimeKnowledgeService', async () => {
    const runtimeKnowledgeService = {
      ingestCatalogSyncSources: vi.fn(async () => ({
        runId: 'knowledge-indexing-catalog',
        sourceCount: 1,
        chunkCount: 1,
        embeddedChunkCount: 1
      }))
    };
    const controller = new KnowledgeIngestionController(runtimeKnowledgeService as never);
    const payload = {
      entries: [
        {
          catalogId: 'service-runtime',
          title: 'Runtime Service',
          content: 'runtime service owner and SLA',
          owner: 'runtime-team'
        }
      ]
    };

    await expect(controller.ingestCatalogSync(payload)).resolves.toMatchObject({
      runId: 'knowledge-indexing-catalog',
      sourceCount: 1
    });
    expect(runtimeKnowledgeService.ingestCatalogSyncSources).toHaveBeenCalledWith(payload.entries);
  });

  it('rejects invalid catalog sync trustClass before calling runtime service', async () => {
    const runtimeKnowledgeService = {
      ingestCatalogSyncSources: vi.fn()
    };
    const controller = new KnowledgeIngestionController(runtimeKnowledgeService as never);

    await expect(
      controller.ingestCatalogSync({
        entries: [
          {
            catalogId: 'service-runtime',
            title: 'Runtime Service',
            content: 'runtime service owner and SLA',
            trustClass: 'community'
          }
        ]
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(runtimeKnowledgeService.ingestCatalogSyncSources).not.toHaveBeenCalled();
  });

  it('validates web curated requests and delegates entries to RuntimeKnowledgeService', async () => {
    const runtimeKnowledgeService = {
      ingestWebCuratedSources: vi.fn(async () => ({
        runId: 'knowledge-indexing-web',
        sourceCount: 1,
        chunkCount: 1,
        embeddedChunkCount: 1
      }))
    };
    const controller = new KnowledgeIngestionController(runtimeKnowledgeService as never);
    const payload = {
      entries: [
        {
          sourceId: 'web-runtime-runbook',
          url: 'https://example.com/runtime-runbook',
          title: 'Runtime Runbook',
          content: 'curated runtime runbook content',
          curatedBy: 'research-team'
        }
      ]
    };

    await expect(controller.ingestWebCurated(payload)).resolves.toMatchObject({
      runId: 'knowledge-indexing-web',
      sourceCount: 1
    });
    expect(runtimeKnowledgeService.ingestWebCuratedSources).toHaveBeenCalledWith(payload.entries);
  });

  it('rejects empty web curated requests before calling runtime service', async () => {
    const runtimeKnowledgeService = {
      ingestWebCuratedSources: vi.fn()
    };
    const controller = new KnowledgeIngestionController(runtimeKnowledgeService as never);

    await expect(controller.ingestWebCurated({ entries: [] })).rejects.toBeInstanceOf(BadRequestException);
    expect(runtimeKnowledgeService.ingestWebCuratedSources).not.toHaveBeenCalled();
  });

  it('validates connector sync requests and delegates entries to RuntimeKnowledgeService', async () => {
    const runtimeKnowledgeService = {
      ingestConnectorSyncSources: vi.fn(async () => ({
        runId: 'knowledge-indexing-connector',
        sourceCount: 1,
        chunkCount: 1,
        embeddedChunkCount: 1
      }))
    };
    const controller = new KnowledgeIngestionController(runtimeKnowledgeService as never);
    const payload = {
      entries: [
        {
          connectorId: 'github',
          documentId: 'repo-readme',
          title: 'Repository README',
          content: 'repository readme from connector sync',
          uri: 'connector://github/repo-readme',
          capabilityId: 'github.repo.read'
        }
      ]
    };

    await expect(controller.ingestConnectorSync(payload)).resolves.toMatchObject({
      runId: 'knowledge-indexing-connector',
      sourceCount: 1
    });
    expect(runtimeKnowledgeService.ingestConnectorSyncSources).toHaveBeenCalledWith(payload.entries);
  });

  it('rejects empty connector sync requests before calling runtime service', async () => {
    const runtimeKnowledgeService = {
      ingestConnectorSyncSources: vi.fn()
    };
    const controller = new KnowledgeIngestionController(runtimeKnowledgeService as never);

    await expect(controller.ingestConnectorSync({ entries: [] })).rejects.toBeInstanceOf(BadRequestException);
    expect(runtimeKnowledgeService.ingestConnectorSyncSources).not.toHaveBeenCalled();
  });
});
