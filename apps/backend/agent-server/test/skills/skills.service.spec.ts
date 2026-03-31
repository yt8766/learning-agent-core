import { describe, expect, it, vi } from 'vitest';

import { SkillsService } from '../../src/skills/skills.service';

describe('SkillsService', () => {
  it('delegates catalog actions to RuntimeSkillCatalogService', () => {
    const runtimeSkillCatalogService = {
      listSkills: vi.fn(),
      listLabSkills: vi.fn(),
      getSkill: vi.fn(),
      promoteSkill: vi.fn(),
      disableSkill: vi.fn(),
      restoreSkill: vi.fn(),
      retireSkill: vi.fn()
    };
    const service = new SkillsService(runtimeSkillCatalogService as any);

    service.list('active' as any);
    service.listLab();
    service.getById('skill-1');
    service.promote('skill-1');
    service.disable('skill-1');
    service.restore('skill-1');
    service.retire('skill-1');

    expect(runtimeSkillCatalogService.listSkills).toHaveBeenCalledWith('active');
    expect(runtimeSkillCatalogService.listLabSkills).toHaveBeenCalledTimes(1);
    expect(runtimeSkillCatalogService.getSkill).toHaveBeenCalledWith('skill-1');
    expect(runtimeSkillCatalogService.promoteSkill).toHaveBeenCalledWith('skill-1');
    expect(runtimeSkillCatalogService.disableSkill).toHaveBeenCalledWith('skill-1');
    expect(runtimeSkillCatalogService.restoreSkill).toHaveBeenCalledWith('skill-1');
    expect(runtimeSkillCatalogService.retireSkill).toHaveBeenCalledWith('skill-1');
  });
});
