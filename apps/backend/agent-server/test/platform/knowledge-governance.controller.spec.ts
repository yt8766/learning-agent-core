import { describe, expect, it } from 'vitest';

import { KnowledgeGovernanceProjectionSchema } from '@agent/core';

import { RuntimeKnowledgeGovernanceService } from '../../src/runtime/services/runtime-knowledge-governance.service';
import { KnowledgeGovernanceController } from '../../src/platform/knowledge-governance.controller';

describe('knowledge governance controller', () => {
  it('returns a safe agent-admin governance projection', async () => {
    const service = new RuntimeKnowledgeGovernanceService();
    const projection = KnowledgeGovernanceProjectionSchema.parse(await service.getProjection());
    const controller = new KnowledgeGovernanceController(service);
    const response = KnowledgeGovernanceProjectionSchema.parse(await controller.getProjection());
    const serialized = JSON.stringify(response);

    expect(projection.summary.knowledgeBaseCount).toBeGreaterThanOrEqual(0);
    expect(response.summary.documentCount).toBeGreaterThanOrEqual(0);
    expect(serialized).not.toContain('apiKey');
    expect(serialized).not.toContain('rawResponse');
  });
});
