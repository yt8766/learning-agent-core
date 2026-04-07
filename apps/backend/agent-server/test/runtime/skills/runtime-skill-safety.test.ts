import { beforeEach, describe, expect, it, vi } from 'vitest';

const skillSafetyMocks = vi.hoisted(() => ({
  listSkillSourcesSnapshotMock: vi.fn(),
  listSkillManifestsMock: vi.fn()
}));

vi.mock('../../../src/runtime/helpers/runtime-connector-registry', () => ({
  listSkillSourcesSnapshot: (...args: unknown[]) => skillSafetyMocks.listSkillSourcesSnapshotMock(...args)
}));

vi.mock('../../../src/runtime/skills/runtime-skill-sources.service', () => ({
  listSkillManifests: (...args: unknown[]) => skillSafetyMocks.listSkillManifestsMock(...args)
}));

import {
  buildConnectorTemplateSuggestions,
  evaluateSkillManifestSafety,
  findAutoInstallableManifest
} from '../../../src/runtime/skills/runtime-skill-safety';

function createContext() {
  return {
    settings: {
      profile: 'default'
    },
    toolRegistry: new Map<string, { riskLevel: 'low' | 'medium' | 'high' | 'critical' }>([
      ['safe-tool', { riskLevel: 'low' }],
      ['medium-tool', { riskLevel: 'medium' }],
      ['high-tool', { riskLevel: 'high' }],
      ['critical-tool', { riskLevel: 'critical' }]
    ])
  } as any;
}

