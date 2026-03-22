import { describe, expect, it } from 'vitest';

import { ActionIntent } from '@agent/shared';

import { ApprovalService } from './approval-service';

describe('ApprovalService', () => {
  const service = new ApprovalService();

  it('对高风险动作返回需要审批', () => {
    expect(service.requiresApproval(ActionIntent.WRITE_FILE)).toBe(true);
    expect(service.getDefaultDecision(ActionIntent.CALL_EXTERNAL_API)).toBe('pending');
  });

  it('对只读动作默认直接批准', () => {
    expect(service.requiresApproval(ActionIntent.READ_FILE)).toBe(false);
    expect(service.getDefaultDecision(ActionIntent.READ_FILE)).toBe('approved');
  });

  it('当工具自身标记 requiresApproval 时也会进入审批', () => {
    expect(
      service.requiresApproval(ActionIntent.READ_FILE, {
        name: 'read_local_file',
        description: 'read only tool',
        category: 'system',
        riskLevel: 'low',
        requiresApproval: true,
        timeoutMs: 1000,
        sandboxProfile: 'read-only',
        inputSchema: {}
      })
    ).toBe(true);
  });
});
