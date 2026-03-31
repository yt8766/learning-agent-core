import { describe, expect, it, vi } from 'vitest';

import { RuntimeSkillCatalogService } from '../../../src/runtime/services/runtime-skill-catalog.service';

describe('RuntimeSkillCatalogService', () => {
  it('uses llm-generated skill draft contract when provider is configured', async () => {
    const publishToLab = vi.fn(async (skill: any) => skill);
    const registerSkillWorker = vi.fn();
    const service = new RuntimeSkillCatalogService(() => ({
      skillRegistry: {
        list: vi.fn(),
        getById: vi.fn(),
        publishToLab,
        promote: vi.fn(),
        disable: vi.fn(),
        restore: vi.fn(),
        retire: vi.fn()
      },
      registerSkillWorker,
      llmProvider: {
        isConfigured: () => true,
        generateObject: vi.fn(async () => ({
          description: 'A generated Lark delivery skill.',
          applicableGoals: ['发送 Lark 消息'],
          requiredTools: ['lark.send_message'],
          optionalTools: ['lark.search_docs'],
          approvalSensitiveTools: ['lark.send_message'],
          preferredConnectors: ['lark-mcp-template'],
          requiredConnectors: ['lark-mcp-template'],
          configureIfMissing: true,
          successSignals: ['message_sent'],
          riskLevel: 'medium',
          steps: [
            { title: 'Frame', instruction: 'Clarify the message target.', toolNames: [] },
            { title: 'Prepare', instruction: 'Prepare payload and approval.', toolNames: ['lark.send_message'] },
            { title: 'Send', instruction: 'Send and confirm delivery.', toolNames: ['lark.send_message'] }
          ]
        })),
        providerId: 'test',
        displayName: 'test',
        supportedModels: () => [],
        generateText: vi.fn(),
        streamText: vi.fn()
      }
    }));

    const result = await service.createUserSkillDraft({
      prompt: '生成一个会发 Lark 消息的 skill'
    });

    expect(publishToLab).toHaveBeenCalledTimes(1);
    expect(result.description).toContain('generated');
    expect(result.constraints).toContain('preferredConnector=lark-mcp-template');
    expect(result.constraints).toContain('requiredConnector=lark-mcp-template');
    expect(result.steps).toHaveLength(3);
    expect(result.toolContract?.approvalSensitive).toContain('lark.send_message');
    expect(result.connectorContract?.required).toContain('lark-mcp-template');
    expect(result.requiredCapabilities).toContain('lark.send_message');
    expect(result.requiredConnectors).toContain('lark-mcp-template');
    expect(registerSkillWorker).toHaveBeenCalledWith(
      expect.objectContaining({
        name: expect.any(String),
        requiredCapabilities: expect.arrayContaining(['lark.send_message']),
        requiredConnectors: expect.arrayContaining(['lark-mcp-template'])
      })
    );
  });
});