describe('runtime-skill-safety', () => {
  beforeEach(() => {
    skillSafetyMocks.listSkillSourcesSnapshotMock.mockReset();
    skillSafetyMocks.listSkillManifestsMock.mockReset();
    skillSafetyMocks.listSkillSourcesSnapshotMock.mockReturnValue([]);
  });

  it('blocks missing manifests immediately', () => {
    expect(evaluateSkillManifestSafety(createContext(), undefined, undefined)).toEqual({
      verdict: 'blocked',
      trustScore: 0,
      maxRiskLevel: 'critical',
      reasons: ['未找到 skill manifest，无法评估安全性。'],
      riskyTools: [],
      missingDeclarations: ['manifest']
    });
  });

  it('returns allow for trusted low-risk manifests with complete declarations', () => {
    skillSafetyMocks.listSkillSourcesSnapshotMock.mockReturnValue([
      {
        id: 'source-1',
        trustClass: 'official',
        profilePolicy: { enabledByProfile: true }
      }
    ]);

    const result = evaluateSkillManifestSafety(
      createContext(),
      {
        id: 'manifest-1',
        sourceId: 'source-1',
        riskLevel: 'low',
        allowedTools: ['safe-tool'],
        requiredConnectors: [],
        license: 'MIT',
        compatibility: '^1.0.0',
        integrity: 'sha256-abc',
        approvalPolicy: 'none'
      } as any,
      undefined
    );

    expect(result).toMatchObject({
      verdict: 'allow',
      sourceTrustClass: 'official',
      profileCompatible: true,
      maxRiskLevel: 'low',
      riskyTools: [],
      missingDeclarations: []
    });
    expect(result.trustScore).toBeGreaterThanOrEqual(80);
  });

  it('returns blocked for critical tools or profile-incompatible sources', () => {
    const blockedByCriticalTool = evaluateSkillManifestSafety(
      createContext(),
      {
        id: 'manifest-2',
        sourceId: 'source-2',
        riskLevel: 'low',
        allowedTools: ['critical-tool'],
        license: 'MIT',
        compatibility: '^1.0.0',
        integrity: 'sha256-abc',
        approvalPolicy: 'none'
      } as any,
      {
        id: 'source-2',
        trustClass: 'internal',
        profilePolicy: { enabledByProfile: true }
      } as any
    );

    const blockedByProfile = evaluateSkillManifestSafety(
      createContext(),
      {
        id: 'manifest-3',
        sourceId: 'source-3',
        riskLevel: 'low',
        allowedTools: ['safe-tool'],
        license: 'MIT',
        compatibility: '^1.0.0',
        integrity: 'sha256-abc',
        approvalPolicy: 'none'
      } as any,
      {
        id: 'source-3',
        trustClass: 'official',
        profilePolicy: { enabledByProfile: false }
      } as any
    );

    expect(blockedByCriticalTool).toMatchObject({
      verdict: 'blocked',
      maxRiskLevel: 'critical',
      riskyTools: ['critical-tool']
    });
    expect(blockedByProfile).toMatchObject({
      verdict: 'blocked',
      profileCompatible: false,
      sourceTrustClass: 'official'
    });
  });

  it('returns needs-approval when declarations are missing, risk is high, or source trust is weak', () => {
    const needsApproval = evaluateSkillManifestSafety(
      createContext(),
      {
        id: 'manifest-4',
        sourceId: 'source-4',
        riskLevel: 'low',
        requiredCapabilities: ['missing-tool', 'medium-tool'],
        requiredConnectors: ['github'],
        approvalPolicy: 'high-risk-only'
      } as any,
      {
        id: 'source-4',
        trustClass: 'community',
        profilePolicy: { enabledByProfile: true }
      } as any
    );

    expect(needsApproval).toMatchObject({
      verdict: 'needs-approval',
      sourceTrustClass: 'community',
      maxRiskLevel: 'medium'
    });
    expect(needsApproval.missingDeclarations).toEqual(
      expect.arrayContaining(['tool:missing-tool', 'license', 'compatibility', 'integrity'])
    );
    expect(needsApproval.reasons.join(' | ')).toContain('依赖连接器：github');
  });

  it('builds connector template suggestions for github, browser, and lark goals', () => {
    const suggestions = buildConnectorTemplateSuggestions(
      'Need GitHub PR review, browser screenshot replay, and 飞书 chat 通知 for this workflow'
    );

    expect(suggestions.map(item => item.id)).toEqual([
      'github-mcp-template',
      'browser-mcp-template',
      'lark-mcp-template'
    ]);
  });

  it('finds an auto-installable manifest only when installability and safety checks pass', async () => {
    const context = createContext();
    skillSafetyMocks.listSkillSourcesSnapshotMock.mockReturnValue([
      {
        id: 'trusted-source',
        trustClass: 'official',
        profilePolicy: { enabledByProfile: true }
      }
    ]);
    skillSafetyMocks.listSkillManifestsMock.mockResolvedValue([
      {
        id: 'manifest-ok',
        sourceId: 'trusted-source',
        riskLevel: 'low',
        allowedTools: ['safe-tool'],
        license: 'MIT',
        compatibility: '^1.0.0',
        integrity: 'sha256-abc',
        approvalPolicy: 'none'
      },
      {
        id: 'manifest-blocked',
        sourceId: 'trusted-source',
        riskLevel: 'low',
        allowedTools: ['critical-tool'],
        license: 'MIT',
        compatibility: '^1.0.0',
        integrity: 'sha256-def',
        approvalPolicy: 'none'
      }
    ]);

    await expect(findAutoInstallableManifest(context, [])).resolves.toBeUndefined();
    await expect(
      findAutoInstallableManifest(context, [
        {
          id: 'manifest-missing',
          kind: 'manifest',
          availability: 'installable',
          displayName: 'Missing',
          summary: '',
          sourceId: 'trusted-source',
          score: 0.5,
          reason: '',
          version: '1.0.0'
        } as any
      ])
    ).resolves.toBeUndefined();
    await expect(
      findAutoInstallableManifest(context, [
        {
          id: 'manifest-blocked',
          kind: 'manifest',
          availability: 'installable-remote',
          displayName: 'Blocked',
          summary: '',
          sourceId: 'trusted-source',
          score: 0.5,
          reason: '',
          version: '1.0.0'
        } as any
      ])
    ).resolves.toBeUndefined();
    await expect(
      findAutoInstallableManifest(context, [
        {
          id: 'manifest-ok',
          kind: 'manifest',
          availability: 'installable-local',
          displayName: 'Allowed',
          summary: '',
          sourceId: 'trusted-source',
          score: 0.9,
          reason: '',
          version: '1.0.0'
        } as any
      ])
    ).resolves.toMatchObject({
      id: 'manifest-ok'
    });
  });
});
