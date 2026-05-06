import { describe, expect, it } from 'vitest';

import {
  type JsonValue,
  type KnowledgeAgentFlowNode,
  type KnowledgeAgentFlowRunRequest,
  type KnowledgeAgentFlowRunResponse,
  KnowledgeAgentFlowNodeSchema,
  KnowledgeAgentFlowRunRequestSchema,
  KnowledgeAgentFlowRunResponseSchema,
  KnowledgeAgentFlowSchema
} from '../src/contracts/knowledge-agent-flow';

describe('knowledge agent flow contracts', () => {
  it('parses a flow with input, retrieval, generation nodes and edges', () => {
    const parsed = KnowledgeAgentFlowSchema.parse({
      id: 'flow_1',
      name: 'Workspace answer flow',
      version: 1,
      status: 'draft',
      nodes: [
        {
          id: 'node_input',
          type: 'input',
          label: 'Question input',
          position: { x: 0, y: 0 },
          config: {
            placeholder: 'Ask a question'
          }
        },
        {
          id: 'node_retrieve',
          type: 'knowledge_retrieve',
          label: 'Retrieve knowledge',
          description: 'Search selected knowledge bases',
          position: { x: 280, y: 0 },
          config: {
            topK: 8,
            mode: 'hybrid',
            filters: {
              tags: ['sdk']
            }
          }
        },
        {
          id: 'node_generate',
          type: 'llm_generate',
          label: 'Generate answer',
          position: { x: 560, y: 0 },
          config: {
            model: 'knowledge-answer',
            groundedCitations: true
          }
        }
      ],
      edges: [
        {
          id: 'edge_input_retrieve',
          source: 'node_input',
          target: 'node_retrieve',
          label: 'question'
        },
        {
          id: 'edge_retrieve_generate',
          source: 'node_retrieve',
          target: 'node_generate',
          sourceHandle: 'hits',
          targetHandle: 'context'
        }
      ],
      createdAt: '2026-05-04T00:00:00.000Z',
      updatedAt: '2026-05-04T00:00:00.000Z'
    });

    expect(parsed.nodes.map(node => node.type)).toEqual(['input', 'knowledge_retrieve', 'llm_generate']);
    expect(parsed.edges).toHaveLength(2);
    expect(parsed.description).toBe('');
  });

  it('rejects unsupported node types', () => {
    expect(() =>
      KnowledgeAgentFlowNodeSchema.parse({
        id: 'node_web',
        type: 'web_crawler',
        label: 'Crawl the web',
        position: { x: 0, y: 0 },
        config: {}
      })
    ).toThrow();
  });

  it('parses a flow run request with message and knowledge base ids', () => {
    const parsed = KnowledgeAgentFlowRunRequestSchema.parse({
      flowId: 'flow_1',
      input: {
        message: 'What changed in the retrieval runtime?',
        knowledgeBaseIds: ['kb_runtime', 'kb_contracts']
      }
    });

    expect(parsed.input.knowledgeBaseIds).toEqual(['kb_runtime', 'kb_contracts']);
  });

  it('keeps node config and run payloads typed as JSON-safe values', () => {
    const node: KnowledgeAgentFlowNode = KnowledgeAgentFlowNodeSchema.parse({
      id: 'node_retrieve',
      type: 'knowledge_retrieve',
      label: 'Retrieve knowledge',
      position: { x: 0, y: 0 },
      config: {
        topK: 5,
        tags: ['runtime'],
        nested: {
          enabled: true,
          value: null
        }
      }
    });
    const request: KnowledgeAgentFlowRunRequest = KnowledgeAgentFlowRunRequestSchema.parse({
      flowId: 'flow_1',
      input: {
        message: 'Explain JSON-safe contracts',
        variables: {
          locale: 'zh-CN',
          debug: false
        }
      }
    });
    const response: KnowledgeAgentFlowRunResponse = KnowledgeAgentFlowRunResponseSchema.parse({
      runId: 'run_1',
      flowId: 'flow_1',
      status: 'completed',
      output: {
        answer: 'JSON-safe',
        citations: ['doc_1']
      },
      createdAt: '2026-05-04T00:00:00.000Z',
      updatedAt: '2026-05-04T00:00:00.000Z'
    });

    const configValue: JsonValue | undefined = node.config.nested;
    const variableValue: JsonValue | undefined = request.input.variables.locale;
    const outputValue: JsonValue | undefined = response.output?.citations;

    expect(configValue).toEqual({ enabled: true, value: null });
    expect(variableValue).toBe('zh-CN');
    expect(outputValue).toEqual(['doc_1']);
  });

  it('rejects non JSON-safe config values', () => {
    expect(() =>
      KnowledgeAgentFlowNodeSchema.parse({
        id: 'node_invalid',
        type: 'llm_generate',
        label: 'Generate',
        position: { x: 0, y: 0 },
        config: {
          callback: () => 'not-json'
        }
      })
    ).toThrow();

    expect(() =>
      KnowledgeAgentFlowNodeSchema.parse({
        id: 'node_undefined',
        type: 'llm_generate',
        label: 'Generate',
        position: { x: 0, y: 0 },
        config: {
          model: undefined
        }
      })
    ).toThrow();
  });

  it('rejects React Flow vendor fields on strict node contracts', () => {
    expect(() =>
      KnowledgeAgentFlowNodeSchema.parse({
        id: 'node_vendor',
        type: 'input',
        label: 'Input',
        position: { x: 0, y: 0 },
        config: {},
        measured: { width: 200, height: 80 },
        selected: true
      })
    ).toThrow();
  });

  it('parses supported run statuses and rejects unsupported run statuses', () => {
    for (const status of ['queued', 'running', 'completed', 'failed']) {
      expect(
        KnowledgeAgentFlowRunResponseSchema.parse({
          runId: `run_${status}`,
          flowId: 'flow_1',
          status,
          createdAt: '2026-05-04T00:00:00.000Z',
          updatedAt: '2026-05-04T00:00:00.000Z'
        }).status
      ).toBe(status);
    }

    expect(() =>
      KnowledgeAgentFlowRunResponseSchema.parse({
        runId: 'run_invalid',
        flowId: 'flow_1',
        status: 'paused',
        createdAt: '2026-05-04T00:00:00.000Z',
        updatedAt: '2026-05-04T00:00:00.000Z'
      })
    ).toThrow();
  });
});
