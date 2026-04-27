import { ChatEventRecordSchema } from '@agent/core';
import { describe, expect, it, vi } from 'vitest';

import { AgentToolsRepository } from '../../src/agent-tools/agent-tools.repository';
import { AgentToolsService } from '../../src/agent-tools/agent-tools.service';
import { AutoReviewRepository } from '../../src/auto-review/auto-review.repository';
import { AutoReviewService } from '../../src/auto-review/auto-review.service';
import { SandboxRepository } from '../../src/sandbox/sandbox.repository';
import { SandboxService } from '../../src/sandbox/sandbox.service';

describe('AgentToolsService sandbox and auto-review integration', () => {
  it('projects low-risk sandbox and auto-review allow metadata without leaking raw payloads', () => {
    const { service } = createIntegratedService();

    const response = service.createRequest({
      sessionId: 'session-integration-allow',
      taskId: 'task-integration-allow',
      capabilityId: 'capability.filesystem.read_local_file',
      toolName: 'read_local_file',
      requestedBy: { actor: 'runtime', actorId: 'runtime-integration' },
      input: {
        path: 'README.md',
        vendor: { raw: 'must not leak' },
        rawOutput: 'must not leak'
      },
      inputPreview: 'Read README.md',
      riskClass: 'low',
      metadata: {
        vendor: { raw: 'must not leak' },
        rawOutput: 'must not leak'
      }
    });

    const events = service.listEvents(response.request.requestId);

    expect(response.request.status).toBe('succeeded');
    expect(response.request.metadata).toEqual(
      expect.objectContaining({
        sandboxRunId: expect.stringMatching(/^sandbox_run_/),
        sandboxDecision: 'allow',
        sandboxProfile: 'workspace-readonly',
        autoReviewId: expect.stringMatching(/^review_/),
        autoReviewVerdict: 'allow'
      })
    );
    expect(() => ChatEventRecordSchema.array().parse(events)).not.toThrow();
    expect(events.map(event => event.type)).toEqual([
      'tool_selected',
      'tool_called',
      'tool_called',
      'execution_step_started',
      'execution_step_completed',
      'tool_stream_completed'
    ]);
    for (const event of events) {
      expect(event.payload).toEqual(
        expect.not.objectContaining({
          input: expect.anything(),
          rawOutput: expect.anything(),
          vendor: expect.anything()
        })
      );
    }
    expect(events[1].payload).toEqual(
      expect.objectContaining({
        sandboxRunId: response.request.metadata?.sandboxRunId,
        sandboxDecision: 'allow',
        sandboxProfile: 'workspace-readonly',
        autoReviewId: response.request.metadata?.autoReviewId,
        autoReviewVerdict: 'allow'
      })
    );
    expect(events[4].payload).toEqual(
      expect.objectContaining({
        sandboxRunId: response.request.metadata?.sandboxRunId,
        sandboxDecision: 'allow',
        sandboxProfile: 'workspace-readonly',
        autoReviewId: response.request.metadata?.autoReviewId,
        autoReviewVerdict: 'allow'
      })
    );
  });

  it('keeps auto-review block requests pending until approval resume drains the execution queue', () => {
    const { service, sandboxService, autoReviewService } = createIntegratedService();
    const sandboxResumeSpy = vi.spyOn(sandboxService, 'resumeApproval');
    const autoReviewResumeSpy = vi.spyOn(autoReviewService, 'resumeApproval');

    const pending = service.createRequest({
      sessionId: 'session-integration-review-block',
      taskId: 'task-integration-review-block',
      capabilityId: 'capability.filesystem.read_local_file',
      toolName: 'read_local_file',
      requestedBy: { actor: 'runtime' },
      input: { path: 'README.md' },
      inputPreview: 'Read README.md with SECRET marker',
      riskClass: 'low'
    });

    expect(pending.request.status).toBe('pending_approval');
    expect(pending.policyDecision).toEqual(
      expect.objectContaining({
        decision: 'require_approval',
        requiresApproval: true,
        reasonCode: 'auto_review_blocked'
      })
    );

    const approved = service.resumeApproval(pending.request.requestId, {
      sessionId: 'session-integration-review-block',
      actor: 'human',
      reason: 'operator accepted the auto-review block',
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
        autoReviewVerdict: 'block',
        approvalAction: 'approve',
        executorQueue: expect.objectContaining({
          drainMode: 'synchronous',
          transitions: ['queued', 'running', 'succeeded']
        })
      })
    );
    expect(sandboxResumeSpy).not.toHaveBeenCalled();
    expect(autoReviewResumeSpy).toHaveBeenCalledWith(
      pending.request.metadata?.autoReviewId,
      expect.objectContaining({
        actor: 'human',
        reason: 'operator accepted the auto-review block',
        interrupt: expect.objectContaining({
          action: 'approve',
          reviewId: pending.request.metadata?.autoReviewId,
          requestId: pending.request.requestId
        })
      })
    );
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
  });

  it('does not enter auto-review when sandbox preflight requires approval', () => {
    const sandboxService = createSandboxApprovalService();
    const autoReviewService = {
      createReview: vi.fn(body => ({
        reviewId: 'review_should_not_run',
        sessionId: (body as { sessionId?: string }).sessionId,
        taskId: (body as { taskId: string }).taskId,
        requestId: (body as { requestId?: string }).requestId,
        kind: 'tool_execution',
        status: 'blocked',
        verdict: 'block',
        summary: 'Auto review should not run after sandbox approval is required.',
        findings: [],
        evidenceIds: [],
        artifactIds: [],
        sandboxRunId: (body as { sandboxRunId?: string }).sandboxRunId,
        approval: {
          approvalId: 'approval_review_should_not_run',
          interruptId: 'interrupt_review_should_not_run',
          resumeEndpoint: '/api/auto-review/reviews/review_should_not_run/approval'
        },
        createdAt: '2026-04-26T00:00:00.000Z',
        updatedAt: '2026-04-26T00:00:00.000Z',
        completedAt: '2026-04-26T00:00:00.000Z',
        metadata: {}
      })),
      resumeApproval: vi.fn()
    };
    const service = new AgentToolsService(
      new AgentToolsRepository(),
      sandboxService as never,
      autoReviewService as never
    );

    const pending = service.createRequest({
      sessionId: 'session-integration-sandbox-approval',
      taskId: 'task-integration-sandbox-approval',
      capabilityId: 'capability.filesystem.read_local_file',
      toolName: 'read_local_file',
      requestedBy: { actor: 'runtime' },
      input: { path: 'README.md' },
      inputPreview: 'Read README.md with SECRET marker',
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
        sandboxRunId: 'sandbox_run_requires_approval',
        sandboxDecision: 'require_approval',
        sandboxProfile: 'workspace-readonly'
      })
    );
    expect(pending.request.metadata).not.toHaveProperty('autoReviewId');
    expect(pending.request.metadata).not.toHaveProperty('autoReviewVerdict');
    expect(autoReviewService.createReview).not.toHaveBeenCalled();
    expect(service.listEvents(pending.request.requestId).map(event => event.type)).toEqual([
      'tool_selected',
      'tool_called',
      'execution_step_blocked',
      'interrupt_pending'
    ]);
  });
});

