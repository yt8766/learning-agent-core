import { describe, expect, it } from 'vitest';

import { CompanyExpertDefinitionSchema } from '@agent/core';

import { companyLiveCoreExpertIds, companyLiveExpertDefinitions } from '../src';
import { companyLiveCoreRoutingPriority } from '../src/flows/company-live/expert-definitions';

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

  it('keeps routing priority aligned with the core expert set', () => {
    expect(new Set(companyLiveCoreRoutingPriority)).toEqual(new Set(companyLiveCoreExpertIds));
  });

  it('parses production definitions with the core schema and keeps core ids available', () => {
    const parsedDefinitions = companyLiveExpertDefinitions.map(definition =>
      CompanyExpertDefinitionSchema.parse(definition)
    );

    for (const expertId of companyLiveCoreExpertIds) {
      const definition = parsedDefinitions.find(parsedDefinition => parsedDefinition.expertId === expertId);
      expect(definition?.phase).toBe('core');
    }
  });
});
