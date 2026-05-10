import { describe, expect, it } from 'vitest';

import { KnowledgeAgentFlowService } from '../../src/domains/knowledge/services/knowledge-agent-flow.service';

const sampleFlow = {
  id: 'flow_1',
  name: 'Test Flow',
  description: 'A test flow',
  version: 1,
  status: 'draft' as const,
  nodes: [
    {
      id: 'node_1',
      type: 'input' as const,
      label: 'Input',
      position: { x: 0, y: 0 },
      config: {}
    }
  ],
  edges: [],
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z'
};

describe('KnowledgeAgentFlowService', () => {
  it('listFlows returns valid response shape with empty store', async () => {
    const service = new KnowledgeAgentFlowService();
    const result = await service.listFlows();

    expect(result).toEqual({
      items: [],
      total: 0,
      page: 1,
      pageSize: 0
    });
  });

  it('saveFlow persists and returns the flow', async () => {
    const service = new KnowledgeAgentFlowService();
    const result = await service.saveFlow({ flow: sampleFlow });

    expect(result.flow).toEqual(sampleFlow);

    const listed = await service.listFlows();
    expect(listed.items).toHaveLength(1);
    expect(listed.items[0]).toEqual(sampleFlow);
  });

  it('updateFlow updates an existing flow', async () => {
    const service = new KnowledgeAgentFlowService();
    await service.saveFlow({ flow: sampleFlow });

    const updated = await service.updateFlow('flow_1', {
      flow: { ...sampleFlow, name: 'Updated Flow', version: 2 }
    });

    expect(updated.flow.name).toBe('Updated Flow');
    expect(updated.flow.version).toBe(2);
    expect(updated.flow.id).toBe('flow_1');
  });

  it('updateFlow throws when flow does not exist', async () => {
    const service = new KnowledgeAgentFlowService();

    await expect(service.updateFlow('nonexistent', { flow: sampleFlow })).rejects.toThrow(
      'knowledge_agent_flow_not_found'
    );
  });

  it('runFlow returns deterministic response', async () => {
    const service = new KnowledgeAgentFlowService();
    await service.saveFlow({ flow: sampleFlow });

    const result = await service.runFlow('flow_1', {
      flowId: 'flow_1',
      input: {
        message: 'Run the flow',
        knowledgeBaseIds: ['kb_1'],
        variables: {}
      }
    });

    expect(result).toEqual({
      runId: 'run_flow_1',
      flowId: 'flow_1',
      status: 'completed',
      output: {
        answer: 'Flow flow_1 completed.',
        knowledgeBaseIds: ['kb_1']
      },
      createdAt: expect.any(String),
      updatedAt: expect.any(String)
    });
  });

  it('runFlow throws when flow does not exist', async () => {
    const service = new KnowledgeAgentFlowService();

    await expect(
      service.runFlow('nonexistent', {
        flowId: 'nonexistent',
        input: { message: 'Run', knowledgeBaseIds: [], variables: {} }
      })
    ).rejects.toThrow('knowledge_agent_flow_not_found');
  });

  it('listFlows returns all saved flows', async () => {
    const service = new KnowledgeAgentFlowService();
    await service.saveFlow({ flow: sampleFlow });
    await service.saveFlow({ flow: { ...sampleFlow, id: 'flow_2', name: 'Flow 2' } });

    const listed = await service.listFlows();
    expect(listed.items).toHaveLength(2);
    expect(listed.total).toBe(2);
  });
});