function createIntegratedService() {
  const sandboxService = new SandboxService(new SandboxRepository());
  const autoReviewService = new AutoReviewService(new AutoReviewRepository());
  const service = new AgentToolsService(new AgentToolsRepository(), sandboxService, autoReviewService);
  return { service, sandboxService, autoReviewService };
}

function createSandboxApprovalService() {
  return {
    preflight: vi.fn(body => ({
      decision: 'require_approval',
      reasonCode: 'sandbox_approval_required',
      reason: 'Sandbox profile or risk class requires approval before continuing.',
      profile: (body as { profile: string }).profile,
      normalizedPermissionScope: {
        allowedPaths: [],
        deniedPaths: [],
        allowedHosts: [],
        deniedHosts: [],
        allowedCommands: [],
        deniedCommands: []
      },
      requiresApproval: true,
      run: {
        runId: 'sandbox_run_requires_approval',
        requestId: (body as { requestId?: string }).requestId,
        taskId: (body as { taskId: string }).taskId,
        sessionId: (body as { sessionId?: string }).sessionId,
        profile: (body as { profile: string }).profile,
        stage: 'preflight',
        status: 'blocked',
        attempt: 1,
        maxAttempts: 1,
        verdict: 'block',
        createdAt: '2026-04-26T00:00:00.000Z',
        updatedAt: '2026-04-26T00:00:00.000Z',
        metadata: {}
      },
      approval: {
        approvalId: 'approval_sandbox_run_requires_approval',
        interruptId: 'interrupt_sandbox_run_requires_approval',
        resumeEndpoint: '/api/sandbox/runs/sandbox_run_requires_approval/approval'
      }
    })),
    resumeApproval: vi.fn()
  };
}
