import { describe, expect, it } from 'vitest';

import { SkillSourcesCenterController } from '../../src/platform/skill-sources-center.controller';
import { createPlatformControllerDeps } from './platform-controller.test-helpers';

describe('skill sources center controller', () => {
  it('delegates install, receipt and source state flows', async () => {
    const { runtimeCentersService } = createPlatformControllerDeps();
    const controller = new SkillSourcesCenterController(runtimeCentersService as never);

    await expect(controller.getSkillSourcesCenter()).resolves.toEqual({ scope: 'skillSources' });
    expect(controller.installSkill({ sourceId: 'local-skill' } as never)).toEqual({
      type: 'local',
      dto: { sourceId: 'local-skill' }
    });
    expect(controller.installRemoteSkill({ repo: 'org/repo' } as never)).toEqual({
      type: 'remote',
      dto: { repo: 'org/repo' }
    });
    expect(controller.checkInstalledSkills()).toEqual({ checked: true });
    expect(controller.updateInstalledSkills()).toEqual({ updated: true });
    expect(controller.getSkillInstallReceipt('receipt-1')).toEqual({ receiptId: 'receipt-1' });
    expect(controller.enableSkillSource('source-1')).toEqual({ sourceId: 'source-1', enabled: true });
    expect(controller.disableSkillSource('source-1')).toEqual({ sourceId: 'source-1', enabled: false });
    expect(controller.syncSkillSource('source-1')).toEqual({ sourceId: 'source-1', synced: true });
    expect(controller.approveSkillInstall('receipt-1', { note: 'ok' } as never)).toEqual({
      receiptId: 'receipt-1',
      action: 'approve',
      dto: { note: 'ok' }
    });
    expect(controller.rejectSkillInstall('receipt-1', { note: 'nope' } as never)).toEqual({
      receiptId: 'receipt-1',
      action: 'reject',
      dto: { note: 'nope' }
    });
  });
});
