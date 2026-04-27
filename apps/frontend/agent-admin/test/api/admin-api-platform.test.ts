import { describe, expect, it, vi, beforeEach } from 'vitest';

const requestMock = vi.fn();

const now = '2026-04-26T00:00:00.000Z';

const validCapability = {
  capabilityId: 'cap-terminal-run',
  nodeId: 'node-local',
  toolName: 'terminal.run',
  category: 'terminal',
  riskClass: 'medium',
  requiresApproval: true
};

const validPolicyDecision = {
  decisionId: 'decision-1',
  requestId: 'request-1',
  decision: 'require_approval',
  reasonCode: 'high_risk_command',
  reason: 'Command requires approval',
  matchedPolicyIds: ['policy-1'],
  requiresApproval: true,
  riskClass: 'medium',
  createdAt: now
};

const validAgentToolProjection = {
  requests: [
    {
      requestId: 'request-1',
      taskId: 'task-1',
      sessionId: 'session-1',
      nodeId: 'node-local',
      capabilityId: 'cap-terminal-run',
      toolName: 'terminal.run',
      requestedBy: { actor: 'supervisor', actorId: 'supervisor-1' },
      inputPreview: 'pnpm test',
      riskClass: 'medium',
      policyDecision: validPolicyDecision,
      approvalId: 'approval-1',
      status: 'pending_approval',
      createdAt: now
    }
  ],
  results: [
    {
      resultId: 'result-1',
      requestId: 'request-1',
      taskId: 'task-1',
      nodeId: 'node-local',
      status: 'succeeded',
      outputPreview: 'ok',
      artifactIds: [],
      evidenceIds: [],
      durationMs: 42,
      createdAt: now
    }
  ],
  capabilities: [validCapability],
  nodes: [
    {
      nodeId: 'node-local',
      displayName: 'Local terminal',
      kind: 'local_terminal',
      status: 'available',
      sandboxMode: 'host',
      riskClass: 'medium',
      capabilities: [validCapability],
      permissionScope: {},
      health: { ok: true, checkedAt: now },
      createdAt: now,
      updatedAt: now
    }
  ],
  policyDecisions: [validPolicyDecision],
  events: [
    {
      id: 'event-1',
      sessionId: 'session-1',
      type: 'tool_called',
      at: now,
      payload: { requestId: 'request-1' }
    }
  ]
};

vi.mock('@/api/admin-api-core', () => ({
  request: (...args: unknown[]) => requestMock(...args)
}));

import {
  exportApprovalsCenter,
  exportEvalsCenter,
  exportRuntimeCenter,
  forceBriefingRun,
  getAgentToolExecutionProjection,
  getApprovalScopePolicies,
  getApprovalsCenter,
  getBrowserReplay,
  getBriefingRuns,
  getChannelDeliveries,
  getCompanyAgentsCenter,
  getConnectorsCenter,
  getEvalsCenter,
  getEvalsCenterFiltered,
  getEvidenceCenter,
  getLearningCenter,
  getPlatformConsoleLogAnalysis,
  getRunObservatory,
  getRunObservatoryDetail,
  getRuntimeArchitecture,
  getRuntimeCenter,
  getRuntimeCenterFiltered,
  getSkillSourcesCenter,
  getToolsCenter,
  getWorkflowPresets,
  recoverToCheckpoint,
  refreshMetricsSnapshots,
  revokeApprovalScopePolicy,
  submitBriefingFeedback
} from '@/api/admin-api-platform';

