import { BadRequestException, ConflictException, HttpException, NotFoundException } from '@nestjs/common';
import {
  ChatEventRecordSchema,
  ExecutionCapabilityRecordSchema,
  ExecutionNodeRecordSchema,
  ExecutionPolicyDecisionRecordSchema,
  ExecutionRequestRecordSchema,
  ExecutionResultRecordSchema
} from '@agent/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentToolsRepository } from '../../src/agent-tools/agent-tools.repository';
import { AgentToolsService } from '../../src/agent-tools/agent-tools.service';

describe('AgentToolsService', () => {
  let service: AgentToolsService;

  beforeEach(() => {
    service = new AgentToolsService(new AgentToolsRepository());
  });

  it('lists project execution nodes and capabilities as core execution contracts', () => {
    const nodes = service.listNodes({});
    const capabilities = service.listCapabilities({});

    expect(nodes.length).toBeGreaterThan(0);
    expect(capabilities.length).toBeGreaterThan(0);
    expect(() => ExecutionNodeRecordSchema.array().parse(nodes)).not.toThrow();
    expect(() => ExecutionCapabilityRecordSchema.array().parse(capabilities)).not.toThrow();
    expect(service.getNode(nodes[0].nodeId)).toEqual(nodes[0]);
  });

  it('filters capability and node queries by the documented query parameters', () => {
    const node = service.listNodes({})[0];
    const capability = service.listCapabilities({ nodeId: node.nodeId })[0];

    expect(service.listNodes({ status: node.status, kind: node.kind, sandboxMode: node.sandboxMode })).toEqual([node]);
    expect(service.listNodes({ riskClass: node.riskClass })).toEqual([node]);
    expect(service.listNodes({ status: 'offline' })).toEqual([]);
    expect(service.listCapabilities({ nodeId: node.nodeId })).toEqual(
      expect.arrayContaining([expect.objectContaining({ capabilityId: capability.capabilityId })])
    );
    expect(service.listCapabilities({ category: capability.category })).toEqual(
      expect.arrayContaining([expect.objectContaining({ capabilityId: capability.capabilityId })])
    );
    expect(service.listCapabilities({ riskClass: capability.riskClass })).toEqual(
      expect.arrayContaining([expect.objectContaining({ capabilityId: capability.capabilityId })])
    );
    expect(service.listCapabilities({ requiresApproval: String(capability.requiresApproval) })).toEqual(
      expect.arrayContaining([expect.objectContaining({ capabilityId: capability.capabilityId })])
    );
    expect(service.listCapabilities({ nodeId: 'missing-node' })).toEqual([]);
  });

  it('creates a low risk execution request through the synchronous executor queue boundary', () => {
    const response = service.createRequest({
      sessionId: 'session-1',
      taskId: 'task-1',
      capabilityId: 'capability.filesystem.read_local_file',
      toolName: 'read_local_file',
      requestedBy: { actor: 'runtime', actorId: 'runtime-1' },
      input: { path: 'README.md' },
      riskClass: 'low'
    });

    expect(response.request.status).toBe('succeeded');
    expect(response.policyDecision).toEqual(expect.objectContaining({ decision: 'allow', requiresApproval: false }));
    expect(response.result).toEqual(
      expect.objectContaining({ status: 'succeeded', requestId: response.request.requestId })
    );
    expect(response.approval).toBeUndefined();
    expect(() => ExecutionRequestRecordSchema.parse(response.request)).not.toThrow();
    expect(() => ExecutionResultRecordSchema.parse(response.result)).not.toThrow();
    expect(service.getRequest(response.request.requestId)).toEqual(response.request);
    expect(service.getResult(response.request.requestId)).toEqual(response.result);
    expect(service.listEvents(response.request.requestId).map(event => event.type)).toEqual([
      'tool_selected',
      'tool_called',
      'tool_called',
      'execution_step_started',
      'execution_step_completed',
      'tool_stream_completed'
    ]);
    expect(response.request.metadata).toEqual(
      expect.objectContaining({
        executorQueue: expect.objectContaining({
          drainMode: 'synchronous',
          transitions: ['queued', 'running', 'succeeded']
        })
      })
    );
    expect(() => ChatEventRecordSchema.array().parse(service.listEvents(response.request.requestId))).not.toThrow();
    expect(service.listEvents(response.request.requestId)[1].payload).toEqual(
      expect.objectContaining({
        requestId: response.request.requestId,
        toolName: 'read_local_file',
        inputPreview: response.request.inputPreview,
        policyDecision: expect.objectContaining({ decision: 'allow' })
      })
    );
    expect(service.listEvents(response.request.requestId)[2].payload).toEqual(
      expect.objectContaining({
        requestId: response.request.requestId,
        toolName: 'read_local_file',
        inputPreview: response.request.inputPreview,
        queue: expect.objectContaining({
          status: 'queued',
          drainMode: 'synchronous'
        })
      })
    );
    expect(service.listEvents(response.request.requestId)[3].payload).toEqual(
      expect.objectContaining({
        requestId: response.request.requestId,
        status: 'running',
        queue: expect.objectContaining({ status: 'running' })
      })
    );
    expect(service.listEvents(response.request.requestId)[4].payload).toEqual(
      expect.objectContaining({
        requestId: response.request.requestId,
        resultId: response.result?.resultId,
        status: 'succeeded',
        outputPreview: 'Simulated agent tool execution completed.'
      })
    );
  });

  it('resolves alias requests before creating execution records', () => {
    const response = service.createRequest({
      sessionId: 'session-agent-tool-surface',
      taskId: 'task-agent-tool-surface',
      alias: 'edit',
      approvalMode: 'auto_edit',
      requestedBy: { actor: 'supervisor' },
      input: { path: 'src/index.ts', search: 'old', replace: 'new' }
    });

    expect(response.request.toolName).toBe('patch_local_file');
    expect(response.request.capabilityId).toBe('capability.filesystem.patch_local_file');
    expect(response.request.riskClass).toBe('high');
    expect(response.request.status).toBe('succeeded');
    expect(response.policyDecision).toEqual(expect.objectContaining({ decision: 'allow', requiresApproval: false }));
    expect(response.request.metadata).toEqual(
      expect.objectContaining({
        alias: 'edit',
        approvalMode: 'auto_edit',
        approvalReasonCode: 'auto_edit_allows_workspace_patch',
        aliasReasonCode: 'alias_edit_patch'
      })
    );
  });

  it('runs auto review for auto-approved alias edits before queueing execution', () => {
    const sandboxService = createSandboxServiceMock({ decision: 'allow', runId: 'sandbox_run_alias_edit' });
    const autoReviewService = createAutoReviewServiceMock({ verdict: 'block', reviewId: 'review_alias_edit' });
    service = new AgentToolsService(new AgentToolsRepository(), sandboxService, autoReviewService);

    const response = service.createRequest({
      sessionId: 'session-agent-tool-surface-review',
      taskId: 'task-agent-tool-surface-review',
      alias: 'edit',
      approvalMode: 'auto_edit',
      requestedBy: { actor: 'supervisor' },
      input: { path: 'src/index.ts', search: 'old', replace: 'new' }
    });

    expect(autoReviewService.createReview).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-agent-tool-surface-review',
        sessionId: 'session-agent-tool-surface-review',
        kind: 'tool_execution',
        sandboxRunId: 'sandbox_run_alias_edit',
        target: expect.objectContaining({
          type: 'agent_tool',
          id: 'patch_local_file'
        })
      })
    );
    expect(response.request.status).toBe('pending_approval');
    expect(response.policyDecision).toEqual(
      expect.objectContaining({
        decision: 'require_approval',
        requiresApproval: true,
        reasonCode: 'auto_review_blocked'
      })
    );
  });

  it('downgrades full auto recursive delete into pending approval', () => {
    const response = service.createRequest({
      sessionId: 'session-agent-tool-delete',
      taskId: 'task-agent-tool-delete',
      alias: 'delete',
      approvalMode: 'full_auto',
      requestedBy: { actor: 'supervisor' },
      input: { path: '.', recursive: true }
    });

    expect(response.request.toolName).toBe('delete_local_file');
    expect(response.request.capabilityId).toBe('capability.filesystem.delete_local_file');
    expect(response.request.riskClass).toBe('critical');
    expect(response.request.status).toBe('pending_approval');
    expect(response.policyDecision).toEqual(
      expect.objectContaining({
        decision: 'require_approval',
        requiresApproval: true,
        reasonCode: 'agent_tool_requires_approval'
      })
    );
  });

  it('creates medium and higher risk execution requests as pending approval with resume payload', () => {
    const response = service.createRequest({
      taskId: 'task-2',
      capabilityId: 'capability.mcp.run_terminal',
      toolName: 'run_terminal',
      requestedBy: { actor: 'supervisor' },
      input: { command: 'pnpm test' },
      riskClass: 'medium',
      approvalIntent: 'Run a controlled project test command'
    });

    expect(response.request.status).toBe('pending_approval');
    expect(response.policyDecision).toEqual(
      expect.objectContaining({ decision: 'require_approval', requiresApproval: true })
    );
    expect(response.approval).toEqual(
      expect.objectContaining({
        approvalId: response.request.approvalId,
        interruptId: expect.stringContaining(response.request.requestId),
        resumeEndpoint: `/api/agent-tools/requests/${response.request.requestId}/approval`,
        resumePayload: expect.objectContaining({
          action: 'approve',
          requestId: response.request.requestId,
          approvalId: response.request.approvalId
        })
      })
    );
    expect(response.result).toBeUndefined();
    expect(service.getResult(response.request.requestId)).toBeNull();
    expect(service.listEvents(response.request.requestId).map(event => event.type)).toEqual([
      'tool_selected',
      'tool_called',
      'execution_step_blocked',
      'interrupt_pending'
    ]);
    expect(service.listEvents(response.request.requestId)[2].payload).toEqual(
      expect.objectContaining({
        requestId: response.request.requestId,
        reasonCode: 'agent_tool_requires_approval',
        approvalId: response.request.approvalId,
        interruptId: response.approval?.interruptId
      })
    );
    expect(service.listEvents(response.request.requestId)[3].payload).toEqual(
      expect.objectContaining({
        interruptId: response.approval?.interruptId,
        kind: 'tool_execution',
        requestId: response.request.requestId,
        approvalId: response.request.approvalId
      })
    );
  });

  it('runs sandbox preflight and auto review before low risk tool execution', () => {
    const sandboxService = createSandboxServiceMock({ decision: 'allow', runId: 'sandbox_run_low' });
    const autoReviewService = createAutoReviewServiceMock({ verdict: 'allow', reviewId: 'review_low' });
    service = new AgentToolsService(new AgentToolsRepository(), sandboxService, autoReviewService);

    const response = service.createRequest({
      sessionId: 'session-gate-low',
      taskId: 'task-gate-low',
      capabilityId: 'capability.filesystem.read_local_file',
      toolName: 'read_local_file',
      requestedBy: { actor: 'runtime', actorId: 'runtime-gate' },
      input: { path: 'README.md' },
      riskClass: 'low'
    });

    expect(response.request.status).toBe('succeeded');
    expect(response.request.metadata).toEqual(
      expect.objectContaining({
        sandboxRunId: 'sandbox_run_low',
        sandboxDecision: 'allow',
        sandboxProfile: 'workspace-readonly',
        autoReviewId: 'review_low',
        autoReviewVerdict: 'allow'
      })
    );
    expect(sandboxService.preflight).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-gate-low',
        sessionId: 'session-gate-low',
        requestId: response.request.requestId,
        toolName: 'read_local_file',
        profile: 'workspace-readonly',
        riskClass: 'low',
        inputPreview: response.request.inputPreview
      })
    );
    expect(autoReviewService.createReview).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: 'task-gate-low',
        sessionId: 'session-gate-low',
        requestId: response.request.requestId,
        kind: 'tool_execution',
        sandboxRunId: 'sandbox_run_low',
        target: expect.objectContaining({
          type: 'agent_tool',
          id: 'read_local_file',
          summary: expect.stringContaining('read_local_file'),
          outputPreview: response.request.inputPreview
        })
      })
    );
    const events = service.listEvents(response.request.requestId);
    expect(() => ChatEventRecordSchema.array().parse(events)).not.toThrow();
    expect(events.map(event => event.type)).toEqual([
      'tool_selected',
      'tool_called',
      'tool_called',
      'execution_step_started',
      'execution_step_completed',
      'tool_stream_completed'
    ]);
    expect(events[1].payload).toEqual(
      expect.objectContaining({
        sandboxRunId: 'sandbox_run_low',
        sandboxDecision: 'allow',
        sandboxProfile: 'workspace-readonly',
        autoReviewId: 'review_low',
        autoReviewVerdict: 'allow'
      })
    );
    expect(events[1].payload).not.toHaveProperty('input');
    expect(events[1].payload).not.toHaveProperty('rawOutput');
    expect(events[1].payload).not.toHaveProperty('vendor');
    expect(events[3].payload).toEqual(
      expect.objectContaining({
        sandboxRunId: 'sandbox_run_low',
        sandboxDecision: 'allow',
        sandboxProfile: 'workspace-readonly',
        autoReviewId: 'review_low',
        autoReviewVerdict: 'allow'
      })
    );
    expect(events[3].payload).not.toHaveProperty('input');
    expect(events[3].payload).not.toHaveProperty('rawOutput');
    expect(events[3].payload).not.toHaveProperty('vendor');
  });

  it('projects auto review warn verdict metadata into stable execution events without blocking', () => {
    const sandboxService = createSandboxServiceMock({ decision: 'allow', runId: 'sandbox_run_review_warn' });
    const autoReviewService = createAutoReviewServiceMock({ verdict: 'warn', reviewId: 'review_warn' });
    service = new AgentToolsService(new AgentToolsRepository(), sandboxService, autoReviewService);

    const response = service.createRequest({
      sessionId: 'session-review-warn',
      taskId: 'task-review-warn',
      capabilityId: 'capability.filesystem.read_local_file',
      toolName: 'read_local_file',
      requestedBy: { actor: 'runtime' },
      input: { path: 'README.md' },
      riskClass: 'low'
    });

    const events = service.listEvents(response.request.requestId);

    expect(response.request.status).toBe('succeeded');
    expect(response.policyDecision).toEqual(expect.objectContaining({ decision: 'allow', requiresApproval: false }));
    expect(() => ChatEventRecordSchema.array().parse(events)).not.toThrow();
    expect(events.map(event => event.type)).toEqual([
      'tool_selected',
      'tool_called',
      'tool_called',
      'execution_step_started',
      'execution_step_completed',
      'tool_stream_completed'
    ]);
    expect(events[1].payload).toEqual(
      expect.objectContaining({
        sandboxRunId: 'sandbox_run_review_warn',
        sandboxDecision: 'allow',
        sandboxProfile: 'workspace-readonly',
        autoReviewId: 'review_warn',
        autoReviewVerdict: 'warn'
      })
    );
    expect(events[4].payload).toEqual(
      expect.objectContaining({
        sandboxRunId: 'sandbox_run_review_warn',
        sandboxDecision: 'allow',
        sandboxProfile: 'workspace-readonly',
        autoReviewId: 'review_warn',
        autoReviewVerdict: 'warn'
      })
    );
  });

  it('blocks high risk release profile requests when sandbox requires approval', () => {
    const sandboxService = createSandboxServiceMock({ decision: 'require_approval', runId: 'sandbox_run_release' });
    const autoReviewService = createAutoReviewServiceMock({ verdict: 'block', reviewId: 'review_release' });
    service = new AgentToolsService(new AgentToolsRepository(), sandboxService, autoReviewService);

    const response = service.createRequest({
      sessionId: 'session-sandbox-approval',
      taskId: 'task-sandbox-approval',
      capabilityId: 'capability.mcp.run_terminal',
      toolName: 'run_terminal',
      requestedBy: { actor: 'supervisor' },
      input: { command: 'pnpm release' },
      riskClass: 'high'
    });

    expect(response.request.status).toBe('pending_approval');
    expect(response.policyDecision).toEqual(
      expect.objectContaining({
        decision: 'require_approval',
        requiresApproval: true,
        reasonCode: 'sandbox_approval_required'
      })
    );
    expect(response.request.metadata).toEqual(
      expect.objectContaining({
        sandboxRunId: 'sandbox_run_release',
        sandboxDecision: 'require_approval',
        sandboxProfile: 'release-ops'
      })
    );
    expect(response.request.metadata).not.toHaveProperty('autoReviewId');
    expect(response.request.metadata).not.toHaveProperty('autoReviewVerdict');
    expect(autoReviewService.createReview).not.toHaveBeenCalled();
    expect(service.listEvents(response.request.requestId)[2].payload).toEqual(
      expect.objectContaining({
        sandboxRunId: 'sandbox_run_release',
        sandboxProfile: 'release-ops',
        reasonCode: 'sandbox_approval_required'
      })
    );
    expect(() => ChatEventRecordSchema.array().parse(service.listEvents(response.request.requestId))).not.toThrow();
  });

  it('blocks low risk execution when auto review returns a block verdict', () => {
    const sandboxService = createSandboxServiceMock({ decision: 'allow', runId: 'sandbox_run_review_block' });
    const autoReviewService = createAutoReviewServiceMock({ verdict: 'block', reviewId: 'review_block' });
    service = new AgentToolsService(new AgentToolsRepository(), sandboxService, autoReviewService);

    const response = service.createRequest({
      sessionId: 'session-review-block',
      taskId: 'task-review-block',
      capabilityId: 'capability.filesystem.read_local_file',
      toolName: 'read_local_file',
      requestedBy: { actor: 'runtime' },
      input: { path: 'README.md' },
      riskClass: 'low'
    });

    expect(response.request.status).toBe('pending_approval');
    expect(response.policyDecision).toEqual(
      expect.objectContaining({
        decision: 'require_approval',
        requiresApproval: true,
        reasonCode: 'auto_review_blocked'
      })
    );
    expect(response.request.metadata).toEqual(
      expect.objectContaining({
        sandboxRunId: 'sandbox_run_review_block',
        reviewId: 'review_block',
        autoReviewId: 'review_block',
        autoReviewVerdict: 'block'
      })
    );
    expect(service.listEvents(response.request.requestId)[2].payload).toEqual(
      expect.objectContaining({
        reviewId: 'review_block',
        autoReviewId: 'review_block',
        autoReviewVerdict: 'block',
        reasonCode: 'auto_review_blocked'
      })
    );
    expect(service.listEvents(response.request.requestId)[3].payload).toEqual(
      expect.objectContaining({
        reviewId: 'review_block',
        autoReviewId: 'review_block',
        autoReviewVerdict: 'block'
      })
    );
    const projection = service.getProjection({ requestId: response.request.requestId });
    expect(projection.requests[0].metadata).toEqual(
      expect.objectContaining({
        reviewId: 'review_block',
        autoReviewId: 'review_block',
        autoReviewVerdict: 'block'
      })
    );
    expect(projection.events[2].payload).toEqual(
      expect.objectContaining({
        reviewId: 'review_block',
        autoReviewId: 'review_block',
        autoReviewVerdict: 'block'
      })
    );
    expect(() => ChatEventRecordSchema.array().parse(service.listEvents(response.request.requestId))).not.toThrow();
  });

  it('lists all events in append order and filters events by existing request id', () => {
    const succeeded = service.createRequest({
      taskId: 'task-events-low',
      capabilityId: 'capability.filesystem.read_local_file',
      toolName: 'read_local_file',
      requestedBy: { actor: 'runtime', actorId: 'runtime-events' },
      input: { path: 'README.md' },
      riskClass: 'low'
    });
    const pending = service.createRequest({
      taskId: 'task-events-pending',
      capabilityId: 'capability.mcp.run_terminal',
      toolName: 'run_terminal',
      requestedBy: { actor: 'supervisor' },
      input: { command: 'pnpm verify' },
      riskClass: 'medium'
    });

    const allEvents = service.listEvents();
    const succeededEvents = service.listEvents(succeeded.request.requestId);
    const pendingEvents = service.listEvents(pending.request.requestId);

    expect(() => ChatEventRecordSchema.array().parse(allEvents)).not.toThrow();
    expect(allEvents).toEqual([...succeededEvents, ...pendingEvents]);
    expect(allEvents.map(event => event.payload.requestId)).toEqual([
      ...succeededEvents.map(() => succeeded.request.requestId),
      ...pendingEvents.map(() => pending.request.requestId)
    ]);
    expect(succeededEvents.map(event => event.type)).toEqual([
      'tool_selected',
      'tool_called',
      'tool_called',
      'execution_step_started',
      'execution_step_completed',
      'tool_stream_completed'
    ]);
    expect(pendingEvents.map(event => event.type)).toEqual([
      'tool_selected',
      'tool_called',
      'execution_step_blocked',
      'interrupt_pending'
    ]);
  });

  it('filters events by task id and session id using matching requests', () => {
    const taskMatched = service.createRequest({
      taskId: 'task-events-filter-shared',
      sessionId: 'session-events-filter-one',
      capabilityId: 'capability.filesystem.read_local_file',
      toolName: 'read_local_file',
      requestedBy: { actor: 'runtime', actorId: 'runtime-events-filter' },
      input: { path: 'README.md' },
      riskClass: 'low'
    });
    const taskAndSessionMatched = service.createRequest({
      taskId: 'task-events-filter-shared',
      sessionId: 'session-events-filter-two',
      capabilityId: 'capability.mcp.run_terminal',
      toolName: 'run_terminal',
      requestedBy: { actor: 'supervisor' },
      input: { command: 'pnpm verify' },
      riskClass: 'high'
    });
    const other = service.createRequest({
      taskId: 'task-events-filter-other',
      sessionId: 'session-events-filter-other',
      capabilityId: 'capability.filesystem.read_local_file',
      toolName: 'read_local_file',
      requestedBy: { actor: 'runtime' },
      input: { path: 'package.json' },
      riskClass: 'low'
    });

    const taskEvents = service.listEvents({ taskId: 'task-events-filter-shared' });
    const sessionEvents = service.listEvents({ sessionId: 'session-events-filter-two' });
    const combinedEvents = service.listEvents({
      taskId: 'task-events-filter-shared',
      sessionId: 'session-events-filter-two'
    });

    expect(taskEvents.map(event => event.payload.requestId)).toEqual([
      ...service.listEvents(taskMatched.request.requestId).map(() => taskMatched.request.requestId),
      ...service.listEvents(taskAndSessionMatched.request.requestId).map(() => taskAndSessionMatched.request.requestId)
    ]);
    expect(taskEvents).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ payload: expect.objectContaining({ requestId: other.request.requestId }) })
      ])
    );
    expect(sessionEvents).toEqual(service.listEvents(taskAndSessionMatched.request.requestId));
    expect(combinedEvents).toEqual(service.listEvents(taskAndSessionMatched.request.requestId));
    expect(() => ChatEventRecordSchema.array().parse(taskEvents)).not.toThrow();
    expect(() => ChatEventRecordSchema.array().parse(sessionEvents)).not.toThrow();
    expect(() => ChatEventRecordSchema.array().parse(combinedEvents)).not.toThrow();
  });

  it('ignores blank event query filters instead of looking up an empty request id', () => {
    service.createRequest({
      taskId: 'task-events-blank-query',
      sessionId: 'session-events-blank-query',
      capabilityId: 'capability.filesystem.read_local_file',
      toolName: 'read_local_file',
      requestedBy: { actor: 'runtime' },
      input: { path: 'README.md' },
      riskClass: 'low'
    });

    const allEvents = service.listEvents();

    expect(service.listEvents({ requestId: ' ', taskId: '', sessionId: '\t' } as never)).toEqual(allEvents);
    expect(() => service.listEvents({ requestId: ['request-1'] } as never)).toThrow(BadRequestException);
  });

  it('returns schema-parseable events without leaking non-governance metadata payload fields', () => {
    const repository = new AgentToolsRepository();
    service = new AgentToolsService(repository);
    const response = service.createRequest({
      taskId: 'task-events-sanitize',
      sessionId: 'session-events-sanitize',
      capabilityId: 'capability.filesystem.read_local_file',
      toolName: 'read_local_file',
      requestedBy: { actor: 'runtime' },
      input: { path: 'README.md' },
      riskClass: 'low',
      metadata: {
        sandboxRunId: 'sandbox_run_sanitize',
        input: { secret: 'request metadata input' },
        rawInput: 'raw request input',
        vendor: { name: 'vendor payload' },
        rawOutput: 'raw vendor output'
      }
    });
    repository.appendEvents(response.request.requestId, [
      ChatEventRecordSchema.parse({
        id: `agent_tool_${response.request.requestId}_9999_tool_called`,
        sessionId: response.request.sessionId,
        type: 'tool_called',
        at: '2026-04-26T00:00:00.000Z',
        payload: {
          requestId: response.request.requestId,
          metadata: {
            sandboxRunId: 'sandbox_run_sanitize',
            autoReviewVerdict: 'allow',
            input: { secret: 'metadata input' },
            rawInput: 'raw metadata input',
            vendor: { raw: true },
            rawOutput: 'raw metadata output',
            vendorObject: { raw: 'metadata vendor object' },
            vendorPayload: { raw: 'metadata vendor payload' },
            vendorResponse: { raw: 'metadata vendor response' },
            rawVendorResponse: { raw: 'metadata raw vendor response' },
            providerResponse: { raw: 'metadata provider response' },
            rawProviderResponse: { raw: 'metadata raw provider response' }
          },
          input: { secret: 'payload input' },
          rawInput: 'payload raw input',
          vendor: { raw: true },
          rawOutput: 'payload raw output',
          vendorObject: { raw: 'payload vendor object' },
          vendorPayload: { raw: 'payload vendor payload' },
          vendorResponse: { raw: 'payload vendor response' },
          rawVendorResponse: { raw: 'payload raw vendor response' },
          providerResponse: { raw: 'payload provider response' },
          rawProviderResponse: { raw: 'payload raw provider response' }
        }
      })
    ]);

    const events = service.listEvents(response.request.requestId);
    const sanitized = events.find(event => event.id.endsWith('_9999_tool_called'));

    expect(() => ChatEventRecordSchema.array().parse(events)).not.toThrow();
    expect(sanitized?.payload).toEqual(
      expect.objectContaining({
        requestId: response.request.requestId,
        sandboxRunId: 'sandbox_run_sanitize',
        autoReviewVerdict: 'allow'
      })
    );
    expect(sanitized?.payload).not.toHaveProperty('metadata');
    expect(sanitized?.payload).not.toHaveProperty('input');
    expect(sanitized?.payload).not.toHaveProperty('rawInput');
    expect(sanitized?.payload).not.toHaveProperty('vendor');
    expect(sanitized?.payload).not.toHaveProperty('rawOutput');
    expect(sanitized?.payload).not.toHaveProperty('vendorObject');
    expect(sanitized?.payload).not.toHaveProperty('vendorPayload');
    expect(sanitized?.payload).not.toHaveProperty('vendorResponse');
    expect(sanitized?.payload).not.toHaveProperty('rawVendorResponse');
    expect(sanitized?.payload).not.toHaveProperty('providerResponse');
    expect(sanitized?.payload).not.toHaveProperty('rawProviderResponse');
    const projectionEvent = service
      .getProjection({ requestId: response.request.requestId })
      .events.find(event => event.id.endsWith('_9999_tool_called'));
    expect(projectionEvent?.payload).toEqual(sanitized?.payload);
  });

  it('removes nested raw vendor and provider fields from projected event payloads', () => {
    const repository = new AgentToolsRepository();
    service = new AgentToolsService(repository);
    const response = service.createRequest({
      taskId: 'task-events-nested-sanitize',
      sessionId: 'session-events-nested-sanitize',
      capabilityId: 'capability.filesystem.read_local_file',
      toolName: 'read_local_file',
      requestedBy: { actor: 'runtime' },
      input: { path: 'README.md' },
      riskClass: 'low'
    });
    repository.appendEvents(response.request.requestId, [
      ChatEventRecordSchema.parse({
        id: `agent_tool_${response.request.requestId}_9999_tool_called`,
        sessionId: response.request.sessionId,
        type: 'tool_called',
        at: '2026-04-26T00:00:00.000Z',
        payload: {
          requestId: response.request.requestId,
          details: {
            safeSummary: 'kept',
            providerResponse: { token: 'provider secret' },
            nested: {
              vendorPayload: { token: 'vendor secret' },
              rawVendorResponse: { token: 'raw vendor secret' }
            }
          },
          outputs: [
            {
              label: 'preview',
              rawProviderResponse: { token: 'raw provider secret' }
            }
          ]
        }
      })
    ]);

    const event = service
      .listEvents(response.request.requestId)
      .find(record => record.id.endsWith('_9999_tool_called'));
    const projectionEvent = service
      .getProjection({ requestId: response.request.requestId })
      .events.find(record => record.id.endsWith('_9999_tool_called'));

    expect(event?.payload).toEqual({
      requestId: response.request.requestId,
      details: {
        safeSummary: 'kept',
        nested: {}
      },
      outputs: [
        {
          label: 'preview'
        }
      ]
    });
    expect(projectionEvent?.payload).toEqual(event?.payload);
  });

  it('projects alias governance metadata without leaking raw request metadata', () => {
    const response = service.createRequest({
      taskId: 'task-alias-projection-sanitize',
      sessionId: 'session-alias-projection-sanitize',
      alias: 'read',
      approvalMode: 'full_auto',
      requestedBy: { actor: 'runtime' },
      input: { path: 'README.md' },
      metadata: {
        rawInput: 'raw request input',
        vendor: { raw: true },
        rawOutput: 'raw request output'
      }
    });

    const projection = service.getProjection({ requestId: response.request.requestId });
    const projectedRequest = projection.requests[0];
    const calledEvent = projection.events.find(event => event.type === 'tool_called');

    expect(projectedRequest.metadata).toEqual(
      expect.objectContaining({
        alias: 'read',
        approvalMode: 'full_auto',
        approvalReasonCode: 'full_auto_allows_sandbox_action',
        aliasReasonCode: 'alias_read_file'
      })
    );
    expect(projectedRequest.metadata).not.toHaveProperty('input');
    expect(projectedRequest.metadata).not.toHaveProperty('rawInput');
    expect(projectedRequest.metadata).not.toHaveProperty('vendor');
    expect(projectedRequest.metadata).not.toHaveProperty('rawOutput');
    expect(calledEvent?.payload).toEqual(
      expect.objectContaining({
        alias: 'read',
        approvalMode: 'full_auto',
        approvalReasonCode: 'full_auto_allows_sandbox_action',
        aliasReasonCode: 'alias_read_file'
      })
    );
  });

  it('returns a governance projection for requests, results, catalog records and policy decisions', () => {
    const succeeded = service.createRequest({
      taskId: 'task-projection-low',
      capabilityId: 'capability.filesystem.read_local_file',
      toolName: 'read_local_file',
      requestedBy: { actor: 'runtime', actorId: 'runtime-projection' },
      input: { path: 'README.md' },
      riskClass: 'low'
    });
    const pending = service.createRequest({
      taskId: 'task-projection-approval',
      capabilityId: 'capability.mcp.run_terminal',
      toolName: 'run_terminal',
      requestedBy: { actor: 'supervisor' },
      input: { command: 'pnpm verify' },
      riskClass: 'high'
    });

    const projection = service.getProjection();

    expect(projection.requests.map(request => request.requestId)).toEqual([
      succeeded.request.requestId,
      pending.request.requestId
    ]);
    expect(projection.results).toEqual([succeeded.result]);
    expect(projection.capabilities).toEqual(service.listCapabilities({}));
    expect(projection.nodes).toEqual(service.listNodes({}));
    expect(projection.policyDecisions).toEqual([succeeded.policyDecision, pending.policyDecision]);
    expect(projection.events).toEqual(service.listEvents());
    expect(projection.events.map(event => event.payload.requestId)).toEqual([
      ...service.listEvents(succeeded.request.requestId).map(() => succeeded.request.requestId),
      ...service.listEvents(pending.request.requestId).map(() => pending.request.requestId)
    ]);
    expect(() => ExecutionRequestRecordSchema.array().parse(projection.requests)).not.toThrow();
    expect(() => ExecutionResultRecordSchema.array().parse(projection.results)).not.toThrow();
    expect(() => ExecutionCapabilityRecordSchema.array().parse(projection.capabilities)).not.toThrow();
    expect(() => ExecutionNodeRecordSchema.array().parse(projection.nodes)).not.toThrow();
    expect(() => ExecutionPolicyDecisionRecordSchema.array().parse(projection.policyDecisions)).not.toThrow();
    expect(() => ChatEventRecordSchema.array().parse(projection.events)).not.toThrow();
  });

  it('filters governance projection records by request id while preserving catalog records', () => {
    const matched = service.createRequest({
      taskId: 'task-projection-filter-request',
      sessionId: 'session-projection-filter-request',
      capabilityId: 'capability.filesystem.read_local_file',
      toolName: 'read_local_file',
      requestedBy: { actor: 'runtime' },
      input: { path: 'README.md' },
      riskClass: 'low'
    });
    const other = service.createRequest({
      taskId: 'task-projection-filter-other',
      sessionId: 'session-projection-filter-other',
      capabilityId: 'capability.mcp.run_terminal',
      toolName: 'run_terminal',
      requestedBy: { actor: 'supervisor' },
      input: { command: 'pnpm verify' },
      riskClass: 'high'
    });

    const projection = service.getProjection({ requestId: matched.request.requestId });

    expect(projection.requests.map(request => request.requestId)).toEqual([matched.request.requestId]);
    expect(projection.results).toEqual([matched.result]);
    expect(projection.policyDecisions).toEqual([matched.policyDecision]);
    expect(projection.events).toEqual(service.listEvents(matched.request.requestId));
    expect(projection.events.map(event => event.payload.requestId)).toEqual(
      service.listEvents(matched.request.requestId).map(() => matched.request.requestId)
    );
    expect(projection.results).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ requestId: other.request.requestId })])
    );
    expect(projection.capabilities).toEqual(service.listCapabilities({}));
    expect(projection.nodes).toEqual(service.listNodes({}));
    expect(() => ExecutionRequestRecordSchema.array().parse(projection.requests)).not.toThrow();
    expect(() => ExecutionResultRecordSchema.array().parse(projection.results)).not.toThrow();
    expect(() => ExecutionCapabilityRecordSchema.array().parse(projection.capabilities)).not.toThrow();
    expect(() => ExecutionNodeRecordSchema.array().parse(projection.nodes)).not.toThrow();
    expect(() => ExecutionPolicyDecisionRecordSchema.array().parse(projection.policyDecisions)).not.toThrow();
    expect(() => ChatEventRecordSchema.array().parse(projection.events)).not.toThrow();
  });

  it('filters governance projection records by task id and session id', () => {
    const taskMatched = service.createRequest({
      taskId: 'task-projection-filter-shared',
      sessionId: 'session-projection-filter-one',
      capabilityId: 'capability.filesystem.read_local_file',
      toolName: 'read_local_file',
      requestedBy: { actor: 'runtime' },
      input: { path: 'README.md' },
      riskClass: 'low'
    });
    const taskAndSessionMatched = service.createRequest({
      taskId: 'task-projection-filter-shared',
      sessionId: 'session-projection-filter-two',
      capabilityId: 'capability.mcp.run_terminal',
      toolName: 'run_terminal',
      requestedBy: { actor: 'supervisor' },
      input: { command: 'pnpm verify' },
      riskClass: 'high'
    });
    const other = service.createRequest({
      taskId: 'task-projection-filter-other',
      sessionId: 'session-projection-filter-other',
      capabilityId: 'capability.filesystem.read_local_file',
      toolName: 'read_local_file',
      requestedBy: { actor: 'runtime' },
      input: { path: 'package.json' },
      riskClass: 'low'
    });

    const taskProjection = service.getProjection({ taskId: 'task-projection-filter-shared' });
    const sessionProjection = service.getProjection({ sessionId: 'session-projection-filter-two' });

    expect(taskProjection.requests.map(request => request.requestId)).toEqual([
      taskMatched.request.requestId,
      taskAndSessionMatched.request.requestId
    ]);
    expect(taskProjection.results).toEqual([taskMatched.result]);
    expect(taskProjection.policyDecisions).toEqual([taskMatched.policyDecision, taskAndSessionMatched.policyDecision]);
    expect(taskProjection.events.map(event => event.payload.requestId)).toEqual([
      ...service.listEvents(taskMatched.request.requestId).map(() => taskMatched.request.requestId),
      ...service.listEvents(taskAndSessionMatched.request.requestId).map(() => taskAndSessionMatched.request.requestId)
    ]);
    expect(taskProjection.requests).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ requestId: other.request.requestId })])
    );

    expect(sessionProjection.requests.map(request => request.requestId)).toEqual([
      taskAndSessionMatched.request.requestId
    ]);
    expect(sessionProjection.results).toEqual([]);
    expect(sessionProjection.policyDecisions).toEqual([taskAndSessionMatched.policyDecision]);
    expect(sessionProjection.events).toEqual(service.listEvents(taskAndSessionMatched.request.requestId));
    expect(sessionProjection.capabilities).toEqual(service.listCapabilities({}));
    expect(sessionProjection.nodes).toEqual(service.listNodes({}));
    expect(() => ExecutionRequestRecordSchema.array().parse(taskProjection.requests)).not.toThrow();
    expect(() => ExecutionResultRecordSchema.array().parse(taskProjection.results)).not.toThrow();
    expect(() => ExecutionPolicyDecisionRecordSchema.array().parse(taskProjection.policyDecisions)).not.toThrow();
    expect(() => ChatEventRecordSchema.array().parse(taskProjection.events)).not.toThrow();
    expect(() => ExecutionRequestRecordSchema.array().parse(sessionProjection.requests)).not.toThrow();
    expect(() => ExecutionResultRecordSchema.array().parse(sessionProjection.results)).not.toThrow();
    expect(() => ExecutionPolicyDecisionRecordSchema.array().parse(sessionProjection.policyDecisions)).not.toThrow();
    expect(() => ChatEventRecordSchema.array().parse(sessionProjection.events)).not.toThrow();
  });

  it('returns 400 for invalid request bodies and mismatched capability contracts', () => {
    expectHttpError(
      () => service.createRequest({ taskId: 'task-x' }),
      BadRequestException,
      'agent_tool_request_invalid'
    );
    expectHttpError(
      () =>
        service.createRequest({
          taskId: 'task-x',
          capabilityId: 'capability.mcp.run_terminal',
          toolName: 'read_local_file',
          requestedBy: { actor: 'runtime' },
          input: {}
        }),
      BadRequestException,
      'agent_tool_request_invalid'
    );
    expectHttpError(
      () =>
        service.createRequest({
          taskId: 'task-x',
          alias: 'read',
          requestedBy: { actor: 'runtime' },
          input: {}
        }),
      BadRequestException,
      'agent_tool_request_invalid'
    );
  });

  it('returns 404 error codes for missing requests, nodes and capabilities', () => {
    expectHttpError(() => service.getRequest('missing-request'), NotFoundException, 'agent_tool_request_not_found');
    expectHttpError(() => service.getResult('missing-request'), NotFoundException, 'agent_tool_request_not_found');
    expectHttpError(() => service.listEvents('missing-request'), NotFoundException, 'agent_tool_request_not_found');
    expectHttpError(() => service.getNode('missing-node'), NotFoundException, 'agent_tool_node_not_found');
    expectHttpError(
      () =>
        service.createRequest({
          taskId: 'task-x',
          capabilityId: 'missing-capability',
          toolName: 'run_terminal',
          requestedBy: { actor: 'runtime' },
          input: {}
        }),
      NotFoundException,
      'agent_tool_capability_not_found'
    );
  });

  it('cancels pending approval requests and rejects cancellation of terminal requests', () => {
    const pending = service.createRequest({
      taskId: 'task-cancel',
      capabilityId: 'capability.mcp.run_terminal',
      toolName: 'run_terminal',
      requestedBy: { actor: 'runtime' },
      input: { command: 'pnpm build' },
      riskClass: 'high'
    });

    const cancelled = service.cancelRequest(pending.request.requestId, { actor: 'human', reason: 'stop' });

    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.finishedAt).toBeDefined();
    expect(service.getResult(pending.request.requestId)).toEqual(
      expect.objectContaining({ status: 'cancelled', requestId: pending.request.requestId })
    );
    expect(service.listEvents(pending.request.requestId).map(event => event.type)).toEqual([
      'tool_selected',
      'tool_called',
      'execution_step_blocked',
      'interrupt_pending',
      'execution_step_resumed',
      'interrupt_resumed',
      'execution_step_completed',
      'tool_stream_completed'
    ]);
    expect(service.listEvents(pending.request.requestId).at(-1)?.payload).toEqual(
      expect.objectContaining({ requestId: pending.request.requestId, status: 'cancelled' })
    );
    expectHttpError(
      () => service.cancelRequest(pending.request.requestId, {}),
      ConflictException,
      'agent_tool_conflict'
    );
    expectHttpError(
      () => service.cancelRequest(pending.request.requestId, 'bad-body'),
      BadRequestException,
      'agent_tool_request_invalid'
    );
  });

  it('applies approval actions and preserves terminal conflict semantics', () => {
    const pending = service.createRequest({
      taskId: 'task-approval',
      capabilityId: 'capability.mcp.run_terminal',
      toolName: 'run_terminal',
      requestedBy: { actor: 'supervisor' },
      input: { command: 'pnpm verify' },
      riskClass: 'critical'
    });

    const approvalBody = {
      sessionId: 'session-approval',
      actor: 'human',
      interrupt: {
        action: 'approve',
        requestId: pending.request.requestId,
        approvalId: pending.request.approvalId,
        interruptId: pending.approval?.interruptId
      }
    } as const;
    const approved = service.resumeApproval(pending.request.requestId, approvalBody);

    expect(approved.request.status).toBe('succeeded');
    expect(approved.result).toEqual(expect.objectContaining({ status: 'succeeded' }));
    expect(service.listEvents(pending.request.requestId).map(event => event.type)).toEqual([
      'tool_selected',
      'tool_called',
      'execution_step_blocked',
      'interrupt_pending',
      'execution_step_resumed',
      'interrupt_resumed',
      'tool_called',
      'execution_step_started',
      'execution_step_completed',
      'tool_stream_completed'
    ]);
    expect(approved.request.metadata).toEqual(
      expect.objectContaining({
        approvalAction: 'approve',
        executorQueue: expect.objectContaining({
          drainMode: 'synchronous',
          transitions: ['queued', 'running', 'succeeded']
        })
      })
    );
    expect(service.listEvents(pending.request.requestId)[4].payload).toEqual(
      expect.objectContaining({
        requestId: pending.request.requestId,
        approvalId: pending.request.approvalId,
        interruptId: pending.approval?.interruptId,
        action: 'approve'
      })
    );
    expectHttpError(
      () => service.resumeApproval(pending.request.requestId, approvalBody),
      ConflictException,
      'agent_tool_conflict'
    );

    const feedbackPending = service.createRequest({
      taskId: 'task-feedback',
      capabilityId: 'capability.mcp.run_terminal',
      toolName: 'run_terminal',
      requestedBy: { actor: 'supervisor' },
      input: { command: 'pnpm verify' },
      riskClass: 'high'
    });
    const feedback = service.resumeApproval(feedbackPending.request.requestId, {
      sessionId: 'session-feedback',
      actor: 'human',
      interrupt: {
        action: 'feedback',
        requestId: feedbackPending.request.requestId,
        feedback: 'Use a narrower command'
      }
    });

    expect(feedback.request.status).toBe('pending_policy');
    expect(feedback.result).toBeUndefined();
    expect(feedback.request.metadata).toEqual(expect.objectContaining({ approvalFeedback: 'Use a narrower command' }));
    expect(
      service
        .listEvents(feedbackPending.request.requestId)
        .map(event => event.type)
        .slice(-2)
    ).toEqual(['execution_step_resumed', 'interrupt_rejected_with_feedback']);
    expect(service.listEvents(feedbackPending.request.requestId).at(-1)?.payload).toEqual(
      expect.objectContaining({
        kind: 'tool_execution',
        requestId: feedbackPending.request.requestId,
        feedback: 'Use a narrower command'
      })
    );

    const rejectedPending = service.createRequest({
      taskId: 'task-reject',
      capabilityId: 'capability.mcp.run_terminal',
      toolName: 'run_terminal',
      requestedBy: { actor: 'supervisor' },
      input: { command: 'rm -rf dist' },
      riskClass: 'high'
    });

    expect(
      service.resumeApproval(rejectedPending.request.requestId, {
        sessionId: 'session-reject',
        interrupt: {
          action: 'reject',
          requestId: rejectedPending.request.requestId,
          feedback: 'Too broad'
        }
      }).request.status
    ).toBe('denied');
    expect(
      service
        .listEvents(rejectedPending.request.requestId)
        .map(event => event.type)
        .slice(-2)
    ).toEqual(['execution_step_resumed', 'interrupt_rejected_with_feedback']);

    const abortPending = service.createRequest({
      taskId: 'task-abort',
      capabilityId: 'capability.mcp.run_terminal',
      toolName: 'run_terminal',
      requestedBy: { actor: 'supervisor' },
      input: { command: 'pnpm verify' },
      riskClass: 'high'
    });

    expect(
      service.resumeApproval(abortPending.request.requestId, {
        sessionId: 'session-abort',
        interrupt: {
          action: 'abort',
          requestId: abortPending.request.requestId
        }
      }).request.status
    ).toBe('cancelled');
    expect(
      service
        .listEvents(abortPending.request.requestId)
        .map(event => event.type)
        .slice(-4)
    ).toEqual(['execution_step_resumed', 'interrupt_resumed', 'execution_step_completed', 'tool_stream_completed']);
  });

  it('syncs sandbox and auto review approvals before draining an approved request', () => {
    const sandboxService = createSandboxServiceMock({ decision: 'require_approval', runId: 'sandbox_run_resume' });
    const autoReviewService = createAutoReviewServiceMock({ verdict: 'block', reviewId: 'review_resume' });
    service = new AgentToolsService(new AgentToolsRepository(), sandboxService, autoReviewService);
    const pending = service.createRequest({
      taskId: 'task-approval-sync',
      sessionId: 'session-approval-sync',
      capabilityId: 'capability.mcp.run_terminal',
      toolName: 'run_terminal',
      requestedBy: { actor: 'supervisor' },
      input: { command: 'pnpm release' },
      riskClass: 'high',
      metadata: {
        autoReviewId: 'review_resume',
        autoReviewVerdict: 'block'
      }
    });

    const approved = service.resumeApproval(pending.request.requestId, {
      sessionId: 'session-approval-sync',
      actor: 'human',
      reason: 'approved after governance review',
      interrupt: {
        action: 'approve',
        requestId: pending.request.requestId,
        approvalId: pending.request.approvalId,
        interruptId: pending.approval?.interruptId
      }
    });

    expect(approved.request.status).toBe('succeeded');
    expect(approved.result).toEqual(expect.objectContaining({ status: 'succeeded' }));
    expect(approved.request.metadata).toEqual(
      expect.objectContaining({
        sandboxRunId: 'sandbox_run_resume',
        autoReviewId: 'review_resume',
        approvalAction: 'approve'
      })
    );
    expect(sandboxService.resumeApproval).toHaveBeenCalledWith(
      'sandbox_run_resume',
      expect.objectContaining({
        sessionId: 'session-approval-sync',
        actor: 'human',
        interrupt: expect.objectContaining({
          action: 'approve',
          runId: 'sandbox_run_resume',
          requestId: pending.request.requestId
        })
      })
    );
    expect(autoReviewService.resumeApproval).toHaveBeenCalledWith(
      'review_resume',
      expect.objectContaining({
        sessionId: 'session-approval-sync',
        actor: 'human',
        interrupt: expect.objectContaining({
          action: 'approve',
          reviewId: 'review_resume',
          requestId: pending.request.requestId
        })
      })
    );
  });

  it('prefers reviewId over the legacy autoReviewId when resuming linked auto review approvals', () => {
    const autoReviewService = createAutoReviewServiceMock({ verdict: 'block', reviewId: 'review_canonical' });
    service = new AgentToolsService(new AgentToolsRepository(), undefined, autoReviewService);
    const pending = service.createRequest({
      taskId: 'task-approval-review-id',
      sessionId: 'session-approval-review-id',
      capabilityId: 'capability.mcp.run_terminal',
      toolName: 'run_terminal',
      requestedBy: { actor: 'supervisor' },
      input: { command: 'pnpm release' },
      riskClass: 'high',
      metadata: {
        reviewId: 'review_canonical',
        autoReviewId: 'review_legacy',
        autoReviewVerdict: 'block'
      }
    });

    service.resumeApproval(pending.request.requestId, {
      sessionId: 'session-approval-review-id',
      actor: 'human',
      reason: 'approved after governance review',
      interrupt: {
        action: 'approve',
        requestId: pending.request.requestId,
        approvalId: pending.request.approvalId,
        interruptId: pending.approval?.interruptId
      }
    });

    expect(autoReviewService.resumeApproval).toHaveBeenCalledWith(
      'review_canonical',
      expect.objectContaining({
        interrupt: expect.objectContaining({
          reviewId: 'review_canonical',
          requestId: pending.request.requestId
        })
      })
    );
  });

  it('skips auto review when sandbox preflight already requires approval and resumes sandbox on bypass', () => {
    const sandboxService = createSandboxServiceMock({
      decision: 'require_approval',
      runId: 'sandbox_run_linked_bypass'
    });
    const autoReviewService = createAutoReviewServiceMock({ verdict: 'block', reviewId: 'review_linked_bypass' });
    service = new AgentToolsService(new AgentToolsRepository(), sandboxService, autoReviewService);

    const pending = service.createRequest({
      taskId: 'task-linked-bypass',
      sessionId: 'session-linked-bypass',
      capabilityId: 'capability.filesystem.read_local_file',
      toolName: 'read_local_file',
      requestedBy: { actor: 'runtime' },
      input: { path: 'README.md' },
      riskClass: 'low'
    });

    expect(pending.request.status).toBe('pending_approval');
    expect(pending.policyDecision).toEqual(
      expect.objectContaining({
        decision: 'require_approval',
        requiresApproval: true,
        reasonCode: 'sandbox_approval_required'
      })
    );
    expect(pending.request.metadata).toEqual(
      expect.objectContaining({
        sandboxRunId: 'sandbox_run_linked_bypass',
        sandboxDecision: 'require_approval',
        sandboxProfile: 'workspace-readonly'
      })
    );
    expect(pending.request.metadata).not.toHaveProperty('autoReviewId');
    expect(pending.request.metadata).not.toHaveProperty('autoReviewVerdict');
    expect(autoReviewService.createReview).not.toHaveBeenCalled();

    const bypassed = service.resumeApproval(pending.request.requestId, {
      sessionId: 'session-linked-bypass',
      actor: 'human',
      reason: 'sandbox and review accepted for this run',
      interrupt: {
        action: 'bypass',
        requestId: pending.request.requestId,
        approvalId: pending.request.approvalId,
        interruptId: pending.approval?.interruptId,
        payload: { approvalScope: 'once' }
      }
    });

    expect(bypassed.request.status).toBe('succeeded');
    expect(bypassed.request.metadata).toEqual(
      expect.objectContaining({
        sandboxRunId: 'sandbox_run_linked_bypass',
        sandboxDecision: 'require_approval',
        approvalAction: 'bypass',
        approvalScope: 'once'
      })
    );
    expect(sandboxService.resumeApproval).toHaveBeenCalledWith(
      'sandbox_run_linked_bypass',
      expect.objectContaining({
        actor: 'human',
        reason: 'sandbox and review accepted for this run',
        interrupt: expect.objectContaining({
          action: 'bypass',
          runId: 'sandbox_run_linked_bypass',
          requestId: pending.request.requestId
        })
      })
    );
    expect(autoReviewService.resumeApproval).not.toHaveBeenCalled();
  });

  it('rejects approval resume when the body is invalid or the request is not waiting for approval', () => {
    const succeeded = service.createRequest({
      taskId: 'task-low-approval',
      capabilityId: 'capability.filesystem.read_local_file',
      toolName: 'read_local_file',
      requestedBy: { actor: 'runtime' },
      input: { path: 'README.md' },
      riskClass: 'low'
    });

    expectHttpError(
      () =>
        service.resumeApproval(succeeded.request.requestId, {
          sessionId: 'session-low-approval',
          interrupt: { action: 'approve', requestId: succeeded.request.requestId }
        }),
      ConflictException,
      'agent_tool_conflict'
    );

    const pending = service.createRequest({
      taskId: 'task-invalid-approval',
      capabilityId: 'capability.mcp.run_terminal',
      toolName: 'run_terminal',
      requestedBy: { actor: 'runtime' },
      input: { command: 'pnpm test' },
      riskClass: 'high'
    });

    expectHttpError(
      () => service.resumeApproval(pending.request.requestId, { interrupt: { action: 'approve' } }),
      BadRequestException,
      'agent_tool_request_invalid'
    );
    expectHttpError(
      () =>
        service.resumeApproval(pending.request.requestId, {
          sessionId: 'session-invalid-approval',
          interrupt: { action: 'approve', requestId: pending.request.requestId }
        }),
      BadRequestException,
      'agent_tool_request_invalid'
    );
    expectHttpError(
      () =>
        service.resumeApproval(pending.request.requestId, {
          sessionId: 'session-invalid-approval',
          interrupt: {
            action: 'approve',
            requestId: pending.request.requestId,
            approvalId: pending.request.approvalId
          }
        }),
      BadRequestException,
      'agent_tool_request_invalid'
    );
    expectHttpError(
      () =>
        service.resumeApproval(pending.request.requestId, {
          sessionId: 'session-invalid-approval',
          interrupt: { action: 'bypass', requestId: pending.request.requestId }
        }),
      BadRequestException,
      'agent_tool_request_invalid'
    );
    expectHttpError(
      () =>
        service.resumeApproval(pending.request.requestId, {
          sessionId: 'session-invalid-approval',
          interrupt: {
            action: 'bypass',
            requestId: pending.request.requestId,
            approvalId: pending.request.approvalId
          }
        }),
      BadRequestException,
      'agent_tool_request_invalid'
    );
    expectHttpError(
      () =>
        service.resumeApproval(pending.request.requestId, {
          sessionId: 'session-invalid-approval',
          interrupt: { action: 'approve', requestId: 'different-request' }
        }),
      BadRequestException,
      'agent_tool_request_invalid'
    );
  });

  it('runs controlled node health checks as execution results', () => {
    const node = service.listNodes({})[0];
    const result = service.healthCheckNode(node.nodeId, { actor: 'human', reason: 'smoke' });

    expect(result).toEqual(expect.objectContaining({ nodeId: node.nodeId, status: 'succeeded' }));
    expect(() => ExecutionResultRecordSchema.parse(result)).not.toThrow();
    expectHttpError(() => service.healthCheckNode('missing-node', {}), NotFoundException, 'agent_tool_node_not_found');
    expectHttpError(
      () => service.healthCheckNode(node.nodeId, 'bad-body'),
      BadRequestException,
      'agent_tool_request_invalid'
    );
  });
});

