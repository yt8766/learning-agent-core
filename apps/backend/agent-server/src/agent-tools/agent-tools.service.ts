import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import {
  ExecutionRequestRecordSchema,
  type ChatEventRecord,
  type ExecutionCapabilityRecord,
  type ExecutionNodeRecord,
  type ExecutionPolicyDecisionRecord,
  type ExecutionRequestRecord,
  type ExecutionResultRecord
} from '@agent/core';
import { createExecutionPolicyDecision, createExecutionRequest, createExecutionResult } from '@agent/runtime';
import { AgentToolSurfaceResolver, createDefaultToolRegistry, shouldRequireAgentToolApproval } from '@agent/tools';

import { AutoReviewService } from '../auto-review/auto-review.service';
import { SandboxService } from '../sandbox/sandbox.service';
import { applyAgentToolApprovalAction, buildApprovalProjection } from './agent-tools.approval';
import { buildAgentToolCatalog, filterAgentToolCapabilities, filterAgentToolNodes } from './agent-tools.catalog';
import {
  buildAgentToolEvent,
  buildApprovalRejectedEventDrafts,
  buildApprovalResumedEventDrafts,
  buildBlockedAgentToolEventDrafts,
  buildExecutionQueuedEventDraft,
  buildInitialAgentToolEventDrafts,
  buildTerminalAgentToolEventDrafts,
  type AgentToolEventDraft
} from './agent-tools.events';
import {
  buildAgentToolExecutionResult,
  drainQueuedAgentToolExecution,
  enqueueAgentToolRequest
} from './agent-tools.execution-queue';
import {
  assertNotTerminal,
  assertPendingApproval,
  parseApprovalRequest,
  parseCancelRequest,
  parseCreateRequest,
  parseEventsQuery,
  parseNodeHealthCheckRequest,
  summarizeInput
} from './agent-tools.helpers';
import {
  resumeLinkedAgentToolGovernanceApprovals,
  runAgentToolAutoReview,
  runAgentToolSandboxPreflight
} from './agent-tools.governance';
import { buildAgentToolGovernanceProjection, listProjectedAgentToolEvents } from './agent-tools.projection';
import { AgentToolsRepository } from './agent-tools.repository';
import { resolveAgentToolCapability, resolveAgentToolRequestInput } from './agent-tools.service-resolution';
import type {
  AgentToolApprovalProjection,
  AgentToolCapabilityQuery,
  AgentToolEventsQuery,
  AgentToolExecutionResponse,
  AgentToolGovernanceProjection,
  AgentToolNodeQuery,
  AgentToolProjectionQuery
} from './agent-tools.types';
import type { CreateAgentToolExecutionRequest } from './agent-tools.schemas';

@Injectable()
export class AgentToolsService {
  private readonly catalog = buildAgentToolCatalog();
  private readonly aliasResolver = new AgentToolSurfaceResolver({ registry: createDefaultToolRegistry() });
  private readonly repository: AgentToolsRepository;
  constructor(
    repository: AgentToolsRepository,
    @Optional()
    private readonly sandboxService?: SandboxService,
    @Optional()
    private readonly autoReviewService?: AutoReviewService
  ) {
    this.repository = repository;
  }
  listNodes(query: AgentToolNodeQuery): ExecutionNodeRecord[] {
    return filterAgentToolNodes(this.catalog, query);
  }
  listCapabilities(query: AgentToolCapabilityQuery): ExecutionCapabilityRecord[] {
    return filterAgentToolCapabilities(this.catalog, query);
  }
  getNode(nodeId: string): ExecutionNodeRecord {
    const node = this.catalog.nodes.find(item => item.nodeId === nodeId);
    if (!node) {
      throw new NotFoundException({
        code: 'agent_tool_node_not_found',
        message: `Execution node ${nodeId} not found`,
        nodeId
      });
    }
    return node;
  }

  getRequest(requestId: string): ExecutionRequestRecord {
    const request = this.repository.getRequest(requestId);
    if (!request) {
      throw new NotFoundException({
        code: 'agent_tool_request_not_found',
        message: `Agent tool request ${requestId} not found`,
        requestId
      });
    }
    return request;
  }

  getResult(requestId: string): ExecutionResultRecord | null {
    this.getRequest(requestId);
    return this.repository.getResult(requestId) ?? null;
  }

  listEvents(query?: AgentToolEventsQuery | string): ChatEventRecord[] {
    return listProjectedAgentToolEvents({
      repository: this.repository,
      query: parseEventsQuery(query),
      assertRequestExists: requestId => {
        this.getRequest(requestId);
      }
    });
  }

  getProjection(query?: AgentToolProjectionQuery): AgentToolGovernanceProjection {
    return buildAgentToolGovernanceProjection({ repository: this.repository, catalog: this.catalog, query });
  }

