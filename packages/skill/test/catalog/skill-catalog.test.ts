import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readSkillCatalog, writeSkillCatalog, listSkills, getSkillById } from '../../src/catalog/skill-catalog';

let tmpDir: string;

function makeSkillCard(id: string, status = 'lab') {
  return {
    id,
    name: `Skill ${id}`,
    description: `Description for ${id}`,
    applicableGoals: ['goal-1'],
    requiredTools: ['tool-1'],
    steps: [{ title: 'Step 1', instruction: 'Do thing', toolNames: ['tool-1'] }],
    constraints: [],
    successSignals: ['done'],
    riskLevel: 'low',
    source: 'execution',
    status,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  };
}

beforeEach(async () => {
  tmpDir = await mkdtemp(join(tmpdir(), 'skill-catalog-test-'));
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('readSkillCatalog', () => {
  it('returns an empty array when registry.json does not exist', async () => {
    const result = await readSkillCatalog(tmpDir);
    expect(result).toEqual([]);
  });

  it('reads and parses the registry file', async () => {
    const skills = [makeSkillCard('s1'), makeSkillCard('s2')];
    await writeFile(join(tmpDir, 'registry.json'), JSON.stringify(skills));

    const result = await readSkillCatalog(tmpDir);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('s1');
  });

  it('returns empty array on malformed JSON', async () => {
    await writeFile(join(tmpDir, 'registry.json'), 'not valid json');

    const result = await readSkillCatalog(tmpDir);
    expect(result).toEqual([]);
  });
});

describe('writeSkillCatalog', () => {
  it('writes skills to registry.json', async () => {
    const skills = [makeSkillCard('s1')];
    await writeSkillCatalog(tmpDir, skills);

    const raw = await readFile(join(tmpDir, 'registry.json'), 'utf8');
    expect(JSON.parse(raw)).toEqual(skills);
  });

  it('creates the directory if it does not exist', async () => {
    const nestedDir = join(tmpDir, 'nested', 'dir');
    await writeSkillCatalog(nestedDir, [makeSkillCard('s1')]);

    const raw = await readFile(join(nestedDir, 'registry.json'), 'utf8');
    expect(JSON.parse(raw)).toHaveLength(1);
  });
});

describe('listSkills', () => {
  it('returns all skills when no status filter is provided', async () => {
    await writeSkillCatalog(tmpDir, [makeSkillCard('s1', 'lab'), makeSkillCard('s2', 'stable')]);

    const result = await listSkills(tmpDir);
    expect(result).toHaveLength(2);
  });

  it('filters skills by status', async () => {
    await writeSkillCatalog(tmpDir, [makeSkillCard('s1', 'lab'), makeSkillCard('s2', 'stable')]);

    const labSkills = await listSkills(tmpDir, 'lab' as any);
    expect(labSkills).toHaveLength(1);
    expect(labSkills[0].id).toBe('s1');
  });

  it('returns empty array when no skills match the filter', async () => {
    await writeSkillCatalog(tmpDir, [makeSkillCard('s1', 'lab')]);

    const result = await listSkills(tmpDir, 'stable' as any);
    expect(result).toEqual([]);
  });
});

describe('getSkillById', () => {
  it('returns the skill with matching id', async () => {
    await writeSkillCatalog(tmpDir, [makeSkillCard('s1'), makeSkillCard('s2')]);

    const result = await getSkillById(tmpDir, 's2');
    expect(result?.id).toBe('s2');
  });

  it('returns undefined when no skill matches', async () => {
    await writeSkillCatalog(tmpDir, [makeSkillCard('s1')]);

    const result = await getSkillById(tmpDir, 'nonexistent');
    expect(result).toBeUndefined();
  });
});
