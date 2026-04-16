import { describe, expect, it } from 'vitest';

import { DeliverySummarySchema } from '../src/flows/delivery/schemas/delivery-summary-schema';
import { ResearchEvidenceSchema } from '../src/flows/ministries/hubu-search/schemas/research-evidence-schema';

describe('@agent/agents-supervisor delivery and research contracts', () => {
  it('parses delivery summaries with the expected final answer field', () => {
    expect(
      DeliverySummarySchema.parse({
        finalAnswer: '已完成交付整理，并附上后续建议。'
      })
    ).toEqual({
      finalAnswer: '已完成交付整理，并附上后续建议。'
    });
  });

  it('defaults research observations to an empty array', () => {
    expect(
      ResearchEvidenceSchema.parse({
        contractVersion: 'research-evidence.v1',
        summary: 'React Router 官方文档已经覆盖本轮路由设计所需信息。'
      })
    ).toEqual({
      contractVersion: 'research-evidence.v1',
      summary: 'React Router 官方文档已经覆盖本轮路由设计所需信息。',
      observations: []
    });
  });

  it('accepts structured specialist findings inside research evidence', () => {
    expect(
      ResearchEvidenceSchema.parse({
        contractVersion: 'research-evidence.v1',
        summary: '研究阶段已经确认前端主链方案。',
        observations: ['优先沿用现有路由约定'],
        specialistFinding: {
          specialistId: 'technical-architecture',
          role: 'lead',
          summary: '路由与页面目录结构保持现有分层即可。',
          domain: 'technical-architecture',
          confidence: 0.9
        }
      })
    ).toEqual({
      contractVersion: 'research-evidence.v1',
      summary: '研究阶段已经确认前端主链方案。',
      observations: ['优先沿用现有路由约定'],
      specialistFinding: {
        specialistId: 'technical-architecture',
        role: 'lead',
        summary: '路由与页面目录结构保持现有分层即可。',
        domain: 'technical-architecture',
        confidence: 0.9
      }
    });
  });

  it('rejects research evidence with too many observations', () => {
    expect(() =>
      ResearchEvidenceSchema.parse({
        contractVersion: 'research-evidence.v1',
        summary: '研究阶段输出过多观察点。',
        observations: ['1', '2', '3', '4', '5', '6']
      })
    ).toThrow(/<=5 items/i);
  });
});
