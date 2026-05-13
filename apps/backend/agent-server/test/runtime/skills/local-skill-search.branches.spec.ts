import { describe, expect, it } from 'vitest';

import { buildLocalSkillSuggestions } from '../../../src/runtime/skills/local-skill-search';

function makeSkillCard(overrides: Record<string, any> = {}) {
  return {
    id: 'skill-1',
    name: 'Data Analysis',
    description: 'Analyze data files',
    sourceId: 'source-1',
    version: '1.0.0',
    status: 'active' as const,
    applicableGoals: ['analyze', 'data'],
    requiredTools: ['read_file'],
    requiredCapabilities: ['file-access'],
    requiredConnectors: [],
    constraints: [],
    successSignals: [],
    successRate: 0.8,
    governanceRecommendation: 'promote' as const,
    ...overrides
  };
}

function makeManifest(overrides: Record<string, any> = {}) {
  return {
    id: 'manifest-1',
    name: 'Code Review',
    description: 'Review code quality',
    summary: 'Automated code review',
    sourceId: 'source-1',
    version: '2.0.0',
    triggers: ['review', 'code'],
    allowedTools: ['read_file'],
    requiredCapabilities: ['code-access'],
    requiredConnectors: [],
    preferredMinistries: [],
    recommendedSpecialists: [],
    executionHints: [],
    compressionHints: [],
    safety: { verdict: 'allow' as const },
    compatibility: 'node18',
    ...overrides
  };
}

function makeSource(overrides: Record<string, any> = {}) {
  return {
    id: 'source-1',
    name: 'Local Source',
    enabled: true,
    trustClass: 'internal' as const,
    priority: 'managed/local' as const,
    discoveryMode: 'local',
    healthReason: undefined,
    ...overrides
  };
}

