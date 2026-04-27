import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ExecutionCapabilityRecord } from '@agent/core';
import type { AgentToolSurfaceResolver } from '@agent/tools';

import type { CreateAgentToolExecutionRequest } from './agent-tools.schemas';

export function resolveAgentToolRequestInput(
  input: CreateAgentToolExecutionRequest,
  aliasResolver: AgentToolSurfaceResolver
): {
  input: CreateAgentToolExecutionRequest & { toolName: string };
  aliasRequiresApproval?: boolean;
} {
  if (!input.alias) {
    return { input: input as CreateAgentToolExecutionRequest & { toolName: string } };
  }

  const resolution = resolveAgentToolAlias(input, aliasResolver);

  return {
    input: {
      ...input,
      toolName: resolution.toolName,
      capabilityId: resolution.capabilityId,
      riskClass: resolution.riskClass,
      input: resolution.input,
      inputPreview: input.inputPreview ?? resolution.inputPreview,
      metadata: {
        ...(input.metadata ?? {}),
        alias: resolution.alias,
        approvalMode: resolution.approvalMode,
        approvalReasonCode: resolution.approvalReasonCode,
        aliasReasonCode: resolution.reasonCode
      }
    },
    aliasRequiresApproval: resolution.requiresApproval
  };
}

export function resolveAgentToolCapability(
  capabilities: ExecutionCapabilityRecord[],
  capabilityId: string | undefined,
  toolName: string
): ExecutionCapabilityRecord {
  const capability = capabilityId
    ? capabilities.find(item => item.capabilityId === capabilityId)
    : capabilities.find(item => item.toolName === toolName);
  if (!capability) {
    throw new NotFoundException({
      code: 'agent_tool_capability_not_found',
      message: `Execution capability ${capabilityId ?? toolName} not found`,
      capabilityId,
      toolName
    });
  }
  if (capability.toolName !== toolName) {
    throw new BadRequestException({
      code: 'agent_tool_request_invalid',
      message: `Capability ${capability.capabilityId} does not provide tool ${toolName}`
    });
  }
  return capability;
}

function resolveAgentToolAlias(input: CreateAgentToolExecutionRequest, aliasResolver: AgentToolSurfaceResolver) {
  try {
    return aliasResolver.resolve({
      alias: input.alias,
      approvalMode: input.approvalMode ?? 'suggest',
      capabilityId: input.capabilityId,
      input: input.input,
      requestedBy: input.requestedBy,
      taskId: input.taskId,
      sessionId: input.sessionId,
      intentHint: input.approvalIntent
    });
  } catch (error) {
    throw new BadRequestException({
      code: 'agent_tool_request_invalid',
      message: 'Agent tool alias request is invalid',
      reason: error instanceof Error ? error.message : String(error)
    });
  }
}
