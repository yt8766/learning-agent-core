import { describe, expect, it } from 'vitest';

import {
  buildPromptRegressionSkipSummary,
  derivePromptRegressionSummary,
  enforcePromptRegressionGate,
  extractPromptResultRows,
  isSupportedPromptfooNodeRuntime
} from '../../../scripts/prompt-regression.js';

describe('prompt regression summary helpers', () => {
  it('extracts prompt result rows from common promptfoo-like shapes', () => {
    const rows = extractPromptResultRows({
      results: [
        {
          prompt: { id: 'hubu-research-v1' },
          provider: { id: 'openai:gpt-4o-mini' },
          success: true
        },
        {
          promptId: 'xingbu-review-v2',
          providerId: 'openai:gpt-4o-mini',
          gradingResult: { pass: false }
        }
      ]
    });

    expect(rows).toEqual([
      {
        promptId: 'hubu-research-v1',
        providerId: 'openai:gpt-4o-mini',
        pass: true,
        score: undefined,
        namedScores: undefined
      },
      {
        promptId: 'xingbu-review-v2',
        providerId: 'openai:gpt-4o-mini',
        pass: false,
        score: undefined,
        namedScores: undefined
      }
    ]);
  });

  it('derives suite-level latest summary from raw prompt results', () => {
    const summary = derivePromptRegressionSummary(
      {
        results: [
          { prompt: { id: 'hubu-research-v1' }, provider: { id: 'openai:gpt-4o-mini' }, success: true },
          { prompt: { id: 'hubu-research-v2' }, provider: { id: 'openai:gpt-4o-mini' }, success: false },
          { prompt: { id: 'libu-delivery-v1' }, provider: { id: 'openai:gpt-4o-mini' }, gradingResult: { pass: true } }
        ]
      },
      { runAt: '2026-03-28T02:00:00.000Z' }
    );

    expect(summary).toEqual({
      runAt: '2026-03-28T02:00:00.000Z',
      overallStatus: 'partial',
      passRate: 67,
      providerIds: ['openai:gpt-4o-mini'],
      suiteResults: [
        {
          suiteId: 'hubu-research',
          label: 'hubu-research',
          status: 'partial',
          passRate: 50,
          notes: ['versions: v1, v2', 'pass: v1', 'fail: v2'],
          promptResults: [
            {
              promptId: 'hubu-research-v1',
              version: 'v1',
              providerId: 'openai:gpt-4o-mini',
              pass: true,
              score: undefined
            },
            {
              promptId: 'hubu-research-v2',
              version: 'v2',
              providerId: 'openai:gpt-4o-mini',
              pass: false,
              score: undefined
            }
          ]
        },
        {
          suiteId: 'libu-delivery',
          label: 'libu-delivery',
          status: 'pass',
          passRate: 100,
          notes: ['versions: v1', 'pass: v1'],
          promptResults: [
            {
              promptId: 'libu-delivery-v1',
              version: 'v1',
              providerId: 'openai:gpt-4o-mini',
              pass: true,
              score: undefined
            }
          ]
        }
      ]
    });
  });

  it('enforces the core prompt suite gate above 90 percent', () => {
    const buildSuiteResult = (suiteId: string, passRate: number) => {
      const status: 'pass' | 'partial' = passRate > 90 ? 'pass' : 'partial';

      return {
        suiteId,
        label: suiteId,
        status,
        passRate,
        promptResults: []
      };
    };

    expect(() =>
      enforcePromptRegressionGate({
        runAt: '2026-03-28T00:00:00.000Z',
        overallStatus: 'pass',
        passRate: 97,
        providerIds: ['openai:gpt-4o-mini'],
        suiteResults: [
          buildSuiteResult('supervisor-plan', 100),
          buildSuiteResult('specialist-finding', 100),
          buildSuiteResult('hubu-research', 91),
          buildSuiteResult('xingbu-review', 100),
          buildSuiteResult('libu-delivery', 95)
        ]
      })
    ).not.toThrow();

    expect(() =>
      enforcePromptRegressionGate({
        runAt: '2026-03-28T00:00:00.000Z',
        overallStatus: 'partial',
        passRate: 89,
        providerIds: ['openai:gpt-4o-mini'],
        suiteResults: [
          buildSuiteResult('supervisor-plan', 100),
          buildSuiteResult('specialist-finding', 100),
          buildSuiteResult('hubu-research', 90),
          buildSuiteResult('xingbu-review', 100),
          buildSuiteResult('libu-delivery', 95)
        ]
      })
    ).toThrow(/hubu-research: 90%/);
  });

  it('detects supported promptfoo Node runtimes and builds skip summaries for unsupported ones', () => {
    expect(isSupportedPromptfooNodeRuntime('20.20.0')).toBe(true);
    expect(isSupportedPromptfooNodeRuntime('22.22.0')).toBe(true);
    expect(isSupportedPromptfooNodeRuntime('22.21.1')).toBe(false);

    expect(
      buildPromptRegressionSkipSummary('unsupported_node_runtime', {
        runAt: '2026-04-16T00:00:00.000Z',
        detectedNodeVersion: '22.21.1',
        requiredNodeRange: '^20.20.0 || >=22.22.0'
      })
    ).toEqual({
      runAt: '2026-04-16T00:00:00.000Z',
      overallStatus: 'partial',
      passRate: undefined,
      providerIds: [],
      suiteResults: [],
      skipped: true,
      skipReason: 'unsupported_node_runtime',
      detectedNodeVersion: '22.21.1',
      requiredNodeRange: '^20.20.0 || >=22.22.0'
    });
  });
});