describe('buildLocalSkillSuggestions', () => {
  it('returns empty suggestions when no token matches and no effectiveness boost', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'zzzzqqqqxxxx nonmatching',
      installedSkills: [makeSkillCard({ successRate: 0, governanceRecommendation: undefined })],
      manifests: [],
      sources: [],
      profile: 'learning'
    });
    expect(result.suggestions).toHaveLength(0);
    expect(result.capabilityGapDetected).toBe(true);
  });

  it('matches installed skills by goal tokens', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'analyze data files',
      installedSkills: [makeSkillCard()],
      manifests: [],
      sources: [],
      profile: 'learning'
    });
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions[0].kind).toBe('installed');
    expect(result.suggestions[0].availability).toBe('ready');
  });

  it('marks disabled installed skills as blocked', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'analyze data',
      installedSkills: [makeSkillCard({ status: 'disabled' })],
      manifests: [],
      sources: [],
      profile: 'learning'
    });
    expect(result.suggestions[0].availability).toBe('blocked');
  });

  it('detects used installed skills in reason', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'analyze data',
      installedSkills: [makeSkillCard()],
      manifests: [],
      sources: [],
      usedInstalledSkills: ['installed-skill:skill-1'],
      profile: 'learning'
    });
    expect(result.suggestions[0].reason).toContain('命中');
  });

  it('detects used installed skills by direct id', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'analyze data',
      installedSkills: [makeSkillCard()],
      manifests: [],
      sources: [],
      usedInstalledSkills: ['skill-1'],
      profile: 'learning'
    });
    expect(result.suggestions[0].reason).toContain('命中');
  });

  it('uses requiredTools as requiredCapabilities fallback', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'analyze data',
      installedSkills: [makeSkillCard({ requiredCapabilities: undefined })],
      manifests: [],
      sources: [],
      profile: 'learning'
    });
    expect(result.suggestions[0].requiredCapabilities).toEqual(['read_file']);
  });

  it('matches manifests and determines availability', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'review code quality',
      installedSkills: [],
      manifests: [makeManifest()],
      sources: [makeSource()],
      profile: 'learning'
    });
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions[0].kind).toBe('manifest');
    expect(result.suggestions[0].availability).toBe('installable-local');
  });

  it('marks manifest as blocked when source is disabled', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'review code quality',
      installedSkills: [],
      manifests: [makeManifest()],
      sources: [makeSource({ enabled: false })],
      profile: 'learning'
    });
    expect(result.suggestions[0].availability).toBe('blocked');
  });

  it('marks manifest as approval-required when safety needs-approval', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'review code quality',
      installedSkills: [],
      manifests: [makeManifest({ safety: { verdict: 'needs-approval' } })],
      sources: [makeSource()],
      profile: 'learning'
    });
    expect(result.suggestions[0].availability).toBe('approval-required');
  });

  it('marks manifest as approval-required when trustClass is community', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'review code quality',
      installedSkills: [],
      manifests: [makeManifest()],
      sources: [makeSource({ trustClass: 'community' })],
      profile: 'learning'
    });
    expect(result.suggestions[0].availability).toBe('approval-required');
  });

  it('marks manifest as installable-remote when discoveryMode is remote-index', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'review code quality',
      installedSkills: [],
      manifests: [makeManifest()],
      sources: [makeSource({ discoveryMode: 'remote-index' })],
      profile: 'learning'
    });
    expect(result.suggestions[0].availability).toBe('installable-remote');
  });

  it('marks manifest as installable-remote when discoveryMode is git-registry', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'review code quality',
      installedSkills: [],
      manifests: [makeManifest()],
      sources: [makeSource({ discoveryMode: 'git-registry' })],
      profile: 'learning'
    });
    expect(result.suggestions[0].availability).toBe('installable-remote');
  });

  it('marks manifest as installable-remote when discoveryMode is http-manifest', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'review code quality',
      installedSkills: [],
      manifests: [makeManifest()],
      sources: [makeSource({ discoveryMode: 'http-manifest' })],
      profile: 'learning'
    });
    expect(result.suggestions[0].availability).toBe('installable-remote');
  });

  it('uses healthReason for disabled source', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'review code quality',
      installedSkills: [],
      manifests: [makeManifest()],
      sources: [makeSource({ enabled: false, healthReason: 'Connection timeout' })],
      profile: 'learning'
    });
    expect(result.suggestions[0].reason).toBe('Connection timeout');
  });

  it('sorts by score and deduplicates', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'analyze data',
      installedSkills: [
        makeSkillCard({ id: 's1', name: 'Data Analysis', description: 'analyze data' }),
        makeSkillCard({ id: 's1', name: 'Data Analysis', description: 'analyze data' })
      ],
      manifests: [],
      sources: [],
      profile: 'learning',
      limit: 3
    });
    const ids = result.suggestions.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('respects limit parameter', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'analyze data',
      installedSkills: [
        makeSkillCard({ id: 's1' }),
        makeSkillCard({ id: 's2', name: 'Data Processing' }),
        makeSkillCard({ id: 's3', name: 'Data Export' })
      ],
      manifests: [],
      sources: [],
      profile: 'learning',
      limit: 1
    });
    expect(result.suggestions.length).toBeLessThanOrEqual(1);
  });

  it('sets capabilityGapDetected to false when ready installed skill matches', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'analyze data',
      installedSkills: [makeSkillCard({ status: 'active' })],
      manifests: [],
      sources: [],
      profile: 'learning'
    });
    expect(result.capabilityGapDetected).toBe(false);
  });

  it('includes all manifest fields in suggestion', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'review code quality',
      installedSkills: [],
      manifests: [
        makeManifest({
          preferredMinistries: ['gongbu'],
          preferredConnectors: ['github'],
          specialistAffinity: ['coder'],
          triggers: ['review'],
          recommendedSpecialists: ['senior-coder'],
          executionHints: ['use-cache'],
          compressionHints: ['compress-context']
        })
      ],
      sources: [makeSource()],
      profile: 'learning'
    });
    const suggestion = result.suggestions[0];
    expect(suggestion.preferredMinistries).toEqual(['gongbu']);
    expect(suggestion.preferredConnectors).toEqual(['github']);
    expect(suggestion.specialistAffinity).toEqual(['coder']);
    expect(suggestion.triggers).toEqual(['review']);
    expect(suggestion.recommendedSpecialists).toEqual(['senior-coder']);
    expect(suggestion.executionHints).toEqual(['use-cache']);
    expect(suggestion.compressionHints).toEqual(['compress-context']);
  });

  it('handles governance recommendations for scoring', () => {
    const skills = [
      makeSkillCard({ id: 's1', name: 'Skill Promote', governanceRecommendation: 'promote', successRate: 0.5 }),
      makeSkillCard({ id: 's2', name: 'Skill Keep', governanceRecommendation: 'keep-lab', successRate: 0.5 }),
      makeSkillCard({ id: 's3', name: 'Skill Disable', governanceRecommendation: 'disable', successRate: 0.5 }),
      makeSkillCard({ id: 's4', name: 'Skill Retire', governanceRecommendation: 'retire', successRate: 0.5 }),
      makeSkillCard({ id: 's5', name: 'Skill None', governanceRecommendation: undefined, successRate: 0.5 })
    ];
    const result = buildLocalSkillSuggestions({
      goal: 'analyze data',
      installedSkills: skills,
      manifests: [],
      sources: [],
      profile: 'learning'
    });
    // All should match since they have the same base content
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it('handles source without healthReason for disabled manifest', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'review code quality',
      installedSkills: [],
      manifests: [makeManifest()],
      sources: [makeSource({ enabled: false, healthReason: undefined })],
      profile: 'learning'
    });
    expect(result.suggestions[0].reason).toContain('profile');
  });

  it('handles empty goal with zero-effectiveness skill produces no matches', () => {
    const result = buildLocalSkillSuggestions({
      goal: '',
      installedSkills: [makeSkillCard({ successRate: 0, governanceRecommendation: undefined })],
      manifests: [makeManifest()],
      sources: [makeSource()],
      profile: 'learning'
    });
    // Empty goal -> scoreTokens returns 0, effectiveness boost is 0 -> score <= 0, no match
    expect(result.suggestions).toHaveLength(0);
  });

  it('includes sourceLabel and sourceTrustClass for manifest suggestions', () => {
    const result = buildLocalSkillSuggestions({
      goal: 'review code quality',
      installedSkills: [],
      manifests: [makeManifest()],
      sources: [makeSource({ name: 'My Source', trustClass: 'internal' })],
      profile: 'learning'
    });
    expect(result.suggestions[0].sourceLabel).toBe('My Source');
    expect(result.suggestions[0].sourceTrustClass).toBe('internal');
  });

  it('sets installationMode based on remoteInstallable', () => {
    const localResult = buildLocalSkillSuggestions({
      goal: 'review code quality',
      installedSkills: [],
      manifests: [makeManifest()],
      sources: [makeSource({ discoveryMode: 'local' })],
      profile: 'learning'
    });
    expect(localResult.suggestions[0].installationMode).toBe('builtin');

    const remoteResult = buildLocalSkillSuggestions({
      goal: 'review code quality',
      installedSkills: [],
      manifests: [makeManifest()],
      sources: [makeSource({ discoveryMode: 'remote-index' })],
      profile: 'learning'
    });
    expect(remoteResult.suggestions[0].installationMode).toBe('marketplace-managed');
  });
});