  createRequest(body: unknown): AgentToolExecutionResponse {
    const parsedInput = parseCreateRequest(body);
    const { input, aliasRequiresApproval } = resolveAgentToolRequestInput(parsedInput, this.aliasResolver);
    const capability = resolveAgentToolCapability(this.catalog.capabilities, input.capabilityId, input.toolName);
    const nodeId = input.nodeId ?? capability.nodeId;
    this.getNode(nodeId);
    if (capability.nodeId !== nodeId) {
      throw new BadRequestException({
        code: 'agent_tool_request_invalid',
        message: `Capability ${capability.capabilityId} is not hosted by node ${nodeId}`
      });
    }

    let request = createExecutionRequest({
      taskId: input.taskId,
      sessionId: input.sessionId,
      nodeId,
      capabilityId: capability.capabilityId,
      toolName: input.toolName,
      requestedBy: input.requestedBy,
      inputPreview: input.inputPreview ?? summarizeInput(input.input),
      riskClass: input.riskClass ?? capability.riskClass,
      metadata: {
        ...(input.metadata ?? {}),
        input: input.input
      }
    });
    const riskClass = request.riskClass;
    const sandboxDecision = runAgentToolSandboxPreflight(this.sandboxService, request, capability);
    request = {
      ...request,
      metadata: {
        ...(request.metadata ?? {}),
        ...sandboxDecision.metadata
      }
    };
    const policyRequiresApproval =
      sandboxDecision.decision === 'require_approval' ||
      (aliasRequiresApproval ?? shouldRequireAgentToolApproval(riskClass, capability.requiresApproval));
    const baseDecision: ExecutionPolicyDecisionRecord = createExecutionPolicyDecision({
      requestId: request.requestId,
      decision: policyRequiresApproval ? 'require_approval' : 'allow',
      reasonCode:
        sandboxDecision.decision === 'require_approval'
          ? 'sandbox_approval_required'
          : policyRequiresApproval
            ? 'agent_tool_requires_approval'
            : aliasRequiresApproval === false
              ? 'agent_tool_auto_approved'
              : 'agent_tool_low_risk_allowed',
      reason:
        sandboxDecision.decision === 'require_approval'
          ? 'Sandbox profile or risk class requires approval before continuing.'
          : policyRequiresApproval
            ? (input.approvalIntent ?? 'Agent tool request requires approval before execution.')
            : aliasRequiresApproval === false
              ? 'Agent tool request was auto-approved by the configured approval mode policy.'
              : 'Low risk agent tool request can run through the simulated facade.',
      riskClass,
      matchedPolicyIds: ['agent-tools-http-facade']
    });
    const reviewDecision = baseDecision.requiresApproval
      ? undefined
      : runAgentToolAutoReview(this.autoReviewService, request, sandboxDecision.runId, {
          force: aliasRequiresApproval === false
        });
    request = {
      ...request,
      metadata: {
        ...(request.metadata ?? {}),
        ...(reviewDecision?.metadata ?? {})
      }
    };
    const decision =
      !baseDecision.requiresApproval && reviewDecision?.requiresApproval
        ? createExecutionPolicyDecision({
            requestId: request.requestId,
            decision: 'require_approval',
            reasonCode: 'auto_review_blocked',
            reason: 'Auto review blocked this tool execution pending approval or fixes.',
            riskClass,
            matchedPolicyIds: ['agent-tools-http-facade', 'agent-tools-auto-review']
          })
        : baseDecision;

    if (decision.requiresApproval) {
      const approvalId = `approval_${request.requestId}`;
      const pendingRequest = this.saveRequest({
        ...request,
        status: 'pending_approval',
        policyDecision: decision,
        approvalId
      });
      const approval = buildApprovalProjection(pendingRequest);
      this.repository.saveRequest(pendingRequest, approval);
      this.appendEvents(pendingRequest, [
        ...buildInitialAgentToolEventDrafts(pendingRequest, decision),
        ...buildBlockedAgentToolEventDrafts(pendingRequest, approval)
      ]);
      return { request: pendingRequest, policyDecision: decision, approval };
    }

    const queuedRequest = this.enqueueRequest({ ...request, policyDecision: decision });
    this.appendEvents(queuedRequest, [
      ...buildInitialAgentToolEventDrafts(queuedRequest, decision),
      buildExecutionQueuedEventDraft(queuedRequest)
    ]);
    return this.drainQueuedExecution(queuedRequest, 'Simulated agent tool execution completed.');
  }

  cancelRequest(requestId: string, body: unknown): ExecutionRequestRecord {
    parseCancelRequest(body);
    const request = this.getRequest(requestId);
    assertNotTerminal(request);
    const cancelled = this.saveRequest({
      ...request,
      status: 'cancelled',
      finishedAt: new Date().toISOString()
    });
    const result = buildAgentToolExecutionResult(cancelled, 'cancelled', 'Agent tool request was cancelled.');
    this.repository.saveResult(result);
    const approval = buildApprovalProjection(request);
    this.appendEvents(cancelled, [
      ...buildApprovalResumedEventDrafts(request, approval, 'cancel'),
      ...buildTerminalAgentToolEventDrafts(cancelled, 'cancelled', result.resultId, result.outputPreview)
    ]);
    return cancelled;
  }

