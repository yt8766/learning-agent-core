export type ArchitectureDiagramScope = 'project' | 'agent' | 'agentChat' | 'agentAdmin';
export type ArchitectureDiagramDirection = 'TD' | 'LR';

export interface ArchitectureNodeDescriptor {
  id: string;
  label: string;
  kind?:
    | 'entry'
    | 'runtime'
    | 'strategy'
    | 'ministry'
    | 'fallback'
    | 'frontend'
    | 'backend'
    | 'worker'
    | 'data'
    | 'registry'
    | 'governance'
    | 'view'
    | 'connector';
  subgraphId?: string;
  metadata?: Record<string, unknown>;
}

export interface ArchitectureEdgeDescriptor {
  from: string;
  to: string;
  label?: string;
  style?: 'solid' | 'dashed';
}

export interface ArchitectureSubgraphDescriptor {
  id: string;
  title: string;
}

export interface ArchitectureDescriptor {
  id: string;
  title: string;
  scope: ArchitectureDiagramScope;
  direction: ArchitectureDiagramDirection;
  sourceDescriptors: string[];
  subgraphs: ArchitectureSubgraphDescriptor[];
  nodes: ArchitectureNodeDescriptor[];
  edges: ArchitectureEdgeDescriptor[];
}

export interface ArchitectureDescriptorRegistryEntry {
  id: ArchitectureDiagramScope;
  sourceDescriptors: string[];
  build: () => ArchitectureDescriptor;
}

export interface ArchitectureDiagramRecord {
  id: ArchitectureDiagramScope;
  title: string;
  generatedAt: string;
  version: string;
  sourceDescriptors: string[];
  descriptor: ArchitectureDescriptor;
  mermaid: string;
}

export interface RuntimeArchitectureRecord {
  project: ArchitectureDiagramRecord;
  agent: ArchitectureDiagramRecord;
  agentChat: ArchitectureDiagramRecord;
  agentAdmin: ArchitectureDiagramRecord;
}
