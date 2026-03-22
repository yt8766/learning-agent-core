import { AgentOrchestrator, createAgentGraph, createInitialState } from '@agent/agent-core';
import { FileMemoryRepository, FileRuntimeStateRepository } from '@agent/memory';
import { SkillRegistry } from '@agent/skills';
import { ApprovalService, createDefaultToolRegistry } from '@agent/tools';

async function main(): Promise<void> {
  const orchestrator = new AgentOrchestrator(
    new FileMemoryRepository(),
    new SkillRegistry(),
    new ApprovalService(),
    new FileRuntimeStateRepository()
  );
  await orchestrator.initialize();

  const toolRegistry = createDefaultToolRegistry();
  const graph = createAgentGraph().compile();
  const previewState = await graph.invoke(createInitialState('preview_task', 'Preview multi-agent workflow'));

  console.info('worker ready', {
    graph: orchestrator.describeGraph(),
    workflowStep: previewState.currentStep,
    toolCount: toolRegistry.list().length,
    tools: toolRegistry.list().map(tool => tool.name),
    mode: 'sandboxed'
  });
}

void main();
