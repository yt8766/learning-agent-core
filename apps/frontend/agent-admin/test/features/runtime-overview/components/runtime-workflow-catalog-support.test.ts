import { describe, expect, it } from 'vitest';

import { buildWorkflowLaunchGoal } from '@/features/runtime-overview/components/runtime-workflow-catalog-support';

describe('runtime workflow catalog support', () => {
  it('prefixes the goal with workflow command when present', () => {
    expect(
      buildWorkflowLaunchGoal(
        {
          id: 'review',
          displayName: '代码审查流程',
          command: '/review',
          intentPatterns: ['review'],
          requiredMinistries: ['xingbu-review'],
          allowedCapabilities: ['read_local_file'],
          approvalPolicy: 'none',
          outputContract: {
            type: 'code_review',
            requiredSections: ['findings']
          }
        },
        'check runtime orchestration'
      )
    ).toBe('/review check runtime orchestration');
  });

  it('keeps the raw goal for workflows without command', () => {
    expect(
      buildWorkflowLaunchGoal(
        {
          id: 'general',
          displayName: '通用协作流程',
          intentPatterns: ['general'],
          requiredMinistries: ['libu-governance'],
          allowedCapabilities: ['read_local_file'],
          approvalPolicy: 'high-risk-only',
          outputContract: {
            type: 'general_delivery',
            requiredSections: ['summary']
          }
        },
        'audit runtime center'
      )
    ).toBe('audit runtime center');
  });
});
