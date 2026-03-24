import { Injectable } from '@nestjs/common';

import { SkillStatus } from '@agent/shared';

import { RuntimeService } from '../runtime/runtime.service';

@Injectable()
export class SkillsService {
  constructor(private readonly runtimeService: RuntimeService) {}

  list(status?: SkillStatus) {
    return this.runtimeService.listSkills(status);
  }

  listLab() {
    return this.runtimeService.listLabSkills();
  }

  getById(id: string) {
    return this.runtimeService.getSkill(id);
  }

  promote(id: string) {
    return this.runtimeService.promoteSkill(id);
  }

  disable(id: string) {
    return this.runtimeService.disableSkill(id);
  }

  restore(id: string) {
    return this.runtimeService.restoreSkill(id);
  }

  retire(id: string) {
    return this.runtimeService.retireSkill(id);
  }
}
