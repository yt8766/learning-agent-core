import { AgentOrchestrator, ZhipuLlmProvider, createAgentGraph, createInitialState } from '@agent/agent-core';
import { FileMemoryRepository, FileRuleRepository, FileRuntimeStateRepository } from '@agent/memory';
import { SkillRegistry } from '@agent/skills';
import { ApprovalService, StubSandboxExecutor, createDefaultToolRegistry } from '@agent/tools';

async function main(): Promise<void> {
  const orchestrator = new AgentOrchestrator({
    memoryRepository: new FileMemoryRepository(),
    skillRegistry: new SkillRegistry(),
    approvalService: new ApprovalService(),
    runtimeStateRepository: new FileRuntimeStateRepository(),
    llmProvider: new ZhipuLlmProvider(),
    ruleRepository: new FileRuleRepository(),
    sandboxExecutor: new StubSandboxExecutor()
  });
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
