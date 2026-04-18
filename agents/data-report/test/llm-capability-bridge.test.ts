import { describe, expect, it, vi } from 'vitest';

import { MODEL_CAPABILITIES, type LlmProvider } from '@agent/adapters';

import { DataReportSandpackAgent } from '../src/flows/data-report/sandpack-agent';
import { generateSingleReportPlannedFiles } from '../src/flows/data-report/nodes/single-report-file-generator';
import type { DataReportSandpackGraphState } from '../src/types';

function createProviderMock(overrides?: { streamResult?: string; textResult?: string }): LlmProvider {
  return {
    providerId: 'mock',
    displayName: 'Mock Provider',
    supportedModels: () => [],
    isConfigured: () => true,
    generateText: vi.fn(async () => overrides?.textResult ?? 'export default function Test() { return null; }'),
    streamText: vi.fn(async (_messages, _options, onToken) => {
      const content =
        overrides?.streamResult ??
        JSON.stringify({
          status: 'success',
          files: {
            '/App.tsx': 'export default function App() { return null; }',
            '/src/pages/dataDashboard/Revenue/index.tsx': 'export default function Page() { return null; }',
            '/src/services/data/Revenue.ts': 'export async function fetchRevenue() { return []; }',
            '/src/types/data/Revenue.ts': 'export interface RevenueRow { id: string; }'
          }
        });
      onToken(content);
      return content;
    }),
    generateObject: vi.fn(async () => ({ ok: true }))
  };
}

describe('@agent/agents-data-report llm capability bridge', () => {
  it('routes sandpack generation through shared stream retry helpers so text capability is always required', async () => {
    const llm = createProviderMock();
    const agent = new DataReportSandpackAgent();

    await agent.generate({
      llm,
      goal: '生成一个数据看板',
      modelId: 'claude-3-7-sonnet'
    });

    expect(llm.streamText).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        requiredCapabilities: [MODEL_CAPABILITIES.TEXT]
      }),
      expect.any(Function)
    );
  });

  it('routes planned single-file generation through shared text retry helpers', async () => {
    const llm = createProviderMock();
    const state: DataReportSandpackGraphState = {
      goal: '生成单报表页面',
      llm,
      modelId: 'claude-3-7-sonnet',
      analysis: {
        title: 'Revenue Overview',
        routeName: 'revenue',
        templateId: 'bonus-center-data',
        referenceMode: 'single'
      } as DataReportSandpackGraphState['analysis'],
      scopeDecision: {
        routeTitle: 'Revenue Overview',
        referenceMode: 'single'
      } as DataReportSandpackGraphState['scopeDecision'],
      blueprint: {
        templateId: 'bonus-center-data',
        scope: 'single'
      } as DataReportSandpackGraphState['blueprint']
    };

    await generateSingleReportPlannedFiles(state, [
      {
        path: '/src/pages/dataDashboard/revenue/index.tsx',
        phase: 'leaf',
        instruction: '生成页面代码',
        generator: 'llm'
      }
    ]);

    expect(llm.generateText).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        requiredCapabilities: [MODEL_CAPABILITIES.TEXT]
      })
    );
  });
});
