import { derivePlannerStrategyRecord } from '../src/index.js';

const richCandidates = derivePlannerStrategyRecord(
  {
    specialistLead: {
      displayName: '技术架构专家',
      domain: 'technical-architecture',
      requiredCapabilities: ['specialist.technical-architecture'],
      agentId: 'official.coder',
      candidateAgentIds: ['official.coder', 'official.reviewer', 'official.data-report']
    }
  },
  '2026-04-19T00:00:00.000Z'
);

const capabilityGap = derivePlannerStrategyRecord(
  {
    specialistLead: {
      displayName: '风控合规专家',
      domain: 'risk-compliance',
      requiredCapabilities: ['specialist.risk-compliance'],
      candidateAgentIds: []
    }
  },
  '2026-04-19T00:00:00.000Z'
);

console.log(
  JSON.stringify(
    {
      richCandidates: {
        mode: richCandidates.mode,
        preferredAgentId: richCandidates.preferredAgentId,
        candidateCount: richCandidates.candidateCount
      },
      capabilityGap: {
        mode: capabilityGap.mode,
        gapDetected: capabilityGap.gapDetected,
        candidateCount: capabilityGap.candidateCount
      }
    },
    null,
    2
  )
);
