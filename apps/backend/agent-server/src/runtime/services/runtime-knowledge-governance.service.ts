import { Injectable } from '@nestjs/common';

import type { KnowledgeGovernanceProjection } from '@agent/core';

const KNOWLEDGE_GOVERNANCE_PROVIDERS: KnowledgeGovernanceProjection['providerHealth'] = [
  {
    provider: 'embedding',
    status: 'unconfigured',
    warningCount: 0
  },
  {
    provider: 'vector',
    status: 'unconfigured',
    warningCount: 0
  },
  {
    provider: 'keyword',
    status: 'unconfigured',
    warningCount: 0
  },
  {
    provider: 'generation',
    status: 'unconfigured',
    warningCount: 0
  }
];

@Injectable()
export class RuntimeKnowledgeGovernanceService {
  async getProjection(): Promise<KnowledgeGovernanceProjection> {
    return {
      summary: {
        knowledgeBaseCount: 0,
        documentCount: 0,
        readyDocumentCount: 0,
        failedJobCount: 0,
        warningCount: 0
      },
      providerHealth: KNOWLEDGE_GOVERNANCE_PROVIDERS,
      ingestionSources: [],
      retrievalDiagnostics: [],
      agentUsage: [],
      updatedAt: new Date().toISOString()
    };
  }
}
