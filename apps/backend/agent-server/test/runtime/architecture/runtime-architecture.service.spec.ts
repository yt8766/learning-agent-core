import { describe, expect, it } from 'vitest';

import { RuntimeArchitectureService } from '../../../src/runtime/architecture/runtime-architecture.service';
import { createArchitectureDescriptorRegistry } from '../../../src/runtime/architecture/runtime-architecture-registries';
import { loadSettings } from '@agent/config';
import { listSubgraphDescriptors, listWorkflowPresets, WorkerRegistry } from '@agent/agent-core';
import { buildKnowledgeDescriptor } from '../../../src/runtime/knowledge/runtime-knowledge-store';

describe('RuntimeArchitectureService', () => {
  it('returns four architecture diagrams with mermaid content and metadata', () => {
    const service = new RuntimeArchitectureService();

    const diagrams = service.getArchitecture();

    expect(Object.keys(diagrams)).toEqual(['project', 'agent', 'agentChat', 'agentAdmin']);
    expect(diagrams.project.mermaid).toContain('agent-core');
    expect(diagrams.project.sourceDescriptors).toContain('subgraph registry');
    expect(diagrams.project.sourceDescriptors).toContain('runtime host descriptor');
    expect(diagrams.agent.mermaid).toContain('BudgetGate');
    expect(diagrams.agent.mermaid).toContain('Critic');
    expect(diagrams.agent.sourceDescriptors).toEqual(
      expect.arrayContaining(['workflow route registry', 'worker registry'])
    );
    expect(diagrams.agentChat.mermaid).toContain('chat thread');
    expect(diagrams.agentChat.sourceDescriptors).toContain('chat workspace descriptor');
    expect(diagrams.agentAdmin.mermaid).toContain('Architecture View');
    expect(diagrams.agentAdmin.sourceDescriptors).toContain('admin page registry');
    expect(diagrams.agentAdmin.version).toBeTruthy();
    expect(diagrams.agent.generatedAt).toMatch(/T/);
  });

  it('builds diagram descriptors from registry entries instead of ad-hoc service constants', () => {
    const registry = createArchitectureDescriptorRegistry({
      subgraphs: listSubgraphDescriptors(),
      workflows: listWorkflowPresets(),
      workers: new WorkerRegistry().list(),
      knowledgeDescriptor: buildKnowledgeDescriptor(loadSettings())
    });

    expect(Object.keys(registry)).toEqual(['project', 'agent', 'agentChat', 'agentAdmin']);
    expect(registry.project.id).toBe('project');
    expect(registry.agent.sourceDescriptors).toEqual(
      expect.arrayContaining(['workflow route registry', 'worker registry'])
    );
    expect(registry.agentAdmin.build().sourceDescriptors).toEqual(registry.agentAdmin.sourceDescriptors);
  });
});
