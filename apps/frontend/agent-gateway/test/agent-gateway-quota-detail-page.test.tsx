import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { QuotaDetailPage } from '../src/app/pages/QuotaDetailPage';

describe('QuotaDetailPage', () => {
  it('renders provider-specific quota details and refresh controls', () => {
    const html = renderToStaticMarkup(
      <QuotaDetailPage
        details={{
          items: [
            {
              id: 'quota-openai-gpt-5',
              providerId: 'openai-main',
              model: 'gpt-5',
              scope: 'daily',
              window: '1d',
              limit: 1000,
              used: 250,
              remaining: 750,
              resetAt: '2026-05-10T00:00:00.000Z',
              refreshedAt: '2026-05-09T00:00:00.000Z',
              status: 'normal'
            }
          ]
        }}
      />
    );

    expect(html).toContain('Quota Detail');
    expect(html).toContain('openai-main');
    expect(html).toContain('gpt-5');
    expect(html).toContain('250 / 1000');
    expect(html).toContain('Refresh provider quota');
  });
});
