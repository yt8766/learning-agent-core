import { AgentRuntime } from '@agent/runtime';

import { RemoteSkillDiscoveryService } from '../skills/remote-skill-discovery.service';
import { SkillArtifactFetcher } from '../skills/skill-artifact-fetcher';
import { SkillSourceSyncService } from '../skills/skill-source-sync.service';

export class RuntimeHost {
  readonly runtime = new AgentRuntime({
    profile: 'platform',
    settingsOptions: {
      workspaceRoot: process.cwd()
    }
  });

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
}
