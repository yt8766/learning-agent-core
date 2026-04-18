import { existsSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { SkillRegistry, loadAgentSkillManifests } from '../src';
import * as contractSkillRuntimeFacade from '../src/contracts/skill-runtime-facade';
import { SkillRegistry as canonicalSkillRegistry } from '../src/registry/skill-registry';
import { loadAgentSkillManifests as canonicalLoadAgentSkillManifests } from '../src/sources/agent-skill-loader';

describe('@agent/skill-runtime root exports', () => {
  it('keeps root exports wired to canonical hosts', () => {
    expect(SkillRegistry).toBe(canonicalSkillRegistry);
    expect(loadAgentSkillManifests).toBe(canonicalLoadAgentSkillManifests);
  });

  it('keeps the package root aligned with the stable skill-runtime facade contract', () => {
    expect(SkillRegistry).toBe(contractSkillRuntimeFacade.SkillRegistry);
    expect(loadAgentSkillManifests).toBe(contractSkillRuntimeFacade.loadAgentSkillManifests);
  });

  it('retains the skill-runtime facade contract file as a stable package export boundary', () => {
    expect(existsSync(new URL('../src/contracts/skill-runtime-facade.ts', import.meta.url))).toBe(true);
  });
});
