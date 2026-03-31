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
});
