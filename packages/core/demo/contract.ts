import {
  CritiqueResultSchema,
  SpecialistFindingSchema,
  normalizeCritiqueResult,
  normalizeSpecialistFinding
} from '../src/index.js';

const finding = SpecialistFindingSchema.parse(
  normalizeSpecialistFinding({
    specialistId: 'technical-architecture',
    role: 'lead',
    summary: '  需要先收敛共享 provider contract  '
  })
);

const critique = CritiqueResultSchema.parse(
  normalizeCritiqueResult({
    decision: 'block',
    blockingIssues: ['  缺少审批门  ', '缺少审批门']
  })
);

console.log(
  JSON.stringify(
    {
      finding: {
        specialistId: finding.specialistId,
        summary: finding.summary,
        contractVersion: finding.contractVersion
      },
      critique: {
        decision: critique.decision,
        summary: critique.summary,
        shouldBlockEarly: critique.shouldBlockEarly
      }
    },
    null,
    2
  )
);
