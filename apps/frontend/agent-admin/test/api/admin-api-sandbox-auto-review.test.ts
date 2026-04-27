import { describe, expect, it, vi } from 'vitest';

import {
  cancelSandboxRun,
  createAutoReview,
  executeSandboxCommand,
  getAutoReview,
  getSandboxRun,
  listAutoReviews,
  listSandboxProfiles,
  preflightSandboxRun,
  rerunAutoReview,
  resumeAutoReviewApproval,
  resumeSandboxRunApproval
} from '@/api/admin-api';

const sandboxProfile = {
  profile: 'workspace-write',
  label: 'Workspace write',
  summary: 'Can write inside controlled workspace roots'
};

const sandboxRun = {
  runId: 'run-1',
  taskId: 'task-1',
  profile: 'workspace-write',
  stage: 'preflight',
  status: 'running',
  attempt: 1,
  maxAttempts: 2,
  verdict: 'unknown',
  createdAt: '2026-04-26T00:00:00.000Z',
  updatedAt: '2026-04-26T00:00:00.000Z'
};

const autoReview = {
  reviewId: 'review-1',
  taskId: 'task-1',
  kind: 'code_change',
  status: 'blocked',
  verdict: 'block',
  summary: 'Blocked by a finding',
  findings: [],
  evidenceIds: [],
  artifactIds: [],
  gate: {
    gateId: 'gate-1',
    status: 'blocked',
    decision: 'block',
    reasonCode: 'blocker_finding',
    requiresApproval: true
  },
  reviewer: {
    reviewerId: 'rule-based-reviewer',
    reviewerKind: 'rule_based',
    displayName: 'Rule based reviewer',
    version: '2026-04-26'
  },
  createdAt: '2026-04-26T00:00:00.000Z',
  updatedAt: '2026-04-26T00:00:00.000Z'
};

