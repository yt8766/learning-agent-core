import { AgentRuntime } from '@agent/agent-core';

async function main(): Promise<void> {
  const runtime = new AgentRuntime({
    profile: 'company',
    settingsOptions: {
      workspaceRoot: process.cwd()
    }
  });
  await runtime.start();

  console.info('agent-work ready', {
    profile: runtime.settings.profile,
    dataRoot: 'data/agent-work',
    providers: runtime.providerRegistry.getAll().map(provider => provider.providerId),
    graph: runtime.orchestrator.describeGraph()
  });
}

void main();