function expectHttpError(
  action: () => unknown,
  errorType: new (...args: never[]) => HttpException,
  code: string
): void {
  expect(action).toThrow(errorType);
  try {
    action();
  } catch (error) {
    const response = error instanceof HttpException ? error.getResponse() : undefined;
    expect(response).toEqual(expect.objectContaining({ code }));
  }
}

function createSandboxServiceMock(options: { decision: 'allow' | 'require_approval'; runId: string }) {
  return {
    preflight: vi.fn(body => ({
      decision: options.decision,
      reasonCode: options.decision === 'require_approval' ? 'sandbox_approval_required' : 'sandbox_policy_allowed',
      reason:
        options.decision === 'require_approval'
          ? 'Sandbox profile or risk class requires approval before continuing.'
          : 'Sandbox policy allowed this execution plan.',
      profile: (body as { profile: string }).profile,
      normalizedPermissionScope: {
        allowedPaths: [],
        deniedPaths: [],
        allowedHosts: [],
        deniedHosts: [],
        allowedCommands: [],
        deniedCommands: []
      },
      requiresApproval: options.decision === 'require_approval',
      run: {
        runId: options.runId,
        requestId: (body as { requestId?: string }).requestId,
        taskId: (body as { taskId: string }).taskId,
        sessionId: (body as { sessionId?: string }).sessionId,
        profile: (body as { profile: string }).profile,
        stage: 'preflight',
        status: options.decision === 'require_approval' ? 'blocked' : 'passed',
        attempt: 1,
        maxAttempts: 1,
        verdict: options.decision === 'require_approval' ? 'block' : 'allow',
        createdAt: '2026-04-26T00:00:00.000Z',
        updatedAt: '2026-04-26T00:00:00.000Z',
        metadata: {}
      },
      approval:
        options.decision === 'require_approval'
          ? {
              approvalId: `approval_${options.runId}`,
              interruptId: `interrupt_${options.runId}`,
              resumeEndpoint: `/api/sandbox/runs/${options.runId}/approval`
            }
          : undefined
    })),
    resumeApproval: vi.fn((runId: string) => ({
      runId,
      taskId: 'task-approval-sync',
      profile: 'release-ops',
      stage: 'preflight',
      status: 'passed',
      attempt: 1,
      maxAttempts: 1,
      verdict: 'allow',
      createdAt: '2026-04-26T00:00:00.000Z',
      updatedAt: '2026-04-26T00:00:00.000Z',
      metadata: {}
    }))
  };
}

