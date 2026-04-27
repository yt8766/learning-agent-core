import { describe, expect, it } from 'vitest';

import {
  buildAgentToolExecutionGovernanceBadges,
  summarizeAgentToolExecutions
} from '@/features/runtime-overview/components/runtime-agent-tool-execution-projections';

describe('runtime agent tool execution projections', () => {
  it('summarizes agent-tools contract records for governance dashboards', () => {
    const summary = summarizeAgentToolExecutions({
      requests: [
        {
          id: 'req-approval',
          taskId: 'task-1',
          toolName: 'browser.open',
          nodeId: 'node-browser',
          capabilityId: 'cap-browser-open',
          status: 'pending_approval',
          riskClass: 'high',
          policyDecisionId: 'decision-approval',
          requestedAt: '2026-04-26T09:00:00.000Z'
        },
        {
          id: 'req-running',
          taskId: 'task-2',
          toolName: 'terminal.exec',
          nodeId: 'node-terminal',
          capabilityId: 'cap-terminal-exec',
          status: 'running',
          riskClass: 'critical',
          requestedAt: '2026-04-26T09:01:00.000Z'
        },
        {
          id: 'req-success',
          taskId: 'task-3',
          toolName: 'github.search_code',
          nodeId: 'node-mcp',
          capabilityId: 'cap-github-search',
          status: 'running',
          riskClass: 'medium',
          requestedAt: '2026-04-26T09:02:00.000Z'
        },
        {
          id: 'req-failed',
          taskId: 'task-4',
          toolName: 'filesystem.write',
          nodeId: 'node-filesystem',
          capabilityId: 'cap-filesystem-write',
          status: 'failed',
          riskClass: 'high',
          requestedAt: '2026-04-26T09:03:00.000Z'
        },
        {
          id: 'req-cancelled',
          taskId: 'task-5',
          toolName: 'terminal.exec',
          nodeId: 'node-terminal',
          capabilityId: 'cap-terminal-exec',
          status: 'cancelled',
          riskClass: 'critical',
          requestedAt: '2026-04-26T09:04:00.000Z'
        }
      ],
      results: [
        {
          id: 'result-success',
          requestId: 'req-success',
          status: 'succeeded',
          completedAt: '2026-04-26T09:03:00.000Z'
        },
        {
          id: 'result-failed',
          requestId: 'req-failed',
          status: 'failed',
          completedAt: '2026-04-26T09:04:00.000Z'
        },
        {
          id: 'result-cancelled',
          requestId: 'req-cancelled',
          status: 'cancelled',
          completedAt: '2026-04-26T09:05:00.000Z'
        }
      ],
      capabilities: [
        {
          id: 'cap-browser-open',
          toolName: 'browser.open',
          nodeId: 'node-browser',
          displayName: 'Open browser',
          riskClass: 'high',
          requiresApproval: true
        },
        {
          id: 'cap-terminal-exec',
          toolName: 'terminal.exec',
          nodeId: 'node-terminal',
          displayName: 'Run command',
          riskClass: 'critical',
          requiresApproval: true
        }
      ],
      nodes: [
        {
          id: 'node-browser',
          displayName: 'Browser node',
          status: 'available',
          riskClass: 'high'
        },
        {
          id: 'node-terminal',
          displayName: 'Terminal node',
          status: 'available',
          riskClass: 'critical'
        }
      ],
      policyDecisions: [
        {
          id: 'decision-approval',
          requestId: 'req-approval',
          decision: 'require_approval',
          riskClass: 'high',
          reason: 'Browser navigation needs review'
        }
      ]
    });

    expect(summary.totals).toEqual({
      total: 5,
      pendingApproval: 1,
      running: 1,
      succeeded: 1,
      failed: 1,
      cancelled: 1
    });
    expect(summary.byRiskClass).toEqual([
      { riskClass: 'critical', total: 2, pendingApproval: 0, running: 1, succeeded: 0, failed: 0, cancelled: 1 },
      { riskClass: 'high', total: 2, pendingApproval: 1, running: 0, succeeded: 0, failed: 1, cancelled: 0 },
      { riskClass: 'medium', total: 1, pendingApproval: 0, running: 0, succeeded: 1, failed: 0, cancelled: 0 }
    ]);
    expect(summary.byNode).toEqual([
      {
        nodeId: 'node-terminal',
        nodeLabel: 'Terminal node',
        total: 2,
        pendingApproval: 0,
        running: 1,
        succeeded: 0,
        failed: 0,
        cancelled: 1
      },
      {
        nodeId: 'node-browser',
        nodeLabel: 'Browser node',
        total: 1,
        pendingApproval: 1,
        running: 0,
        succeeded: 0,
        failed: 0,
        cancelled: 0
      },
      {
        nodeId: 'node-filesystem',
        nodeLabel: 'node-filesystem',
        total: 1,
        pendingApproval: 0,
        running: 0,
        succeeded: 0,
        failed: 1,
        cancelled: 0
      },
      {
        nodeId: 'node-mcp',
        nodeLabel: 'node-mcp',
        total: 1,
        pendingApproval: 0,
        running: 0,
        succeeded: 1,
        failed: 0,
        cancelled: 0
      }
    ]);
    expect(summary.policyDecisions).toEqual([
      {
        id: 'decision-approval',
        requestId: 'req-approval',
        decision: 'require_approval',
        riskClass: 'high',
        reason: 'Browser navigation needs review'
      }
    ]);
    expect(summary.capabilityCount).toBe(2);
    expect(summary.requestQueue).toEqual([
      {
        requestId: 'req-cancelled',
        taskId: 'task-5',
        toolName: 'terminal.exec',
        nodeId: 'node-terminal',
        nodeLabel: 'Terminal node',
        status: 'cancelled',
        riskClass: 'critical',
        at: '2026-04-26T09:04:00.000Z'
      },
      {
        requestId: 'req-failed',
        taskId: 'task-4',
        toolName: 'filesystem.write',
        nodeId: 'node-filesystem',
        nodeLabel: 'node-filesystem',
        status: 'failed',
        riskClass: 'high',
        at: '2026-04-26T09:03:00.000Z'
      },
      {
        requestId: 'req-success',
        taskId: 'task-3',
        toolName: 'github.search_code',
        nodeId: 'node-mcp',
        nodeLabel: 'node-mcp',
        status: 'succeeded',
        riskClass: 'medium',
        at: '2026-04-26T09:02:00.000Z'
      },
      {
        requestId: 'req-running',
        taskId: 'task-2',
        toolName: 'terminal.exec',
        nodeId: 'node-terminal',
        nodeLabel: 'Terminal node',
        status: 'running',
        riskClass: 'critical',
        at: '2026-04-26T09:01:00.000Z'
      },
      {
        requestId: 'req-approval',
        taskId: 'task-1',
        toolName: 'browser.open',
        nodeId: 'node-browser',
        nodeLabel: 'Browser node',
        status: 'pending_approval',
        riskClass: 'high',
        at: '2026-04-26T09:00:00.000Z'
      }
    ]);
  });

  it('accepts core execution contract field names without raw task inference', () => {
    const summary = summarizeAgentToolExecutions({
      requests: [
        {
          requestId: 'request-core-1',
          taskId: 'task-core-1',
          toolName: 'read_local_file',
          nodeId: 'node-local',
          capabilityId: 'capability.filesystem.read_local_file',
          status: 'running',
          riskClass: 'low',
          createdAt: '2026-04-26T10:00:00.000Z'
        }
      ],
      results: [
        {
          resultId: 'result-core-1',
          requestId: 'request-core-1',
          status: 'succeeded',
          createdAt: '2026-04-26T10:00:01.000Z'
        }
      ],
      capabilities: [
        {
          capabilityId: 'capability.filesystem.read_local_file',
          toolName: 'read_local_file',
          nodeId: 'node-local',
          displayName: 'Read local file',
          riskClass: 'low',
          requiresApproval: false
        }
      ],
      nodes: [
        {
          nodeId: 'node-local',
          displayName: 'Local node',
          status: 'available',
          riskClass: 'low'
        }
      ],
      policyDecisions: [
        {
          decisionId: 'decision-core-1',
          requestId: 'request-core-1',
          decision: 'allow',
          riskClass: 'low',
          reason: 'low risk'
        }
      ]
    });

    expect(summary.totals).toEqual({
      total: 1,
      pendingApproval: 0,
      running: 0,
      succeeded: 1,
      failed: 0,
      cancelled: 0
    });
    expect(summary.byNode).toEqual([
      {
        nodeId: 'node-local',
        nodeLabel: 'Local node',
        total: 1,
        pendingApproval: 0,
        running: 0,
        succeeded: 1,
        failed: 0,
        cancelled: 0
      }
    ]);
    expect(summary.policyDecisions[0]).toEqual(expect.objectContaining({ requestId: 'request-core-1' }));
    expect(summary.capabilityCount).toBe(1);
  });

  it('projects sandbox and auto-review metadata into request governance badges', () => {
    const summary = summarizeAgentToolExecutions({
      requests: [
        {
          requestId: 'request-governance-1',
          taskId: 'task-governance-1',
          toolName: 'terminal.exec',
          nodeId: 'node-terminal',
          status: 'pending_approval',
          riskClass: 'critical',
          requestedAt: '2026-04-26T10:10:00.000Z',
          metadata: {
            sandboxRunId: 'sandbox-run-42',
            sandboxDecision: 'requires_review',
            sandboxProfile: 'workspace-write',
            sandboxProviderId: 'local-sandbox',
            sandboxExitCode: '0',
            autoReviewId: 'review-42',
            autoReviewVerdict: 'changes_requested',
            autoReviewGateDecision: 'hold',
            autoReviewReviewerKind: 'codex',
            rawInput: 'SECRET_RAW_INPUT'
          }
        } as any
      ]
    });

    expect(summary.requestQueue[0]).toEqual(
      expect.objectContaining({
        requestId: 'request-governance-1',
        governanceBadges: [
          'sandbox sandbox-run-42',
          'sandbox decision requires_review',
          'sandbox profile workspace-write',
          'sandbox provider local-sandbox',
          'sandbox exit 0',
          'review review-42',
          'review verdict changes_requested',
          'review gate hold',
          'reviewer codex'
        ]
      })
    );
    expect(JSON.stringify(summary.requestQueue[0])).not.toContain('SECRET_RAW_INPUT');
  });

  it('merges sandbox and auto-review governance badges from request, result, and event metadata', () => {
    const summary = summarizeAgentToolExecutions({
      requests: [
        {
          requestId: 'request-governance-merged',
          taskId: 'task-governance-merged',
          toolName: 'terminal.exec',
          nodeId: 'node-terminal',
          status: 'running',
          riskClass: 'critical',
          requestedAt: '2026-04-26T10:30:00.000Z',
          metadata: {
            sandboxRunId: 'sandbox-run-merged',
            sandboxDecision: 'requires_review',
            rawInput: 'SECRET_REQUEST_RAW_INPUT',
            stdout: 'SECRET_REQUEST_STDOUT'
          }
        } as any
      ],
      results: [
        {
          resultId: 'result-governance-merged',
          requestId: 'request-governance-merged',
          status: 'failed',
          createdAt: '2026-04-26T10:31:00.000Z',
          metadata: {
            sandboxExitCode: 137,
            autoReviewVerdict: 'blocked',
            rawOutput: 'SECRET_RESULT_RAW_OUTPUT',
            stderr: 'SECRET_RESULT_STDERR'
          }
        } as any
      ],
      events: [
        {
          id: 'event-governance-merged',
          sessionId: 'session-1',
          type: 'execution_step_blocked',
          at: '2026-04-26T10:32:00.000Z',
          payload: {
            requestId: 'request-governance-merged',
            toolName: 'terminal.exec',
            reasonCode: 'auto_review_required',
            metadata: {
              sandboxProfile: 'workspace-write',
              sandboxProviderId: 'local-sandbox',
              autoReviewId: 'review-merged',
              autoReviewGateDecision: 'hold',
              autoReviewReviewerKind: 'ai-reviewer',
              providerPayload: 'SECRET_EVENT_PROVIDER_PAYLOAD'
            }
          }
        } as any
      ]
    });

    expect(summary.requestQueue[0]).toEqual(
      expect.objectContaining({
        requestId: 'request-governance-merged',
        status: 'failed',
        governanceBadges: [
          'sandbox sandbox-run-merged',
          'sandbox decision requires_review',
          'sandbox profile workspace-write',
          'sandbox provider local-sandbox',
          'sandbox exit 137',
          'review review-merged',
          'review verdict blocked',
          'review gate hold',
          'reviewer ai-reviewer'
        ]
      })
    );
    expect(JSON.stringify(summary)).not.toContain('SECRET_');
  });

  it('ignores non-whitelisted, empty, and non-string metadata when building governance badges', () => {
    expect(
      buildAgentToolExecutionGovernanceBadges({
        sandboxRunId: 'sandbox-run-42',
        sandboxDecision: '',
        sandboxProfile: 123,
        sandboxProviderId: 'local-sandbox',
        sandboxExitCode: '0',
        autoReviewId: 'review-42',
        autoReviewVerdict: { verdict: 'approved' },
        autoReviewGateDecision: 'allow',
        autoReviewReviewerKind: 'static-reviewer',
        rawInput: 'SECRET_RAW_INPUT',
        input: 'SECRET_INPUT',
        rawOutput: 'SECRET_RAW_OUTPUT',
        stdout: 'SECRET_STDOUT',
        stderr: 'SECRET_STDERR',
        providerPayload: 'SECRET_PROVIDER_PAYLOAD',
        vendorObject: { token: 'SECRET_VENDOR_OBJECT' },
        vendorResponse: 'SECRET_VENDOR_RESPONSE',
        providerResponse: 'SECRET_PROVIDER_RESPONSE'
      })
    ).toEqual([
      'sandbox sandbox-run-42',
      'sandbox provider local-sandbox',
      'sandbox exit 0',
      'review review-42',
      'review gate allow',
      'reviewer static-reviewer'
    ]);
  });

  it('does not expose malicious metadata through summary or policy decision display objects', () => {
    const summary = summarizeAgentToolExecutions({
      requests: [
        {
          requestId: 'request-sensitive',
          taskId: 'task-sensitive',
          toolName: 'terminal.exec',
          nodeId: 'node-terminal',
          status: 'pending_approval',
          riskClass: 'critical',
          requestedAt: '2026-04-26T10:20:00.000Z',
          metadata: {
            sandboxRunId: 'sandbox-run-99',
            sandboxDecision: 'requires_review',
            sandboxProfile: 'workspace-write',
            autoReviewId: 'review-99',
            autoReviewVerdict: 'approved',
            rawInput: 'SECRET_METADATA_RAW_INPUT',
            vendorResponse: 'SECRET_METADATA_VENDOR_RESPONSE'
          }
        } as any
      ],
      policyDecisions: [
        {
          decisionId: 'decision-sensitive',
          requestId: 'request-sensitive',
          decision: 'require_approval',
          riskClass: 'critical',
          reason: 'needs review',
          rawInput: 'SECRET_POLICY_RAW_INPUT',
          input: 'SECRET_POLICY_INPUT',
          rawOutput: 'SECRET_POLICY_RAW_OUTPUT',
          vendorObject: { token: 'SECRET_POLICY_VENDOR_OBJECT' },
          vendorResponse: 'SECRET_POLICY_VENDOR_RESPONSE',
          providerResponse: 'SECRET_POLICY_PROVIDER_RESPONSE'
        } as any
      ]
    });

    expect(summary.requestQueue[0]).toEqual(
      expect.objectContaining({
        governanceBadges: [
          'sandbox sandbox-run-99',
          'sandbox decision requires_review',
          'sandbox profile workspace-write',
          'review review-99',
          'review verdict approved'
        ]
      })
    );
    expect(summary.policyDecisions).toEqual([
      {
        decisionId: 'decision-sensitive',
        requestId: 'request-sensitive',
        decision: 'require_approval',
        riskClass: 'critical',
        reason: 'needs review'
      }
    ]);
    expect(JSON.stringify(summary)).not.toContain('SECRET_');
  });

  it('projects agent-tools event log blocked and resumed state without inferring from raw request state', () => {
    const summary = summarizeAgentToolExecutions({
      requests: [
        {
          id: 'req-request-state-only',
          taskId: 'task-raw',
          toolName: 'terminal.exec',
          nodeId: 'node-terminal',
          status: 'pending_approval',
          riskClass: 'critical'
        }
      ],
      events: [
        {
          id: 'event-unknown',
          sessionId: 'session-1',
          type: 'unknown_agent_tool_event',
          at: '2026-04-26T09:00:00.000Z',
          payload: { requestId: 'req-unknown', toolName: 'ignored.tool' }
        } as any,
        {
          id: 'event-blocked',
          sessionId: 'session-1',
          type: 'execution_step_blocked',
          at: '2026-04-26T09:01:00.000Z',
          payload: {
            requestId: 'req-blocked',
            toolName: 'browser.open',
            nodeId: 'node-browser',
            reasonCode: 'approval_required'
          }
        },
        {
          id: 'event-resumed',
          sessionId: 'session-1',
          type: 'interrupt_resumed',
          at: '2026-04-26T09:02:00.000Z',
          payload: {
            kind: 'tool_execution',
            requestId: 'req-blocked',
            action: 'approve'
          }
        }
      ]
    });

    expect(summary.eventLog.blockedCount).toBe(1);
    expect(summary.eventLog.resumedCount).toBe(1);
    expect(summary.eventLog.latestEvents).toEqual([
      {
        eventId: 'event-resumed',
        requestId: 'req-blocked',
        status: 'resumed',
        title: '审批已恢复',
        summary: 'approve',
        at: '2026-04-26T09:02:00.000Z'
      },
      {
        eventId: 'event-blocked',
        requestId: 'req-blocked',
        status: 'blocked',
        title: '执行步骤阻断',
        summary: 'approval_required',
        toolName: 'browser.open',
        nodeId: 'node-browser',
        at: '2026-04-26T09:01:00.000Z'
      }
    ]);
  });

  it('projects agent-tools stream and terminal lifecycle events for runtime governance summaries', () => {
    const summary = summarizeAgentToolExecutions({
      events: [
        {
          id: 'event-detected',
          sessionId: 'session-1',
          type: 'tool_stream_detected',
          at: '2026-04-26T09:00:00.000Z',
          payload: {
            requestId: 'req-tool',
            toolName: 'terminal.exec',
            nodeId: 'node-terminal',
            outputPreview: 'pnpm test requested',
            status: 'running'
          }
        } as any,
        {
          id: 'event-dispatched',
          sessionId: 'session-1',
          type: 'tool_stream_dispatched',
          at: '2026-04-26T09:01:00.000Z',
          payload: {
            executionRequestId: 'req-tool',
            toolName: 'terminal.exec',
            nodeId: 'node-terminal',
            chunk: 'spawned terminal executor'
          }
        } as any,
        {
          id: 'event-completed',
          sessionId: 'session-1',
          type: 'tool_stream_completed',
          at: '2026-04-26T09:02:00.000Z',
          payload: {
            requestId: 'req-tool',
            toolName: 'terminal.exec',
            nodeId: 'node-terminal',
            status: 'succeeded'
          }
        } as any,
        {
          id: 'event-step-completed',
          sessionId: 'session-1',
          type: 'execution_step_completed',
          at: '2026-04-26T09:03:00.000Z',
          payload: {
            requestId: 'req-tool-failed',
            toolName: 'filesystem.write',
            nodeId: 'node-filesystem',
            outputPreview: 'permission denied',
            status: 'failed'
          }
        } as any
      ]
    });

    expect(summary.eventLog.blockedCount).toBe(0);
    expect(summary.eventLog.resumedCount).toBe(0);
    expect(summary.eventLog.latestEvents).toEqual([
      {
        eventId: 'event-step-completed',
        requestId: 'req-tool-failed',
        status: 'failed',
        title: '执行步骤完成',
        summary: 'permission denied',
        toolName: 'filesystem.write',
        nodeId: 'node-filesystem',
        at: '2026-04-26T09:03:00.000Z'
      },
      {
        eventId: 'event-completed',
        requestId: 'req-tool',
        status: 'succeeded',
        title: '工具流完成',
        summary: 'succeeded',
        toolName: 'terminal.exec',
        nodeId: 'node-terminal',
        at: '2026-04-26T09:02:00.000Z'
      },
      {
        eventId: 'event-dispatched',
        requestId: 'req-tool',
        status: 'running',
        title: '工具流已派发',
        summary: 'spawned terminal executor',
        toolName: 'terminal.exec',
        nodeId: 'node-terminal',
        at: '2026-04-26T09:01:00.000Z'
      },
      {
        eventId: 'event-detected',
        requestId: 'req-tool',
        status: 'running',
        title: '工具流已检测',
        summary: 'pnpm test requested',
        toolName: 'terminal.exec',
        nodeId: 'node-terminal',
        at: '2026-04-26T09:00:00.000Z'
      }
    ]);
  });
});
