import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';
import { AppController } from '../src/app.controller';

describe('knowledge-server app health', () => {
  it('returns service identity', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AppController]
    }).compile();
    const controller = moduleRef.get(AppController);

    expect(controller.health()).toEqual({ service: 'knowledge-server', status: 'ok' });
  });
});
