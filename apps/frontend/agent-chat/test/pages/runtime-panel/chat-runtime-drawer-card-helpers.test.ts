import { describe, expect, it } from 'vitest';

import {
  getExecutionStepOwnerLabel,
  getExecutionStepStatusColor,
  getWorkflowAlertDescriptors
} from '@/pages/runtime-panel/chat-runtime-drawer-card-helpers';

describe('chat-runtime-drawer-card-helpers', () => {
  it('maps execution step status and owner labels', () => {
    expect(getExecutionStepStatusColor('completed')).toBe('success');
    expect(getExecutionStepStatusColor('blocked')).toBe('error');
    expect(getExecutionStepStatusColor('running')).toBe('info');
    expect(getExecutionStepStatusColor('unknown')).toBe('info');

    expect(getExecutionStepOwnerLabel('libu-docs')).toBe('礼部');
    expect(getExecutionStepOwnerLabel('system')).toBe('系统');
    expect(getExecutionStepOwnerLabel('custom-owner')).toBe('custom-owner');
    expect(getExecutionStepOwnerLabel()).toBe('--');
  });

  it('builds workflow alert descriptors for governance and runtime projections', () => {
    const alerts = getWorkflowAlertDescriptors(
      {
        specialistLead: { domain: 'general-assistant' },
        dispatches: [
          { kind: 'hubu', selectedAgentId: 'official.coder' },
          { kind: 'gongbu', selectedAgentId: 'official.reviewer' }
        ],
        contextFilterState: {
          dispatchOrder: ['hubu', 'gongbu'],
          audienceSlices: {
            strategy: { dispatchCount: 1 },
            ministry: { dispatchCount: 2 },
            fallback: { dispatchCount: 3 }
          }
        },
        streamStatus: {
          nodeLabel: '工部',
          detail: '正在执行',
          progressPercent: 60
        },
        budgetGateState: {
          status: 'closed',
          summary: '预算已触发保护',
          queueDepth: 4
        },
        finalReviewState: {
          decision: 'pass',
          summary: '终审通过',
          deliveryStatus: 'delivered',
          deliveryMinistry: 'libu-docs'
        },
        critiqueResult: {
          decision: 'needs_human_approval',
          summary: '需要人工复核',
          shouldBlockEarly: true
        },
        graphState: {
          revisionCount: 2,
          maxRevisions: 3,
          microLoopState: {
            state: 'exhausted',
            attempt: 3,
            maxAttempts: 3,
            exhaustedReason: '超过尝试上限'
          }
        },
        sandboxState: {
          stage: 'verify',
          status: 'failed',
          attempt: 2,
          maxAttempts: 3,
          verdict: 'blocked',
          exhaustedReason: '测试失败'
        },
        governanceScore: {
          score: 72,
          status: 'watch',
          summary: '需要观察',
          trustAdjustment: -0.2
        },
        governanceReport: {
          reviewOutcome: { summary: '终审建议通过' },
          evidenceSufficiency: { score: 88 },
          sandboxReliability: { score: 91 }
        },
        knowledgeIngestionState: { status: 'running' },
        knowledgeIndexState: {
          indexStatus: 'ready',
          searchableDocumentCount: 5,
          blockedDocumentCount: 1
        },
        approvalFeedback: '请补充风险说明'
      } as any,
      '因为当前目标更适合通用助理兜底'
    );

    expect(alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'route-reason',
          title: '通用助理兜底原因'
        }),
        expect.objectContaining({
          key: 'dispatches',
          description: expect.stringContaining('已收敛 Agent official.coder / official.reviewer')
        }),
        expect.objectContaining({
          key: 'budget-gate',
          type: 'warning',
          description: expect.stringContaining('queue 4')
        }),
        expect.objectContaining({
          key: 'final-review-state',
          type: 'success',
          description: expect.stringContaining('礼部')
        }),
        expect.objectContaining({
          key: 'critique-result',
          type: 'warning',
          description: expect.stringContaining('建议前置阻断')
        }),
        expect.objectContaining({
          key: 'sandbox-state',
          type: 'error'
        }),
        expect.objectContaining({
          key: 'knowledge-state',
          description: expect.stringContaining('searchable 5 / blocked 1')
        }),
        expect.objectContaining({
          key: 'approval-feedback',
          type: 'error'
        })
      ])
    );
  });
});
