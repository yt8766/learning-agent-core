import { AgentRuntime, createAgentGraph, createInitialState } from '@agent/agent-core';

async function main(): Promise<void> {
  const runtime = new AgentRuntime({
    profile: 'company',
    settingsOptions: {
      workspaceRoot: process.cwd()
    }
  });
  await runtime.start();

  const graph = createAgentGraph().compile();
  const previewState = await graph.invoke(createInitialState('preview_task', 'Preview multi-agent workflow'));

  console.info('worker ready', {
    graph: runtime.orchestrator.describeGraph(),
    workflowStep: previewState.currentStep,
    providerCount: runtime.providerRegistry.getAll().length,
    providers: runtime.providerRegistry.getAll().map(provider => provider.providerId),
    toolCount: runtime.toolRegistry.list().length,
    tools: runtime.toolRegistry.list().map(tool => tool.name),
    mode: 'sandboxed'
  });
}

void main();
