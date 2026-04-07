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

  it('filters accidental weekly-report drafts and duplicate generic lab skills from listings', async () => {
    const service = new RuntimeSkillCatalogService(() => ({
      skillRegistry: {
        list: vi.fn(async () => [
          {
            id: 'stable-skill',
            name: '多 Agent 执行模式',
            description: '从主 Agent 与子 Agent 协作过程中抽取出的可复用实验技能。',
            status: 'stable',
            source: 'execution',
            ownership: {
              ownerType: 'user-attached',
              capabilityType: 'skill',
              scope: 'workspace',
              trigger: 'user_requested'
            }
          },
          {
            id: 'lab-skill-dup',
            name: '多 Agent 执行模式',
            description: '从主 Agent 与子 Agent 协作过程中抽取出的可复用实验技能。',
            status: 'lab',
            source: 'execution',
            ownership: {
              ownerType: 'user-attached',
              capabilityType: 'skill',
              scope: 'workspace',
              trigger: 'user_requested'
            }
          },
          {
            id: 'weekly-report-draft',
            name: '周报草稿',
            description:
              '参考上面的生成我当前完成任务的周报。这个草稿会先做上下文理解，再根据缺失能力选择 skill / MCP / 审批链路。',
            status: 'lab',
            source: 'research',
            ownership: {
              ownerType: 'user-attached',
              capabilityType: 'skill',
              scope: 'workspace',
              trigger: 'user_requested'
            }
          }
        ]),
        getById: vi.fn(),
        publishToLab: vi.fn(),
        promote: vi.fn(),
        disable: vi.fn(),
        restore: vi.fn(),
        retire: vi.fn()
      }
    }));

    await expect(service.listSkills()).resolves.toEqual([
      expect.objectContaining({
        id: 'stable-skill',
        name: '多 Agent 执行模式',
        status: 'stable'
      })
    ]);
  });

  it('rejects creating user skill drafts for weekly report style prompts', async () => {
    const publishToLab = vi.fn(async (skill: any) => skill);
    const service = new RuntimeSkillCatalogService(() => ({
      skillRegistry: {
        list: vi.fn(),
        getById: vi.fn(),
        publishToLab,
        promote: vi.fn(),
        disable: vi.fn(),
        restore: vi.fn(),
        retire: vi.fn()
      }
    }));

    await expect(
      service.createUserSkillDraft({
        prompt: '参考上面的生成我当前完成任务的周报'
      })
    ).rejects.toThrow('current_request_is_not_a_reusable_skill');
    expect(publishToLab).not.toHaveBeenCalled();
  });
});
