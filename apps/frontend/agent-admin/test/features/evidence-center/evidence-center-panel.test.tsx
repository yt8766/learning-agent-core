import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { renderedButtons, getBrowserReplayMock, recoverToCheckpointMock, stateQueue } = vi.hoisted(() => ({
  renderedButtons: [] as Array<{ children?: unknown; onClick?: () => void | Promise<void> }>,
  getBrowserReplayMock: vi.fn(),
  recoverToCheckpointMock: vi.fn(),
  stateQueue: [] as Array<[unknown, ReturnType<typeof vi.fn>]>
}));

vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useState: ((initialValue: unknown) => {
      if (stateQueue.length > 0) {
        return stateQueue.shift()!;
      }
      return [initialValue, vi.fn()];
    }) as unknown as typeof actual.useState
  };
});

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: { children?: unknown; onClick?: () => void | Promise<void> }) => {
    renderedButtons.push({ children, onClick });
    return <button>{children as any}</button>;
  }
}));

vi.mock('@/api/admin-api', () => ({
  getBrowserReplay: getBrowserReplayMock,
  recoverToCheckpoint: recoverToCheckpointMock
}));

import { EvidenceCenterPanel } from '@/features/evidence-center/evidence-center-panel';

describe('EvidenceCenterPanel', () => {
  beforeEach(() => {
    renderedButtons.length = 0;
    stateQueue.length = 0;
    getBrowserReplayMock.mockReset();
    recoverToCheckpointMock.mockReset();
  });

  it('renders diagnosis, replay, checkpoint and evidence detail sections', () => {
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
            sourceType: 'freshness_meta',
            sourceStore: 'cangjing',
            summary: '藏经阁索引 source 5 / searchable 4 / blocked 1',
            taskGoal: '知识库索引概览',
            trustClass: 'internal',
            createdAt: '2026-03-30T10:00:00.000Z',
            detail: {
              sourceCount: 5,
              referenceDate: '2026-03-30',
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
    expect(html).toContain('Wenyuan Overview');
    expect(html).toContain('Freshness Baseline');
    expect(html).toContain('决策 pass');
    expect(html).toContain('信息基准日期');
  });

  it('loads replay payloads and caches existing replay sessions', async () => {
    const setExpandedReplayId = vi.fn();
    const setReplayPayloads = vi.fn();
    const setLoadingReplayId = vi.fn();
    const setRecoveringEvidenceId = vi.fn();

    stateQueue.push(
      [undefined, setExpandedReplayId],
      [{}, setReplayPayloads],
      [undefined, setLoadingReplayId],
      [undefined, setRecoveringEvidenceId]
    );
    getBrowserReplayMock.mockResolvedValue({ steps: 3 });

    renderToStaticMarkup(
      <EvidenceCenterPanel
        evidence={[
          {
            id: 'e-1',
            sourceType: 'document',
            summary: '回放样本',
            taskGoal: '加载浏览器回放',
            trustClass: 'high',
            createdAt: '2026-03-30T10:00:00.000Z',
            replay: {
              sessionId: 'replay-1',
              snapshotSummary: 'browser replay'
            }
          } as any
        ]}
      />
    );

    const openReplay = renderedButtons.find(item => item.children === '打开回放');
    await openReplay?.onClick?.();

    expect(setExpandedReplayId).toHaveBeenCalledWith('e-1');
    expect(setLoadingReplayId).toHaveBeenNthCalledWith(1, 'e-1');
    expect(getBrowserReplayMock).toHaveBeenCalledWith('replay-1');
    expect(setReplayPayloads).toHaveBeenCalledTimes(1);
    expect(setLoadingReplayId).toHaveBeenNthCalledWith(2, undefined);

    renderedButtons.length = 0;
    stateQueue.push(
      [undefined, vi.fn()],
      [{ 'replay-1': { cached: true } }, vi.fn()],
      [undefined, vi.fn()],
      [undefined, vi.fn()]
    );
    getBrowserReplayMock.mockClear();

    renderToStaticMarkup(
      <EvidenceCenterPanel
        evidence={[
          {
            id: 'e-1',
            sourceType: 'document',
            summary: '回放样本',
            taskGoal: '加载浏览器回放',
            trustClass: 'high',
            createdAt: '2026-03-30T10:00:00.000Z',
            replay: {
              sessionId: 'replay-1',
              snapshotSummary: 'browser replay'
            }
          } as any
        ]}
      />
    );

    await renderedButtons.find(item => item.children === '打开回放')?.onClick?.();
    expect(getBrowserReplayMock).not.toHaveBeenCalled();
  });

  it('closes expanded replay and triggers checkpoint recovery callbacks', async () => {
    const setExpandedReplayId = vi.fn();
    const setRecoveringEvidenceId = vi.fn();

    stateQueue.push(
      ['e-1', setExpandedReplayId],
      [{}, vi.fn()],
      [undefined, vi.fn()],
      [undefined, setRecoveringEvidenceId]
    );

    renderToStaticMarkup(
      <EvidenceCenterPanel
        evidence={[
          {
            id: 'e-1',
            sourceType: 'diagnosis_result',
            summary: '回放样本',
            taskGoal: '恢复到检查点',
            trustClass: 'high',
            createdAt: '2026-03-30T10:00:00.000Z',
            replay: {
              sessionId: 'replay-1',
              snapshotSummary: 'browser replay'
            },
            recoverable: true,
            checkpointRef: {
              sessionId: 'session-1',
              checkpointId: 'cp-1',
              checkpointCursor: 9,
              recoverability: 'partial'
            }
          } as any
        ]}
      />
    );

    await renderedButtons.find(item => item.children === '收起回放')?.onClick?.();
    expect(setExpandedReplayId).toHaveBeenCalledWith(undefined);
    expect(getBrowserReplayMock).not.toHaveBeenCalled();

    recoverToCheckpointMock.mockResolvedValue({ ok: true });
    await renderedButtons.find(item => item.children === '回到此刻')?.onClick?.();

    expect(setRecoveringEvidenceId).toHaveBeenNthCalledWith(1, 'e-1');
    expect(recoverToCheckpointMock).toHaveBeenCalledWith({
      sessionId: 'session-1',
      checkpointId: 'cp-1',
      checkpointCursor: 9,
      reason: 'recover_from_evidence:e-1'
    });
    expect(setRecoveringEvidenceId).toHaveBeenNthCalledWith(2, undefined);
  });

  it('renders empty state when there is no evidence', () => {
    const html = renderToStaticMarkup(<EvidenceCenterPanel evidence={[]} />);
    expect(html).toContain('当前没有可展示的证据记录。');
  });
});
