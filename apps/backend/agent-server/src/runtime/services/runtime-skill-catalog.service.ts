import { NotFoundException } from '@nestjs/common';

import type { ILLMProvider, SkillCard, SkillStatus } from '@agent/core';
import { createRuntimeUserSkillDraft } from '../domain/skills/runtime-skill-draft';
import { sanitizeListedSkills } from '../domain/skills/runtime-skill-card-listing';

export interface RuntimeSkillCatalogContext {
  runtimeHost?: {
    platformRuntime: {
      agentDependencies: {
        listBootstrapSkills: () => Array<{ id: string; displayName: string; description: string }>;
      };
    };
  };
  skillRegistry: {
    list: (status?: SkillStatus) => Promise<SkillCard[]>;
    getById: (skillId: string) => Promise<SkillCard | undefined>;
    publishToLab: (skill: SkillCard) => Promise<SkillCard>;
    promote: (skillId: string) => Promise<SkillCard>;
    disable: (skillId: string, reason?: string) => Promise<SkillCard>;
    restore: (skillId: string) => Promise<SkillCard>;
    retire: (skillId: string, reason?: string) => Promise<SkillCard>;
  };
  llmProvider?: ILLMProvider;
  registerSkillWorker?: (skill: SkillCard) => void;
}

export class RuntimeSkillCatalogService {
  constructor(private readonly getContext: () => RuntimeSkillCatalogContext) {}

  async listSkills(status?: SkillStatus) {
    const skills = await this.ctx().skillRegistry.list(status);
    return sanitizeListedSkills(skills);
  }

  async listLabSkills() {
    const skills = await this.ctx().skillRegistry.list('lab');
    return sanitizeListedSkills(skills);
  }

  listBootstrapSkills() {
    return this.ctx().runtimeHost?.platformRuntime.agentDependencies.listBootstrapSkills() ?? [];
  }

  async getSkill(skillId: string) {
    const skill = await this.ctx().skillRegistry.getById(skillId);
    if (!skill) {
      throw new NotFoundException(`Skill ${skillId} not found`);
    }
    return skill;
  }

  promoteSkill(skillId: string) {
    return this.ctx().skillRegistry.promote(skillId);
  }

  disableSkill(skillId: string) {
    return this.ctx().skillRegistry.disable(skillId, 'disabled_from_admin');
  }

  restoreSkill(skillId: string) {
    return this.ctx().skillRegistry.restore(skillId);
  }

  retireSkill(skillId: string) {
    return this.ctx().skillRegistry.retire(skillId, 'retired_from_admin');
  }

  async createUserSkillDraft(params: { prompt: string; displayName?: string; sessionId?: string; taskId?: string }) {
    return createRuntimeUserSkillDraft(
      skill => this.ctx().skillRegistry.publishToLab(skill),
      this.ctx().registerSkillWorker,
      this.ctx().llmProvider,
      params
    );
  }

  private ctx() {
    return this.getContext();
  }
}
