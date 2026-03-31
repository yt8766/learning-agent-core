import { describe, expect, it, vi } from 'vitest';

import { RuntimeCentersGovernanceService } from '../../../src/runtime/centers/runtime-centers-governance.service';

describe('RuntimeCentersGovernanceService', () => {
  it('runs skills check and skills update via the shared install context', async () => {
    const check = vi.fn(async () => ({ stdout: '1 update available', stderr: '' }));
    const update = vi.fn(async () => ({ stdout: 'updated 1 skill', stderr: '' }));
    const runtimeStateRepository = {
      load: vi.fn(async () => ({ governanceAudit: [] })),
      save: vi.fn(async () => undefined)
    };

    const service = new RuntimeCentersGovernanceService(
      () =>
        ({
          runtimeStateRepository,
          getSkillInstallContext: () => ({
            remoteSkillCli: {
              check,
              update
            }
          })
        }) as any
    );

    const checkResult = await service.checkInstalledSkills();
    const updateResult = await service.updateInstalledSkills();

    expect(checkResult).toEqual({ stdout: '1 update available', stderr: '' });
    expect(updateResult).toEqual({ stdout: 'updated 1 skill', stderr: '' });
    expect(check).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
    expect(runtimeStateRepository.save).toHaveBeenCalled();
  });
});
