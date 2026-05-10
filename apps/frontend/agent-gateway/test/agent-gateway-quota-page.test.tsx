import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { QuotasPage } from '../src/app/pages/QuotasPage';

describe('QuotasPage', () => {
  it('renders provider quota sections like the CLI Proxy management page', () => {
    const html = renderToStaticMarkup(
      <QuotasPage
        quotas={[
          {
            id: 'quota-codex-main',
            provider: 'codex',
            scope: 'daily',
            limitTokens: 100,
            usedTokens: 10,
            resetAt: '2026-05-10T00:00:00.000Z',
            status: 'normal'
          }
        ]}
      />
    );

    expect(html).toContain('配额管理');
    expect(html).toContain('quota-management-clone');
    expect(html).toContain('quota-section-card');
    expect(html).toContain('Claude 配额');
    expect(html).toContain('Antigravity 配额');
    expect(html).toContain('Codex 配额');
    expect(html).toContain('Gemini CLI 配额');
    expect(html).toContain('Kimi 配额');
    expect(html).toContain('分页模式');
    expect(html).toContain('全部显示');
    expect(html).toContain('刷新全部');
    expect(html).toContain('10 / 100 tokens');
  });
});
