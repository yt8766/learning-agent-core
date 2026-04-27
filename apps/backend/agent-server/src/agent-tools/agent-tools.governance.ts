import { BadRequestException, HttpException } from '@nestjs/common';
import type { ExecutionCapabilityRecord, ExecutionRequestRecord, ExecutionRiskClass } from '@agent/core';

import type { AutoReviewService } from '../auto-review/auto-review.service';
import type { SandboxService } from '../sandbox/sandbox.service';
import type { AgentToolApprovalRequest } from './agent-tools.schemas';

const APPROVAL_RISK_CLASSES = new Set<ExecutionRiskClass>(['medium', 'high', 'critical']);

export interface AgentToolSandboxGateDecision {
  decision?: string;
  runId?: string;
  metadata: Record<string, unknown>;
}

export interface AgentToolAutoReviewGateDecision {
  requiresApproval: boolean;
  metadata: Record<string, unknown>;
}

export function shouldRequireAgentToolApproval(
  riskClass: ExecutionRiskClass,
  capabilityRequiresApproval: boolean
): boolean {
  return capabilityRequiresApproval || APPROVAL_RISK_CLASSES.has(riskClass);
}

export function runAgentToolSandboxPreflight(
  sandboxService: SandboxService | undefined,
  request: ExecutionRequestRecord,
  capability: ExecutionCapabilityRecord
): AgentToolSandboxGateDecision {
  if (!sandboxService) {
    return { metadata: {} };
  }

  try {
    const profile = resolveSandboxProfile(request.riskClass, capability.toolName);
    const response = sandboxService.preflight({
      taskId: request.taskId,
      sessionId: request.sessionId,
      requestId: request.requestId,
      toolName: request.toolName,
      profile,
      riskClass: request.riskClass,
      commandPreview:
        typeof request.metadata?.input === 'object' ? extractCommandPreview(request.metadata.input) : undefined,
      inputPreview: request.inputPreview,
      permissionScope: {
        allowedPaths: [],
        deniedPaths: [],
        allowedHosts: [],
        deniedHosts: [],
        allowedCommands: [],
        deniedCommands: []
      },
      metadata: {
        capabilityId: request.capabilityId,
        nodeId: request.nodeId
      }
    });
    return {
      decision: response.decision,
      runId: response.run.runId,
      metadata: {
        sandboxRunId: response.run.runId,
        sandboxDecision: response.decision,
        sandboxProfile: response.profile
      }
    };
  } catch (error) {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      throw new BadRequestException({
        code: 'agent_tool_sandbox_preflight_failed',
        message: 'Sandbox preflight rejected this agent tool request.',
        cause: typeof response === 'object' && response ? response : undefined
      });
    }
    throw error;
  }
}

export function runAgentToolAutoReview(
  autoReviewService: AutoReviewService | undefined,
  request: ExecutionRequestRecord,
  sandboxRunId: string | undefined,
  options: { force?: boolean } = {}
): AgentToolAutoReviewGateDecision | undefined {
  if (!autoReviewService || (!options.force && request.riskClass !== 'low')) {
    return undefined;
  }
  const review = autoReviewService.createReview({
    taskId: request.taskId,
    sessionId: request.sessionId,
    requestId: request.requestId,
    kind: 'tool_execution',
    sandboxRunId,
    target: {
      type: 'agent_tool',
      id: request.toolName,
      summary: `Agent tool execution: ${request.toolName}`,
      outputPreview: request.inputPreview
    },
    evidenceIds: [],
    artifactIds: [],
    requestedBy: undefined,
    metadata: {
      capabilityId: request.capabilityId,
      nodeId: request.nodeId
    }
  });
  return {
    requiresApproval: review.verdict === 'block',
    metadata: {
      autoReviewId: review.reviewId,
      autoReviewVerdict: review.verdict
    }
  };
}

export function resumeLinkedAgentToolGovernanceApprovals(args: {
  request: ExecutionRequestRecord;
  input: AgentToolApprovalRequest;
  sandboxService?: SandboxService;
  autoReviewService?: AutoReviewService;
}): void {
  const { request, input, sandboxService, autoReviewService } = args;
  const sandboxRunId = typeof request.metadata?.sandboxRunId === 'string' ? request.metadata.sandboxRunId : undefined;
  const sandboxDecision =
    typeof request.metadata?.sandboxDecision === 'string' ? request.metadata.sandboxDecision : undefined;
  if (sandboxRunId && sandboxDecision === 'require_approval' && sandboxService) {
    sandboxService.resumeApproval(sandboxRunId, {
      sessionId: input.sessionId,
      actor: input.actor,
      reason: input.reason,
      interrupt: {
        action: input.interrupt.action,
        feedback: input.interrupt.feedback,
        value: input.interrupt.value,
        payload: input.interrupt.payload,
        runId: sandboxRunId,
        requestId: request.requestId,
        approvalId: `approval_${sandboxRunId}`,
        interruptId: `interrupt_${sandboxRunId}`
      }
    });
  }

  const autoReviewId = typeof request.metadata?.autoReviewId === 'string' ? request.metadata.autoReviewId : undefined;
  if (autoReviewId && autoReviewService) {
    autoReviewService.resumeApproval(autoReviewId, {
      sessionId: input.sessionId,
      actor: input.actor,
      reason: input.reason,
      interrupt: {
        action: input.interrupt.action,
        feedback: input.interrupt.feedback,
        value: input.interrupt.value,
        payload: input.interrupt.payload,
        reviewId: autoReviewId,
        requestId: request.requestId
      }
    });
  }
}

function resolveSandboxProfile(riskClass: ExecutionRiskClass, toolName: string): string {
  if (riskClass === 'high' || riskClass === 'critical') {
    return 'release-ops';
  }
  if (toolName === 'read_local_file') {
    return 'workspace-readonly';
  }
  return 'workspace-write';
}

function extractCommandPreview(input: unknown): string | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return undefined;
  }
  const command = (input as Record<string, unknown>).command;
  return typeof command === 'string' ? command : undefined;
}
