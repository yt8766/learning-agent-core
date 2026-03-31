import { describe, expect, it } from 'vitest';

import { buildApprovalsCenterExportUrl, buildBrowserReplayUrl, buildRuntimeCenterExportUrl } from '@/api/chat-api';

// Legacy aliases in input should normalize into canonical executionPlan.mode query values.
describe('chat-api url builders', () => {
  it('builds runtime and approvals export urls with interrupt-native filters', () => {
    expect(
      buildRuntimeCenterExportUrl({
        executionMode: 'planning-readonly',
        interactionKind: 'plan-question',
        format: 'json'
      })
    ).toContain('/platform/runtime-center/export?days=30&executionMode=plan&interactionKind=plan-question&format=json');

    expect(
      buildApprovalsCenterExportUrl({
        executionMode: 'planning-readonly',
        interactionKind: 'plan-question',
        format: 'json'
      })
    ).toContain('/platform/approvals-center/export?executionMode=plan&interactionKind=plan-question&format=json');
  });

  it('builds browser replay urls for active sessions', () => {
    expect(buildBrowserReplayUrl('session-42')).toContain('/platform/browser-replays/session-42');
  });
});
