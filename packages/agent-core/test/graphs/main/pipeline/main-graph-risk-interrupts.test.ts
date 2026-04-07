import { describe, expect, it } from 'vitest';
import { ActionIntent } from '@agent/shared';

import {
  buildRiskApprovalMetadata,
  extendInterruptWithRiskMetadata,
  extendPendingApprovalWithRiskMetadata
} from '../../../../src/flows/approval/risk-interrupts';

describe('main-graph-risk-interrupts', () => {
  it('会把删除型命令识别为 destructive 风险', () => {
    const metadata = buildRiskApprovalMetadata({
      intent: ActionIntent.DELETE_FILE,
      toolName: 'shell.exec',
      preview: [{ label: 'Command', value: 'rm -rf /tmp/test' }]
    });

    expect(metadata).toEqual(
      expect.objectContaining({
        commandPreview: 'rm -rf /tmp/test',
        riskCode: 'requires_approval_destructive'
      })
    );
  });

  it('会给 pendingApproval 与 interrupt 补齐 command/risk/approvalScope 元数据', () => {
    const pendingApproval = extendPendingApprovalWithRiskMetadata(
      {
        toolName: 'shell.exec',
        intent: ActionIntent.CALL_EXTERNAL_API,
        requestedBy: 'bingbu-ops',
        reason: '准备执行 deploy webhook',
        preview: [{ label: 'Command', value: 'curl -X POST https://api.example.com/deploy' }]
      },
      { approvalScope: 'once' }
    );
    const interrupt = extendInterruptWithRiskMetadata({
      id: 'interrupt-1',
      status: 'pending',
      mode: 'blocking',
      source: 'graph',
      kind: 'tool-approval',
      intent: ActionIntent.CALL_EXTERNAL_API,
      toolName: 'shell.exec',
      requestedBy: 'bingbu-ops',
      reason: '准备执行 deploy webhook',
      riskLevel: 'high',
      resumeStrategy: 'approval-recovery',
      preview: [{ label: 'Command', value: 'curl -X POST https://api.example.com/deploy' }],
      createdAt: '2026-04-01T00:00:00.000Z'
    });

    expect(pendingApproval.reasonCode).toBe('requires_approval_external_mutation');
    expect(pendingApproval.preview).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Risk' }),
        expect.objectContaining({ label: 'Approval scope', value: 'once' })
      ])
    );
    expect(interrupt.payload).toEqual(
      expect.objectContaining({
        commandPreview: 'curl -X POST https://api.example.com/deploy',
        riskCode: 'requires_approval_external_mutation',
        approvalScope: 'once'
      })
    );
  });
});
