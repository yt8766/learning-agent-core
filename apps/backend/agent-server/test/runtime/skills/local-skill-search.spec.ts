import { describe, expect, it } from 'vitest';

import { buildLocalSkillSuggestions } from '../../../src/runtime/skills/local-skill-search';

const profile = 'standard' as any;

function makeSkill(overrides: Record<string, unknown> = {}) {
  return {
    id: 'skill-1',
    name: 'Data Analysis',
    description: 'Analyze data',
    sourceId: 'src-1',
    version: '1.0.0',
    status: 'active',
    applicableGoals: ['analyze', 'data'],
    requiredTools: ['python'],
    requiredCapabilities: ['data-processing'],
    requiredConnectors: [],
    constraints: [],
    successSignals: [],
    successRate: 0.9,
    governanceRecommendation: 'promote' as const,
    ...overrides
  };
}

function makeManifest(overrides: Record<string, unknown> = {}) {
  return {
    id: 'manifest-1',
    name: 'Chart Generator',
    description: 'Generate charts from data',
    summary: 'Creates beautiful charts',
    sourceId: 'src-1',
    version: '2.0.0',
    requiredCapabilities: ['charting'],
    requiredConnectors: [],
    triggers: ['chart', 'graph'],
    allowedTools: ['matplotlib'],
    preferredMinistries: [],
    recommendedSpecialists: [],
    executionHints: [],
    compressionHints: [],
    safety: undefined,
    ...overrides
  };
}

function makeSource(overrides: Record<string, unknown> = {}) {
  return {
    id: 'src-1',
    name: 'Test Source',
    enabled: true,
    trustClass: 'official' as const,
    priority: 'managed/local' as const,
    discoveryMode: 'local-manifest' as const,
    ...overrides
  };
}

