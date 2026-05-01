import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import fs from 'fs-extra';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { KnowledgeIngestionController } from '../../src/platform/knowledge-ingestion.controller';
import { RuntimeCenterController } from '../../src/platform/runtime-center.controller';
import { RuntimeCentersService } from '../../src/runtime/centers/runtime-centers.service';
import { RuntimeKnowledgeService } from '../../src/runtime/services/runtime-knowledge.service';
import { describeConnectorProfilePolicy } from '@agent/runtime';

describe('Knowledge ingestion backend smoke', () => {
  let app: INestApplication;
  let workspaceRoot: string;
  let runtimeStateSnapshot: Record<string, unknown>;

  beforeEach(async () => {
    workspaceRoot = await fs.mkdtemp(join(tmpdir(), 'agent-server-knowledge-ingestion-'));
    runtimeStateSnapshot = {};

    const settings = {
      profile: 'platform',
      workspaceRoot,
      knowledgeRoot: join(workspaceRoot, 'data', 'knowledge'),
      policy: {
        approvalMode: 'balanced',
        skillInstallMode: 'manual',
        learningMode: 'controlled',
        sourcePolicyMode: 'controlled-first',
        budget: {
          stepBudget: 8,
          retryBudget: 2,
          sourceBudget: 5
        }
      },
      runtimeBackground: {
        workerPoolSize: 2
      },
      dailyTechBriefing: {
        enabled: false,
        schedule: '0 9 * * *'
      }
    };
    const vectorIndexRepository = {
      upsertKnowledge: vi.fn(async () => undefined)
    };
    const runtimeStateRepository = {
      load: vi.fn(async () => runtimeStateSnapshot),
      save: vi.fn(async (snapshot: Record<string, unknown>) => {
        runtimeStateSnapshot = snapshot;
      })
    };
    const runtimeHost = {
      settings,
      runtime: {
        vectorIndexRepository,
        knowledgeSearchService: {
          getLastDiagnostics: () => undefined
        }
      },
      runtimeStateRepository,
      orchestrator: {
        listTasks: () => [],
        listPendingApprovals: () => []
      },
      wenyuanFacade: {
        listHistory: () => [],
        getCheckpoint: () => undefined
      },
      toolRegistry: {
        list: () => [],
        listFamilies: () => []
      },
      listSubgraphDescriptors: () => [],
      listWorkflowVersions: () => [],
      getKnowledgeSearchStatus: async () => ({
        configuredMode: 'keyword-only',
        effectiveMode: 'keyword-only',
        vectorConfigured: false,
        hybridEnabled: false,
        diagnostics: [],
        checkedAt: '2026-05-01T00:00:00.000Z'
      })
    };
    const centersContext = {
      settings,
      runtimeHost,
      wenyuanFacade: runtimeHost.wenyuanFacade,
      sessionCoordinator: {},
      orchestrator: runtimeHost.orchestrator,
      runtimeStateRepository,
      memoryRepository: {},
      ruleRepository: {},
      skillRegistry: {},
      toolRegistry: runtimeHost.toolRegistry,
      mcpClientManager: {},
      mcpServerRegistry: {},
      mcpCapabilityRegistry: {},
      describeConnectorProfilePolicy,
      fetchProviderUsageAudit: vi.fn(async () => ({
        status: 'configured',
        provider: 'fake',
        source: 'test',
        daily: []
      })),
      getBackgroundWorkerSlots: () => new Map(),
      getConnectorRegistryContext: () => centersContext,
      getSkillInstallContext: () => centersContext,
      getSkillSourcesContext: () => centersContext,
      getPlatformConsoleContext: () => centersContext
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [KnowledgeIngestionController, RuntimeCenterController],
      providers: [
        {
          provide: RuntimeKnowledgeService,
          useValue: new RuntimeKnowledgeService(() => ({
            wenyuanFacade: runtimeHost.wenyuanFacade,
            ruleRepository: {},
            orchestrator: runtimeHost.orchestrator,
            runtimeStateRepository,
            settings,
            vectorIndexRepository
          }))
        },
        {
          provide: RuntimeCentersService,
          useValue: new RuntimeCentersService(() => centersContext as never)
        }
      ]
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
    await fs.remove(workspaceRoot);
  });

  it('ingests a normalized source through POST and projects the persisted snapshot in Runtime Center', async () => {
    const server = app.getHttpServer();

    await request(server)
      .post('/api/platform/knowledge/sources/ingest')
      .send({
        payloads: [
          {
            sourceId: 'upload-smoke-1',
            sourceType: 'user-upload',
            uri: '/uploads/runtime-policy.md',
            title: 'Runtime Policy Upload',
            trustClass: 'internal',
            content: 'runtime policy upload content for backend smoke',
            metadata: {
              docType: 'uploaded-policy',
              status: 'active',
              allowedRoles: ['admin']
            }
          }
        ]
      })
      .expect(201)
      .expect(response => {
        expect(response.body).toMatchObject({
          sourceCount: 1,
          chunkCount: 1,
          embeddedChunkCount: 1
        });
      });

    await request(server)
      .get('/api/platform/runtime-center')
      .expect(200)
      .expect(response => {
        expect(response.body.knowledgeOverview).toMatchObject({
          sourceCount: 1,
          chunkCount: 1,
          latestReceipts: [
            expect.objectContaining({
              sourceId: 'upload-smoke-1',
              sourceType: 'user-upload',
              status: 'completed',
              chunkCount: 1
            })
          ]
        });
      });
  });

  it('reads a workspace upload file through the user-upload adapter and projects it in Runtime Center', async () => {
    const server = app.getHttpServer();
    await fs.ensureDir(join(workspaceRoot, 'uploads'));
    await fs.writeFile(join(workspaceRoot, 'uploads', 'adapter-policy.md'), 'adapter upload policy content', 'utf8');

    await request(server)
      .post('/api/platform/knowledge/sources/user-upload/ingest')
      .send({
        uploadId: 'upload-adapter-1',
        filePath: 'uploads/adapter-policy.md',
        uploadedBy: 'admin@example.com',
        allowedRoles: ['admin'],
        mimeType: 'text/markdown',
        metadata: {
          status: 'active'
        }
      })
      .expect(201)
      .expect(response => {
        expect(response.body).toMatchObject({
          sourceCount: 1,
          chunkCount: 1,
          embeddedChunkCount: 1
        });
      });

    await request(server)
      .get('/api/platform/runtime-center')
      .expect(200)
      .expect(response => {
        expect(response.body.knowledgeOverview.latestReceipts).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              sourceId: 'upload-adapter-1',
              sourceType: 'user-upload',
              status: 'completed',
              chunkCount: 1
            })
          ])
        );
      });
  });

  it('ingests catalog sync entries and projects their receipts in Runtime Center', async () => {
    const server = app.getHttpServer();

    await request(server)
      .post('/api/platform/knowledge/sources/catalog-sync/ingest')
      .send({
        entries: [
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
        ]
      })
      .expect(201)
      .expect(response => {
        expect(response.body).toMatchObject({
          sourceCount: 1,
          chunkCount: 1,
          embeddedChunkCount: 1
        });
      });

    await request(server)
      .get('/api/platform/runtime-center')
      .expect(200)
      .expect(response => {
        expect(response.body.knowledgeOverview.latestReceipts).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              sourceId: 'catalog-service-runtime',
              sourceType: 'catalog-sync',
              status: 'completed',
              chunkCount: 1
            })
          ])
        );
      });
  });

  it('ingests web curated entries and projects their receipts in Runtime Center', async () => {
    const server = app.getHttpServer();

    await request(server)
      .post('/api/platform/knowledge/sources/web-curated/ingest')
      .send({
        entries: [
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
        ]
      })
      .expect(201)
      .expect(response => {
        expect(response.body).toMatchObject({
          sourceCount: 1,
          chunkCount: 1,
          embeddedChunkCount: 1
        });
      });

    await request(server)
      .get('/api/platform/runtime-center')
      .expect(200)
      .expect(response => {
        expect(response.body.knowledgeOverview.latestReceipts).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              sourceId: 'web-runtime-runbook',
              sourceType: 'web-curated',
              status: 'completed',
              chunkCount: 1
            })
          ])
        );
      });
  });

  it('ingests connector sync entries and projects their receipts in Runtime Center', async () => {
    const server = app.getHttpServer();

    await request(server)
      .post('/api/platform/knowledge/sources/connector-sync/ingest')
      .send({
        entries: [
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
        ]
      })
      .expect(201)
      .expect(response => {
        expect(response.body).toMatchObject({
          sourceCount: 1,
          chunkCount: 1,
          embeddedChunkCount: 1
        });
      });

    await request(server)
      .get('/api/platform/runtime-center')
      .expect(200)
      .expect(response => {
        expect(response.body.knowledgeOverview.latestReceipts).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              sourceId: 'connector-github-repo-readme',
              sourceType: 'connector-manifest',
              status: 'completed',
              chunkCount: 1
            })
          ])
        );
      });
  });
});
