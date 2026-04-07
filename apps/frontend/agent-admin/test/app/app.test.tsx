import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/pages/dashboard/dashboard-page', () => ({
  DashboardPage: () => <div>dashboard-page-body</div>
}));

describe('agent-admin app shell', () => {
  it('renders dashboard page inside app container', async () => {
    const { default: App } = await import('@/app/app');
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain('dashboard-page-body');
    expect(html).toContain('min-h-screen');
  });
});
