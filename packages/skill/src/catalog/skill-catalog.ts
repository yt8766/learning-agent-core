import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { SkillCard, SkillStatus } from '@agent/core';

function registryPath(root: string) {
  return join(root, 'registry.json');
}

export async function readSkillCatalog(root: string): Promise<SkillCard[]> {
  try {
    const raw = await readFile(registryPath(root), 'utf8');
    return JSON.parse(raw) as SkillCard[];
  } catch {
    return [];
  }
}

export async function writeSkillCatalog(root: string, skills: SkillCard[]): Promise<void> {
  const targetPath = registryPath(root);
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, JSON.stringify(skills, null, 2));
}

export async function listSkills(root: string, status?: SkillStatus): Promise<SkillCard[]> {
  const skills = await readSkillCatalog(root);
  return status ? skills.filter(skill => skill.status === status) : skills;
}

export async function getSkillById(root: string, id: string): Promise<SkillCard | undefined> {
  const skills = await readSkillCatalog(root);
  return skills.find(skill => skill.id === id);
}
