import type { CompanyLiveContentBrief, CompanyLiveNodeTrace } from '@agent/core';

export interface CompanyLiveBusinessAgentDefinition {
  nodeId: string;
  domain: string;
  focus: string;
}

export const companyLiveBusinessAgents = [
  {
    nodeId: 'growthAgent',
    domain: 'growth',
    focus: 'GMV, revenue, conversion, regional growth'
  },
  {
    nodeId: 'operationsAgent',
    domain: 'operations',
    focus: 'host operations, scheduling, room health, moderation'
  },
  {
    nodeId: 'riskAgent',
    domain: 'risk',
    focus: 'fraud, compliance, refunds, bans, audit'
  },
  {
    nodeId: 'productAgent',
    domain: 'product',
    focus: 'experience, funnel, experiments, retention'
  },
  {
    nodeId: 'financeAgent',
    domain: 'finance',
    focus: 'settlement, profit, ROI, budget'
  },
  {
    nodeId: 'supportAgent',
    domain: 'support',
    focus: 'tickets, complaints, after-sales, refund reasons'
  },
  {
    nodeId: 'contentAgent',
    domain: 'content',
    focus: 'live scripts, selling points, short video, localization'
  },
  {
    nodeId: 'intelligenceAgent',
    domain: 'intelligence',
    focus: 'competitors, market, platform policy, creator ecosystem'
  }
] satisfies CompanyLiveBusinessAgentDefinition[];

export interface RunCompanyLiveBusinessAgentsInput {
  brief: CompanyLiveContentBrief;
  trace: CompanyLiveNodeTrace[];
  onNodeComplete?: (trace: CompanyLiveNodeTrace) => void;
}

function buildBusinessAgentTrace(
  brief: CompanyLiveContentBrief,
  agent: CompanyLiveBusinessAgentDefinition
): CompanyLiveNodeTrace {
  const start = Date.now();

  return {
    nodeId: agent.nodeId,
    status: 'succeeded',
    durationMs: Date.now() - start,
    inputSnapshot: {
      briefId: brief.briefId,
      targetPlatform: brief.targetPlatform,
      targetRegion: brief.targetRegion,
      riskLevel: brief.riskLevel
    },
    outputSnapshot: {
      agentId: agent.nodeId,
      domain: agent.domain,
      summary: `${agent.domain} agent reviewed ${brief.targetPlatform}/${brief.targetRegion} brief for ${agent.focus}.`
    }
  };
}

export function runCompanyLiveBusinessAgents(input: RunCompanyLiveBusinessAgentsInput): CompanyLiveNodeTrace[] {
  const trace = [...input.trace];

  for (const agent of companyLiveBusinessAgents) {
    const nodeTrace = buildBusinessAgentTrace(input.brief, agent);
    trace.push(nodeTrace);
    input.onNodeComplete?.(nodeTrace);
  }

  return trace;
}
