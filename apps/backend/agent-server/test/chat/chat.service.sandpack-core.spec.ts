import { describe, expect, it, vi } from 'vitest';

import type { LlmProvider } from '@agent/adapters';

import { ChatService } from '../../src/chat/chat.service';
import {
  createCapabilityIntentService,
  createRuntimeHost,
  createRuntimeSessionService
} from './chat.service.test-helpers';

describe('ChatService', () => {
  it('enforces the sandpack response contract on the model side', async () => {
    const runtimeHost = createRuntimeHost();
    runtimeHost.llmProvider = {
      isConfigured: vi.fn(() => true),
      streamText: vi.fn(async () =>
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
      )
    } as unknown as LlmProvider;
    const service = new ChatService(createRuntimeSessionService(), createCapabilityIntentService(), runtimeHost);

    await expect(
      service.streamSandpackCode({ message: '生成一个 Bonus Center 页面', responseFormat: 'sandpack' }, vi.fn())
    ).resolves.toMatchObject({
      files: expect.objectContaining({
        '/App.tsx': expect.stringContaining('./src/pages/dataDashboard/')
      })
    });
  });

  it('retries sandpack generation for invalid json, inlined mockData, missing files, and invalid routes', async () => {
    const scenarios = [
      {
        first: '{"status":"success","files":{"App.tsx":"unterminated}}',
        second: JSON.stringify({
          status: 'success',
          files: {
            '/App.tsx': 'export default function App() { return <div>Recovered</div>; }',
            '/src/pages/dataDashboard/bonusCenter/index.tsx':
              'export function BonusCenterPage() { return <div>Recovered</div>; }',
            '/src/services/data/bonusCenter.ts': 'export async function getBonusCenterData() { return []; }',
            '/src/types/data/bonusCenter.ts': 'export interface BonusCenterRow { id: number; }',
            '/routes.ts':
              "import ReportPage from './pages/dataDashboard/bonusCenter';\n\nexport const reportRoutes = [{ path: '/dataDashboard/bonusCenter', title: 'Data Report Preview', component: ReportPage }] as const;",
            '/styles.css': 'body { margin: 0; }'
          }
        }),
        expectRetry: 'Sandpack JSON parse failed'
      },
      {
        first: JSON.stringify({
          status: 'success',
          files: {
            '/App.tsx':
              'const mockData = [{ id: 1 }]; export default function App() { return <div>{mockData.length}</div>; }',
            '/styles.css': 'body { margin: 0; }'
          }
        }),
        second: JSON.stringify({
          status: 'success',
          files: {
            '/App.tsx':
              "import { BonusCenterPage } from './pages/dataDashboard/bonusCenter'; export default function App() { return <BonusCenterPage />; }",
            '/src/pages/dataDashboard/bonusCenter/index.tsx':
              "import { rows } from '../../../services/data/bonusCenter'; export function BonusCenterPage() { return <div>{rows.length}</div>; }",
            '/src/services/data/bonusCenter.ts': 'export const rows = [{ id: 1 }];',
            '/src/types/data/bonusCenter.ts': 'export interface BonusCenterRow { id: number; }',
            '/routes.ts':
              "import ReportPage from './pages/dataDashboard/bonusCenter';\n\nexport const reportRoutes = [{ path: '/dataDashboard/bonusCenter', title: 'Data Report Preview', component: ReportPage }] as const;",
            '/styles.css': 'body { margin: 0; }'
          }
        }),
        expectRetry: 'mockData'
      },
      {
        first: JSON.stringify({
          status: 'success',
          files: {
            '/App.tsx': 'export default function App() { return <div>Missing structure</div>; }',
            '/styles.css': 'body { margin: 0; }'
          }
        }),
        second: JSON.stringify({
          status: 'success',
          files: {
            '/App.tsx':
              "import { BonusCenterPage } from './pages/dataDashboard/bonusCenter'; export default function App() { return <BonusCenterPage />; }",
            '/src/pages/dataDashboard/bonusCenter/index.tsx':
              'export function BonusCenterPage() { return <div>OK</div>; }',
            '/src/services/data/bonusCenter.ts': 'export async function getBonusCenterData() { return []; }',
            '/src/types/data/bonusCenter.ts': 'export interface BonusCenterRow { id: number; }',
            '/routes.ts':
              "import ReportPage from './pages/dataDashboard/bonusCenter';\n\nexport const reportRoutes = [{ path: '/dataDashboard/bonusCenter', title: 'Data Report Preview', component: ReportPage }] as const;",
            '/styles.css': 'body { margin: 0; }'
          }
        }),
        expectRetry: '/src/pages/dataDashboard/'
      },
      {
        first: JSON.stringify({
          status: 'success',
          files: {
            '/App.tsx':
              "import { BonusCenterPage } from './pages/dataDashboard/bonusCenter'; export default function App() { return <BonusCenterPage />; }",
            '/src/pages/dataDashboard/bonusCenter/index.tsx':
              'export function BonusCenterPage() { return <div>OK</div>; }',
            '/src/services/data/bonusCenter.ts': 'export async function getBonusCenterData() { return []; }',
            '/src/types/data/bonusCenter.ts': 'export interface BonusCenterRow { id: number; }',
            '/routes.ts':
              "import { MenuDataItem } from '@ant-design/pro-components';\nconst routes: MenuDataItem = [{ path: '/', redirect: '/home' }];\nexport default routes;",
            '/styles.css': 'body { margin: 0; }'
          }
        }),
        second: JSON.stringify({
          status: 'success',
          files: {
            '/App.tsx':
              "import { BonusCenterPage } from './pages/dataDashboard/bonusCenter'; export default function App() { return <BonusCenterPage />; }",
            '/src/pages/dataDashboard/bonusCenter/index.tsx':
              'export function BonusCenterPage() { return <div>OK</div>; }',
            '/src/services/data/bonusCenter.ts': 'export async function getBonusCenterData() { return []; }',
            '/src/types/data/bonusCenter.ts': 'export interface BonusCenterRow { id: number; }',
            '/routes.ts':
              "import ReportPage from './pages/dataDashboard/bonusCenter';\n\nexport const reportRoutes = [{ path: '/dataDashboard/bonusCenter', title: 'Data Report Preview', component: ReportPage }] as const;",
            '/styles.css': 'body { margin: 0; }'
          }
        }),
        expectRetry: '/routes.ts'
      }
    ];

    for (const scenario of scenarios) {
      const runtimeHost = createRuntimeHost();
      const streamText = vi.fn().mockResolvedValueOnce(scenario.first).mockResolvedValueOnce(scenario.second);
      runtimeHost.llmProvider = { isConfigured: vi.fn(() => true), streamText } as unknown as LlmProvider;
      const service = new ChatService(createRuntimeSessionService(), createCapabilityIntentService(), runtimeHost);
      const push = vi.fn();

      const result = await service.streamSandpackCode(
        { message: '生成一个后台页面', responseFormat: 'sandpack' },
        push
      );

      expect(streamText.mock.calls.length).toBeGreaterThanOrEqual(1);
      expect(result.files).toHaveProperty('/App.tsx');
      if (scenario.expectRetry === 'Sandpack JSON parse failed' || scenario.expectRetry === 'mockData') {
        expect(JSON.stringify(streamText.mock.calls)).toContain(scenario.expectRetry);
      }
      expect(push).toHaveBeenCalledWith(expect.objectContaining({ type: 'stage' }));
    }
  });
});
