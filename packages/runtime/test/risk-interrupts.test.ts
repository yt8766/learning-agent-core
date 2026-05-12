import { describe, expect, it } from 'vitest';

import { ActionIntent } from '@agent/core';

import {
  buildRiskApprovalMetadata,
  extendInterruptWithRiskMetadata,
  extendPendingApprovalWithRiskMetadata
} from '../src/flows/approval/risk-interrupts';

describe('risk-interrupts', () => {
  describe('buildRiskApprovalMetadata', () => {
    it('classifies destructive commands', () => {
      const result = buildRiskApprovalMetadata({
        intent: ActionIntent.WRITE_FILE,
        toolName: 'filesystem',
        reason: 'rm -rf /tmp/old'
      });
      expect(result.riskCode).toBe('requires_approval_destructive');
      expect(result.riskReason).toContain('破坏性');
    });

    it('classifies delete_file intent as destructive', () => {
      const result = buildRiskApprovalMetadata({
        intent: 'delete_file',
        toolName: 'filesystem'
      });
      expect(result.riskCode).toBe('requires_approval_destructive');
    });

    it('classifies permission escalation', () => {
      const result = buildRiskApprovalMetadata({
        toolName: 'terminal',
        reason: 'sudo apt-get install'
      });
      expect(result.riskCode).toBe('requires_approval_permission_escalation');
    });

    it('classifies external mutation', () => {
      const result = buildRiskApprovalMetadata({
        toolName: 'http_request',
        reason: 'curl -X POST https://api.example.com/deploy'
      });
      expect(result.riskCode).toBe('requires_approval_external_mutation');
    });

    it('classifies call_external_api intent as external mutation', () => {
      const result = buildRiskApprovalMetadata({
        intent: 'call_external_api',
        toolName: 'http'
      });
      expect(result.riskCode).toBe('requires_approval_external_mutation');
    });

    it('classifies governance changes', () => {
      const result = buildRiskApprovalMetadata({
        toolName: 'connector-config',
        reason: 'update policy settings'
      });
      expect(result.riskCode).toBe('requires_approval_governance');
    });

    it('classifies high risk level', () => {
      const result = buildRiskApprovalMetadata({
        riskLevel: 'high',
        toolName: 'code-runner'
      });
      expect(result.riskCode).toBe('requires_approval_high_risk');
    });

    it('classifies critical risk level', () => {
      const result = buildRiskApprovalMetadata({
        riskLevel: 'critical',
        toolName: 'code-runner'
      });
      expect(result.riskCode).toBe('requires_approval_high_risk');
    });

    it('defaults to governance risk for unknown', () => {
      const result = buildRiskApprovalMetadata({
        toolName: 'unknown-tool'
      });
      expect(result.riskCode).toBe('requires_approval_governance');
    });

    it('defaults approvalScope to once', () => {
      const result = buildRiskApprovalMetadata({});
      expect(result.approvalScope).toBe('once');
    });

    it('uses provided approvalScope', () => {
      const result = buildRiskApprovalMetadata({ approvalScope: 'session' });
      expect(result.approvalScope).toBe('session');
    });

    it('extracts command preview from preview items', () => {
      const result = buildRiskApprovalMetadata({
        preview: [
          { label: 'Command', value: 'git push origin main' },
          { label: 'Branch', value: 'main' }
        ]
      });
      expect(result.commandPreview).toBe('git push origin main');
    });

    it('builds command preview from non-command labels when no Command label', () => {
      const result = buildRiskApprovalMetadata({
        preview: [
          { label: 'Action', value: 'push' },
          { label: 'Target', value: 'origin' }
        ]
      });
      expect(result.commandPreview).toContain('Action: push');
    });
  });

  describe('extendPendingApprovalWithRiskMetadata', () => {
    it('adds risk metadata to pending approval', () => {
      const result = extendPendingApprovalWithRiskMetadata(
        {
          intent: ActionIntent.WRITE_FILE,
          toolName: 'filesystem',
          reason: 'rm -rf /tmp'
        },
        { requestedBy: 'gongbu-code', approvalScope: 'session' }
      );
      expect(result.reasonCode).toBe('requires_approval_destructive');
      expect(result.preview).toBeDefined();
      expect(result.preview!.length).toBeGreaterThan(0);
    });

    it('preserves existing reasonCode', () => {
      const result = extendPendingApprovalWithRiskMetadata(
        {
          intent: ActionIntent.WRITE_FILE,
          toolName: 'fs',
          reasonCode: 'custom_code'
        },
        {}
      );
      expect(result.reasonCode).toBe('custom_code');
    });
  });

  describe('extendInterruptWithRiskMetadata', () => {
    it('adds risk metadata to interrupt', () => {
      const result = extendInterruptWithRiskMetadata(
        {
          id: 'int-1',
          status: 'pending',
          intent: ActionIntent.EXECUTE,
          toolName: 'terminal',
          reason: 'sudo make install'
        },
        { approvalScope: 'once' }
      );
      expect(result.payload!.riskCode).toBe('requires_approval_permission_escalation');
      expect(result.preview!.length).toBeGreaterThan(0);
    });

    it('merges with existing preview without duplicates', () => {
      const result = extendInterruptWithRiskMetadata(
        {
          id: 'int-1',
          status: 'pending',
          preview: [{ label: 'Command', value: 'existing-cmd' }]
        } as any,
        {}
      );
      const commandPreview = result.preview!.find((p: any) => p.label === 'Command');
      expect(commandPreview!.value).toBe('existing-cmd');
    });
  });
});
