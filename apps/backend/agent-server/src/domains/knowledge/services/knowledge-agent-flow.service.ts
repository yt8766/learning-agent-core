import { Injectable } from '@nestjs/common';
import {
  KnowledgeAgentFlowRunRequestSchema,
  KnowledgeAgentFlowRunResponseSchema,
  KnowledgeAgentFlowSaveRequestSchema,
  type KnowledgeAgentFlow,
  type KnowledgeAgentFlowListResponse,
  type KnowledgeAgentFlowRunResponse
} from '@agent/knowledge';

@Injectable()
export class KnowledgeAgentFlowService {
  private readonly flows = new Map<string, KnowledgeAgentFlow>();

  async listFlows(): Promise<KnowledgeAgentFlowListResponse> {
    const items = Array.from(this.flows.values());
    return {
      items,
      total: items.length,
      page: 1,
      pageSize: items.length
    };
  }

  async saveFlow(input: unknown): Promise<{ flow: KnowledgeAgentFlow }> {
    const parsed = KnowledgeAgentFlowSaveRequestSchema.parse(input);
    const flow = parsed.flow;
    this.flows.set(flow.id, flow);
    return { flow };
  }

  async updateFlow(flowId: string, input: unknown): Promise<{ flow: KnowledgeAgentFlow }> {
    const parsed = KnowledgeAgentFlowSaveRequestSchema.parse(input);
    const existing = this.flows.get(flowId);
    if (!existing) {
      throw new Error(`knowledge_agent_flow_not_found: Flow ${flowId} not found`);
    }
    const updated: KnowledgeAgentFlow = { ...parsed.flow, id: flowId };
    this.flows.set(flowId, updated);
    return { flow: updated };
  }

  async runFlow(flowId: string, input: unknown): Promise<KnowledgeAgentFlowRunResponse> {
    const flow = this.flows.get(flowId);
    if (!flow) {
      throw new Error(`knowledge_agent_flow_not_found: Flow ${flowId} not found`);
    }

    const parsed = KnowledgeAgentFlowRunRequestSchema.parse(input);
    const now = new Date().toISOString();

    const response = {
      runId: `run_${flowId}`,
      flowId,
      status: 'completed' as const,
      output: {
        answer: `Flow ${flowId} completed.`,
        knowledgeBaseIds: parsed.input.knowledgeBaseIds
      },
      createdAt: now,
      updatedAt: now
    };

    return KnowledgeAgentFlowRunResponseSchema.parse(response);
  }
}
