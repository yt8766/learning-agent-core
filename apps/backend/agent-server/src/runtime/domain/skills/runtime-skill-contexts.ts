import type { SkillCard, SkillManifestRecord, SkillSourceRecord } from '@agent/core';

import { autoInstallLocalManifest, type RuntimeSkillInstallContext } from '../../skills/runtime-skill-install.service';
import { type RuntimeSkillSourcesContext } from '../../skills/runtime-skill-sources.service';
import type { RuntimeHost } from '../../core/runtime.host';

type RuntimeSkillSourcesContextWithList = RuntimeSkillSourcesContext & {
  listSkillSources?: () => Promise<SkillSourceRecord[]>;
};

export function createSkillInstallContext(input: {
  settings: RuntimeHost['settings'];
  skillRegistry: RuntimeHost['skillRegistry'];
  skillArtifactFetcher: RuntimeHost['skillArtifactFetcher'];
  remoteSkillDiscoveryService: RuntimeHost['remoteSkillDiscoveryService'];
  getSkillSourcesContext: () => RuntimeSkillSourcesContextWithList;
  registerSkillWorker: (skill: SkillCard) => void;
}): RuntimeSkillInstallContext {
  return {
    settings: input.settings,
    skillRegistry: input.skillRegistry,
    skillArtifactFetcher: input.skillArtifactFetcher,
    listSkillSources: () => input.getSkillSourcesContext().listSkillSources?.() ?? Promise.resolve([]),
    remoteSkillCli: {
      install: (params: { repo: string; skillName?: string }) =>
        input.remoteSkillDiscoveryService.installRemoteSkill(params),
      check: () => input.remoteSkillDiscoveryService.checkInstalledSkills(),
      update: () => input.remoteSkillDiscoveryService.updateInstalledSkills()
    },
    registerInstalledSkillWorker: input.registerSkillWorker
  };
}

export function createSkillSourcesContext(input: {
  settings: RuntimeHost['settings'];
  toolRegistry: RuntimeHost['toolRegistry'];
  skillRegistry: RuntimeHost['skillRegistry'];
  skillSourceSyncService: RuntimeHost['skillSourceSyncService'];
  remoteSkillDiscoveryService: RuntimeHost['remoteSkillDiscoveryService'];
  getDisabledSkillSourceIds: () => Promise<string[]>;
  getSkillInstallContext: () => RuntimeSkillInstallContext;
  listWorkspaceSkillDraftManifests?: () => Promise<SkillManifestRecord[]>;
}) {
  const context: RuntimeSkillSourcesContextWithList = {
    settings: input.settings,
    toolRegistry: input.toolRegistry,
    skillRegistry: input.skillRegistry,
    skillSourceSyncService: input.skillSourceSyncService,
    remoteSkillDiscoveryService: input.remoteSkillDiscoveryService,
    getDisabledSkillSourceIds: () => input.getDisabledSkillSourceIds(),
    autoInstallLocalManifest: (manifest: SkillManifestRecord) =>
      autoInstallLocalManifest(input.getSkillInstallContext(), manifest),
    listWorkspaceSkillDraftManifests: input.listWorkspaceSkillDraftManifests
  };
  context.listSkillSources = async () => {
    const { listSkillSources } = await import('../../skills/runtime-skill-sources.service');
    return listSkillSources(context);
  };
  return context;
}
