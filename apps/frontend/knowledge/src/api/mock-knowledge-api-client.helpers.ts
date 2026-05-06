import type { AgentFlowRecord, ChatRequest, ChatResponse, DocumentProcessingJob, PageResult } from '../types/api';

export function toSdkCitation(citation: ChatResponse['citations'][number]) {
  return {
    sourceId: citation.documentId,
    chunkId: citation.chunkId,
    title: citation.title,
    uri: citation.uri ?? '',
    quote: citation.quote,
    sourceType: 'user-upload' as const,
    trustClass: 'internal' as const,
    score: citation.score
  };
}

export function latestUserMessage(messages: ChatRequest['messages']): string | undefined {
  const message = [...(messages ?? [])].reverse().find(item => item.role === 'user');
  if (!message) {
    return undefined;
  }
  if (typeof message.content === 'string') {
    return message.content;
  }
  return message.content
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('\n');
}

export function page<T>(items: T[]): PageResult<T> {
  return { items, total: items.length, page: 1, pageSize: 20 };
}

export function createMockJob(documentId: string): DocumentProcessingJob {
  return {
    id: 'job_mock_latest',
    documentId,
    stage: 'uploaded',
    status: 'queued',
    stages: [],
    progress: { percent: 0 },
    attempts: 1,
    createdAt: new Date().toISOString()
  };
}

export function createDefaultAgentFlow(): AgentFlowRecord {
  const now = new Date().toISOString();
  return {
    id: 'flow_default_rag',
    name: 'Default RAG Flow',
    description: 'Mock knowledge retrieval and answer generation flow.',
    version: 1,
    status: 'active',
    nodes: [
      {
        id: 'input',
        type: 'input',
        label: 'Input',
        position: { x: 0, y: 80 },
        config: {}
      },
      {
        id: 'knowledge_retrieve',
        type: 'knowledge_retrieve',
        label: 'Retrieve Knowledge',
        position: { x: 240, y: 80 },
        config: { topK: 6 }
      },
      {
        id: 'llm_generate',
        type: 'llm_generate',
        label: 'Generate Answer',
        position: { x: 480, y: 80 },
        config: { modelProfileId: 'daily-balanced' }
      },
      {
        id: 'output',
        type: 'output',
        label: 'Output',
        position: { x: 720, y: 80 },
        config: {}
      }
    ],
    edges: [
      { id: 'edge_input_retrieve', source: 'input', target: 'knowledge_retrieve' },
      { id: 'edge_retrieve_generate', source: 'knowledge_retrieve', target: 'llm_generate' },
      { id: 'edge_generate_output', source: 'llm_generate', target: 'output' }
    ],
    createdAt: now,
    updatedAt: now
  };
}

export function upsertAgentFlow(flows: AgentFlowRecord[], flow: AgentFlowRecord): AgentFlowRecord[] {
  const next = flows.filter(item => item.id !== flow.id);
  next.unshift(flow);
  return next;
}
