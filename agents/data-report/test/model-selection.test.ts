import { describe, expect, it } from 'vitest';

import type { ILLMProvider } from '@agent/core';

import { resolveDataReportJsonNodeModelCandidates } from '../src/flows/data-report-json/model-policy';
import { resolveFirstModelSelectorCandidate } from '../src/utils/model-selection';

function createLlm(models: string[]): ILLMProvider {
  return {
    providerId: 'fixture',
    displayName: 'fixture',
    isConfigured: () => true,
    supportedModels: () =>
      models.map(modelId => ({
        id: modelId,
        displayName: modelId,
        providerId: 'fixture',
        contextWindow: 200_000,
        maxOutput: 16_000,
        capabilities: ['text', 'tool-call']
      })),
    generateText: async () => '',
    streamText: async () => '',
    generateObject: async <T>() => ({}) as T
  };
}

describe('@agent/agents-data-report model selection', () => {
  it('prefers fast-class models for lightweight selectors and quality-class models for heavy selectors', () => {
    const llm = createLlm(['MiniMax-M2.7', 'MiniMax-M2.5-highspeed', 'M2-her']);

    expect(
      resolveFirstModelSelectorCandidate({
        llm,
        selector: { tier: 'fast', role: 'manager' }
      })
    ).toBe('MiniMax-M2.5-highspeed');

    expect(
      resolveFirstModelSelectorCandidate({
        llm,
        selector: { tier: 'quality', role: 'research' }
      })
    ).toBe('MiniMax-M2.7');
  });

  it('uses preferred model hints ahead of heuristic ranking when the runtime supplies them', () => {
    const llm = createLlm(['GLM-5.1', 'GLM-4.7-FlashX']);

    expect(
      resolveFirstModelSelectorCandidate({
        llm,
        selector: {
          tier: 'fast',
          role: 'manager',
          preferredModelIds: ['GLM-4.7-FlashX', 'GLM-5.1']
        }
      })
    ).toBe('GLM-4.7-FlashX');
  });

  it('builds node candidate lists from semantic policy selectors instead of fixed model ids', () => {
    const llm = createLlm(['GLM-5.1', 'GLM-4.7-FlashX']);

    const candidates = resolveDataReportJsonNodeModelCandidates(
      {
        goal: '生成一个复杂驾驶舱',
        llm,
        nodeModelPolicy: {
          analysisNode: { primary: { tier: 'fast', role: 'manager' } },
          patchIntentNode: { primary: { tier: 'fast', role: 'manager' } },
          schemaSpecNode: { primary: { tier: 'quality', role: 'research' } },
          filterSchemaNode: {
            primary: { tier: 'fast', role: 'manager' },
            fallback: { tier: 'quality', role: 'research' }
          },
          dataSourceNode: {
            primary: { tier: 'fast', role: 'manager' },
            fallback: { tier: 'quality', role: 'research' }
          },
          sectionPlanNode: {
            primary: { tier: 'quality', role: 'research' },
            fallback: { tier: 'fast', role: 'manager' }
          },
          metricsBlockNode: {
            primary: { tier: 'fast', role: 'manager' },
            fallback: { tier: 'quality', role: 'research' }
          },
          chartBlockNode: {
            primary: { tier: 'quality', role: 'research' },
            fallback: { tier: 'fast', role: 'manager' }
          },
          tableBlockNode: {
            primary: { tier: 'fast', role: 'manager' },
            fallback: { tier: 'quality', role: 'research' }
          },
          sectionSchemaNode: {
            primary: { tier: 'fast', role: 'manager' },
            complex: { tier: 'quality', role: 'research' },
            fallback: { tier: 'quality', role: 'research' }
          },
          patchSchemaNode: {
            primary: { tier: 'fast', role: 'manager' },
            complex: { tier: 'quality', role: 'research' },
            fallback: { tier: 'quality', role: 'research' }
          }
        }
      },
      'chartBlockNode'
    );

    expect(candidates).toEqual(['GLM-5.1', 'GLM-4.7-FlashX']);
  });
});
