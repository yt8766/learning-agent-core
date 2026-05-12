import { describe, expect, it, vi } from 'vitest';

import { ChatCapabilityIntentsService } from '../../src/chat/chat-capability-intents.service';

function createMockService(overrides: Record<string, any> = {}) {
  return new ChatCapabilityIntentsService(
    {
      appendInlineCapabilityResponse: vi.fn(async () => ({
        id: 'msg-1',
        role: 'assistant',
        content: 'response',
        conversationId: 'conv-1',
        createdAt: '2026-05-11T12:00:00.000Z'
      })),
      attachSessionCapabilities: vi.fn(async () => {})
    } as any,
    {
      listSkills: vi.fn(async () => overrides.skills ?? []),
      listBootstrapSkills: vi.fn(async () => overrides.bootstrapSkills ?? []),
      createUserSkillDraft: vi.fn(async () => ({
        id: 'skill-1',
        name: 'test',
        description: 'test',
        status: 'draft',
        ownership: { ownerType: 'user-attached', ownerId: 'user-1' },
        steps: [],
        toolContract: { required: [], optional: [], approvalSensitive: [] },
        connectorContract: { preferred: [], required: [] },
        createdAt: '2026-05-11T12:00:00.000Z',
        updatedAt: '2026-05-11T12:00:00.000Z'
      }))
    } as any,
    {
      installRemoteSkill: vi.fn(async () => ({
        skillId: 'skill-1',
        skillName: 'my-skill',
        repo: 'org/repo',
        status: 'installed'
      }))
    } as any,
    {
      getToolsCenter: vi.fn(() => ({
        families: [
          { id: 'file', displayName: 'File Tools' },
          { id: 'web', displayName: 'Web Tools' }
        ],
        tools: [
          {
            name: 'read_file',
            description: 'Read a file',
            family: 'file',
            ownerType: 'shared',
            bootstrap: false,
            requiresApproval: false
          },
          {
            name: 'write_file',
            description: 'Write a file',
            family: 'file',
            ownerType: 'shared',
            bootstrap: false,
            requiresApproval: true
          }
        ],
        totalTools: 2
      })),
      listConnectors: vi.fn(async () => overrides.connectors ?? [])
    } as any
  );
}

describe('ChatCapabilityIntentsService', () => {
  it('returns undefined for non-intent messages', async () => {
    const service = createMockService();
    const result = await service.tryHandle('sess-1', { conversationId: 'conv-1', message: 'hello world' } as any);
    expect(result).toBeUndefined();
  });

  it('handles list-skills intent', async () => {
    const service = createMockService({
      skills: [{ id: 's1', displayName: 'Skill 1', description: 'desc' }],
      bootstrapSkills: [{ id: 'bs1', displayName: 'Bootstrap 1', description: 'bdesc' }]
    });
    const result = await service.tryHandle('sess-1', { conversationId: 'conv-1', message: 'list skills' } as any);
    expect(result).toBeDefined();
  });

  it('handles list-tools intent', async () => {
    const service = createMockService();
    const result = await service.tryHandle('sess-1', { conversationId: 'conv-1', message: 'list tools' } as any);
    expect(result).toBeDefined();
  });

  it('handles list-connectors intent with connectors', async () => {
    const service = createMockService({
      connectors: [
        {
          id: 'c1',
          displayName: 'GitHub',
          capabilityCount: 5,
          transport: 'stdio',
          source: 'config',
          enabled: true,
          healthState: 'healthy'
        }
      ]
    });
    const result = await service.tryHandle('sess-1', { conversationId: 'conv-1', message: 'list connectors' } as any);
    expect(result).toBeDefined();
  });

  it('handles list-connectors intent without connectors', async () => {
    const service = createMockService({ connectors: [] });
    const result = await service.tryHandle('sess-1', { conversationId: 'conv-1', message: 'list connectors' } as any);
    expect(result).toBeDefined();
  });

  it('handles list-connectors with healthReason and configurationTemplateId', async () => {
    const service = createMockService({
      connectors: [
        {
          id: 'c1',
          displayName: 'GitHub',
          healthReason: 'Connection healthy',
          configurationTemplateId: 'tpl-1',
          capabilityCount: 5,
          transport: 'stdio',
          source: 'config',
          enabled: true,
          healthState: 'healthy'
        }
      ]
    });
    const result = await service.tryHandle('sess-1', { conversationId: 'conv-1', message: 'list connectors' } as any);
    expect(result).toBeDefined();
  });

  it('handles list-capabilities intent', async () => {
    const service = createMockService({
      connectors: [
        {
          id: 'c1',
          displayName: 'GitHub',
          capabilityCount: 5,
          transport: 'stdio',
          source: 'config',
          enabled: true,
          healthState: 'healthy'
        }
      ]
    });
    const result = await service.tryHandle('sess-1', {
      conversationId: 'conv-1',
      message: 'list tools and skills'
    } as any);
    expect(result).toBeDefined();
  });

  it('handles create-skill intent', async () => {
    const service = createMockService();
    const result = await service.tryHandle('sess-1', {
      conversationId: 'conv-1',
      message: 'create skill for data analysis'
    } as any);
    expect(result).toBeDefined();
  });

  it('handles install-skill intent', async () => {
    const service = createMockService();
    const result = await service.tryHandle('sess-1', {
      conversationId: 'conv-1',
      message: 'install skill org/repo'
    } as any);
    expect(result).toBeDefined();
  });

  it('returns undefined for unrecognized intent', async () => {
    const service = createMockService();
    const result = await service.tryHandle('sess-1', {
      conversationId: 'conv-1',
      message: 'hello how are you'
    } as any);
    expect(result).toBeUndefined();
  });

  it('handles connector with healthReason for summary', async () => {
    const service = createMockService({
      connectors: [
        {
          id: 'c1',
          displayName: 'GitHub',
          healthReason: 'Healthy',
          capabilityCount: 5,
          transport: 'stdio',
          source: 'config',
          enabled: true,
          healthState: 'healthy'
        }
      ]
    });
    const result = await service.tryHandle('sess-1', {
      conversationId: 'conv-1',
      message: 'list tools and skills and connectors'
    } as any);
    expect(result).toBeDefined();
  });

  it('handles tools with approval-sensitive status', async () => {
    const service = createMockService();
    const result = await service.tryHandle('sess-1', {
      conversationId: 'conv-1',
      message: 'list tools and skills and connectors'
    } as any);
    expect(result).toBeDefined();
  });
});
