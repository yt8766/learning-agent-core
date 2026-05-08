import {
  SkillArtifactFetcher as SkillArtifactFetcherBase,
  type SkillArtifactFetchResult,
  type SkillDraftRepository
} from '@agent/skill';

import {
  createRuntimeSkillDraftRepository,
  RuntimeSkillArtifactStorageRepository
} from './runtime-skill-storage.repository';

export interface RuntimeSkillArtifactFetcherOptions {
  skillDraftRepository?: SkillDraftRepository;
}

export class SkillArtifactFetcher extends SkillArtifactFetcherBase {
  constructor(workspaceRoot: string, options: RuntimeSkillArtifactFetcherOptions = {}) {
    super({
      workspaceRoot,
      storageRepository: new RuntimeSkillArtifactStorageRepository(workspaceRoot),
      skillDraftRepository: options.skillDraftRepository ?? createRuntimeSkillDraftRepository(workspaceRoot)
    });
  }
}

export type { SkillArtifactFetchResult };