function createAutoReviewServiceMock(options: { verdict: 'allow' | 'warn' | 'block'; reviewId: string }) {
  return {
    createReview: vi.fn(body => ({
      reviewId: options.reviewId,
      sessionId: (body as { sessionId?: string }).sessionId,
      taskId: (body as { taskId: string }).taskId,
      requestId: (body as { requestId?: string }).requestId,
      kind: 'tool_execution',
      status: options.verdict === 'block' ? 'blocked' : options.verdict === 'warn' ? 'warnings' : 'passed',
      verdict: options.verdict,
      summary: 'Auto review completed.',
      findings: [],
      evidenceIds: [],
      artifactIds: [],
      sandboxRunId: (body as { sandboxRunId?: string }).sandboxRunId,
      approval:
        options.verdict === 'block'
          ? {
              approvalId: `approval_${options.reviewId}`,
              interruptId: `interrupt_${options.reviewId}`,
              resumeEndpoint: `/api/auto-review/reviews/${options.reviewId}/approval`
            }
          : undefined,
      createdAt: '2026-04-26T00:00:00.000Z',
      updatedAt: '2026-04-26T00:00:00.000Z',
      completedAt: '2026-04-26T00:00:00.000Z',
      metadata: {}
    })),
    resumeApproval: vi.fn((reviewId: string) => ({
      reviewId,
      taskId: 'task-approval-sync',
      kind: 'tool_execution',
      status: 'warnings',
      verdict: 'warn',
      summary: 'Auto review approved.',
      findings: [],
      evidenceIds: [],
      artifactIds: [],
      createdAt: '2026-04-26T00:00:00.000Z',
      updatedAt: '2026-04-26T00:00:00.000Z',
      completedAt: '2026-04-26T00:00:00.000Z',
      metadata: {}
    }))
  };
}
