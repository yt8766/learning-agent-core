import { existsSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  buildSkillSearchMcpRecommendation,
  buildSkillSearchSafetyNotes,
  buildSkillDraftInstallCandidate,
  findInstallableManifestSuggestion,
  loadAgentSkillManifests,
  resolveSkillSearchStatus,
  sanitizeListedSkills,
  shouldAutoInstallManifest,
  SkillRegistry
} from '../src';
import * as contractSkillRuntimeFacade from '../src/contracts/skill-runtime-facade';
import { sanitizeListedSkills as canonicalSanitizeListedSkills } from '../src/catalog/skill-card-listing';
import {
  findInstallableManifestSuggestion as canonicalFindInstallableManifestSuggestion,
  shouldAutoInstallManifest as canonicalShouldAutoInstallManifest
} from '../src/install/skill-auto-install';
import { buildSkillDraftInstallCandidate as canonicalBuildSkillDraftInstallCandidate } from '../src/drafts/install-candidate';
import { SkillRegistry as canonicalSkillRegistry } from '../src/registry/skill-registry';
import { loadAgentSkillManifests as canonicalLoadAgentSkillManifests } from '../src/sources/agent-skill-loader';
import {
  buildSkillSearchMcpRecommendation as canonicalBuildSkillSearchMcpRecommendation,
  buildSkillSearchSafetyNotes as canonicalBuildSkillSearchSafetyNotes,
  resolveSkillSearchStatus as canonicalResolveSkillSearchStatus
} from '../src/sources/skill-search-resolution';

describe('@agent/skill root exports', () => {
  it('keeps root exports wired to canonical hosts', () => {
    expect(SkillRegistry).toBe(canonicalSkillRegistry);
    expect(loadAgentSkillManifests).toBe(canonicalLoadAgentSkillManifests);
    expect(sanitizeListedSkills).toBe(canonicalSanitizeListedSkills);
    expect(findInstallableManifestSuggestion).toBe(canonicalFindInstallableManifestSuggestion);
    expect(shouldAutoInstallManifest).toBe(canonicalShouldAutoInstallManifest);
    expect(resolveSkillSearchStatus).toBe(canonicalResolveSkillSearchStatus);
    expect(buildSkillSearchSafetyNotes).toBe(canonicalBuildSkillSearchSafetyNotes);
    expect(buildSkillSearchMcpRecommendation).toBe(canonicalBuildSkillSearchMcpRecommendation);
    expect(buildSkillDraftInstallCandidate).toBe(canonicalBuildSkillDraftInstallCandidate);
  });

  it('keeps the package root aligned with the stable skill-runtime facade contract', () => {
    expect(SkillRegistry).toBe(contractSkillRuntimeFacade.SkillRegistry);
    expect(loadAgentSkillManifests).toBe(contractSkillRuntimeFacade.loadAgentSkillManifests);
  });

  it('retains the skill-runtime facade contract file as a stable package export boundary', () => {
    expect(existsSync(new URL('../src/contracts/skill-runtime-facade.ts', import.meta.url))).toBe(true);
  });
});
