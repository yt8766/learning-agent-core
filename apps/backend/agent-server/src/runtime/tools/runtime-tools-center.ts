import type {
  TaskRecord,
  ToolAttachmentRecord,
  ToolDefinition,
  ToolFamilyRecord,
  ToolUsageSummaryRecord
} from '@agent/core';

function summarizeToolUsage(tasks: TaskRecord[]): ToolUsageSummaryRecord[] {
  const items: ToolUsageSummaryRecord[] = [];

  for (const task of tasks) {
    for (const summary of task.toolUsageSummary ?? []) {
      items.push(summary);
    }

    if (task.pendingApproval?.toolName) {
      items.push({
        toolName: task.pendingApproval.toolName,
        family: 'runtime-governance',
        capabilityType: 'governance-tool',
        status: 'blocked',
        route: task.pendingApproval.serverId ? 'mcp' : 'governance',
        requestedBy: task.currentMinistry,
        reason: task.pendingApproval.reason,
        blockedReason: task.pendingApproval.reason,
        serverId: task.pendingApproval.serverId,
        capabilityId: task.pendingApproval.capabilityId,
        approvalRequired: true,
        riskLevel: task.pendingApproval.riskLevel,
        usedAt: task.updatedAt
      });
    }

    for (const agentState of task.agentStates ?? []) {
      for (const toolCall of agentState.toolCalls ?? []) {
        if (!toolCall.startsWith('tool:')) {
          continue;
        }
        const toolName = toolCall.slice('tool:'.length);
        items.push({
          toolName,
          family: 'unknown',
          capabilityType: 'local-tool',
          status: task.status === 'failed' ? 'failed' : task.status === 'completed' ? 'completed' : 'called',
          route: 'local',
          requestedBy: task.currentMinistry ?? agentState.role,
          usedAt: task.updatedAt
        });
      }
    }
  }

  return Array.from(
    new Map(items.map(item => [`${item.toolName}:${item.status}:${item.usedAt}`, item] as const)).values()
  )
    .sort((left, right) => new Date(right.usedAt).getTime() - new Date(left.usedAt).getTime())
    .slice(0, 40);
}

function summarizeToolAttachments(tasks: TaskRecord[]): ToolAttachmentRecord[] {
  const attachments = tasks.flatMap(task => task.toolAttachments ?? []);
  return Array.from(
    new Map(attachments.map(item => [`${item.toolName}:${item.ownerType}:${item.ownerId ?? ''}`, item])).values()
  );
}

export function buildToolsCenter(params: {
  toolRegistry: {
    list: () => ToolDefinition[];
    listFamilies: () => ToolFamilyRecord[];
  };
  tasks: TaskRecord[];
}) {
  const tools = params.toolRegistry.list();
  const families = params.toolRegistry.listFamilies();
  const usage = summarizeToolUsage(params.tasks).map(item => ({
    ...item,
    family:
      item.family === 'unknown' ? (tools.find(tool => tool.name === item.toolName)?.family ?? 'unknown') : item.family,
    capabilityType:
      item.capabilityType === 'local-tool'
        ? (tools.find(tool => tool.name === item.toolName)?.capabilityType ?? item.capabilityType)
        : item.capabilityType
  }));
  const attachments = summarizeToolAttachments(params.tasks);
  const blocked = usage.filter(item => item.status === 'blocked');

  return {
    totalTools: tools.length,
    familyCount: families.length,
    blockedToolCount: blocked.length,
    approvalRequiredCount: tools.filter(tool => tool.requiresApproval).length,
    mcpBackedCount: tools.filter(tool => tool.capabilityType === 'mcp-capability').length,
    governanceToolCount: tools.filter(tool => tool.capabilityType === 'governance-tool').length,
    families: families.map(family => ({
      ...family,
      toolCount: tools.filter(tool => tool.family === family.id).length
    })),
    tools: tools.map(tool => ({
      ...tool,
      familyDisplayName: families.find(family => family.id === tool.family)?.displayName ?? tool.family,
      usageCount: usage.filter(item => item.toolName === tool.name).length,
      blockedCount: blocked.filter(item => item.toolName === tool.name).length
    })),
    attachments,
    recentUsage: usage,
    blockedReasons: blocked.slice(0, 10)
  };
}
