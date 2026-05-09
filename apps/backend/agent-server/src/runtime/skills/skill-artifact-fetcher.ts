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
  skillsRoot?: string;
  stagingRoot?: string;
  skillDraftRepository?: SkillDraftRepository;
}

export class SkillArtifactFetcher extends SkillArtifactFetcherBase {
  constructor(workspaceRoot: string, options: RuntimeSkillArtifactFetcherOptions = {}) {
    const skillsRoot = options.skillsRoot ?? `${workspaceRoot}/profile-storage/platform/skills`;
    super({
      workspaceRoot,
      storageRepository: new RuntimeSkillArtifactStorageRepository(options.stagingRoot ?? `${skillsRoot}/staging`),
      skillDraftRepository: options.skillDraftRepository ?? createRuntimeSkillDraftRepository(skillsRoot)
    });
  }
}

export type { SkillArtifactFetchResult };
