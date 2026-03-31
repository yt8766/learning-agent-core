import { Injectable } from '@nestjs/common';

import { SkillStatus } from '@agent/shared';

import { RuntimeSkillCatalogService } from '../runtime/services/runtime-skill-catalog.service';

@Injectable()
export class SkillsService {
  constructor(private readonly runtimeSkillCatalogService: RuntimeSkillCatalogService) {}

  list(status?: SkillStatus) {
    return this.runtimeSkillCatalogService.listSkills(status);
  }

  listLab() {
    return this.runtimeSkillCatalogService.listLabSkills();
  }

  getById(id: string) {
    return this.runtimeSkillCatalogService.getSkill(id);
  }

  promote(id: string) {
    return this.runtimeSkillCatalogService.promoteSkill(id);
  }

  disable(id: string) {
    return this.runtimeSkillCatalogService.disableSkill(id);
  }

  restore(id: string) {
    return this.runtimeSkillCatalogService.restoreSkill(id);
  }

  retire(id: string) {
    return this.runtimeSkillCatalogService.retireSkill(id);
  }
}
