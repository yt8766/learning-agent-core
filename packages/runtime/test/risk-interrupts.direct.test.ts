import { describe, expect, it } from 'vitest';

import {
  buildRiskApprovalMetadata,
  extendPendingApprovalWithRiskMetadata,
  extendInterruptWithRiskMetadata
} from '../src/flows/approval/risk-interrupts';

describe('risk-interrupts (direct)', () => {
  describe('buildRiskApprovalMetadata', () => {
    it('detects destructive command pattern', () => {
      const result = buildRiskApprovalMetadata({
        preview: [{ label: 'Command', value: 'rm -rf /tmp/data' }]
      });
      expect(result.riskCode).toBe('requires_approval_destructive');
      expect(result.riskReason).toContain('破坏性');
    });

    it('detects permission escalation', () => {
      const result = buildRiskApprovalMetadata({
        preview: [{ label: 'Command', value: 'sudo apt install something' }]
      });
      expect(result.riskCode).toBe('requires_approval_permission_escalation');
    });

    it('detects external mutation', () => {
      const result = buildRiskApprovalMetadata({
        preview: [{ label: 'Command', value: 'curl -X POST https://api.example.com' }]
      });
      expect(result.riskCode).toBe('requires_approval_external_mutation');
    });

    it('detects delete_file intent', () => {
      const result = buildRiskApprovalMetadata({
        intent: 'delete_file'
      });
      expect(result.riskCode).toBe('requires_approval_destructive');
    });

    it('detects call_external_api intent', () => {
      const result = buildRiskApprovalMetadata({
        intent: 'call_external_api'
      });
      expect(result.riskCode).toBe('requires_approval_external_mutation');
    });

    it('detects connector/governance keywords', () => {
      const result = buildRiskApprovalMetadata({
        reason: 'connector configuration change'
      });
      expect(result.riskCode).toBe('requires_approval_governance');
    });

    it('detects high risk level', () => {
      const result = buildRiskApprovalMetadata({
        riskLevel: 'high'
      });
      expect(result.riskCode).toBe('requires_approval_high_risk');
    });

    it('detects critical risk level', () => {
      const result = buildRiskApprovalMetadata({
        riskLevel: 'critical'
      });
      expect(result.riskCode).toBe('requires_approval_high_risk');
    });

    it('falls back to governance for normal risk', () => {
      const result = buildRiskApprovalMetadata({
        riskLevel: 'low',
        toolName: 'bash',
        reason: 'run a script'
      });
      expect(result.riskCode).toBe('requires_approval_governance');
    });

    it('uses approvalScope from params', () => {
      const result = buildRiskApprovalMetadata({ approvalScope: 'session' });
      expect(result.approvalScope).toBe('session');
    });

    it('defaults approvalScope to once', () => {
      const result = buildRiskApprovalMetadata({});
      expect(result.approvalScope).toBe('once');
    });

    it('includes requestedBy', () => {
      const result = buildRiskApprovalMetadata({ requestedBy: 'gongbu-code' });
      expect(result.requestedBy).toBe('gongbu-code');
    });

    it('extracts commandPreview from preview with Command label', () => {
      const result = buildRiskApprovalMetadata({
        preview: [
          { label: 'Command', value: 'npm test' },
          { label: 'Other', value: 'something' }
        ]
      });
      expect(result.commandPreview).toBe('npm test');
    });

    it('builds commandPreview from first 3 items when no Command label', () => {
      const result = buildRiskApprovalMetadata({
        preview: [
          { label: 'Action', value: 'build' },
          { label: 'Target', value: 'production' }
        ]
      });
      expect(result.commandPreview).toBe('Action: build | Target: production');
    });

    it('returns empty commandPreview when no preview', () => {
      const result = buildRiskApprovalMetadata({});
      expect(result.commandPreview).toBe('');
    });
  });

  describe('extendPendingApprovalWithRiskMetadata', () => {
    it('adds risk metadata to approval', () => {
      const approval = {
        intent: 'tool_approval',
        toolName: 'bash',
        reason: 'run tests'
      };
      const result = extendPendingApprovalWithRiskMetadata(approval as any, { requestedBy: 'gongbu-code' });
      expect(result.reasonCode).toBeDefined();
      expect(result.preview).toBeDefined();
    });

    it('preserves existing reasonCode', () => {
      const approval = {
        intent: 'tool_approval',
        toolName: 'bash',
        reason: 'run tests',
        reasonCode: 'existing_code'
      };
      const result = extendPendingApprovalWithRiskMetadata(approval as any, {});
      expect(result.reasonCode).toBe('existing_code');
    });

    it('adds risk-related preview items', () => {
      const approval = {
        intent: 'tool_approval',
        toolName: 'bash',
        reason: 'run tests',
        preview: [{ label: 'Command', value: 'npm test' }]
      };
      const result = extendPendingApprovalWithRiskMetadata(approval as any, {});
      expect(result.preview.length).toBeGreaterThan(1);
      expect(result.preview.some((p: any) => p.label === 'Risk')).toBe(true);
    });

    it('does not duplicate existing preview labels', () => {
      const approval = {
        intent: 'tool_approval',
        toolName: 'bash',
        reason: 'run tests',
        preview: [
          { label: 'Command', value: 'npm test' },
          { label: 'Risk', value: 'already set' }
        ]
      };
      const result = extendPendingApprovalWithRiskMetadata(approval as any, {});
      const riskItems = result.preview.filter((p: any) => p.label === 'Risk');
      expect(riskItems).toHaveLength(1);
    });
  });

  describe('extendInterruptWithRiskMetadata', () => {
    it('adds risk metadata to interrupt', () => {
      const interrupt = {
        id: 'int-1',
        status: 'pending',
        intent: 'tool_approval',
        toolName: 'bash',
        reason: 'run tests'
      };
      const result = extendInterruptWithRiskMetadata(interrupt as any);
      expect(result.preview).toBeDefined();
      expect(result.payload).toBeDefined();
      expect(result.payload.riskCode).toBeDefined();
      expect(result.payload.riskReason).toBeDefined();
      expect(result.payload.approvalScope).toBe('once');
    });

    it('preserves existing interrupt fields', () => {
      const interrupt = {
        id: 'int-1',
        status: 'pending',
        intent: 'tool_approval',
        toolName: 'bash',
        reason: 'run tests',
        preview: [{ label: 'Detail', value: 'something' }]
      };
      const result = extendInterruptWithRiskMetadata(interrupt as any, { approvalScope: 'session' });
      expect(result.id).toBe('int-1');
      expect(result.status).toBe('pending');
      expect(result.payload.approvalScope).toBe('session');
    });

    it('uses default approvalScope when not provided', () => {
      const interrupt = {
        id: 'int-1',
        intent: 'tool_approval'
      };
      const result = extendInterruptWithRiskMetadata(interrupt as any);
      expect(result.payload.approvalScope).toBe('once');
    });
  });
});