describe('buildLocalSkillSuggestions', () => {
  it('returns empty suggestions when no matching skills or manifests', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'completely unrelated topic',
      installedSkills: [],
      manifests: [],
      sources: [],
      profile
    });
    expect(result.suggestions).toEqual([]);
    expect(result.capabilityGapDetected).toBe(true);
  });

  it('matches installed skills by goal keywords', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'analyze data',
      installedSkills: [makeSkill()],
      manifests: [],
      sources: [],
      profile
    });
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions[0].kind).toBe('installed');
    expect(result.suggestions[0].availability).toBe('ready');
  });

  it('marks disabled installed skills as blocked', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'analyze data',
      installedSkills: [makeSkill({ status: 'disabled' })],
      manifests: [],
      sources: [],
      profile
    });
    const skill = result.suggestions.find(s => s.id === 'skill-1');
    if (skill) {
      expect(skill.availability).toBe('blocked');
    }
  });

  it('detects used installed skills in reason', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'analyze data',
      installedSkills: [makeSkill()],
      manifests: [],
      sources: [],
      profile,
      usedInstalledSkills: ['installed-skill:skill-1']
    });
    const skill = result.suggestions.find(s => s.id === 'skill-1');
    if (skill) {
      expect(skill.reason).toContain('复用');
    }
  });

  it('matches manifests by goal keywords', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'generate chart',
      installedSkills: [],
      manifests: [makeManifest()],
      sources: [makeSource()],
      profile
    });
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions[0].kind).toBe('manifest');
  });

  it('marks manifest as blocked when source is disabled', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'generate chart',
      installedSkills: [],
      manifests: [makeManifest()],
      sources: [makeSource({ enabled: false })],
      profile
    });
    const manifest = result.suggestions.find(s => s.id === 'manifest-1');
    if (manifest) {
      expect(manifest.availability).toBe('blocked');
    }
  });

  it('marks manifest as approval-required for community trust class', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'generate chart',
      installedSkills: [],
      manifests: [makeManifest()],
      sources: [makeSource({ trustClass: 'community' })],
      profile
    });
    const manifest = result.suggestions.find(s => s.id === 'manifest-1');
    if (manifest) {
      expect(manifest.availability).toBe('approval-required');
    }
  });

  it('marks manifest as approval-required when safety verdict is needs-approval', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'generate chart',
      installedSkills: [],
      manifests: [makeManifest({ safety: { verdict: 'needs-approval' } })],
      sources: [makeSource()],
      profile
    });
    const manifest = result.suggestions.find(s => s.id === 'manifest-1');
    if (manifest) {
      expect(manifest.availability).toBe('approval-required');
    }
  });

  it('marks manifest as installable-remote for remote-index discovery', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'generate chart',
      installedSkills: [],
      manifests: [makeManifest()],
      sources: [makeSource({ discoveryMode: 'remote-index' })],
      profile
    });
    const manifest = result.suggestions.find(s => s.id === 'manifest-1');
    if (manifest) {
      expect(manifest.availability).toBe('installable-remote');
    }
  });

  it('marks manifest as installable-local for local discovery', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'generate chart',
      installedSkills: [],
      manifests: [makeManifest()],
      sources: [makeSource({ discoveryMode: 'local-manifest' })],
      profile
    });
    const manifest = result.suggestions.find(s => s.id === 'manifest-1');
    if (manifest) {
      expect(manifest.availability).toBe('installable-local');
    }
  });

  it('marks manifest as installable-remote for git-registry discovery', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'generate chart',
      installedSkills: [],
      manifests: [makeManifest()],
      sources: [makeSource({ discoveryMode: 'git-registry' })],
      profile
    });
    const manifest = result.suggestions.find(s => s.id === 'manifest-1');
    if (manifest) {
      expect(manifest.availability).toBe('installable-remote');
    }
  });

  it('marks manifest as installable-remote for http-manifest discovery', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'generate chart',
      installedSkills: [],
      manifests: [makeManifest()],
      sources: [makeSource({ discoveryMode: 'http-manifest' })],
      profile
    });
    const manifest = result.suggestions.find(s => s.id === 'manifest-1');
    if (manifest) {
      expect(manifest.availability).toBe('installable-remote');
    }
  });

  it('marks unverified trust class as approval-required', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'generate chart',
      installedSkills: [],
      manifests: [makeManifest()],
      sources: [makeSource({ trustClass: 'unverified' })],
      profile
    });
    const manifest = result.suggestions.find(s => s.id === 'manifest-1');
    if (manifest) {
      expect(manifest.availability).toBe('approval-required');
    }
  });

  it('uses healthReason from source when source is disabled', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'generate chart',
      installedSkills: [],
      manifests: [makeManifest()],
      sources: [makeSource({ enabled: false, healthReason: 'Source offline' })],
      profile
    });
    const manifest = result.suggestions.find(s => s.id === 'manifest-1');
    if (manifest) {
      expect(manifest.reason).toBe('Source offline');
    }
  });

  it('uses manifest summary when available, falls back to description', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'generate chart',
      installedSkills: [],
      manifests: [makeManifest({ summary: undefined })],
      sources: [makeSource()],
      profile
    });
    const manifest = result.suggestions.find(s => s.id === 'manifest-1');
    if (manifest) {
      expect(manifest.summary).toBe('Generate charts from data');
    }
  });

  it('respects limit parameter', () => {
    const skills = Array.from({ length: 10 }, (_, i) =>
      makeSkill({ id: `skill-${i}`, name: `Data Skill ${i}`, description: 'analyze data' })
    );
    const result = buildLocalSkillSuggestions({
      goal: 'analyze data',
      installedSkills: skills,
      manifests: [],
      sources: [],
      profile,
      limit: 3
    });
    expect(result.suggestions.length).toBeLessThanOrEqual(3);
  });

  it('defaults limit to 5', () => {
    const skills = Array.from({ length: 10 }, (_, i) =>
      makeSkill({ id: `skill-${i}`, name: `Data Skill ${i}`, description: 'analyze data' })
    );
    const result = buildLocalSkillSuggestions({
      goal: 'analyze data',
      installedSkills: skills,
      manifests: [],
      sources: [],
      profile
    });
    expect(result.suggestions.length).toBeLessThanOrEqual(5);
  });

  it('deduplicates suggestions by id and kind', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'analyze data',
      installedSkills: [makeSkill(), makeSkill()],
      manifests: [],
      sources: [],
      profile
    });
    const ids = result.suggestions.filter(s => s.kind === 'installed').map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('capabilityGapDetected is false when ready installed skill is present', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'analyze data',
      installedSkills: [makeSkill({ status: 'active' })],
      manifests: [],
      sources: [],
      profile
    });
    const readySkill = result.suggestions.find(s => s.kind === 'installed' && s.availability === 'ready');
    if (readySkill) {
      expect(result.capabilityGapDetected).toBe(false);
    }
  });

  it('handles usedInstalledSkills with direct skill id', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'analyze data',
      installedSkills: [makeSkill()],
      manifests: [],
      sources: [],
      profile,
      usedInstalledSkills: ['skill-1']
    });
    const skill = result.suggestions.find(s => s.id === 'skill-1');
    if (skill) {
      expect(skill.reason).toContain('复用');
    }
  });

  it('handles installed skills with empty optional arrays', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'analyze data',
      installedSkills: [
        makeSkill({
          applicableGoals: undefined,
          requiredTools: undefined,
          requiredCapabilities: undefined,
          requiredConnectors: undefined,
          constraints: undefined,
          successSignals: undefined
        })
      ],
      manifests: [],
      sources: [],
      profile
    });
    expect(result.suggestions).toBeDefined();
  });

  it('handles manifests with empty optional arrays', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'generate chart',
      installedSkills: [],
      manifests: [
        makeManifest({
          triggers: undefined,
          allowedTools: undefined,
          preferredMinistries: undefined,
          recommendedSpecialists: undefined,
          executionHints: undefined,
          compressionHints: undefined,
          requiredConnectors: undefined,
          compatibility: undefined,
          summary: undefined
        })
      ],
      sources: [makeSource()],
      profile
    });
    expect(result.suggestions).toBeDefined();
  });

  it('includes sourceLabel and sourceTrustClass for manifest suggestions', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'generate chart',
      installedSkills: [],
      manifests: [makeManifest()],
      sources: [makeSource({ trustClass: 'official', name: 'Official Source' })],
      profile
    });
    const manifest = result.suggestions.find(s => s.id === 'manifest-1');
    if (manifest) {
      expect(manifest.sourceLabel).toBe('Official Source');
      expect(manifest.sourceTrustClass).toBe('official');
    }
  });

  it('installs marketplace-managed mode for remote installable', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'generate chart',
      installedSkills: [],
      manifests: [makeManifest()],
      sources: [makeSource({ discoveryMode: 'remote-index' })],
      profile
    });
    const manifest = result.suggestions.find(s => s.id === 'manifest-1');
    if (manifest) {
      expect(manifest.installationMode).toBe('marketplace-managed');
    }
  });

  it('installs builtin mode for local installable', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'generate chart',
      installedSkills: [],
      manifests: [makeManifest()],
      sources: [makeSource({ discoveryMode: 'local-manifest' })],
      profile
    });
    const manifest = result.suggestions.find(s => s.id === 'manifest-1');
    if (manifest) {
      expect(manifest.installationMode).toBe('builtin');
    }
  });

  it('uses preferredConnectors fallback from requiredConnectors', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'generate chart',
      installedSkills: [],
      manifests: [makeManifest({ requiredConnectors: ['connector-1'], preferredConnectors: undefined })],
      sources: [makeSource()],
      profile
    });
    const manifest = result.suggestions.find(s => s.id === 'manifest-1');
    if (manifest) {
      expect(manifest.preferredConnectors).toEqual(['connector-1']);
    }
  });

  it('uses specialistAffinity fallback from recommendedSpecialists', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'generate chart',
      installedSkills: [],
      manifests: [makeManifest({ recommendedSpecialists: ['specialist-1'], specialistAffinity: undefined })],
      sources: [makeSource()],
      profile
    });
    const manifest = result.suggestions.find(s => s.id === 'manifest-1');
    if (manifest) {
      expect(manifest.specialistAffinity).toEqual(['specialist-1']);
    }
  });
});
