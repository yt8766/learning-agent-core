import {
  LocalSkillSuggestionRecord,
  RuntimeProfile,
  SkillCard,
  SkillManifestRecord,
  SkillSourcePriority,
  SkillSourceRecord
} from '@agent/shared';

interface BuildLocalSkillSuggestionsParams {
  goal: string;
  installedSkills: SkillCard[];
  manifests: SkillManifestRecord[];
  sources: SkillSourceRecord[];
  profile: RuntimeProfile;
  usedInstalledSkills?: string[];
  limit?: number;
}

function tokenize(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .split(/[^\p{L}\p{N}_]+/u)
        .map(token => token.trim())
        .filter(token => token.length >= 2)
    )
  );
}

function scoreTokens(queryTokens: string[], documentTokens: string[]): number {
  if (!queryTokens.length || !documentTokens.length) {
    return 0;
  }

  const documentSet = new Set(documentTokens);
  let matches = 0;
  for (const token of queryTokens) {
    if (documentSet.has(token)) {
      matches += 1;
    }
  }

  return matches / Math.max(queryTokens.length, Math.min(documentTokens.length, queryTokens.length + 2));
}

function installedSkillEffectivenessBoost(skill: SkillCard): number {
  const successRate = skill.successRate ?? 0;
  const recommendationBoost =
    skill.governanceRecommendation === 'promote'
      ? 0.2
      : skill.governanceRecommendation === 'keep-lab'
        ? 0.08
        : skill.governanceRecommendation === 'disable' || skill.governanceRecommendation === 'retire'
          ? -0.1
          : 0;
  return successRate * 0.25 + recommendationBoost;
}

function priorityScore(priority?: SkillSourcePriority): number {
  switch (priority) {
    case 'workspace/internal':
      return 30;
    case 'managed/local':
      return 20;
    case 'bundled/marketplace':
      return 10;
    default:
      return 0;
  }
}

function availabilityScore(availability: LocalSkillSuggestionRecord['availability']): number {
  switch (availability) {
    case 'ready':
      return 30;
    case 'installable-local':
      return 24;
    case 'installable-remote':
      return 22;
    case 'approval-required':
      return 12;
    case 'installable':
      return 20;
    case 'blocked':
      return 0;
    default:
      return 0;
  }
}

function buildInstalledSkillText(skill: SkillCard): string {
  return [
    skill.name,
    skill.description,
    ...(skill.applicableGoals ?? []),
    ...(skill.requiredTools ?? []),
    ...(skill.requiredCapabilities ?? []),
    ...(skill.requiredConnectors ?? []),
    ...(skill.constraints ?? []),
    ...(skill.successSignals ?? [])
  ].join(' ');
}

function buildManifestText(manifest: SkillManifestRecord): string {
  return [
    manifest.name,
    manifest.description,
    manifest.summary ?? '',
    manifest.compatibility ?? '',
    ...(manifest.allowedTools ?? []),
    ...manifest.requiredCapabilities,
    ...(manifest.requiredConnectors ?? [])
  ].join(' ');
}

export function buildLocalSkillSuggestions(params: BuildLocalSkillSuggestionsParams): {
  capabilityGapDetected: boolean;
  suggestions: LocalSkillSuggestionRecord[];
} {
  const queryTokens = tokenize(params.goal);
  const sourceMap = new Map(params.sources.map(source => [source.id, source]));
  const suggestions: LocalSkillSuggestionRecord[] = [];

  for (const skill of params.installedSkills) {
    const score =
      scoreTokens(queryTokens, tokenize(buildInstalledSkillText(skill))) + installedSkillEffectivenessBoost(skill);
    if (score <= 0) {
      continue;
    }

    suggestions.push({
      id: skill.id,
      kind: 'installed',
      displayName: skill.name,
      summary: skill.description,
      sourceId: skill.sourceId,
      score,
      availability: skill.status === 'disabled' ? 'blocked' : 'ready',
      reason:
        params.usedInstalledSkills?.includes(`installed-skill:${skill.id}`) ||
        params.usedInstalledSkills?.includes(skill.id)
          ? '本轮已命中过该技能，可优先继续复用。'
          : '本地已安装技能，可直接进入 Skill Lab 复用。',
      requiredCapabilities: skill.requiredCapabilities ?? skill.requiredTools ?? [],
      requiredConnectors: skill.requiredConnectors,
      version: skill.version,
      successRate: skill.successRate,
      governanceRecommendation: skill.governanceRecommendation
    });
  }

  for (const manifest of params.manifests) {
    const score = scoreTokens(queryTokens, tokenize(buildManifestText(manifest)));
    if (score <= 0) {
      continue;
    }

    const source = sourceMap.get(manifest.sourceId);
    const enabled = source?.enabled ?? false;
    const remoteInstallable =
      source?.discoveryMode === 'remote-index' ||
      source?.discoveryMode === 'git-registry' ||
      source?.discoveryMode === 'http-manifest';
    const requiresApproval =
      manifest.safety?.verdict === 'needs-approval' ||
      source?.trustClass === 'community' ||
      source?.trustClass === 'unverified';
    const availability: LocalSkillSuggestionRecord['availability'] = !enabled
      ? 'blocked'
      : requiresApproval
        ? 'approval-required'
        : remoteInstallable
          ? 'installable-remote'
          : 'installable-local';
    suggestions.push({
      id: manifest.id,
      kind: 'manifest',
      displayName: manifest.name,
      summary: manifest.summary ?? manifest.description,
      sourceId: manifest.sourceId,
      score,
      availability,
      reason: enabled
        ? requiresApproval
          ? `当前 profile=${params.profile} 可安装，但需要审批。`
          : remoteInstallable
            ? `当前 profile=${params.profile} 可从远程来源安装。`
            : `当前 profile=${params.profile} 可从本地来源安装。`
        : (source?.healthReason ?? `当前 profile=${params.profile} 下该来源不可用。`),
      requiredCapabilities: manifest.requiredCapabilities,
      requiredConnectors: manifest.requiredConnectors,
      version: manifest.version,
      sourceLabel: source?.name,
      sourceTrustClass: source?.trustClass,
      installationMode: remoteInstallable ? 'marketplace-managed' : 'builtin',
      safety: manifest.safety
    });
  }

  const deduped = suggestions
    .sort((left, right) => {
      const leftSource = sourceMap.get(left.sourceId ?? '');
      const rightSource = sourceMap.get(right.sourceId ?? '');
      const scoreDelta =
        availabilityScore(right.availability) +
        priorityScore(rightSource?.priority) +
        right.score * 100 -
        (availabilityScore(left.availability) + priorityScore(leftSource?.priority) + left.score * 100);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }
      return left.displayName.localeCompare(right.displayName);
    })
    .filter(
      (item, index, list) =>
        list.findIndex(candidate => candidate.id === item.id && candidate.kind === item.kind) === index
    )
    .slice(0, params.limit ?? 5);

  const capabilityGapDetected = !deduped.some(item => item.kind === 'installed' && item.availability === 'ready');

  return {
    capabilityGapDetected,
    suggestions: deduped
  };
}
