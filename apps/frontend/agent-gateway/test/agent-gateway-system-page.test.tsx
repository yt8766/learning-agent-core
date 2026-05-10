import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SystemPage } from '../src/app/pages/SystemPage';

describe('SystemPage', () => {
  it('renders latest version, request-log, and local login cleanup controls', () => {
    const html = renderToStaticMarkup(
      <SystemPage
        info={{
          version: '1.2.3',
          buildDate: '2026-05-01',
          latestVersion: '1.2.4',
          updateAvailable: true,
          links: { help: 'https://help.router-for.me/' }
        }}
        modelGroups={[]}
      />
    );

    expect(html).toContain('System');
    expect(html).toContain('Check latest version');
    expect(html).toContain('Enable request log');
    expect(html).toContain('Clear local login storage');
  });
});
