import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LogsManagerPage } from '../src/app/pages/LogsManagerPage';

describe('LogsManagerPage', () => {
  it('renders structured filters, download actions, and raw parsed view controls', () => {
    const html = renderToStaticMarkup(<LogsManagerPage />);

    expect(html).toContain('Logs Manager');
    expect(html).toContain('All methods');
    expect(html).toContain('POST');
    expect(html).toContain('All status');
    expect(html).toContain('5xx');
    expect(html).toContain('Download request by id');
    expect(html).toContain('Download error log file');
    expect(html).toContain('Raw view');
    expect(html).toContain('Parsed view');
  });
});
