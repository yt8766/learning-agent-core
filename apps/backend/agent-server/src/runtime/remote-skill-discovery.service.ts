import { SkillManifestRecord, SkillSourceRecord } from '@agent/shared';

import { buildLocalSkillSuggestions } from './local-skill-search';

interface DiscoveryInput {
  goal: string;
  installedSkills: Parameters<typeof buildLocalSkillSuggestions>[0]['installedSkills'];
  manifests: SkillManifestRecord[];
  sources: SkillSourceRecord[];
  profile: Parameters<typeof buildLocalSkillSuggestions>[0]['profile'];
  usedInstalledSkills?: string[];
  limit?: number;
}

export class RemoteSkillDiscoveryService {
  discover(input: DiscoveryInput) {
    return buildLocalSkillSuggestions({
      goal: input.goal,
      installedSkills: input.installedSkills,
      manifests: input.manifests,
      sources: input.sources,
      profile: input.profile,
      usedInstalledSkills: input.usedInstalledSkills,
      limit: input.limit
    });
  }
}
