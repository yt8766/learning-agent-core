import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DashboardPage } from '../src/app/pages/DashboardPage';

describe('DashboardPage', () => {
  it('renders Agent Gateway dashboard summary counts', () => {
    const html = renderToStaticMarkup(
      <DashboardPage
        summary={{
          observedAt: '2026-05-09T00:00:00.000Z',
          connection: {
            status: 'connected',
            apiBase: 'https://router.example.com/v0/management',
            serverVersion: '1.2.3',
            serverBuildDate: '2026-05-01'
          },
          counts: {
            managementApiKeys: 2,
            authFiles: 3,
            providerCredentials: 4,
            availableModels: 9
          },
          providers: [],
          routing: {
            strategy: 'priority',
            forceModelPrefix: false,
            requestRetry: 2,
            wsAuth: true,
            proxyUrl: null
          }
        }}
      />
    );

    expect(html).toContain('仪表盘');
    expect(html).toContain('2 个管理密钥');
    expect(html).toContain('9 个可用模型');
    expect(html).toContain('Agent Gateway 运行总览');
    expect(html).toContain('https://router.example.com/v0/management');
    expect(html).toContain('dashboard-background-orbs');
    expect(html).toContain('dashboard-orb-one');
    expect(html).toContain('dashboard-orb-two');
    expect(html).toContain('dashboard-animated-card');
    expect(html).toContain('dashboard-status-dot connected');
  });
});
