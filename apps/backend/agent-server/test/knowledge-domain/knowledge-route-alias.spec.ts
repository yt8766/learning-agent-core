import { describe, expect, it } from 'vitest';

import { KnowledgeApiController } from '../../src/api/knowledge/knowledge.controller';
import { LegacyKnowledgeController } from '../../src/api/knowledge/legacy-knowledge.controller';

const service = {
  listBases: async () => [{ id: 'base_1', name: 'Default' }]
};

describe('knowledge route aliases', () => {
  it('serves knowledge bases through the canonical controller', async () => {
    const controller = new KnowledgeApiController(service as never);

    await expect(controller.listBases()).resolves.toEqual([{ id: 'base_1', name: 'Default' }]);
  });

  it('serves knowledge bases through the legacy controller', async () => {
    const controller = new LegacyKnowledgeController(service as never);

    await expect(controller.listBases()).resolves.toEqual([{ id: 'base_1', name: 'Default' }]);
  });
});
