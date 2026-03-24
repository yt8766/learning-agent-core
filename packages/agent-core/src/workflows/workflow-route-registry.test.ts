import { describe, expect, it } from 'vitest';

import { resolveWorkflowRoute } from './workflow-route-registry';

describe('resolveWorkflowRoute', () => {
  it('routes approval-only workflows to the approval recovery graph', () => {
    const result = resolveWorkflowRoute({
      goal: '继续执行被挂起的高风险动作',
      workflow: {
        id: 'approval-recovery',
        displayName: 'Approval Recovery',
        intentPatterns: [],
        requiredMinistries: [],
        allowedCapabilities: [],
        approvalPolicy: 'all-actions',
        outputContract: {
          type: 'final_answer',
          requiredSections: []
        }
      }
    });

    expect(result).toEqual({
      graph: 'approval-recovery',
      flow: 'approval',
      reason: 'approval_only_workflow'
    });
  });
});
