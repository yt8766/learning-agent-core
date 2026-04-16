import { describe, expect, it, vi } from 'vitest';

import type { ILLMProvider as LlmProvider } from '@agent/core';

import { ChatService } from '../../src/chat/chat.service';
import {
  createCapabilityIntentService,
  createRuntimeHost,
  createRuntimeSessionService
} from './chat.service.test-helpers';

describe('ChatService', () => {
  it('post-processes sandpack files before returning them to the client', async () => {
    const runtimeHost = createRuntimeHost();
    runtimeHost.llmProvider = {
      isConfigured: vi.fn(() => true),
      streamText: vi.fn(async () =>
        JSON.stringify({
          status: 'success',
          files: {
            '/App.tsx': [
              'type Props = { users?: string[] };',
              'export default function App({ users }: Props) {',
              '  return <div>{users.map(user => user).join(", ")}</div>;',
              '}'
            ].join('\n'),
            '/pages/dataDashboard/bonusCenter/index.tsx': 'export function BonusCenterPage() { return <div>OK</div>; }',
            '/services/data/bonusCenter.ts': 'export async function getBonusCenterData() { return []; }',
            '/types/data/bonusCenter.ts': 'export interface BonusCenterRow { id: number; }',
            '/routes.ts':
              "import ReportPage from './pages/dataDashboard/bonusCenter';\n\nexport const reportRoutes = [{ path: '/dataDashboard/bonusCenter', title: 'Data Report Preview', component: ReportPage }] as const;",
            '/styles.css': 'body { margin: 0; }'
          }
        })
      )
    } as unknown as LlmProvider;
    const service = new ChatService(createRuntimeSessionService(), createCapabilityIntentService(), runtimeHost);

    const result = await service.streamSandpackCode(
      { message: '生成一个后台页面', responseFormat: 'sandpack' },
      vi.fn()
    );
    expect(result.files['/App.tsx']).toContain('(users ?? []).map(');
    expect(result.content).toContain('(users ?? []).map(');
  });

  it('emits heartbeat stage events while waiting for sandpack generation', async () => {
    vi.useFakeTimers();
    const runtimeHost = createRuntimeHost();
    runtimeHost.llmProvider = {
      isConfigured: vi.fn(() => true),
      streamText: vi.fn(
        () =>
          new Promise<string>(resolve => {
            setTimeout(() => {
              resolve(
                JSON.stringify({
                  status: 'success',
                  files: {
                    '/App.tsx': 'export default function App() { return <div>OK</div>; }',
                    '/src/pages/dataDashboard/bonusCenter/index.tsx':
                      'export function BonusCenterPage() { return <div>OK</div>; }',
                    '/src/services/data/bonusCenter.ts': 'export async function getBonusCenterData() { return []; }',
                    '/src/types/data/bonusCenter.ts': 'export interface BonusCenterRow { id: number; }',
                    '/routes.ts':
                      "import ReportPage from './pages/dataDashboard/bonusCenter';\n\nexport const reportRoutes = [{ path: '/dataDashboard/bonusCenter', title: 'Data Report Preview', component: ReportPage }] as const;",
                    '/styles.css': 'body { margin: 0; }'
                  }
                })
              );
            }, 4500);
          })
      )
    } as unknown as LlmProvider;
    const service = new ChatService(createRuntimeSessionService(), createCapabilityIntentService(), runtimeHost);
    const push = vi.fn();

    const task = service.streamSandpackCode({ message: '生成一个复杂报表页面', responseFormat: 'sandpack' }, push);
    await vi.advanceTimersByTimeAsync(4200);
    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'stage',
        data: expect.objectContaining({ stage: 'generate', status: 'pending' })
      })
    );
    await vi.advanceTimersByTimeAsync(500);
    await expect(task).resolves.toMatchObject({
      files: { '/App.tsx': 'export default function App() { return <div>OK</div>; }' }
    });
    vi.useRealTimers();
  });

  it('emits file-level and graph-level stage events for single-report generation', async () => {
    const generateText = vi.fn(async messages => {
      const content = messages.at(-1)?.content ?? '';
      if (content.includes('Target file: /src/pages/dataDashboard/silverCoinExchangeRecord/index.tsx')) {
        return "import { SilverCoinExchangeRecordChart } from './components/SilverCoinExchangeRecordChart';\nimport { SilverCoinExchangeRecordMetrics } from './components/SilverCoinExchangeRecordMetrics';\nimport { SilverCoinExchangeRecordTable } from './components/SilverCoinExchangeRecordTable';\nexport default function ReportPage() { return <section><SilverCoinExchangeRecordMetrics /><SilverCoinExchangeRecordChart /><SilverCoinExchangeRecordTable /></section>; }";
      }
      if (content.includes('SilverCoinExchangeRecordChart.tsx'))
        return 'export function SilverCoinExchangeRecordChart() { return <div>chart</div>; }';
      if (content.includes('SilverCoinExchangeRecordMetrics.tsx'))
        return 'export function SilverCoinExchangeRecordMetrics() { return <div>metrics</div>; }';
      if (content.includes('SilverCoinExchangeRecordTable.tsx'))
        return 'export function SilverCoinExchangeRecordTable() { return <div>table</div>; }';
      if (content.includes('/src/services/data/silverCoinExchangeRecord.ts'))
        return 'export async function fetchSilverCoinExchangeRecordReport() { return Promise.resolve({ list: [] }); }';
      if (content.includes('/src/types/data/silverCoinExchangeRecord.ts'))
        return 'export interface ReportTableRow { id: string; }';
      throw new Error(`Unexpected prompt: ${content}`);
    });

    const runtimeHost = createRuntimeHost();
    runtimeHost.llmProvider = {
      isConfigured: vi.fn(() => true),
      streamText: vi.fn(),
      generateText,
      generateObject: vi.fn()
    } as unknown as LlmProvider;
    const service = new ChatService(createRuntimeSessionService(), createCapabilityIntentService(), runtimeHost);
    const push = vi.fn();

    await service.streamSandpackCode(
      { message: '生成 Bonus Center 银币兑换记录驾驶舱，需要指标卡、趋势图和表格', responseFormat: 'sandpack' },
      push
    );

    const orderedNodeStages = push.mock.calls
      .map(([event]) => event)
      .filter((event): event is { type: 'stage'; data: { stage: string; status: string } } => event?.type === 'stage')
      .map(event => event.data)
      .filter(data => data.stage.endsWith('Node') || data.stage.endsWith('Subgraph'))
      .map(data => `${data.stage}:${data.status}`);

    expect(orderedNodeStages).toEqual([
      'analysisNode:pending',
      'analysisNode:success',
      'scopeNode:pending',
      'scopeNode:success',
      'intentNode:pending',
      'intentNode:success',
      'componentNode:pending',
      'componentNode:success',
      'structureNode:pending',
      'structureNode:success',
      'typeNode:pending',
      'typeNode:success',
      'serviceNode:pending',
      'serviceNode:success',
      'componentSubgraph:pending',
      'componentSubgraph:success',
      'pageSubgraph:pending',
      'pageSubgraph:success',
      'appGenNode:pending',
      'appGenNode:success',
      'assembleNode:pending',
      'assembleNode:success',
      'postProcessNode:pending',
      'postProcessNode:success'
    ]);
    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'stage', data: expect.objectContaining({ stage: 'generate_file' }) })
    );
  });

  it('streams preview stages before sending sandpack files for data-report requests', async () => {
    const service = new ChatService(
      createRuntimeSessionService(),
      createCapabilityIntentService(),
      createRuntimeHost()
    );
    const push = vi.fn();

    const sandpackFiles = await service.streamSandpackPreview(
      { message: '参考 bonusCenterData 生成多个数据报表页面' },
      push
    );

    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'stage',
        data: expect.objectContaining({ stage: 'analysis', status: 'pending' })
      })
    );
    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'stage',
        data: expect.objectContaining({ stage: 'postprocess', status: 'success' })
      })
    );
    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'files',
        data: expect.objectContaining({
          files: expect.objectContaining({
            '/App.tsx': sandpackFiles['/App.tsx']?.code
          })
        })
      })
    );
  });
});
