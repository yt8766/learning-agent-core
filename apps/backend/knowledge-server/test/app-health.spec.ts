import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppController } from '../src/app.controller';
import { AppModule } from '../src/app.module';

describe('knowledge-server app health', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns service identity', async () => {
    vi.stubEnv('DATABASE_URL', '');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const controller = moduleRef.get(AppController);

    expect(controller.health()).toEqual({ service: 'knowledge-server', status: 'ok' });
  });
});
