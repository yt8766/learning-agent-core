import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { EvidenceCenterPanel } from '@/features/evidence-center/evidence-center-panel';

describe('EvidenceCenterPanel render smoke', () => {
  it('renders diagnosis and replay sections', () => {
    const html = renderToStaticMarkup(
      <EvidenceCenterPanel
        evidence={[
          {
            id: 'e-1',
            sourceType: 'diagnosis_result',
            sourceStore: 'wenyuan',
            summary: '发现 provider timeout 根因',
            taskGoal: '分析中断问题',
            trustClass: 'high',
            createdAt: '2026-03-30T10:00:00.000Z',
            detail: {
              reviewDecision: 'pass',
              reviewNotes: ['需要调整重试预算'],
              executionSummary: '已完成诊断',
              finalAnswer: '建议启用 checkpoint fallback'
            },
            replay: {
              sessionId: 'replay-1',
              snapshotSummary: '浏览器重放已就绪'
            },
            recoverable: true,
            checkpointRef: {
              sessionId: 'session-1',
              checkpointId: 'cp-1',
              checkpointCursor: 7,
              recoverability: 'safe'
            }
          } as any,
          {
            id: 'e-2',
            sourceType: 'document',
            sourceStore: 'cangjing',
            summary: '藏经阁索引 source 5 / searchable 4 / blocked 1',
            taskGoal: '知识库索引概览',
            trustClass: 'internal',
            createdAt: '2026-03-30T10:00:00.000Z',
            detail: {
              sourceCount: 5,
              searchableDocumentCount: 4,
              blockedDocumentCount: 1,
              latestReceipts: [{ id: 'receipt-1' }]
            }
          } as any
        ]}
      />
    );

    expect(html).toContain('Evidence Center');
    expect(html).toContain('Diagnosis Evidence');
    expect(html).toContain('Browser Replay');
    expect(html).toContain('Checkpoint Replay');
    expect(html).toContain('wenyuan');
    expect(html).toContain('cangjing');
    expect(html).toContain('Knowledge Index');
    expect(html).toContain('latest receipts: receipt-1');
  });
});
