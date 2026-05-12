import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { AgentGatewayModule } from '../../src/domains/agent-gateway/agent-gateway.module';
import { RuntimeEngineFacade } from '../../src/domains/agent-gateway/runtime-engine/runtime-engine.facade';

describe('RuntimeEngineModule', () => {
  it('is available through AgentGatewayModule', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AgentGatewayModule] }).compile();

    const facade = moduleRef.get(RuntimeEngineFacade);
    await expect(facade.health()).resolves.toMatchObject({
      status: 'ready',
      executors: expect.any(Array)
    });
  });
});
