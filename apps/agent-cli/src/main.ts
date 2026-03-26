import { AgentRuntime } from '@agent/agent-core';

async function main(): Promise<void> {
  const runtime = new AgentRuntime({
    profile: 'cli',
    settingsOptions: {
      workspaceRoot: process.cwd()
    }
  });
  await runtime.start();

  console.info('agent-cli ready', {
    profile: runtime.settings.profile,
    providers: runtime.providerRegistry.getAll().map(provider => provider.providerId),
    models: runtime.providerRegistry.getAll().flatMap(provider => provider.supportedModels().map(model => model.id)),
    graph: runtime.orchestrator.describeGraph()
  });
}

void main();
