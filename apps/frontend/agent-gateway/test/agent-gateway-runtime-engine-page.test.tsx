import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { RuntimeEnginePage } from '../src/app/pages/RuntimeEnginePage';

describe('RuntimeEnginePage', () => {
  it('renders runtime health and executor status', () => {
    const html = renderToStaticMarkup(
      <RuntimeEnginePage
        health={{
          status: 'ready',
          checkedAt: '2026-05-10T00:00:00.000Z',
          executors: [
            {
              providerKind: 'codex',
              status: 'ready',
              checkedAt: '2026-05-10T00:00:00.000Z',
              activeRequests: 0,
              supportsStreaming: true
            }
          ],
          activeRequests: 0,
          activeStreams: 0,
          usageQueue: { pending: 2, failed: 0 },
          cooldowns: []
        }}
      />
    );

    expect(html).toContain('Runtime Engine');
    expect(html).toContain('codex');
    expect(html).toContain('ready');
    expect(html).toContain('Streaming');
    expect(html).toContain('Queue');
  });

  it('renders loading and empty executor states', () => {
    expect(renderToStaticMarkup(<RuntimeEnginePage health={null} />)).toContain('正在加载 Runtime Engine');

    const html = renderToStaticMarkup(
      <RuntimeEnginePage
        health={{
          status: 'degraded',
          checkedAt: '2026-05-10T00:00:00.000Z',
          executors: [],
          activeRequests: 0,
          activeStreams: 0,
          usageQueue: { pending: 0, failed: 0 },
          cooldowns: []
        }}
      />
    );

    expect(html).toContain('暂无 executor');
    expect(html).toContain('degraded');
  });
});