describe('admin-api-platform', () => {
  beforeEach(() => {
    requestMock.mockReset();
    requestMock.mockResolvedValue({});
  });

  it('builds runtime, approvals and export query strings with normalized execution mode', async () => {
    await getRuntimeCenter();
    await getRuntimeCenterFiltered({
      days: 14,
      status: 'running',
      model: 'gpt-5.4',
      pricingSource: 'provider',
      executionMode: 'imperial-direct',
      interactionKind: 'plan-question'
    });
    await getApprovalsCenter({
      executionMode: 'imperial-direct',
      interactionKind: 'approval'
    });
    await getRunObservatory({
      status: 'running',
      model: 'gpt-5.4-mini',
      pricingSource: 'estimated',
      executionMode: 'imperial-direct',
      interactionKind: 'approval',
      q: 'regression',
      hasInterrupt: true,
      hasFallback: false,
      hasRecoverableCheckpoint: true,
      limit: 25
    });
    await getRunObservatoryDetail('task-1');
    await exportRuntimeCenter({
      days: 7,
      executionMode: 'imperial-direct',
      interactionKind: 'plan-question',
      format: 'json'
    });
    await exportApprovalsCenter({
      executionMode: 'imperial-direct',
      interactionKind: 'approval',
      format: 'json'
    });

    expect(requestMock).toHaveBeenNthCalledWith(
      1,
      '/platform/runtime-center?days=30',
      expect.objectContaining({ cancelKey: 'runtime-center', cancelPrevious: true })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      2,
      '/platform/runtime-center?days=14&status=running&model=gpt-5.4&pricingSource=provider&executionMode=imperial-direct&interactionKind=plan-question',
      expect.objectContaining({ cancelKey: 'runtime-center', cancelPrevious: true })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      3,
      '/platform/approvals-center?executionMode=imperial-direct&interactionKind=approval',
      expect.objectContaining({ cancelKey: 'approvals-center', cancelPrevious: true })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      4,
      '/platform/run-observatory?status=running&model=gpt-5.4-mini&pricingSource=estimated&executionMode=imperial-direct&interactionKind=approval&q=regression&hasInterrupt=true&hasFallback=false&hasRecoverableCheckpoint=true&limit=25',
      expect.objectContaining({ cancelKey: 'run-observatory', cancelPrevious: true })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      5,
      '/platform/run-observatory/task-1',
      expect.objectContaining({ cancelKey: 'run-observatory:task-1', cancelPrevious: true })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      6,
      '/platform/runtime-center/export?days=7&executionMode=imperial-direct&interactionKind=plan-question&format=json'
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      7,
      '/platform/approvals-center/export?executionMode=imperial-direct&interactionKind=approval&format=json'
    );
  });

  it('covers center fetchers, eval exports, replay and recovery mutations', async () => {
    await getApprovalScopePolicies();
    await revokeApprovalScopePolicy('policy/1');
    await getLearningCenter();
    await getEvidenceCenter();
    await recoverToCheckpoint({
      sessionId: 'session-1',
      checkpointCursor: 2,
      checkpointId: 'cp-1',
      reason: '回滚验证'
    });
    await getBrowserReplay('session-1');
    await getChannelDeliveries();
    await getConnectorsCenter();
    await getToolsCenter();
    await getAgentToolExecutionProjection();
    await getRuntimeArchitecture();
    await getWorkflowPresets();
    await getBriefingRuns({ days: 7, category: 'general-security' });
    await forceBriefingRun('backend-tech');
    await submitBriefingFeedback({
      messageKey: 'general-security:postgres',
      category: 'general-security',
      feedbackType: 'helpful',
      reasonTag: 'useful-actionable'
    });
    await getSkillSourcesCenter();
    await getCompanyAgentsCenter();
    await getEvalsCenter();
    await getEvalsCenterFiltered({ days: 10, scenarioId: 'scenario-1', outcome: 'passed' });
    await getPlatformConsoleLogAnalysis(7);
    await refreshMetricsSnapshots(14);
    await exportEvalsCenter({ days: 10, scenarioId: 'scenario-1', outcome: 'passed', format: 'json' });

    expect(requestMock).toHaveBeenNthCalledWith(
      1,
      '/platform/approval-policies',
      expect.objectContaining({ cancelKey: 'approval-policies', cancelPrevious: true })
    );
    expect(requestMock).toHaveBeenNthCalledWith(2, '/platform/approval-policies/policy%2F1/revoke', {
      method: 'POST'
    });
    expect(requestMock).toHaveBeenNthCalledWith(
      5,
      '/chat/recover-to-checkpoint',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          sessionId: 'session-1',
          checkpointCursor: 2,
          checkpointId: 'cp-1',
          reason: '回滚验证'
        })
      })
    );
    expect(requestMock).toHaveBeenNthCalledWith(6, '/platform/browser-replays/session-1');
    expect(requestMock).toHaveBeenNthCalledWith(
      12,
      '/platform/workflow-presets',
      expect.objectContaining({ cancelKey: 'workflow-presets', cancelPrevious: true })
    );
    expect(requestMock).toHaveBeenNthCalledWith(13, '/platform/briefings/runs?days=7&category=general-security');
    expect(requestMock).toHaveBeenNthCalledWith(14, '/platform/briefings/backend-tech/force-run', {
      method: 'POST'
    });
    expect(requestMock).toHaveBeenNthCalledWith(
      15,
      '/platform/briefings/feedback',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          messageKey: 'general-security:postgres',
          category: 'general-security',
          feedbackType: 'helpful',
          reasonTag: 'useful-actionable'
        })
      })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      18,
      '/platform/evals-center?days=30',
      expect.objectContaining({ cancelKey: 'evals-center', cancelPrevious: true })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      19,
      '/platform/evals-center?days=10&scenarioId=scenario-1&outcome=passed',
      expect.objectContaining({ cancelKey: 'evals-center', cancelPrevious: true })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      20,
      '/platform/console/log-analysis?days=7',
      expect.objectContaining({ cancelKey: 'platform-console-log-analysis', cancelPrevious: true })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      21,
      '/platform/console/refresh-metrics?days=14',
      expect.objectContaining({ method: 'POST' })
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      22,
      '/platform/evals-center/export?days=10&scenarioId=scenario-1&outcome=passed&format=json'
    );
    expect(requestMock).toHaveBeenNthCalledWith(
      10,
      '/agent-tools/projection',
      expect.objectContaining({ cancelKey: 'agent-tool-execution-projection', cancelPrevious: true })
    );
  });

  it('parses the agent tool execution projection contract before returning it', async () => {
    requestMock.mockResolvedValueOnce(validAgentToolProjection);

    await expect(
      getAgentToolExecutionProjection({
        requestId: 'request-1',
        taskId: 'task-1',
        sessionId: 'session-1'
      })
    ).resolves.toEqual(validAgentToolProjection);

    expect(requestMock).toHaveBeenCalledWith(
      '/agent-tools/projection?requestId=request-1&taskId=task-1&sessionId=session-1',
      expect.objectContaining({ cancelKey: 'agent-tool-execution-projection', cancelPrevious: true })
    );
  });

  it('throws a clear contract error when the agent tool projection contains an invalid request payload', async () => {
    requestMock.mockResolvedValueOnce({
      ...validAgentToolProjection,
      requests: [{ ...validAgentToolProjection.requests[0], status: 'not-a-status' }]
    });

    await expect(getAgentToolExecutionProjection()).rejects.toThrow(
      'Agent tool execution projection response did not match the expected contract'
    );
  });

  it('throws a clear contract error when the agent tool projection contains invalid events', async () => {
    requestMock.mockResolvedValueOnce({
      ...validAgentToolProjection,
      events: [{ ...validAgentToolProjection.events[0], type: 'not-an-event' }]
    });

    await expect(getAgentToolExecutionProjection()).rejects.toThrow(
      'Agent tool execution projection response did not match the expected contract'
    );
  });
});
