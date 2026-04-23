import type { LocalSkillSuggestionRecord, SkillManifestRecord } from '@agent/core';

export function findInstallableManifestSuggestion(
  suggestions: LocalSkillSuggestionRecord[]
): LocalSkillSuggestionRecord | undefined {
  return suggestions.find(
    item =>
      item.kind === 'manifest' && ['installable', 'installable-local', 'installable-remote'].includes(item.availability)
  );
}

export function shouldAutoInstallManifest(input: {
  manifest: SkillManifestRecord;
  safety: NonNullable<SkillManifestRecord['safety']>;
}): boolean {
  return (
    input.safety.verdict === 'allow' &&
    input.safety.trustScore >= 80 &&
    ['official', 'curated', 'internal'].includes(input.safety.sourceTrustClass ?? '') &&
    Boolean(input.manifest.license)
  );
}
