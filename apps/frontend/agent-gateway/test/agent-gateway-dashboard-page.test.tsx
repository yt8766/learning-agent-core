import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DashboardPage } from '../src/app/pages/DashboardPage';

describe('DashboardPage', () => {
  it('renders CLI Proxy dashboard summary counts', () => {
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

    expect(html).toContain('Dashboard');
    expect(html).toContain('2 API Keys');
    expect(html).toContain('9 Models');
    expect(html).toContain('https://router.example.com/v0/management');
  });
});
