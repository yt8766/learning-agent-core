import type { INestApplication } from '../../../apps/backend/agent-server/node_modules/@nestjs/common';
import { NestFactory } from '../../../apps/backend/agent-server/node_modules/@nestjs/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { HealthCheckResultSchema } from '@agent/core';

import { AppController } from '../../../apps/backend/agent-server/src/app/app.controller';
import { AppModule } from '../../../apps/backend/agent-server/src/app.module';

const BACKEND_HTTP_APP_HOOK_TIMEOUT_MS = 30_000;

describe('backend app smoke', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
    await app.init();
  }, BACKEND_HTTP_APP_HOOK_TIMEOUT_MS);

  afterAll(async () => {
    await app?.close();
  });

  it('boots the real Nest application module and serves the health contract through AppController', async () => {
    const response = await app.get(AppController).health();

    expect(response).toMatchObject({
      status: 'ok',
      service: 'server',
      now: expect.any(String),
      knowledgeSearchStatus: {
        configuredMode: expect.any(String),
        effectiveMode: expect.any(String),
        vectorConfigured: expect.any(Boolean),
        hybridEnabled: expect.any(Boolean)
      }
    });
    expect(() => HealthCheckResultSchema.parse(response)).not.toThrow();
  });
});
