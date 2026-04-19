import { createDefaultPlatformRuntime, createDefaultPlatformRuntimeOptions } from '@agent/platform-runtime';
import { SkillArtifactFetcher } from '@agent/skill-runtime';

import { RemoteSkillDiscoveryService } from '../skills/remote-skill-discovery.service';
import { SkillSourceSyncService } from '../skills/skill-source-sync.service';

export class RuntimeHost {
  readonly platformRuntime = createDefaultPlatformRuntime({
    ...createDefaultPlatformRuntimeOptions({
      workspaceRoot: process.cwd()
    })
  });

  readonly runtime = this.platformRuntime.runtime;

  readonly settings = this.runtime.settings;
  readonly memoryRepository = this.runtime.memoryRepository;
  readonly ruleRepository = this.runtime.ruleRepository;
  readonly skillRegistry = this.runtime.skillRegistry;
  readonly runtimeStateRepository = this.runtime.runtimeStateRepository;
  readonly toolRegistry = this.runtime.toolRegistry;
  readonly llmProvider = this.runtime.llmProvider;
  readonly mcpServerRegistry = this.runtime.mcpServerRegistry;
  readonly mcpCapabilityRegistry = this.runtime.mcpCapabilityRegistry;
  readonly mcpClientManager = this.runtime.mcpClientManager;
  readonly orchestrator = this.runtime.orchestrator;
  readonly sessionCoordinator = this.runtime.sessionCoordinator;
  readonly skillSourceSyncService = new SkillSourceSyncService({
    workspaceRoot: this.settings.workspaceRoot,
    profile: this.settings.profile
  });
  readonly remoteSkillDiscoveryService = new RemoteSkillDiscoveryService();
  readonly skillArtifactFetcher = new SkillArtifactFetcher(this.settings.workspaceRoot);

  listWorkflowPresets() {
    return this.platformRuntime.metadata.listWorkflowPresets();
  }

  listSubgraphDescriptors() {
    return this.platformRuntime.metadata.listSubgraphDescriptors();
  }

  listWorkflowVersions() {
    return this.platformRuntime.metadata.listWorkflowVersions();
  }
}
