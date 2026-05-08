import { Injectable } from '@nestjs/common';

import { RagModelProfileSchema, RagModelProfileSummarySchema } from '../domain/knowledge-document.schemas';
import type { RagModelProfile, RagModelProfileSummary } from '../domain/knowledge-document.types';

export interface KnowledgeRagModelProfileServiceConfig {
  profiles: RagModelProfile[];
}

@Injectable()
export class KnowledgeRagModelProfileService {
  private readonly profiles: RagModelProfile[];

  constructor(config: KnowledgeRagModelProfileServiceConfig) {
    this.profiles = config.profiles.map(profile => RagModelProfileSchema.parse(profile));
  }

  listSummaries(): RagModelProfileSummary[] {
    return this.profiles.map(profile =>
      RagModelProfileSummarySchema.parse({
        id: profile.id,
        label: profile.label,
        description: profile.description,
        useCase: profile.useCase,
        enabled: profile.enabled
      })
    );
  }

  resolveEnabled(id?: string): RagModelProfile {
    const profile = id
      ? this.profiles.find(candidate => candidate.id === id)
      : this.profiles.find(candidate => candidate.enabled);
    if (!profile) {
      throw new Error('rag_model_profile_not_found');
    }
    if (!profile.enabled) {
      throw new Error('rag_model_profile_disabled');
    }
    return profile;
  }
}
