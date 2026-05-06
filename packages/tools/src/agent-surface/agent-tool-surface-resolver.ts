import {
  AgentToolAliasRequestSchema,
  AgentToolResolutionSchema,
  type AgentToolAliasRequest,
  type AgentToolResolution
} from '../index';

import type { ToolRegistry } from '../registry/tool-registry';
import { decideAgentToolApprovalMode } from './agent-tool-approval-mode-policy';
import { normalizeAgentToolInput } from './agent-tool-input-normalizer';
import { classifyAgentToolRisk } from './agent-tool-risk-policy';

export class AgentToolSurfaceResolver {
  private readonly registry: ToolRegistry;

  constructor(options: { registry: ToolRegistry }) {
    this.registry = options.registry;
  }

  resolve(rawRequest: AgentToolAliasRequest): AgentToolResolution {
    const request = AgentToolAliasRequestSchema.parse(rawRequest);
    const normalized = normalizeAgentToolInput(request);
    const tool = this.registry.get(normalized.toolName);
    if (!tool) {
      throw new Error(`agent_tool_alias_unresolved:${normalized.toolName}`);
    }

    const capabilityId = `capability.${tool.family}.${tool.name}`;
    if (request.capabilityId && request.capabilityId !== capabilityId) {
      throw new Error(`agent_tool_alias_capability_mismatch:${request.capabilityId}:${capabilityId}`);
    }

    const risk = classifyAgentToolRisk({
      alias: request.alias,
      toolRiskClass: tool.riskLevel,
      input: normalized.input
    });
    const approval = decideAgentToolApprovalMode({
      alias: request.alias,
      approvalMode: request.approvalMode,
      riskClass: risk.riskClass,
      toolRequiresApproval: tool.requiresApproval,
      riskReasonCode: risk.reasonCode
    });

    return AgentToolResolutionSchema.parse({
      alias: request.alias,
      toolName: tool.name,
      capabilityId,
      riskClass: risk.riskClass,
      requiresApproval: approval.requiresApproval,
      approvalMode: request.approvalMode,
      approvalReasonCode: approval.approvalReasonCode,
      sandboxProfile: normalizeSandboxProfile(tool.sandboxProfile),
      input: normalized.input,
      inputPreview: normalized.inputPreview,
      reasonCode: risk.reasonCode ?? normalized.reasonCode,
      reason: normalized.reason
    });
  }
}

function normalizeSandboxProfile(profile: string): AgentToolResolution['sandboxProfile'] {
  if (profile === 'workspace-readonly' || profile === 'workspace-write' || profile === 'release-ops') {
    return profile;
  }
  return 'workspace-write';
}
