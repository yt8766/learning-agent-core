import { describe, expect, it } from 'vitest';

import { BOOTSTRAP_SKILLS, listBootstrapSkills } from '../src';

describe('@agent/shared bootstrap skill registry', () => {
  it('returns a defensive copy of bootstrap skills', () => {
    const skills = listBootstrapSkills();

    expect(skills).toHaveLength(BOOTSTRAP_SKILLS.length);
    expect(skills[0]?.id).toBe('task-intake');

    skills.pop();

    expect(listBootstrapSkills()).toHaveLength(BOOTSTRAP_SKILLS.length);
  });
});
