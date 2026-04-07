import { describe, expect, it } from 'vitest';

import {
  buildAgentErrorDiagnosisHint,
  buildAgentErrorRecommendedAction,
  buildAgentErrorRecoveryPlaybook,
  deriveRecentAgentErrors
} from '../../../src/runtime/helpers/runtime-agent-errors';

describe('runtime-agent-errors', () => {
  it('会为 provider transient 错误生成诊断与恢复建议', () => {
    expect(
      buildAgentErrorDiagnosisHint({
        errorCode: 'provider_transient_error',
        errorCategory: 'provider',
        ministry: 'hubu-search',
        retryable: true
      })
    ).toContain('瞬时波动');

    expect(
      buildAgentErrorRecommendedAction({
        errorCode: 'provider_transient_error',
        errorCategory: 'provider',
        ministry: 'hubu-search',
        retryable: true
      })
    ).toContain('重试');

    expect(
      buildAgentErrorRecoveryPlaybook({
        errorCode: 'provider_transient_error',
        errorCategory: 'provider',
        ministry: 'hubu-search',
        retryable: true
      })
    ).toEqual(expect.arrayContaining([expect.stringContaining('切换模型')]));
  });

  it('会从任务 trace 派生最近 agent 错误', () => {
    const records = deriveRecentAgentErrors([
      {
        id: 'task-1',
        goal: '检查最近 AI 技术',
        status: 'failed',
        currentNode: 'hubu_research',
        currentStep: 'research',
        currentMinistry: 'hubu-search',
        currentWorker: 'hubu-search-worker',
        createdAt: '2026-03-27T09:00:00.000Z',
        updatedAt: '2026-03-27T09:01:00.000Z',
        trace: [
          {
            node: 'agent_error',
            at: '2026-03-27T09:01:00.000Z',
            summary: 'research provider timeout',
            data: {
              errorCode: 'provider_transient_error',
              errorCategory: 'provider',
              errorName: 'TimeoutError',
              errorMessage: 'research provider timeout',
              retryable: true,
              ministry: 'hubu-search'
            }
          }
        ]
      } as any
    ]);

    expect(records).toEqual([
      expect.objectContaining({
        taskId: 'task-1',
        errorCode: 'provider_transient_error',
        retryable: true,
        diagnosisHint: expect.stringContaining('瞬时波动'),
        recoveryPlaybook: expect.arrayContaining([expect.stringContaining('重试当前任务')])
      })
    ]);
  });

  it('covers tool, approval, state, ministry and default fallback branches', () => {
    expect(
      buildAgentErrorDiagnosisHint({
        errorCode: 'tool_execution_error',
        errorCategory: 'tool',
        ministry: 'gongbu-code',
        toolName: 'terminal',
        retryable: true
      })
    ).toContain('terminal');
    expect(
      buildAgentErrorRecommendedAction({
        errorCode: 'tool_execution_error',
        errorCategory: 'tool',
        ministry: 'gongbu-code',
        retryable: false
      })
    ).toContain('connector/session');
    expect(
      buildAgentErrorRecoveryPlaybook({
        errorCode: 'approval_flow_error',
        errorCategory: 'approval',
        ministry: 'libu-governance',
        retryable: false
      })
    ).toEqual(expect.arrayContaining([expect.stringContaining('approval recovery')]));
    expect(
      buildAgentErrorDiagnosisHint({
        errorCode: 'state_transition_error',
        errorCategory: 'state',
        ministry: 'libu-governance',
        retryable: false
      })
    ).toContain('状态机');
    expect(
      buildAgentErrorDiagnosisHint({
        errorCode: 'agent_runtime_error',
        errorCategory: 'runtime',
        ministry: 'hubu-search',
        retryable: false
      })
    ).toContain('户部链路');
    expect(
      buildAgentErrorDiagnosisHint({
        errorCode: 'agent_runtime_error',
        errorCategory: 'runtime',
        ministry: 'bingbu-ops',
        retryable: false
      })
    ).toContain('工部/兵部');
    expect(
      buildAgentErrorRecommendedAction({
        errorCode: 'agent_runtime_error',
        errorCategory: 'runtime',
        ministry: 'libu-governance',
        retryable: false
      })
    ).toContain('人工排查');
    expect(
      buildAgentErrorRecoveryPlaybook({
        errorCode: 'agent_runtime_error',
        errorCategory: 'runtime',
        ministry: 'libu-governance',
        retryable: true
      })
    ).toEqual(expect.arrayContaining([expect.stringContaining('重试当前任务')]));
  });

  it('filters, sorts, limits and falls back task fields when deriving recent errors', () => {
    const records = deriveRecentAgentErrors(
      [
        {
          id: 'task-1',
          goal: 'older',
          status: 'failed',
          currentNode: 'node-a',
          currentStep: 'step-a',
          currentMinistry: 'libu-governance',
          currentWorker: 'worker-a',
          createdAt: '2026-03-27T09:00:00.000Z',
          updatedAt: '2026-03-27T09:00:30.000Z',
          trace: [
            {
              node: 'other_event',
              at: '2026-03-27T09:00:10.000Z',
              summary: 'ignored'
            },
            {
              node: 'agent_error',
              at: '2026-03-27T09:00:20.000Z',
              summary: 'fallback message'
            }
          ]
        },
        {
          id: 'task-2',
          goal: 'newer',
          status: 'failed',
          currentNode: 'node-b',
          currentStep: 'step-b',
          currentMinistry: 'hubu-search',
          currentWorker: 'worker-b',
          createdAt: '2026-03-27T09:00:00.000Z',
          updatedAt: '2026-03-27T09:02:00.000Z',
          trace: [
            {
              node: 'agent_error',
              at: '2026-03-27T09:01:30.000Z',
              summary: 'tool failed',
              data: {
                errorCode: 'tool_execution_error',
                errorCategory: 'tool',
                toolName: 'browser',
                retryable: false,
                phase: 'execute',
                routeFlow: 'research',
                intent: 'collect sources',
                stack: 'stack'
              }
            }
          ]
        }
      ] as any,
      1
    );

    expect(records).toHaveLength(1);
    expect(records[0]).toEqual(
      expect.objectContaining({
        taskId: 'task-2',
        node: 'node-b',
        step: 'step-b',
        ministry: 'hubu-search',
        worker: 'worker-b',
        phase: 'execute',
        routeFlow: 'research',
        toolName: 'browser',
        intent: 'collect sources',
        stack: 'stack',
        message: 'tool failed',
        errorName: 'UnknownError'
      })
    );
  });
});
