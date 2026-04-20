import { describe, expect, it } from 'vitest';

import {
  buildSkillSearchMcpRecommendation,
  buildSkillSearchSafetyNotes,
  resolveSkillSearchStatus
} from '../../../../src/runtime/domain/skills/runtime-skill-search-resolution';

describe('runtime skill search resolution', () => {
  it('marks capability gaps as suggested only when there is an actionable suggestion', () => {
    expect(
      resolveSkillSearchStatus({
        capabilityGapDetected: true,
        suggestions: [{ availability: 'installable' }, { availability: 'approval-required' }] as any
      })
    ).toBe('suggested');

    expect(
      resolveSkillSearchStatus({
        capabilityGapDetected: true,
        suggestions: [{ availability: 'ready' }] as any
      })
    ).toBe('blocked');

    expect(
      resolveSkillSearchStatus({
        capabilityGapDetected: false,
        suggestions: [] as any
      })
    ).toBe('not-needed');
  });

  it('builds connector-first MCP recommendations before falling back to skill or not-needed guidance', () => {
    expect(
      buildSkillSearchMcpRecommendation(
        'need github connector',
        [
          {
            id: 'github-mcp-template',
            kind: 'connector-template',
            reason: 'needs github'
          }
        ] as any,
        true
      )
    ).toEqual({
      kind: 'connector',
      summary: '当前更缺 GitHub MCP connector，不只是 skill。',
      reason: 'needs github',
      connectorTemplateId: 'github-mcp-template'
    });

    expect(buildSkillSearchMcpRecommendation('no matching skill', [] as any, true)).toEqual({
      kind: 'skill',
      summary: '当前能力链路存在缺口，优先建议补 skill。',
      reason: '目标“no matching skill”当前没有足够的 ready skill。'
    });

    expect(buildSkillSearchMcpRecommendation('already covered', [] as any, false)).toEqual({
      kind: 'not-needed',
      summary: '当前没有明显的 MCP 或 skill 缺口。',
      reason: '本轮已有本地能力可继续推进。'
    });
  });

  it('summarizes safety notes with remote search context and auto-installed manifest hints', () => {
    expect(
      buildSkillSearchSafetyNotes({
        suggestions: [
          {
            displayName: 'Skill A',
            availability: 'installable',
            safety: {
              verdict: 'allow',
              trustScore: 92,
              reasons: ['safe', 'verified']
            }
          },
          {
            displayName: 'Skill B',
            availability: 'ready'
          }
        ] as any,
        remoteSearch: {
          discoverySource: 'skills.sh',
          results: [{ id: 'skill-a' }]
        } as any,
        profile: 'platform',
        autoInstalledManifestId: 'skill-a'
      })
    ).toEqual([
      '已按当前 profile=platform 自动安装低风险技能 skill-a。',
      '已通过 skills.sh 远程检索 1 个候选。',
      'Skill A：installable，allow，trust=92，safe；verified',
      'Skill B：ready'
    ]);
  });
});
