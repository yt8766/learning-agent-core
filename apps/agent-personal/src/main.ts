import { AgentRuntime } from '@agent/agent-core';

async function main(): Promise<void> {
  const runtime = new AgentRuntime({
    profile: 'personal',
    settingsOptions: {
      workspaceRoot: process.cwd()
    }
  });
  await runtime.start();

  console.info('agent-personal ready', {
    profile: runtime.settings.profile,
    dataRoot: 'data/agent-personal',
    providers: runtime.providerRegistry.getAll().map(provider => provider.providerId),
    graph: runtime.orchestrator.describeGraph()
  });
}

void main();
