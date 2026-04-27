import { describe, expect, it } from 'vitest';

import {
  normalizeAgentToolEvent,
  projectAgentToolEventsToTimeline,
  projectAgentToolGovernanceProjectionToTimeline
} from '../../src/lib/agent-tool-event-projections';

describe('agent tool event projections', () => {
  it('projects tool selection and call events into stable view models', () => {
    expect(
      normalizeAgentToolEvent({
        type: 'tool_selected',
        payload: {
          requestId: 'request-1',
          toolName: 'shell.run',
          capabilityId: 'cap-1',
          nodeId: 'node-1',
          riskClass: 'high'
        }
      })
    ).toEqual({
      requestId: 'request-1',
      kind: 'tool_selected',
      status: 'pending',
      title: '已选择工具 shell.run',
      summary: 'node-1 · cap-1',
      toolName: 'shell.run',
      capabilityId: 'cap-1',
      nodeId: 'node-1',
      riskClass: 'high'
    });

    expect(
      normalizeAgentToolEvent({
        type: 'tool_called',
        payload: {
          requestId: 'request-2',
          toolName: 'browser.open',
          inputPreview: '打开本地页面',
          policyDecision: { decision: 'require_approval', riskClass: 'critical' }
        }
      })
    ).toMatchObject({
      requestId: 'request-2',
      kind: 'tool_called',
      status: 'pending_approval',
      title: '工具调用 browser.open',
      summary: '打开本地页面',
      toolName: 'browser.open',
      riskClass: 'critical',
      approval: { required: true },
      policyDecision: { decision: 'require_approval', riskClass: 'critical' }
    });
  });

  it('does not project raw or vendor payload fields into timeline display models', () => {
    const timeline = projectAgentToolEventsToTimeline([
      {
        type: 'tool_called',
        payload: {
          requestId: 'request-sensitive-call',
          toolName: 'terminal.exec',
          inputPreview: 'pnpm test',
          rawInput: 'SECRET_RAW_INPUT',
          input: 'SECRET_INPUT',
          vendorObject: { token: 'SECRET_VENDOR_OBJECT' },
          vendorResponse: 'SECRET_VENDOR_RESPONSE',
          providerResponse: 'SECRET_PROVIDER_RESPONSE',
          policyDecision: {
            decisionId: 'decision-sensitive',
            decision: 'require_approval',
            reasonCode: 'sandbox_required',
            reason: 'needs review',
            requiresApproval: true,
            riskClass: 'critical',
            rawInput: 'SECRET_POLICY_RAW_INPUT',
            vendorResponse: 'SECRET_POLICY_VENDOR_RESPONSE'
          }
        }
      },
      {
        type: 'execution_step_completed',
        payload: {
          requestId: 'request-sensitive-result',
          resultId: 'result-sensitive',
          status: 'succeeded',
          outputPreview: '执行完成',
          rawOutput: 'SECRET_RAW_OUTPUT',
          vendorObject: { response: 'SECRET_RESULT_VENDOR_OBJECT' },
          providerResponse: 'SECRET_RESULT_PROVIDER_RESPONSE'
        }
      }
    ]);

    expect(timeline).toEqual([
      {
        requestId: 'request-sensitive-call',
        kind: 'tool_called',
        status: 'pending_approval',
        title: '工具调用 terminal.exec',
        summary: 'pnpm test',
        toolName: 'terminal.exec',
        riskClass: 'critical',
        approval: { required: true },
        policyDecision: {
          decisionId: 'decision-sensitive',
          decision: 'require_approval',
          reasonCode: 'sandbox_required',
          reason: 'needs review',
          requiresApproval: true,
          riskClass: 'critical'
        }
      },
      {
        requestId: 'request-sensitive-result',
        kind: 'execution_step',
        status: 'succeeded',
        title: '执行步骤完成',
        summary: '执行完成',
        resultId: 'result-sensitive'
      }
    ]);
    expect(JSON.stringify(timeline)).not.toContain('SECRET_');
    expect(timeline[0]?.policyDecision).not.toHaveProperty('rawInput');
    expect(timeline[0]?.policyDecision).not.toHaveProperty('vendorResponse');
  });

  it('projects stream and execution step events with terminal status', () => {
    expect(
      normalizeAgentToolEvent({
        type: 'tool_stream_dispatched',
        payload: {
          requestId: 'request-1',
          outputPreview: '已输出 12 行',
          streamKind: 'stdout'
        }
      })
    ).toEqual({
      requestId: 'request-1',
      kind: 'tool_stream',
      status: 'running',
      title: '工具流式输出',
      summary: '已输出 12 行',
      streamKind: 'stdout'
    });

    expect(
      normalizeAgentToolEvent({
        type: 'execution_step_completed',
        payload: {
          requestId: 'request-1',
          resultId: 'result-1',
          status: 'succeeded',
          outputPreview: '执行完成'
        }
      })
    ).toEqual({
      requestId: 'request-1',
      kind: 'execution_step',
      status: 'succeeded',
      title: '执行步骤完成',
      summary: '执行完成',
      resultId: 'result-1'
    });
  });

  it('projects blocked and interrupt events with approval action context', () => {
    expect(
      normalizeAgentToolEvent({
        type: 'execution_step_blocked',
        payload: {
          requestId: 'request-1',
          reasonCode: 'approval_required',
          approvalId: 'approval-1',
          interruptId: 'interrupt-1'
        }
      })
    ).toEqual({
      requestId: 'request-1',
      kind: 'execution_step',
      status: 'blocked',
      title: '执行步骤阻断',
      summary: 'approval_required',
      approval: {
        approvalId: 'approval-1',
        interruptId: 'interrupt-1',
        required: true
      },
      reasonCode: 'approval_required'
    });

    expect(
      normalizeAgentToolEvent({
        type: 'interrupt_resumed',
        payload: {
          kind: 'tool_execution',
          requestId: 'request-1',
          interruptId: 'interrupt-1',
          action: 'approve'
        }
      })
    ).toEqual({
      requestId: 'request-1',
      kind: 'interrupt',
      status: 'resumed',
      title: '审批已恢复',
      summary: 'approve',
      approval: {
        interruptId: 'interrupt-1',
        required: false
      },
      action: 'approve'
    });
  });

  it('returns null for unrelated events and non-tool interrupts', () => {
    expect(normalizeAgentToolEvent({ type: 'message_delta', payload: { requestId: 'request-1' } })).toBeNull();
    expect(
      normalizeAgentToolEvent({
        type: 'interrupt_pending',
        payload: { kind: 'plan_question', requestId: 'request-1', interruptId: 'interrupt-1' }
      })
    ).toBeNull();
  });

  it('projects pulled REST events into timeline items and ignores unknown events', () => {
    expect(
      projectAgentToolEventsToTimeline([
        {
          id: 'agent_tool_request-1_0001_tool_called',
          sessionId: 'session-1',
          type: 'tool_called',
          at: '2026-04-26T00:00:00.000Z',
          payload: {
            requestId: 'request-1',
            toolName: 'shell.run',
            inputPreview: 'pnpm test'
          }
        },
        {
          id: 'agent_tool_request-1_0002_unknown',
          sessionId: 'session-1',
          type: 'unknown_agent_tool_event',
          at: '2026-04-26T00:00:01.000Z',
          payload: { requestId: 'request-1' }
        },
        {
          id: 'agent_tool_request-1_0003_execution_step_completed',
          sessionId: 'session-1',
          type: 'execution_step_completed',
          at: '2026-04-26T00:00:02.000Z',
          payload: {
            requestId: 'request-1',
            resultId: 'result-1',
            status: 'succeeded',
            outputPreview: '执行完成'
          }
        }
      ])
    ).toEqual([
      {
        requestId: 'request-1',
        kind: 'tool_called',
        status: 'queued',
        title: '工具调用 shell.run',
        summary: 'pnpm test',
        toolName: 'shell.run'
      },
      {
        requestId: 'request-1',
        kind: 'execution_step',
        status: 'succeeded',
        title: '执行步骤完成',
        summary: '执行完成',
        resultId: 'result-1'
      }
    ]);
  });

  it('uses governance requests and results as timeline fallback when pulled events are incomplete', () => {
    expect(
      projectAgentToolGovernanceProjectionToTimeline({
        events: [
          {
            type: 'tool_called',
            payload: {
              requestId: 'request-with-result',
              toolName: 'browser.open',
              inputPreview: '打开本地页面'
            }
          },
          {
            type: 'execution_step_completed',
            payload: {
              requestId: 'request-terminal',
              resultId: 'result-terminal',
              status: 'succeeded',
              outputPreview: '已有终态事件'
            }
          }
        ],
        requests: [
          {
            requestId: 'request-without-events',
            nodeId: 'node-1',
            capabilityId: 'cap-1',
            toolName: 'shell.run',
            inputPreview: 'pnpm test',
            riskClass: 'high',
            status: 'pending_approval'
          },
          {
            requestId: 'request-with-result',
            nodeId: 'node-2',
            toolName: 'browser.open',
            status: 'running'
          },
          {
            requestId: 'request-terminal',
            nodeId: 'node-3',
            toolName: 'shell.run',
            status: 'succeeded'
          }
        ],
        results: [
          {
            resultId: 'result-with-output',
            requestId: 'request-with-result',
            nodeId: 'node-2',
            status: 'failed',
            outputPreview: '页面加载失败'
          },
          {
            resultId: 'result-terminal',
            requestId: 'request-terminal',
            nodeId: 'node-3',
            status: 'succeeded',
            outputPreview: '不应重复追加'
          }
        ]
      })
    ).toEqual([
      {
        requestId: 'request-with-result',
        kind: 'tool_called',
        status: 'queued',
        title: '工具调用 browser.open',
        summary: '打开本地页面',
        toolName: 'browser.open'
      },
      {
        requestId: 'request-terminal',
        kind: 'execution_step',
        status: 'succeeded',
        title: '执行步骤完成',
        summary: '已有终态事件',
        resultId: 'result-terminal'
      },
      {
        requestId: 'request-without-events',
        kind: 'tool_called',
        status: 'pending_approval',
        title: '工具请求 shell.run',
        summary: 'pnpm test',
        toolName: 'shell.run',
        capabilityId: 'cap-1',
        nodeId: 'node-1',
        riskClass: 'high'
      },
      {
        requestId: 'request-with-result',
        kind: 'execution_step',
        status: 'failed',
        title: '工具结果',
        summary: '页面加载失败',
        nodeId: 'node-2',
        resultId: 'result-with-output'
      }
    ]);
  });
});
