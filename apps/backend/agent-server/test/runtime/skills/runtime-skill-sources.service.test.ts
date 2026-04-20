import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  describeSkillSourceProfilePolicyMock,
  loadAgentSkillManifestsMock,
  buildConnectorTemplateSuggestionsMock,
  evaluateSkillManifestSafetyMock,
  findAutoInstallableManifestMock
} = vi.hoisted(() => ({
  describeSkillSourceProfilePolicyMock: vi.fn(() => ({ enabledByProfile: true })),
  loadAgentSkillManifestsMock: vi.fn(async () => []),
  buildConnectorTemplateSuggestionsMock: vi.fn(() => []),
  evaluateSkillManifestSafetyMock: vi.fn((_context: unknown, manifest: any) => ({
    verdict: 'allow',
    trustScore: 0.9,
    reasons: [`safe:${manifest?.id ?? 'missing'}`]
  })),
  findAutoInstallableManifestMock: vi.fn(async () => undefined)
}));

vi.mock('@agent/runtime', () => ({
  describeSkillSourceProfilePolicy: describeSkillSourceProfilePolicyMock
}));

vi.mock('@agent/skill-runtime', async importOriginal => {
  const actual = await importOriginal<typeof import('@agent/skill-runtime')>();
  return {
    ...actual,
    loadAgentSkillManifests: loadAgentSkillManifestsMock
  };
});

vi.mock('../../../src/runtime/skills/runtime-skill-safety', () => ({
  buildConnectorTemplateSuggestions: buildConnectorTemplateSuggestionsMock,
  evaluateSkillManifestSafety: evaluateSkillManifestSafetyMock,
  findAutoInstallableManifest: findAutoInstallableManifestMock
}));

import {
  listSkillManifests,
  listSkillSources,
  resolveTaskSkillSearch,
  searchLocalSkillSuggestions,
  syncEnabledRemoteSkillSources
} from '../../../src/runtime/skills/runtime-skill-sources.service';

function createContext(overrides: Record<string, unknown> = {}) {
  return {
    settings: {
      workspaceRoot: '/workspace',
      skillsRoot: '/managed-skills',
      skillSourcesRoot: '/skill-sources',
      profile: 'platform',
      policy: {
        sourcePolicyMode: 'controlled-first',
        skillInstallMode: 'manual'
      }
    },
    toolRegistry: {
      get: vi.fn()
    },
    skillRegistry: {
      list: vi.fn(async () => [{ id: 'installed-skill' }])
    },
    skillSourceSyncService: {
      readCachedSyncState: vi.fn(async source => ({
        lastSyncedAt: `synced:${source.id}`,
        healthState: 'healthy',
        healthReason: `${source.id}:ok`
      })),
      readCachedManifests: vi.fn(async source => [
        {
          id: `${source.id}-manifest`,
          sourceId: source.id,
          version: '1.0.0',
          displayName: `${source.id} manifest`
        }
      ]),
      syncSource: vi.fn(async () => undefined)
    },
    remoteSkillDiscoveryService: {
      discover: vi.fn(async () => ({
        capabilityGapDetected: true,
        suggestions: [
          {
            id: 'remote-installable',
            displayName: 'Remote Installable',
            availability: 'installable',
            kind: 'remote-skill'
          }
        ],
        triggerReason: 'capability_gap_detected',
        remoteSearch: {
          query: 'find skill',
          discoverySource: 'skills.sh',
          executedAt: '2026-04-08T00:00:00.000Z',
          results: [{ id: 'remote-installable' }]
        }
      }))
    },
    getDisabledSkillSourceIds: vi.fn(async () => ['managed-local-skills']),
    autoInstallLocalManifest: vi.fn(async () => undefined),
    ...overrides
  } as any;
}

