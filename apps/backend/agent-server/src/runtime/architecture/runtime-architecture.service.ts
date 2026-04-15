import { Injectable } from '@nestjs/common';

import { listSubgraphDescriptors, listWorkflowPresets } from '@agent/agents-supervisor';
import { WorkerRegistry } from '@agent/runtime';
import { loadSettings } from '@agent/config';
import type { ArchitectureDescriptor, ArchitectureDiagramRecord, RuntimeArchitectureRecord } from '@agent/shared';
import { buildKnowledgeDescriptor } from '../knowledge/runtime-knowledge-store';
import { createArchitectureDescriptorRegistry } from './runtime-architecture-registries';

const ARCHITECTURE_VERSION = '2026.03.runtime-architecture.v1';

@Injectable()
export class RuntimeArchitectureService {
  getArchitecture(): RuntimeArchitectureRecord {
    const generatedAt = new Date().toISOString();
    const settings = loadSettings();
    const workerRegistry = new WorkerRegistry();
    const subgraphs = listSubgraphDescriptors();
    const workflows = listWorkflowPresets();
    const workers = workerRegistry.list();
    const knowledgeDescriptor = buildKnowledgeDescriptor(settings);
    const registry = createArchitectureDescriptorRegistry({
      subgraphs,
      workflows,
      workers,
      knowledgeDescriptor
    });

    return {
      project: this.buildDiagram({
        id: 'project',
        generatedAt,
        descriptor: registry.project.build()
      }),
      agent: this.buildDiagram({
        id: 'agent',
        generatedAt,
        descriptor: registry.agent.build()
      }),
      agentChat: this.buildDiagram({
        id: 'agentChat',
        generatedAt,
        descriptor: registry.agentChat.build()
      }),
      agentAdmin: this.buildDiagram({
        id: 'agentAdmin',
        generatedAt,
        descriptor: registry.agentAdmin.build()
      })
    };
  }

  private buildDiagram(input: {
    id: ArchitectureDiagramRecord['id'];
    generatedAt: string;
    descriptor: ArchitectureDescriptor;
  }): ArchitectureDiagramRecord {
    return {
      id: input.id,
      title: input.descriptor.title,
      generatedAt: input.generatedAt,
      version: ARCHITECTURE_VERSION,
      sourceDescriptors: input.descriptor.sourceDescriptors,
      descriptor: input.descriptor,
      mermaid: buildMermaid(input.descriptor)
    };
  }
}

function buildMermaid(descriptor: ArchitectureDescriptor): string {
  const lines = [`flowchart ${descriptor.direction}`];
  descriptor.subgraphs.forEach(subgraph => {
    lines.push(`subgraph ${safeSubgraphId(subgraph.id)} [${escapeSubgraphTitle(subgraph.title)}]`);
    descriptor.nodes
      .filter(node => node.subgraphId === subgraph.id)
      .forEach(node => lines.push(`  ${safeNodeId(node.id)}["${escapeNodeLabel(node.label)}"]`));
    lines.push('end');
  });

  descriptor.nodes
    .filter(node => !node.subgraphId)
    .forEach(node => lines.push(`${safeNodeId(node.id)}["${escapeNodeLabel(node.label)}"]`));

  descriptor.edges.forEach(edge => {
    const connector = edge.style === 'dashed' ? '-.->' : '-->';
    const label = edge.label ? `|${escapeEdgeLabel(edge.label)}|` : '';
    lines.push(`${safeNodeId(edge.from)} ${connector}${label} ${safeNodeId(edge.to)}`);
  });

  return lines.join('\n');
}

function toMermaidToken(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, '_');
}

function safeNodeId(value: string) {
  return `node_${toMermaidToken(value)}`;
}

function safeSubgraphId(value: string) {
  return `group_${toMermaidToken(value)}`;
}

function escapeNodeLabel(value: string) {
  return value.replace(/"/g, "'").replace(/\|/g, '/').replace(/\n/g, '<br/>');
}

function escapeEdgeLabel(value: string) {
  return value.replace(/"/g, "'").replace(/\|/g, '/').replace(/\n/g, ' / ');
}

function escapeSubgraphTitle(value: string) {
  return value
    .replace(/[[\]"]/g, '')
    .replace(/\|/g, '/')
    .replace(/\n/g, ' ');
}
