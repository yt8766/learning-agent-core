import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { loadSettings } from '@agent/config';
import { SkillCard, SkillStatus } from '@agent/core';
import { getSkillById, listSkills, readSkillCatalog, writeSkillCatalog } from '../catalog/skill-catalog';
import { publishPluginDraft, type PluginDraft } from '../install/plugin-draft-publisher';
import {
  disableSkill,
  promoteSkill,
  publishSkillToLab,
  recordSkillExecutionResult,
  restoreSkill,
  retireSkill
} from '../policies/skill-governance-policy';

export class SkillRegistry {
  private readonly root: string;

  constructor(root = loadSettings().skillsRoot) {
    this.root = resolve(root);
  }

  async list(status?: SkillStatus): Promise<SkillCard[]> {
    return listSkills(this.root, status);
  }

  async getById(id: string): Promise<SkillCard | undefined> {
    return getSkillById(this.root, id);
  }

  async publishToLab(skill: SkillCard): Promise<SkillCard> {
    const nextSkill = publishSkillToLab(skill);
    await this.persist(nextSkill);
    return nextSkill;
  }

  async promote(id: string): Promise<SkillCard> {
    const skills = await readSkillCatalog(this.root);
    const target = skills.find(skill => skill.id === id);
    if (!target) {
      throw new Error(`Skill ${id} not found`);
    }

    const nextSkill = promoteSkill(target);
    await this.persist(nextSkill);
    return nextSkill;
  }

  async disable(id: string, reason?: string): Promise<SkillCard> {
    const skills = await readSkillCatalog(this.root);
    const target = skills.find(skill => skill.id === id);
    if (!target) {
      throw new Error(`Skill ${id} not found`);
    }

    const nextSkill = disableSkill(target, reason);
    await this.persist(nextSkill);
    return nextSkill;
  }

  async restore(id: string): Promise<SkillCard> {
    const skills = await readSkillCatalog(this.root);
    const target = skills.find(skill => skill.id === id);
    if (!target) {
      throw new Error(`Skill ${id} not found`);
    }

    const nextSkill = restoreSkill(target);
    await this.persist(nextSkill);
    return nextSkill;
  }

  async retire(id: string, reason?: string): Promise<SkillCard> {
    const skills = await readSkillCatalog(this.root);
    const target = skills.find(skill => skill.id === id);
    if (!target) {
      throw new Error(`Skill ${id} not found`);
    }

    const nextSkill = retireSkill(target, reason);
    await this.persist(nextSkill);
    return nextSkill;
  }

  async publishPluginDraft(draft: PluginDraft): Promise<PluginDraft> {
    return publishPluginDraft(this.root, draft);
  }

  async recordExecutionResult(id: string, runId: string, success: boolean): Promise<SkillCard | undefined> {
    const skills = await readSkillCatalog(this.root);
    const target = skills.find(skill => skill.id === id);
    if (!target) {
      return undefined;
    }

    const nextSkill = recordSkillExecutionResult(target, runId, success);
    await this.persist(nextSkill);
    return nextSkill;
  }

  private async persist(skill: SkillCard): Promise<void> {
    const skills = await readSkillCatalog(this.root);
    const deduped = skills.filter(item => item.id !== skill.id);
    deduped.push(skill);

    const targetDir = skill.status === 'stable' ? 'stable' : 'lab';
    const filePath = join(this.root, targetDir, `${skill.id}.json`);

    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(skill, null, 2));
    await writeSkillCatalog(this.root, deduped);
  }
}
