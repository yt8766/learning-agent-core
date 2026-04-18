import { RiskLevel, type ToolDefinition } from '@agent/core';

export interface McpCapabilityDefinition {
  id: string;
  toolName: string;
  serverId: string;
  displayName: string;
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  category: ToolDefinition['category'];
  timeoutMs?: number;
  dataScope?: string;
  writeScope?: string;
}

export type McpServerApprovalOverride = 'allow' | 'deny' | 'require-approval' | 'observe';

export class McpCapabilityRegistry {
  private readonly capabilities = new Map<string, McpCapabilityDefinition>();
  private readonly serverApprovalOverrides = new Map<string, McpServerApprovalOverride>();
  private readonly capabilityApprovalOverrides = new Map<string, McpServerApprovalOverride>();

  register(capability: McpCapabilityDefinition): void {
    this.capabilities.set(capability.id, capability);
  }

  registerFromTools(serverId: string, tools: ToolDefinition[]): void {
    tools.forEach(tool => {
      this.register({
        id: `${serverId}:${tool.name}`,
        toolName: tool.name,
        serverId,
        displayName: tool.description,
        riskLevel: tool.riskLevel,
        requiresApproval: tool.requiresApproval,
        category: tool.category,
        timeoutMs: tool.timeoutMs,
        dataScope:
          tool.category === 'memory' || tool.category === 'knowledge' ? 'workspace-and-knowledge' : 'workspace',
        writeScope:
          tool.category === 'action' && tool.requiresApproval
            ? 'writes-or-external-actions'
            : tool.category === 'system'
              ? 'workspace-read'
              : 'none'
      });
    });
  }

  get(capabilityId: string): McpCapabilityDefinition | undefined {
    const capability = this.capabilities.get(capabilityId);
    return capability ? this.applyOverrides(capability) : undefined;
  }

  list(): McpCapabilityDefinition[] {
    return Array.from(this.capabilities.values()).map(capability => this.applyOverrides(capability));
  }

  listByServer(serverId: string): McpCapabilityDefinition[] {
    return this.list().filter(capability => capability.serverId === serverId);
  }

  setServerApprovalOverride(serverId: string, effect?: McpServerApprovalOverride): void {
    if (!effect || effect === 'observe') {
      this.serverApprovalOverrides.delete(serverId);
      return;
    }
    this.serverApprovalOverrides.set(serverId, effect);
  }

  getServerApprovalOverride(serverId: string): McpServerApprovalOverride | undefined {
    return this.serverApprovalOverrides.get(serverId);
  }

  setCapabilityApprovalOverride(capabilityId: string, effect?: McpServerApprovalOverride): void {
    if (!effect || effect === 'observe') {
      this.capabilityApprovalOverrides.delete(capabilityId);
      return;
    }
    this.capabilityApprovalOverrides.set(capabilityId, effect);
  }

  getCapabilityApprovalOverride(capabilityId: string): McpServerApprovalOverride | undefined {
    return this.capabilityApprovalOverrides.get(capabilityId);
  }

  isServerDenied(serverId: string): boolean {
    return this.serverApprovalOverrides.get(serverId) === 'deny';
  }

  isCapabilityDenied(capabilityId: string): boolean {
    return this.capabilityApprovalOverrides.get(capabilityId) === 'deny';
  }

  private applyOverrides(capability: McpCapabilityDefinition): McpCapabilityDefinition {
    const effect =
      this.capabilityApprovalOverrides.get(capability.id) ?? this.serverApprovalOverrides.get(capability.serverId);
    if (!effect || effect === 'observe') {
      return capability;
    }
    if (effect === 'allow') {
      return {
        ...capability,
        requiresApproval: false
      };
    }
    if (effect === 'require-approval') {
      return {
        ...capability,
        requiresApproval: true
      };
    }
    return capability;
  }
}
