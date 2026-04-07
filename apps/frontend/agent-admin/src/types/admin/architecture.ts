export interface ArchitectureDescriptorRecord {
  id: string;
  title: string;
  scope: 'project' | 'agent' | 'agentChat' | 'agentAdmin';
  direction: 'TD' | 'LR';
  sourceDescriptors: string[];
  subgraphs: Array<{
    id: string;
    title: string;
  }>;
  nodes: Array<{
    id: string;
    label: string;
    kind?: string;
    subgraphId?: string;
  }>;
  edges: Array<{
    from: string;
    to: string;
    label?: string;
    style?: 'solid' | 'dashed';
  }>;
}

export interface ArchitectureDiagramRecord {
  id: 'project' | 'agent' | 'agentChat' | 'agentAdmin';
  title: string;
  generatedAt: string;
  version: string;
  sourceDescriptors: string[];
  descriptor: ArchitectureDescriptorRecord;
  mermaid: string;
}

export interface RuntimeArchitectureRecord {
  project: ArchitectureDiagramRecord;
  agent: ArchitectureDiagramRecord;
  agentChat: ArchitectureDiagramRecord;
  agentAdmin: ArchitectureDiagramRecord;
}
