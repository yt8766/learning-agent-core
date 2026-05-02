import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { AppController } from '../src/app.controller';
import { AppModule } from '../src/app.module';

describe('auth-server app health', () => {
  it('returns service identity', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const controller = moduleRef.get(AppController);

    expect(controller.health()).toEqual({ service: 'auth-server', status: 'ok' });
  });
});
