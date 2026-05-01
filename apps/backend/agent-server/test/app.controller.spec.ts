import { Test, TestingModule } from '@nestjs/testing';
import { describe, expect, it, beforeEach } from 'vitest';

import { AppController } from '../src/app/app.controller';
import { AppService } from '../src/app/app.service';
import { RuntimeHost } from '../src/runtime/core/runtime.host';
import { RuntimeTaskService } from '../src/runtime/services/runtime-task.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: RuntimeTaskService,
          useValue: {
            describeGraph: () => ['Goal Intake']
          }
        },
        {
          provide: RuntimeHost,
          useValue: {
            getKnowledgeSearchStatus: async () => ({
              configuredMode: 'hybrid',
              effectiveMode: 'keyword-only',
              vectorProviderId: 'missing-client',
              vectorConfigured: true,
              hybridEnabled: false,
              vectorProviderHealth: {
                status: 'unknown',
                checkedAt: '2026-05-01T00:00:00.000Z',
                message: 'Vector provider does not expose a health check.'
              },
              diagnostics: [
                {
                  code: 'knowledge.vector_provider.missing_client',
                  severity: 'warning',
                  message: 'vector client missing'
                }
              ],
              checkedAt: '2026-05-01T00:00:00.000Z'
            }),
            knowledgeSearchStatus: {
              configuredMode: 'hybrid',
              effectiveMode: 'keyword-only',
              vectorProviderId: 'missing-client',
              vectorConfigured: true,
              hybridEnabled: false,
              diagnostics: [
                {
                  code: 'knowledge.vector_provider.missing_client',
                  severity: 'warning',
                  message: 'vector client missing'
                }
              ],
              checkedAt: '2026-05-01T00:00:00.000Z'
            }
          }
        }
      ]
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should return health status payload', async () => {
      await expect(appController.health()).resolves.toMatchObject({
        status: 'ok',
        service: 'server',
        knowledgeSearchStatus: {
          configuredMode: 'hybrid',
          effectiveMode: 'keyword-only',
          vectorConfigured: true,
          hybridEnabled: false,
          vectorProviderHealth: {
            status: 'unknown'
          }
        }
      });
    });
  });
});
