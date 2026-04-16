import { describe, expect, it } from 'vitest';

import {
  CritiqueResultSchema,
  SpecialistFindingSchema,
  normalizeCritiqueResult,
  normalizeSpecialistFinding
} from '../src';

describe('@agent/core schema contracts', () => {
  it('normalizes specialist findings with default contract fields', () => {
    const finding = normalizeSpecialistFinding({
      specialistId: 'technical-architecture',
      role: 'lead',
      summary: '  需要先收敛共享 provider contract  '
    });

    expect(SpecialistFindingSchema.parse(finding)).toEqual({
      specialistId: 'technical-architecture',
      role: 'lead',
      contractVersion: 'specialist-finding.v1',
      source: 'route',
      stage: 'planning',
      summary: '需要先收敛共享 provider contract',
      domain: 'technical-architecture'
    });
  });

  it('clamps specialist finding confidence into the supported range', () => {
    expect(
      normalizeSpecialistFinding({
        specialistId: 'product-strategy',
        role: 'support',
        summary: '需要补齐验收路径',
        confidence: 2
      })
    ).toMatchObject({
      specialistId: 'product-strategy',
      confidence: 1
    });
  });

  it('normalizes critique results with default summary and shouldBlockEarly', () => {
    const result = normalizeCritiqueResult({
      decision: 'block',
      blockingIssues: ['  缺少审批门  ', '缺少审批门']
    });

    expect(CritiqueResultSchema.parse(result)).toEqual({
      contractVersion: 'critique-result.v1',
      decision: 'block',
      summary: '刑部判定当前方案存在阻断问题。',
      blockingIssues: ['缺少审批门'],
      shouldBlockEarly: true
    });
  });
});