describe('runtime-skill-sources.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    describeSkillSourceProfilePolicyMock.mockImplementation((sourceId: string) => ({
      enabledByProfile: sourceId !== 'skills-sh-directory',
      reason: sourceId === 'skills-sh-directory' ? 'profile gated' : undefined
    }));
    loadAgentSkillManifestsMock.mockResolvedValue([
      {
        id: 'workspace-manifest',
        sourceId: 'workspace-skills',
        version: '1.0.0',
        displayName: 'Workspace Manifest'
      },
      {
        id: 'workspace-manifest',
        sourceId: 'workspace-skills',
        version: '1.0.0',
        displayName: 'Workspace Manifest Duplicate'
      }
    ]);
    buildConnectorTemplateSuggestionsMock.mockReturnValue([
      {
        id: 'github-mcp-template',
        displayName: 'GitHub MCP',
        availability: 'connector-template',
        kind: 'connector-template',
        reason: 'needs github'
      }
    ]);
    findAutoInstallableManifestMock.mockResolvedValue(undefined);
  });

  it('lists sources with disabled and profile-gated state applied', async () => {
    const context = createContext();

    const sources = await listSkillSources(context);

    expect(sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'workspace-skills',
          enabled: true,
          healthState: 'healthy',
          lastSyncedAt: undefined
        }),
        expect.objectContaining({
          id: 'managed-local-skills',
          enabled: false,
          healthState: 'disabled',
          healthReason: '该来源已在控制台停用。'
        }),
        expect.objectContaining({
          id: 'skills-sh-directory',
          enabled: false,
          healthState: 'disabled',
          healthReason: 'profile gated',
          lastSyncedAt: 'synced:skills-sh-directory'
        })
      ])
    );
  });

  it('merges local and remote manifests and attaches safety summaries', async () => {
    const context = createContext();

    const manifests = await listSkillManifests(context);

    expect(manifests).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'workspace-manifest',
          sourceId: 'workspace-skills',
          safety: expect.objectContaining({
            verdict: 'allow',
            reasons: ['safe:workspace-manifest']
          })
        }),
        expect.objectContaining({
          id: 'bundled-marketplace-manifest',
          sourceId: 'bundled-marketplace',
          safety: expect.objectContaining({
            verdict: 'allow',
            reasons: ['safe:bundled-marketplace-manifest']
          })
        })
      ])
    );
    expect(manifests.filter((item: any) => item.id === 'workspace-manifest')).toHaveLength(1);
  });

  it('delegates local skill suggestion search with installed skills, manifests, and sources', async () => {
    const context = createContext();

    const result = await searchLocalSkillSuggestions(context, 'find skill', {
      usedInstalledSkills: ['installed-skill'],
      specialistDomain: 'technical-architecture',
      limit: 2
    });

    expect(context.remoteSkillDiscoveryService.discover).toHaveBeenCalledWith(
      expect.objectContaining({
        goal: 'find skill',
        installedSkills: [{ id: 'installed-skill' }],
        usedInstalledSkills: ['installed-skill'],
        specialistDomain: 'technical-architecture',
        limit: 2
      })
    );
    expect(result.capabilityGapDetected).toBe(true);
  });

  it('resolves task skill search with connector recommendations and auto-install flow', async () => {
    const context = createContext({
      settings: {
        workspaceRoot: '/workspace',
        skillsRoot: '/managed-skills',
        skillSourcesRoot: '/skill-sources',
        profile: 'platform',
        policy: {
          sourcePolicyMode: 'controlled-first',
          skillInstallMode: 'low-risk-auto'
        }
      }
    });
    const autoManifest = {
      id: 'auto-installed-manifest',
      sourceId: 'workspace-skills',
      version: '1.0.0',
      displayName: 'Auto Installed Manifest'
    };
    buildConnectorTemplateSuggestionsMock.mockReturnValueOnce([
      {
        id: 'github-mcp-template',
        displayName: 'GitHub MCP',
        availability: 'connector-template',
        kind: 'connector-template',
        reason: 'needs github'
      }
    ]);
    findAutoInstallableManifestMock.mockResolvedValue(autoManifest);
    const discover = context.remoteSkillDiscoveryService.discover as ReturnType<typeof vi.fn>;
    discover
      .mockResolvedValueOnce({
        capabilityGapDetected: true,
        suggestions: [
          {
            id: 'remote-installable',
            displayName: 'Remote Installable',
            availability: 'installable',
            kind: 'remote-skill'
          }
        ],
        triggerReason: 'capability_gap_detected',
        remoteSearch: {
          query: 'need github connector',
          discoverySource: 'skills.sh',
          executedAt: '2026-04-08T00:00:00.000Z',
          results: [{ id: 'remote-installable' }]
        }
      })
      .mockResolvedValueOnce({
        capabilityGapDetected: true,
        suggestions: [
          {
            id: 'ready-skill',
            displayName: 'Ready Skill',
            availability: 'ready',
            kind: 'installed'
          }
        ],
        triggerReason: 'capability_gap_detected'
      });

    const result = await resolveTaskSkillSearch(context, 'need github connector', {
      usedInstalledSkills: ['installed-skill']
    });

    expect(context.autoInstallLocalManifest).toHaveBeenCalledWith(autoManifest);
    expect(result.status).toBe('auto-installed');
    expect(result.safetyNotes[0]).toContain('自动安装低风险技能 auto-installed-manifest');
    expect(result.mcpRecommendation).toEqual({
      kind: 'skill',
      summary: '当前能力链路存在缺口，优先建议补 skill。',
      reason: '目标“need github connector”当前没有足够的 ready skill。'
    });
    expect(result.remoteSearch).toBeUndefined();
  });

  it('marks missing capability as blocked and syncs only enabled remote sources', async () => {
    buildConnectorTemplateSuggestionsMock.mockReturnValueOnce([]);
    const syncSource = vi.fn(async () => undefined);
    const context = createContext({
      remoteSkillDiscoveryService: {
        discover: vi.fn(async () => ({
          capabilityGapDetected: true,
          suggestions: [],
          triggerReason: 'capability_gap_detected'
        }))
      },
      skillSourceSyncService: {
        readCachedSyncState: vi.fn(async () => ({
          lastSyncedAt: 'now',
          healthState: 'healthy'
        })),
        readCachedManifests: vi.fn(async () => []),
        syncSource
      }
    });

    const result = await resolveTaskSkillSearch(context, 'no matching skill');
    await syncEnabledRemoteSkillSources(context);

    expect(result.status).toBe('blocked');
    expect(result.mcpRecommendation).toEqual({
      kind: 'skill',
      summary: '当前能力链路存在缺口，优先建议补 skill。',
      reason: '目标“no matching skill”当前没有足够的 ready skill。'
    });
    expect(syncSource).toHaveBeenCalledTimes(1);
    expect(syncSource).toHaveBeenCalledWith(expect.objectContaining({ id: 'bundled-marketplace' }));
  });
});
