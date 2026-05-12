import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { IntelligenceCenterPage } from '@/pages/intelligence-center/intelligence-center-page';

describe('IntelligenceCenterPage', () => {
  it('renders channels, recent signals, and knowledge candidates', () => {
    const html = renderToStaticMarkup(
      <IntelligenceCenterPage
        overview={{
          generatedAt: '2026-05-10T01:00:00.000Z',
          channels: [
            {
              channel: 'llm-releases',
              label: 'LLM Releases',
              lastRunAt: '2026-05-10T00:00:00.000Z',
              signalCount: 2,
              candidateCount: 1,
              failedQueryCount: 0
            }
          ],
          recentSignals: [
            {
              id: 'sig_1',
              channel: 'llm-releases',
              title: 'New model routing signal',
              summary: 'A model release affects routing.',
              priority: 'P1',
              confidence: 'high',
              status: 'confirmed',
              firstSeenAt: '2026-05-10T00:00:00.000Z',
              lastSeenAt: '2026-05-10T00:00:00.000Z',
              sourceCount: 2,
              knowledgeDecision: 'candidate'
            }
          ],
          pendingCandidates: [
            {
              id: 'cand_1',
              signalId: 'sig_1',
              candidateType: 'knowledge',
              decision: 'candidate',
              decisionReason: 'Official release affects routing.',
              ttlDays: 180,
              reviewStatus: 'pending',
              createdAt: '2026-05-10T00:00:00.000Z'
            }
          ]
        }}
      />
    );

    expect(html).toContain('LLM Releases');
    expect(html).toContain('2 signals');
    expect(html).toContain('New model routing signal');
    expect(html).toContain('A model release affects routing.');
    expect(html).toContain('Official release affects routing.');
    expect(html).toContain('pending');
  });

  it('renders stable empty states when overview lists are empty', () => {
    const html = renderToStaticMarkup(
      <IntelligenceCenterPage
        overview={{
          generatedAt: '2026-05-10T01:00:00.000Z',
          channels: [],
          recentSignals: [],
          pendingCandidates: []
        }}
      />
    );

    expect(html).toContain('当前还没有 Intelligence channel 运行摘要。');
    expect(html).toContain('当前还没有最近信号。');
    expect(html).toContain('当前没有待审知识候选。');
  });
});
