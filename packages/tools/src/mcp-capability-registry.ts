import { RiskLevel, ToolDefinition } from '@agent/shared';

export interface McpCapabilityDefinition {
  id: string;
  toolName: string;
  serverId: string;
  displayName: string;
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  category: ToolDefinition['category'];
}

export class McpCapabilityRegistry {
  private readonly capabilities = new Map<string, McpCapabilityDefinition>();

  register(capability: McpCapabilityDefinition): void {
    this.capabilities.set(capability.id, capability);
  }

  registerFromTools(serverId: string, tools: ToolDefinition[]): void {
    tools.forEach(tool => {
      this.register({
        id: tool.name,
        toolName: tool.name,
        serverId,
        displayName: tool.description,
        riskLevel: tool.riskLevel,
        requiresApproval: tool.requiresApproval,
        category: tool.category
      });
    });
  }

  get(capabilityId: string): McpCapabilityDefinition | undefined {
    return this.capabilities.get(capabilityId);
  }

  list(): McpCapabilityDefinition[] {
    return Array.from(this.capabilities.values());
  }

  listByServer(serverId: string): McpCapabilityDefinition[] {
    return this.list().filter(capability => capability.serverId === serverId);
  }
}
