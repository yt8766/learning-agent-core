import { describe, expect, it } from 'vitest';

import { buildLocalSkillSuggestions } from '../../../src/runtime/skills/local-skill-search';

describe('buildLocalSkillSuggestions', () => {
  it('prefers ready installed skills over installable manifests', () => {
    const result = buildLocalSkillSuggestions({
      goal: '帮我做发布前 build 检查',
      profile: 'company',
      installedSkills: [
        {
          id: 'release_check',
          name: 'Release Check',
          description: '执行发布前检查',
          applicableGoals: ['发布前 build 检查'],
          requiredTools: ['release-ops'],
          steps: [],
          constraints: [],
          successSignals: [],
          riskLevel: 'medium',
          source: 'research',
          status: 'lab',
          createdAt: '2026-03-25T00:00:00.000Z',
          updatedAt: '2026-03-25T00:00:00.000Z'
        }
      ],
      manifests: [
        {
          id: 'release_check_manifest',
          name: 'Release Check Manifest',
          version: '0.1.0',
          description: '执行发布前检查',
          publisher: 'workspace',
          sourceId: 'workspace-skills',
          requiredCapabilities: ['release-ops'],
          approvalPolicy: 'high-risk-only',
          riskLevel: 'medium',
          entry: 'skills/release-check/SKILL.md'
        }
      ],
      sources: [
        {
          id: 'workspace-skills',
          name: 'Workspace Skills',
          kind: 'internal',
          baseUrl: '/tmp/skills',
          trustClass: 'internal',
          priority: 'workspace/internal',
          enabled: true
        }
      ]
    });

    expect(result.capabilityGapDetected).toBe(false);
    expect(result.suggestions[0]).toEqual(
      expect.objectContaining({
        id: 'release_check',
        kind: 'installed',
        availability: 'ready'
      })
    );
  });

  it('marks manifest suggestions as blocked when source is disabled for current profile', () => {
    const result = buildLocalSkillSuggestions({
      goal: '帮我审计 OpenClaw 工作区',
      profile: 'company',
      installedSkills: [],
      manifests: [
        {
          id: 'openclaw_workspace_audit',
          name: 'OpenClaw Workspace Audit',
          version: '0.1.0',
          description: '审计工作区',
          publisher: 'workspace',
          sourceId: 'bundled-marketplace',
          requiredCapabilities: ['documentation'],
          approvalPolicy: 'none',
          riskLevel: 'low',
          entry: 'skills/openclaw-workspace-audit/SKILL.md'
        }
      ],
      sources: [
        {
          id: 'bundled-marketplace',
          name: 'Bundled Marketplace',
          kind: 'marketplace',
          baseUrl: '/tmp/marketplace',
          trustClass: 'curated',
          priority: 'bundled/marketplace',
          enabled: false,
          healthReason: '当前 profile=company 下该来源默认关闭。'
        }
      ]
    });

    expect(result.capabilityGapDetected).toBe(true);
    expect(result.suggestions[0]).toEqual(
      expect.objectContaining({
        id: 'openclaw_workspace_audit',
        kind: 'manifest',
        availability: 'blocked'
      })
    );
  });

  it('surfaces local code review manifests for review-like goals', () => {
    const result = buildLocalSkillSuggestions({
      goal: '帮我做 code review，检查回归风险',
      profile: 'company',
      installedSkills: [],
      manifests: [
        {
          id: 'code_review',
          name: 'Code Review',
          version: '0.1.0',
          description: '执行代码审查、风险排查与回归关注点梳理。',
          publisher: 'workspace',
          sourceId: 'workspace-skills',
          requiredCapabilities: ['code-review', 'documentation'],
          requiredConnectors: ['repo'],
          approvalPolicy: 'none',
          riskLevel: 'low',
          entry: 'skills/code-review/SKILL.md',
          summary: '本地代码审查技能。'
        }
      ],
      sources: [
        {
          id: 'workspace-skills',
          name: 'Workspace Skills',
          kind: 'internal',
          baseUrl: '/tmp/skills',
          trustClass: 'internal',
          priority: 'workspace/internal',
          enabled: true
        }
      ]
    });

    expect(result.capabilityGapDetected).toBe(true);
    expect(result.suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'code_review',
          availability: 'installable-local'
        })
      ])
    );
  });

  it('passes manifest safety evaluation through to local suggestions', () => {
    const result = buildLocalSkillSuggestions({
      goal: '审计学习闭环',
      profile: 'company',
      installedSkills: [],
      manifests: [
        {
          id: 'learning_flow_audit',
          name: 'Learning Flow Audit',
          version: '0.1.0',
          description: '审计学习闭环。',
          publisher: 'workspace',
          sourceId: 'workspace-skills',
          requiredCapabilities: ['knowledge-audit'],
          approvalPolicy: 'none',
          riskLevel: 'low',
          entry: 'skills/learning-flow-audit/SKILL.md',
          safety: {
            verdict: 'allow',
            trustScore: 82,
            sourceTrustClass: 'internal',
            profileCompatible: true,
            maxRiskLevel: 'low',
            reasons: ['license=Proprietary'],
            riskyTools: [],
            missingDeclarations: []
          }
        }
      ],
      sources: [
        {
          id: 'workspace-skills',
          name: 'Workspace Skills',
          kind: 'internal',
          baseUrl: '/tmp/skills',
          trustClass: 'internal',
          priority: 'workspace/internal',
          enabled: true
        }
      ]
    });

    const suggestion = result.suggestions.find(item => item.id === 'learning_flow_audit');
    expect(suggestion?.safety).toEqual(
      expect.objectContaining({
        verdict: 'allow',
        trustScore: 82
      })
    );
  });

  it('marks remote marketplace manifests as installable-remote when source is enabled', () => {
    const result = buildLocalSkillSuggestions({
      goal: '需要一个 repo review companion 来做代码审查和仓库结构梳理',
      profile: 'personal',
      installedSkills: [],
      manifests: [
        {
          id: 'repo_review_companion',
          name: 'Repo Review Companion',
          version: '0.1.0',
          description: 'Curated remote repo review skill.',
          publisher: 'workspace',
          sourceId: 'bundled-marketplace',
          requiredCapabilities: ['code-review', 'documentation'],
          requiredConnectors: ['repo'],
          approvalPolicy: 'none',
          riskLevel: 'low',
          entry: 'data/skill-runtime/remote-sources/artifacts/repo-review-companion/SKILL.md',
          artifactUrl: 'data/skill-runtime/remote-sources/artifacts/repo-review-companion',
          integrity: 'sha256-demo',
          license: 'Proprietary',
          compatibility: 'Requires repo access.'
        }
      ],
      sources: [
        {
          id: 'bundled-marketplace',
          name: 'Bundled Marketplace',
          kind: 'marketplace',
          baseUrl: '/tmp/marketplace',
          discoveryMode: 'remote-index',
          trustClass: 'curated',
          priority: 'bundled/marketplace',
          enabled: true
        }
      ]
    });

    expect(result.suggestions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'repo_review_companion',
          availability: 'installable-remote',
          installationMode: 'marketplace-managed'
        })
      ])
    );
  });
});
