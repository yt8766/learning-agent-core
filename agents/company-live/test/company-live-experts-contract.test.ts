import { describe, expect, it } from 'vitest';

import { companyLiveCoreExpertIds, companyLiveExpertDefinitions } from '../src';

describe('company-live expert definitions', () => {
  it('defines the 10 company experts', () => {
    expect(companyLiveExpertDefinitions).toHaveLength(10);
    expect(companyLiveExpertDefinitions.map(expert => expert.expertId)).toEqual([
      'productAgent',
      'operationsAgent',
      'contentAgent',
      'growthAgent',
      'marketingAgent',
      'intelligenceAgent',
      'riskAgent',
      'financeAgent',
      'supportAgent',
      'supplyAgent'
    ]);
  });

  it('marks 6 core experts for the first version', () => {
    expect(companyLiveCoreExpertIds).toEqual([
      'productAgent',
      'operationsAgent',
      'contentAgent',
      'growthAgent',
      'riskAgent',
      'financeAgent'
    ]);
  });
});