describe('admin sandbox and auto review api helpers', () => {
  it('builds sandbox facade requests and validates returned records', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce([sandboxProfile])
      .mockResolvedValueOnce({
        decision: 'require_approval',
        reasonCode: 'host_profile',
        reason: 'Host profile requires approval',
        profile: 'host',
        normalizedPermissionScope: {},
        requiresApproval: true
      })
      .mockResolvedValueOnce(sandboxRun)
      .mockResolvedValueOnce({ ...sandboxRun, status: 'cancelled' })
      .mockResolvedValueOnce({ ...sandboxRun, status: 'passed', verdict: 'allow' })
      .mockResolvedValueOnce({ ...sandboxRun, stage: 'execute', status: 'passed', exitCode: 0 });

    await expect(listSandboxProfiles(fetcher)).resolves.toEqual([sandboxProfile]);
    await expect(
      preflightSandboxRun(
        {
          taskId: 'task-1',
          toolName: 'terminal.run',
          profile: 'host',
          riskClass: 'high'
        },
        fetcher
      )
    ).resolves.toMatchObject({ decision: 'require_approval', profile: 'host' });
    await expect(getSandboxRun('run/1', fetcher)).resolves.toEqual(sandboxRun);
    await expect(cancelSandboxRun('run/1', { actor: 'human', reason: 'stop' }, fetcher)).resolves.toMatchObject({
      status: 'cancelled'
    });
    await expect(
      resumeSandboxRunApproval(
        'run/1',
        {
          sessionId: 'session-1',
          interrupt: { action: 'approve', runId: 'run/1' },
          actor: 'human'
        },
        fetcher
      )
    ).resolves.toMatchObject({ status: 'passed', verdict: 'allow' });
    await expect(
      executeSandboxCommand(
        {
          taskId: 'task-1',
          command: 'pnpm test',
          profile: 'workspace-write',
          timeoutMs: 30_000
        },
        fetcher
      )
    ).resolves.toMatchObject({ stage: 'execute', status: 'passed' });

    expect(fetcher).toHaveBeenNthCalledWith(1, '/sandbox/profiles');
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      '/sandbox/preflight',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          taskId: 'task-1',
          toolName: 'terminal.run',
          profile: 'host',
          riskClass: 'high'
        })
      })
    );
    expect(fetcher).toHaveBeenNthCalledWith(3, '/sandbox/runs/run%2F1');
    expect(fetcher).toHaveBeenNthCalledWith(
      4,
      '/sandbox/runs/run%2F1/cancel',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ actor: 'human', reason: 'stop' }) })
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      5,
      '/sandbox/runs/run%2F1/approval',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'session-1',
          interrupt: { action: 'approve', runId: 'run/1' },
          actor: 'human'
        })
      })
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      6,
      '/sandbox/execute',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          taskId: 'task-1',
          command: 'pnpm test',
          profile: 'workspace-write',
          timeoutMs: 30_000
        })
      })
    );
  });

  it('builds auto review facade requests, encodes filters and validates returned records', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(autoReview)
      .mockResolvedValueOnce([autoReview])
      .mockResolvedValueOnce(autoReview)
      .mockResolvedValueOnce({ ...autoReview, summary: 'Rerun completed' })
      .mockResolvedValueOnce({ ...autoReview, status: 'passed', verdict: 'allow' });

    const createdReview = await createAutoReview(
      {
        taskId: 'task-1',
        requestId: 'request/1',
        kind: 'code_change',
        target: { type: 'diff', summary: 'BLOCKER in diff' }
      },
      fetcher
    );
    expect(createdReview).toMatchObject({
      gate: {
        gateId: 'gate-1',
        decision: 'block',
        requiresApproval: true
      },
      reviewer: {
        reviewerId: 'rule-based-reviewer',
        reviewerKind: 'rule_based'
      }
    });
    await expect(
      listAutoReviews(
        {
          sessionId: 'session 1',
          taskId: 'task/1',
          requestId: 'request/1',
          kind: 'code_change',
          verdict: 'block'
        },
        fetcher
      )
    ).resolves.toEqual([autoReview]);
    await expect(getAutoReview('review/1', fetcher)).resolves.toEqual(autoReview);
    await expect(
      rerunAutoReview('review/1', { actor: 'human', reason: 'fixed', includeEvidenceIds: ['evidence-1'] }, fetcher)
    ).resolves.toMatchObject({ summary: 'Rerun completed' });
    await expect(
      resumeAutoReviewApproval(
        'review/1',
        {
          sessionId: 'session-1',
          interrupt: { action: 'approve', reviewId: 'review/1' },
          actor: 'human'
        },
        fetcher
      )
    ).resolves.toMatchObject({ status: 'passed', verdict: 'allow' });

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      '/auto-review/reviews',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          taskId: 'task-1',
          requestId: 'request/1',
          kind: 'code_change',
          target: { type: 'diff', summary: 'BLOCKER in diff' }
        })
      })
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      2,
      '/auto-review/reviews?sessionId=session+1&taskId=task%2F1&requestId=request%2F1&kind=code_change&verdict=block'
    );
    expect(fetcher).toHaveBeenNthCalledWith(3, '/auto-review/reviews/review%2F1');
    expect(fetcher).toHaveBeenNthCalledWith(
      4,
      '/auto-review/reviews/review%2F1/rerun',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ actor: 'human', reason: 'fixed', includeEvidenceIds: ['evidence-1'] })
      })
    );
    expect(fetcher).toHaveBeenNthCalledWith(
      5,
      '/auto-review/reviews/review%2F1/approval',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'session-1',
          interrupt: { action: 'approve', reviewId: 'review/1' },
          actor: 'human'
        })
      })
    );
  });

  it('throws clear contract errors and preserves request failures', async () => {
    await expect(listSandboxProfiles(vi.fn().mockResolvedValueOnce([{ label: 'missing profile' }]))).rejects.toThrow(
      'Sandbox profiles response did not match the expected contract'
    );
    await expect(
      getAutoReview('review-1', vi.fn().mockResolvedValueOnce({ ...autoReview, verdict: undefined }))
    ).rejects.toThrow('Auto review response did not match the expected contract');
    await expect(
      executeSandboxCommand({ taskId: 'task-1', command: 'pnpm test' }, vi.fn().mockResolvedValueOnce({}))
    ).rejects.toThrow('Sandbox run response did not match the expected contract');

    const upstreamError = new Error('Request failed: 409');
    await expect(cancelSandboxRun('run-1', {}, vi.fn().mockRejectedValueOnce(upstreamError))).rejects.toThrow(
      'Request failed: 409'
    );
  });

  it('removes raw vendor payload fields from sandbox and auto review records', async () => {
    const sandboxResult = await executeSandboxCommand(
      { taskId: 'task-1', command: 'pnpm test' },
      vi.fn().mockResolvedValueOnce({
        ...sandboxRun,
        rawVendorPayload: { tokenUsage: 42 },
        vendorPayload: { opaque: true }
      })
    );
    expect(sandboxResult).not.toHaveProperty('rawVendorPayload');
    expect(sandboxResult).not.toHaveProperty('vendorPayload');

    const reviewResult = await getAutoReview(
      'review-1',
      vi.fn().mockResolvedValueOnce({
        ...autoReview,
        rawVendorResponse: { providerTrace: 'hidden' },
        metadata: {
          rawProviderResponse: { opaque: true },
          safeCorrelationId: 'correlation-1'
        },
        reviewer: {
          ...autoReview.reviewer,
          rawVendorPayload: { modelTrace: 'hidden' }
        }
      })
    );
    expect(reviewResult).not.toHaveProperty('rawVendorResponse');
    expect(reviewResult.metadata).toEqual({ safeCorrelationId: 'correlation-1' });
    expect(reviewResult.reviewer).not.toHaveProperty('rawVendorPayload');
  });
});
