import { describe, expect, it, vi } from 'vitest';

import { RuntimeSkillCatalogService } from '../../../src/runtime/services/runtime-skill-catalog.service';

describe('RuntimeSkillCatalogService', () => {
  it('falls back to heuristic draft blueprint when llm is unavailable or generation fails', async () => {
    const publishToLab = vi.fn(async (skill: any) => skill);
    const registerSkillWorker = vi.fn();
    const serviceWithoutLlm = new RuntimeSkillCatalogService(() => ({
      skillRegistry: {
        list: vi.fn(),
        getById: vi.fn(),
        publishToLab,
        promote: vi.fn(),
        disable: vi.fn(),
        restore: vi.fn(),
        retire: vi.fn()
      },
      registerSkillWorker
    }));

    const browserDraft = await serviceWithoutLlm.createUserSkillDraft({
      prompt: '帮我分析网页并截图后发飞书通知',
      sessionId: 'session-1',
      taskId: 'task-1'
    });

    expect(browserDraft.name).toContain('分析网页并截图后发飞书通知');
    expect(browserDraft.requiredTools).toEqual(expect.arrayContaining(['browser.open_page', 'notify.send_message']));
    expect(browserDraft.preferredConnectors).toEqual(
      expect.arrayContaining(['browser-mcp-template', 'lark-mcp-template'])
    );
    expect(browserDraft.constraints).toEqual(
      expect.arrayContaining(['sessionId=session-1', 'taskId=task-1', 'preferredConnector=lark-mcp-template'])
    );
    expect(browserDraft.riskLevel).toBe('medium');
    expect(registerSkillWorker).toHaveBeenCalledWith(expect.objectContaining({ id: browserDraft.id }));

    const serviceWithFailingLlm = new RuntimeSkillCatalogService(() => ({
      skillRegistry: {
        list: vi.fn(),
        getById: vi.fn(),
        publishToLab,
        promote: vi.fn(),
        disable: vi.fn(),
        restore: vi.fn(),
        retire: vi.fn()
      },
      llmProvider: {
        isConfigured: () => true,
        generateObject: vi.fn(async () => {
          throw new Error('llm unavailable');
        })
      } as any
    }));

    const architectureDraft = await serviceWithFailingLlm.createUserSkillDraft({
      prompt: '帮我梳理代码库架构并检查依赖'
    });

    expect(architectureDraft.description).toContain('技术架构视角');
    expect(architectureDraft.toolContract?.optional).toEqual(
      expect.arrayContaining(['repo.map_dependencies', 'repo.trace_callers'])
    );
    expect(architectureDraft.steps).toHaveLength(4);
  });

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

  it('lists lab skills, exposes bootstrap skills and forwards catalog mutations', async () => {
    const stableSkill = { id: 'skill-stable', status: 'stable', name: 'Stable', description: 'Stable skill' } as any;
    const labSkill = { id: 'skill-lab', status: 'lab', name: 'Lab', description: 'Lab skill' } as any;
    const skillRegistry = {
      list: vi.fn(async (status?: string) => (status === 'lab' ? [labSkill] : [stableSkill, labSkill])),
      getById: vi.fn(async (skillId: string) => (skillId === 'skill-stable' ? stableSkill : undefined)),
      publishToLab: vi.fn(),
      promote: vi.fn(async (skillId: string) => ({ id: skillId, action: 'promoted' })),
      disable: vi.fn(async (skillId: string, reason?: string) => ({ id: skillId, reason })),
      restore: vi.fn(async (skillId: string) => ({ id: skillId, action: 'restored' })),
      retire: vi.fn(async (skillId: string, reason?: string) => ({ id: skillId, reason }))
    };
    const service = new RuntimeSkillCatalogService(() => ({
      skillRegistry
    }));

    await expect(service.listLabSkills()).resolves.toEqual([expect.objectContaining({ id: 'skill-lab' })]);
    expect(service.listBootstrapSkills()).toEqual(expect.any(Array));
    await expect(service.getSkill('skill-stable')).resolves.toEqual(stableSkill);
    await expect(service.promoteSkill('skill-stable')).resolves.toEqual({
      id: 'skill-stable',
      action: 'promoted'
    });
    await expect(service.disableSkill('skill-stable')).resolves.toEqual({
      id: 'skill-stable',
      reason: 'disabled_from_admin'
    });
    await expect(service.restoreSkill('skill-stable')).resolves.toEqual({
      id: 'skill-stable',
      action: 'restored'
    });
    await expect(service.retireSkill('skill-stable')).resolves.toEqual({
      id: 'skill-stable',
      reason: 'retired_from_admin'
    });
    expect(skillRegistry.list).toHaveBeenCalledWith('lab');
  });

  it('throws when requested skill is missing and prefers stable copies over newer draft duplicates', async () => {
    const service = new RuntimeSkillCatalogService(() => ({
      skillRegistry: {
        list: vi.fn(async () => [
          {
            id: 'older-stable',
            name: 'GitHub Review',
            description: 'Review pull requests safely.',
            status: 'stable',
            source: 'execution',
            createdAt: '2026-01-01T00:00:00.000Z',
            ownership: { ownerType: 'shared' }
          },
          {
            id: 'newer-lab',
            name: 'GitHub Review',
            description: 'Review pull requests safely.',
            status: 'lab',
            source: 'execution',
            createdAt: '2026-04-01T00:00:00.000Z',
            ownership: { ownerType: 'shared' }
          }
        ]),
        getById: vi.fn(async () => undefined),
        publishToLab: vi.fn(),
        promote: vi.fn(),
        disable: vi.fn(),
        restore: vi.fn(),
        retire: vi.fn()
      }
    }));

    await expect(service.listSkills()).resolves.toEqual([
      expect.objectContaining({
        id: 'older-stable',
        status: 'stable'
      })
    ]);
    await expect(service.getSkill('missing-skill')).rejects.toThrow('Skill missing-skill not found');
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
