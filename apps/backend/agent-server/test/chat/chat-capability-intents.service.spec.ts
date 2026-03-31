import { describe, expect, it, vi } from 'vitest';

import { ChatCapabilityIntentsService } from '../../src/chat/chat-capability-intents.service';

describe('ChatCapabilityIntentsService', () => {
  function createService() {
    const runtimeSessionService = {
      appendInlineCapabilityResponse: vi.fn(async (_sessionId, _dto, response) => response),
      attachSessionCapabilities: vi.fn(async () => undefined)
    };
    const runtimeSkillCatalogService = {
      listSkills: vi.fn(async () => []),
      listBootstrapSkills: vi.fn(async () => []),
      createUserSkillDraft: vi.fn(async () => ({
        id: 'skill-1',
        name: 'My Skill',
        description: 'test draft',
        status: 'lab',
        toolContract: {
          required: ['lark.send_message'],
          optional: ['lark.search_docs'],
          approvalSensitive: ['lark.send_message']
        },
        connectorContract: {
          preferred: ['lark-mcp-template'],
          required: ['lark-mcp-template'],
          configureIfMissing: true
        },
        requiredTools: ['lark.send_message'],
        ownership: {
          ownerType: 'user-attached',
          capabilityType: 'skill',
          scope: 'workspace',
          trigger: 'user_requested'
        }
      }))
    };
    const runtimeCentersService = {
      getConnectorsCenter: vi.fn(async () => []),
      getToolsCenter: vi.fn(() => ({
        totalTools: 2,
        familyCount: 1,
        families: [{ id: 'filesystem', displayName: 'Filesystem', toolCount: 2 }],
        tools: [
          {
            name: 'read_local_file',
            description: 'read file',
            family: 'filesystem',
            capabilityType: 'local-tool',
            ownerType: 'shared',
            requiresApproval: false
          },
          {
            name: 'patch_local_file',
            description: 'patch file',
            family: 'filesystem',
            capabilityType: 'local-tool',
            ownerType: 'shared',
            requiresApproval: true,
            preferredMinistries: ['gongbu-code']
          }
        ]
      })),
      configureConnector: vi.fn(async (dto: any) => ({
        id: dto.templateId === 'github-mcp-template' ? 'github-mcp' : 'browser-mcp',
        displayName: dto.displayName,
        capabilityCount: 3,
        transport: dto.transport,
        source: 'configured',
        enabled: true,
        healthState: 'healthy'
      }))
    };
    const runtimeToolsService = {
      getToolsCenter: vi.fn(() => ({
        totalTools: 2,
        familyCount: 1,
        families: [{ id: 'filesystem', displayName: 'Filesystem', toolCount: 2 }],
        tools: [
          {
            name: 'read_local_file',
            description: 'read file',
            family: 'filesystem',
            capabilityType: 'local-tool',
            ownerType: 'shared',
            requiresApproval: false
          },
          {
            name: 'patch_local_file',
            description: 'patch file',
            family: 'filesystem',
            capabilityType: 'local-tool',
            ownerType: 'shared',
            requiresApproval: true,
            preferredMinistries: ['gongbu-code']
          }
        ]
      })),
      listConnectors: vi.fn(async () => []),
      configureConnector: vi.fn(async (dto: any) => ({
        id:
          dto.templateId === 'github-mcp-template'
            ? 'github-mcp'
            : dto.templateId === 'lark-mcp-template'
              ? 'lark-mcp'
              : 'browser-mcp',
        displayName: dto.displayName,
        capabilityCount: 3,
        transport: dto.transport,
        source: 'configured',
        enabled: dto.enabled ?? true,
        healthState: dto.enabled === false ? 'disabled' : 'healthy',
        configuredAt: '2026-03-29T00:00:00.000Z'
      }))
    };

    return {
      service: new ChatCapabilityIntentsService(
        runtimeSessionService as never,
        runtimeSkillCatalogService as never,
        runtimeCentersService as never,
        runtimeToolsService as never
      ),
      runtimeSessionService,
      runtimeSkillCatalogService,
      runtimeCentersService,
      runtimeToolsService
    };
  }

  it('为 GitHub MCP 自然语言请求自动完成默认配置', async () => {
    const { service, runtimeToolsService, runtimeSessionService } = createService();

    const result = await service.tryHandle('session-1', {
      message: '用 GitHub MCP 看这个仓库'
    });

    expect(runtimeToolsService.configureConnector).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: 'github-mcp-template',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', 'github-mcp-server']
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        role: 'assistant',
        card: expect.objectContaining({
          type: 'capability_catalog',
          title: 'GitHub MCP 已配置'
        })
      })
    );
    expect(runtimeSessionService.attachSessionCapabilities).toHaveBeenCalled();
  });

  it('对 Lark MCP 请求返回缺少 template 的显式说明', async () => {
    const { service, runtimeToolsService, runtimeSessionService } = createService();
    runtimeToolsService.configureConnector = vi.fn(async (dto: any) => ({
      id: 'lark-mcp',
      displayName: dto.displayName,
      capabilityCount: 3,
      transport: dto.transport,
      source: 'configured',
      enabled: false,
      healthState: 'disabled'
    }));

    const result = await service.tryHandle('session-1', {
      message: '给我配置一个 Lark MCP'
    });

    expect(runtimeToolsService.configureConnector).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: 'lark-mcp-template',
        transport: 'http',
        enabled: false
      })
    );
    expect(result).toEqual(
      expect.objectContaining({
        content: expect.stringContaining('已生成配置草稿'),
        card: expect.objectContaining({
          type: 'capability_catalog',
          title: 'Lark MCP 配置草稿'
        })
      })
    );
    expect(runtimeSessionService.attachSessionCapabilities).toHaveBeenCalled();
  });

  it('对 Lark MCP 请求会优先使用自然语言里的 endpoint 与 token', async () => {
    const { service, runtimeToolsService } = createService();
    runtimeToolsService.configureConnector = vi.fn(async (dto: any) => ({
      id: 'lark-mcp',
      displayName: dto.displayName,
      capabilityCount: 3,
      transport: dto.transport,
      source: 'configured',
      enabled: true,
      healthState: 'healthy'
    }));

    await service.tryHandle('session-1', {
      message: '给我配置一个 Lark MCP，endpoint=https://lark.example.com token=lark-token-123'
    });

    expect(runtimeToolsService.configureConnector).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: 'lark-mcp-template',
        endpoint: 'https://lark.example.com',
        apiKey: 'lark-token-123',
        enabled: true
      })
    );
  });

  it('创建 skill 时会返回可执行 contract 预览', async () => {
    const { service, runtimeSessionService } = createService();

    const result = await service.tryHandle('session-1', {
      message: '帮我创建一个会发 Lark 消息的 skill'
    });

    expect(result).toEqual(
      expect.objectContaining({
        card: expect.objectContaining({
          type: 'skill_draft_created',
          contract: expect.objectContaining({
            requiredTools: ['lark.send_message'],
            preferredConnectors: ['lark-mcp-template'],
            requiredConnectors: ['lark-mcp-template']
          })
        })
      })
    );
    expect(runtimeSessionService.attachSessionCapabilities).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({
        usedInstalledSkills: ['installed-skill:skill-1']
      })
    );
    expect(runtimeSessionService.attachSessionCapabilities).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({
        attachments: expect.arrayContaining([
          expect.objectContaining({
            metadata: expect.objectContaining({
              requiredTools: expect.arrayContaining(['lark.send_message']),
              requiredConnectors: expect.arrayContaining(['lark-mcp-template'])
            })
          })
        ])
      })
    );
  });

  it('列出 tools 时返回按 family 分组的 catalog', async () => {
    const { service, runtimeToolsService } = createService();

    const result = await service.tryHandle('session-1', {
      message: '我现在有哪些 tools？'
    });

    expect(runtimeToolsService.getToolsCenter).toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        card: expect.objectContaining({
          type: 'capability_catalog',
          title: '当前 Tools',
          groups: [
            expect.objectContaining({
              key: 'filesystem',
              kind: 'tool',
              items: expect.arrayContaining([expect.objectContaining({ id: 'read_local_file', family: 'filesystem' })])
            })
          ]
        })
      })
    );
  });
});
