import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { loadSettings } from '@agent/config';
import { PluginDraft, SkillCard, SkillStatus } from '@agent/shared';

export class SkillRegistry {
  private readonly root = resolve(loadSettings().skillsRoot);

  async list(status?: SkillStatus): Promise<SkillCard[]> {
    const skills = await this.readRegistry();
    return status ? skills.filter(skill => skill.status === status) : skills;
  }

  async getById(id: string): Promise<SkillCard | undefined> {
    const skills = await this.readRegistry();
    return skills.find(skill => skill.id === id);
  }

  async publishToLab(skill: SkillCard): Promise<SkillCard> {
    const nextSkill: SkillCard = {
      ...skill,
      status: 'lab',
      updatedAt: new Date().toISOString()
    };
    await this.persist(nextSkill);
    return nextSkill;
  }

  async promote(id: string): Promise<SkillCard> {
    const skills = await this.readRegistry();
    const target = skills.find(skill => skill.id === id);
    if (!target) {
      throw new Error(`Skill ${id} not found`);
    }

    target.status = 'stable';
    target.updatedAt = new Date().toISOString();
    await this.persist(target);
    return target;
  }

  async disable(id: string, reason?: string): Promise<SkillCard> {
    const skills = await this.readRegistry();
    const target = skills.find(skill => skill.id === id);
    if (!target) {
      throw new Error(`Skill ${id} not found`);
    }

    target.previousStatus = target.status;
    target.status = 'disabled';
    target.disabledReason = reason;
    target.updatedAt = new Date().toISOString();
    await this.persist(target);
    return target;
  }

  async restore(id: string): Promise<SkillCard> {
    const skills = await this.readRegistry();
    const target = skills.find(skill => skill.id === id);
    if (!target) {
      throw new Error(`Skill ${id} not found`);
    }

    target.status = target.previousStatus ?? 'lab';
    target.previousStatus = undefined;
    target.disabledReason = undefined;
    target.restoredAt = new Date().toISOString();
    target.updatedAt = new Date().toISOString();
    await this.persist(target);
    return target;
  }

  async retire(id: string, reason?: string): Promise<SkillCard> {
    const skills = await this.readRegistry();
    const target = skills.find(skill => skill.id === id);
    if (!target) {
      throw new Error(`Skill ${id} not found`);
    }

    target.previousStatus = target.status;
    target.status = 'disabled';
    target.disabledReason = reason ?? 'retired_from_admin';
    target.retiredAt = new Date().toISOString();
    target.updatedAt = new Date().toISOString();
    await this.persist(target);
    return target;
  }

  async publishPluginDraft(draft: PluginDraft): Promise<PluginDraft> {
    const filePath = join(this.root, 'plugins-lab', `${draft.id}.json`);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(draft, null, 2));
    return draft;
  }

  private async persist(skill: SkillCard): Promise<void> {
    const skills = await this.readRegistry();
    const deduped = skills.filter(item => item.id !== skill.id);
    deduped.push(skill);

    const targetDir = skill.status === 'stable' ? 'stable' : 'lab';
    const filePath = join(this.root, targetDir, `${skill.id}.json`);

    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(skill, null, 2));
    await this.writeRegistry(deduped);
  }

  private async readRegistry(): Promise<SkillCard[]> {
    const registryPath = join(this.root, 'registry.json');
    try {
      const raw = await readFile(registryPath, 'utf8');
      return JSON.parse(raw) as SkillCard[];
    } catch {
      return [];
    }
  }

  private async writeRegistry(skills: SkillCard[]): Promise<void> {
    const registryPath = join(this.root, 'registry.json');
    await mkdir(dirname(registryPath), { recursive: true });
    await writeFile(registryPath, JSON.stringify(skills, null, 2));
  }
}