  resumeApproval(requestId: string, body: unknown): AgentToolExecutionResponse {
    const input = parseApprovalRequest(body);
    const request = this.getRequest(requestId);
    assertNotTerminal(request);
    assertPendingApproval(request);
    if (input.interrupt.requestId !== requestId) {
      throw new BadRequestException({
        code: 'agent_tool_request_invalid',
        message: 'Approval requestId must match the route requestId'
      });
    }
    if (input.interrupt.approvalId && input.interrupt.approvalId !== request.approvalId) {
      throw new BadRequestException({
        code: 'agent_tool_request_invalid',
        message: 'Approval id does not match the pending request'
      });
    }
    if (
      (input.interrupt.action === 'approve' || input.interrupt.action === 'bypass') &&
      input.interrupt.approvalId !== request.approvalId
    ) {
      throw new BadRequestException({
        code: 'agent_tool_request_invalid',
        message: 'Approval id is required for approve and bypass actions'
      });
    }
    const expectedInterruptId = `interrupt_${request.requestId}`;
    if (
      (input.interrupt.action === 'approve' || input.interrupt.action === 'bypass') &&
      input.interrupt.interruptId !== expectedInterruptId
    ) {
      throw new BadRequestException({
        code: 'agent_tool_request_invalid',
        message: 'Interrupt id is required for approve and bypass actions'
      });
    }

    const approval = buildApprovalProjection(request);
    if (input.interrupt.action === 'approve' || input.interrupt.action === 'bypass') {
      resumeLinkedAgentToolGovernanceApprovals({
        request,
        input,
        sandboxService: this.sandboxService,
        autoReviewService: this.autoReviewService
      });
      const queuedRequest = this.enqueueRequest({
        ...request,
        approvalId: undefined,
        metadata: {
          ...(request.metadata ?? {}),
          approvalAction: input.interrupt.action,
          approvalScope: input.interrupt.payload?.approvalScope ?? 'once'
        }
      });
      this.appendEvents(queuedRequest, [
        ...buildApprovalResumedEventDrafts(request, approval, input.interrupt.action),
        buildExecutionQueuedEventDraft(queuedRequest)
      ]);
      return this.drainQueuedExecution(queuedRequest, 'Approved tool execution completed.');
    }

    const response = applyAgentToolApprovalAction({
      request,
      input,
      saveRequest: next => {
        this.repository.saveRequest(next);
      },
      saveResult: result => {
        this.repository.saveResult(result);
      },
      buildResult: buildAgentToolExecutionResult
    });
    this.appendApprovalEvents(request, approval, input.interrupt.action, input.interrupt.feedback, response);
    return response;
  }

  healthCheckNode(nodeId: string, body: unknown): ExecutionResultRecord {
    const node = this.getNode(nodeId);
    const metadata = parseNodeHealthCheckRequest(body);
    return createExecutionResult({
      requestId: `health_${node.nodeId}`,
      taskId: `health_${node.nodeId}`,
      nodeId: node.nodeId,
      status: 'succeeded',
      outputPreview: 'Execution node health check completed.',
      metadata
    });
  }

  private saveRequest(request: ExecutionRequestRecord): ExecutionRequestRecord {
    return this.repository.saveRequest(ExecutionRequestRecordSchema.parse(request));
  }

  private enqueueRequest(request: ExecutionRequestRecord): ExecutionRequestRecord {
    return enqueueAgentToolRequest(request, next => this.saveRequest(next));
  }

  private drainQueuedExecution(request: ExecutionRequestRecord, outputPreview: string): AgentToolExecutionResponse {
    return drainQueuedAgentToolExecution({
      request,
      outputPreview,
      saveRequest: next => this.saveRequest(next),
      saveResult: result => this.repository.saveResult(result),
      appendEvents: (nextRequest, drafts) => this.appendEvents(nextRequest, drafts),
      buildResult: buildAgentToolExecutionResult
    });
  }

  private appendEvents(request: ExecutionRequestRecord, drafts: AgentToolEventDraft[]): void {
    const existingCount = this.repository.listEvents(request.requestId).length;
    const events = drafts.map((draft, index) => buildAgentToolEvent(request, existingCount + index + 1, draft));
    this.repository.appendEvents(request.requestId, events);
  }

  private appendApprovalEvents(
    originalRequest: ExecutionRequestRecord,
    approval: AgentToolApprovalProjection,
    action: string,
    feedback: string | undefined,
    response: AgentToolExecutionResponse
  ): void {
    if (action === 'abort') {
      this.appendEvents(response.request, [
        ...buildApprovalResumedEventDrafts(originalRequest, approval, action),
        ...buildTerminalAgentToolEventDrafts(
          response.request,
          'cancelled',
          response.result?.resultId,
          response.result?.outputPreview
        )
      ]);
      return;
    }
    if (action === 'reject' || action === 'feedback' || action === 'input') {
      this.appendEvents(
        response.request,
        buildApprovalRejectedEventDrafts(originalRequest, approval, action, feedback)
      );
    }
  }
}
