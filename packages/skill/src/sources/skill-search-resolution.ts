import type { LocalSkillSuggestionRecord, SkillSearchStatus } from '@agent/core';

interface SkillSearchLike {
  capabilityGapDetected: boolean;
  suggestions: LocalSkillSuggestionRecord[];
}

interface SkillSearchRemoteLike {
  discoverySource: string;
  results: Array<unknown>;
}

export function resolveSkillSearchStatus(input: SkillSearchLike): SkillSearchStatus {
  if (!input.capabilityGapDetected) {
    return 'not-needed';
  }

  return input.suggestions.some(item =>
    ['installable', 'installable-local', 'installable-remote', 'approval-required'].includes(item.availability)
  )
    ? 'suggested'
    : 'blocked';
}

export function buildSkillSearchSafetyNotes(input: {
  suggestions: LocalSkillSuggestionRecord[];
  remoteSearch?: SkillSearchRemoteLike;
  profile: string;
  autoInstalledManifestId?: string;
}): string[] {
  const notes = input.suggestions.slice(0, 3).map(suggestion => {
    const safety = suggestion.safety;
    return safety
      ? `${suggestion.displayName}：${suggestion.availability}，${safety.verdict}，trust=${safety.trustScore}，${safety.reasons.join('；')}`
      : `${suggestion.displayName}：${suggestion.availability}`;
  });

  if (input.remoteSearch) {
    notes.unshift(
      `已通过 ${input.remoteSearch.discoverySource} 远程检索 ${input.remoteSearch.results.length} 个候选。`
    );
  }

  if (input.autoInstalledManifestId) {
    notes.unshift(`已按当前 profile=${input.profile} 自动安装低风险技能 ${input.autoInstalledManifestId}。`);
  }

  return notes;
}

export function buildSkillSearchMcpRecommendation(
  goal: string,
  suggestions: LocalSkillSuggestionRecord[],
  capabilityGapDetected: boolean
) {
  const connectorSuggestion = suggestions.find(item => item.kind === 'connector-template');
  if (connectorSuggestion?.id === 'github-mcp-template') {
    return {
      kind: 'connector' as const,
      summary: '当前更缺 GitHub MCP connector，不只是 skill。',
      reason: connectorSuggestion.reason,
      connectorTemplateId: 'github-mcp-template' as const
    };
  }
  if (connectorSuggestion?.id === 'browser-mcp-template') {
    return {
      kind: 'connector' as const,
      summary: '当前更缺 Browser MCP connector，不只是 skill。',
      reason: connectorSuggestion.reason,
      connectorTemplateId: 'browser-mcp-template' as const
    };
  }
  if (connectorSuggestion?.id === 'lark-mcp-template') {
    return {
      kind: 'connector' as const,
      summary: '当前更缺 Lark MCP connector，不只是 skill。',
      reason: connectorSuggestion.reason,
      connectorTemplateId: 'lark-mcp-template' as const
    };
  }
  if (capabilityGapDetected) {
    return {
      kind: 'skill' as const,
      summary: '当前能力链路存在缺口，优先建议补 skill。',
      reason: `目标“${goal}”当前没有足够的 ready skill。`
    };
  }
  return {
    kind: 'not-needed' as const,
    summary: '当前没有明显的 MCP 或 skill 缺口。',
    reason: '本轮已有本地能力可继续推进。'
  };
}
