import { describe, expect, it } from 'vitest';

import { buildToolsCenter } from '../../../src/governance/runtime-governance/tools-center';

describe('buildToolsCenter (direct)', () => {
  function makeToolRegistry(tools: any[] = [], families: any[] = []) {
    return {
      list: () => tools,
      listFamilies: () => families
    };
  }

  it('returns empty center when no tools or tasks', () => {
    const result = buildToolsCenter({ toolRegistry: makeToolRegistry(), tasks: [] });
    expect(result.totalTools).toBe(0);
    expect(result.familyCount).toBe(0);
    expect(result.blockedToolCount).toBe(0);
  });

  it('counts tools and families', () => {
    const tools = [
      { name: 'read_file', family: 'fs', capabilityType: 'local-tool', requiresApproval: false },
      { name: 'write_file', family: 'fs', capabilityType: 'local-tool', requiresApproval: true }
    ];
    const families = [{ id: 'fs', displayName: 'File System' }];
    const result = buildToolsCenter({ toolRegistry: makeToolRegistry(tools, families), tasks: [] });
    expect(result.totalTools).toBe(2);
    expect(result.familyCount).toBe(1);
    expect(result.approvalRequiredCount).toBe(1);
  });

  it('counts MCP-backed tools', () => {
    const tools = [{ name: 'web_search', family: 'web', capabilityType: 'mcp-capability', requiresApproval: false }];
    const result = buildToolsCenter({ toolRegistry: makeToolRegistry(tools, []), tasks: [] });
    expect(result.mcpBackedCount).toBe(1);
  });

  it('counts governance tools', () => {
    const tools = [
      { name: 'approval_gate', family: 'gov', capabilityType: 'governance-tool', requiresApproval: false }
    ];
    const result = buildToolsCenter({ toolRegistry: makeToolRegistry(tools, []), tasks: [] });
    expect(result.governanceToolCount).toBe(1);
  });

  it('summarizes tool usage from task toolUsageSummary', () => {
    const tasks = [
      {
        toolUsageSummary: [
          { toolName: 'read_file', family: 'fs', status: 'completed', usedAt: '2026-01-01T00:00:00Z' }
        ],
        agentStates: []
      }
    ];
    const result = buildToolsCenter({ toolRegistry: makeToolRegistry([], []), tasks: tasks as any });
    expect(result.recentUsage.length).toBeGreaterThan(0);
  });

  it('summarizes tool usage from pendingApproval', () => {
    const tasks = [
      {
        pendingApproval: {
          toolName: 'write_file',
          reason: 'high risk',
          serverId: 'srv-1',
          capabilityId: 'cap-1',
          riskLevel: 'high'
        },
        currentMinistry: 'gongbu-code',
        updatedAt: '2026-01-01T00:00:00Z',
        agentStates: [],
        toolUsageSummary: []
      }
    ];
    const result = buildToolsCenter({ toolRegistry: makeToolRegistry([], []), tasks: tasks as any });
    expect(result.recentUsage.some(u => u.status === 'blocked')).toBe(true);
    expect(result.blockedToolCount).toBeGreaterThan(0);
  });

  it('summarizes tool usage from agentStates toolCalls', () => {
    const tasks = [
      {
        agentStates: [{ toolCalls: ['tool:read_file', 'tool:write_file', 'not_a_tool'] }],
        status: 'completed',
        updatedAt: '2026-01-01T00:00:00Z',
        currentMinistry: 'gongbu-code',
        toolUsageSummary: []
      }
    ];
    const result = buildToolsCenter({ toolRegistry: makeToolRegistry([], []), tasks: tasks as any });
    expect(result.recentUsage.length).toBe(2);
  });

  it('handles failed tasks in tool usage', () => {
    const tasks = [
      {
        agentStates: [{ toolCalls: ['tool:test_tool'] }],
        status: 'failed',
        updatedAt: '2026-01-01T00:00:00Z',
        currentMinistry: 'gongbu-code',
        toolUsageSummary: []
      }
    ];
    const result = buildToolsCenter({ toolRegistry: makeToolRegistry([], []), tasks: tasks as any });
    expect(result.recentUsage[0].status).toBe('failed');
  });

  it('summarizes tool attachments', () => {
    const tasks = [
      {
        toolAttachments: [{ toolName: 'web_search', ownerType: 'skill', ownerId: 'skill-1' }],
        agentStates: [],
        toolUsageSummary: []
      }
    ];
    const result = buildToolsCenter({ toolRegistry: makeToolRegistry([], []), tasks: tasks as any });
    expect(result.attachments.length).toBe(1);
  });

  it('maps family displayName for tools', () => {
    const tools = [{ name: 'read_file', family: 'fs', capabilityType: 'local-tool', requiresApproval: false }];
    const families = [{ id: 'fs', displayName: 'File System' }];
    const result = buildToolsCenter({ toolRegistry: makeToolRegistry(tools, families), tasks: [] });
    expect(result.tools[0].familyDisplayName).toBe('File System');
  });

  it('counts tools per family', () => {
    const tools = [
      { name: 'read_file', family: 'fs', capabilityType: 'local-tool', requiresApproval: false },
      { name: 'write_file', family: 'fs', capabilityType: 'local-tool', requiresApproval: false },
      { name: 'web_search', family: 'web', capabilityType: 'mcp-capability', requiresApproval: false }
    ];
    const families = [
      { id: 'fs', displayName: 'File System' },
      { id: 'web', displayName: 'Web' }
    ];
    const result = buildToolsCenter({ toolRegistry: makeToolRegistry(tools, families), tasks: [] });
    expect(result.families.find(f => f.id === 'fs')!.toolCount).toBe(2);
    expect(result.families.find(f => f.id === 'web')!.toolCount).toBe(1);
  });

  it('limits recentUsage to 40 items', () => {
    const tasks = [
      {
        toolUsageSummary: Array.from({ length: 50 }, (_, i) => ({
          toolName: `tool_${i}`,
          status: 'completed',
          usedAt: `2026-01-01T00:${String(i).padStart(2, '0')}:00Z`
        })),
        agentStates: []
      }
    ];
    const result = buildToolsCenter({ toolRegistry: makeToolRegistry([], []), tasks: tasks as any });
    expect(result.recentUsage.length).toBeLessThanOrEqual(40);
  });
});
