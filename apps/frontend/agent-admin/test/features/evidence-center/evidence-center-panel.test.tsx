import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EVIDENCE_HIGHLIGHT_STORAGE_KEY,
  clearHighlightedEvidence,
  openEvidenceReplay,
  recoverEvidenceCheckpoint
} from '@/features/evidence-center/evidence-center-panel.helpers';

const { renderedButtons, getBrowserReplayMock, recoverToCheckpointMock } = vi.hoisted(() => ({
  renderedButtons: [] as Array<{ children?: unknown; onClick?: () => void | Promise<void> }>,
  getBrowserReplayMock: vi.fn(),
  recoverToCheckpointMock: vi.fn()
}));

const originalWindow = globalThis.window;

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
    getBrowserReplayMock.mockReset();
    recoverToCheckpointMock.mockReset();
    vi.unstubAllGlobals();
    if (originalWindow) {
      vi.stubGlobal('window', originalWindow);
    }
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

    expect(html).toContain('证据中心');
    expect(html).toContain('诊断证据');
    expect(html).toContain('浏览器回放');
    expect(html).toContain('检查点回放');
    expect(html).toContain('文渊概览');
    expect(html).toContain('时效基线');
    expect(html).toContain('决策 pass');
    expect(html).toContain('信息基准日期');
  });

  it('loads replay payloads, skips cached sessions, and closes expanded replay', async () => {
    const setExpandedReplayId = vi.fn();
    const setReplayPayloads = vi.fn();
    const setLoadingReplayId = vi.fn();

    getBrowserReplayMock.mockResolvedValue({ steps: 3 });

    await openEvidenceReplay({
      item: {
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
      } as any,
      expandedReplayId: undefined,
      replayPayloads: {},
      loadReplay: getBrowserReplayMock,
      setExpandedReplayId,
      setReplayPayloads,
      setLoadingReplayId
    });

    expect(setExpandedReplayId).toHaveBeenCalledWith('e-1');
    expect(setLoadingReplayId).toHaveBeenNthCalledWith(1, 'e-1');
    expect(getBrowserReplayMock).toHaveBeenCalledWith('replay-1');
    expect(setReplayPayloads).toHaveBeenCalledTimes(1);
    expect(setReplayPayloads.mock.calls[0]?.[0]?.({})).toEqual({
      'replay-1': { steps: 3 }
    });
    expect(setLoadingReplayId).toHaveBeenNthCalledWith(2, undefined);

    setExpandedReplayId.mockClear();
    setReplayPayloads.mockClear();
    setLoadingReplayId.mockClear();
    getBrowserReplayMock.mockClear();

    await openEvidenceReplay({
      item: {
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
      } as any,
      expandedReplayId: undefined,
      replayPayloads: { 'replay-1': { cached: true } },
      loadReplay: getBrowserReplayMock,
      setExpandedReplayId,
      setReplayPayloads,
      setLoadingReplayId
    });

    expect(setExpandedReplayId).toHaveBeenCalledWith('e-1');
    expect(getBrowserReplayMock).not.toHaveBeenCalled();
    expect(setReplayPayloads).not.toHaveBeenCalled();
    expect(setLoadingReplayId).not.toHaveBeenCalled();

    setExpandedReplayId.mockClear();

    await openEvidenceReplay({
      item: {
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
      } as any,
      expandedReplayId: 'e-1',
      replayPayloads: {},
      loadReplay: getBrowserReplayMock,
      setExpandedReplayId,
      setReplayPayloads,
      setLoadingReplayId
    });

    expect(setExpandedReplayId).toHaveBeenCalledWith(undefined);
  });

  it('triggers checkpoint recovery callbacks', async () => {
    const setRecoveringEvidenceId = vi.fn();

    recoverToCheckpointMock.mockResolvedValue({ ok: true });

    await recoverEvidenceCheckpoint({
      item: {
        id: 'e-1',
        sourceType: 'diagnosis_result',
        summary: '回放样本',
        taskGoal: '恢复到检查点',
        trustClass: 'high',
        createdAt: '2026-03-30T10:00:00.000Z',
        recoverable: true,
        checkpointRef: {
          sessionId: 'session-1',
          checkpointId: 'cp-1',
          checkpointCursor: 9,
          recoverability: 'partial'
        }
      } as any,
      recover: recoverToCheckpointMock,
      setRecoveringEvidenceId
    });

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

  it('prioritizes highlighted evidence ids from sessionStorage and clears the highlight state', async () => {
    const removeItem = vi.fn();

    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: vi.fn(() => JSON.stringify(['e-2'])),
        removeItem
      }
    } as unknown as Window & typeof globalThis);

    const html = renderToStaticMarkup(
      <EvidenceCenterPanel
        evidence={[
          {
            id: 'e-1',
            sourceType: 'document',
            summary: '普通 evidence',
            taskGoal: 'baseline',
            trustClass: 'medium',
            createdAt: '2026-03-30T10:00:00.000Z'
          } as any,
          {
            id: 'e-2',
            sourceType: 'document',
            summary: '被高亮 evidence',
            taskGoal: 'memory linked',
            trustClass: 'high',
            createdAt: '2026-03-31T10:00:00.000Z'
          } as any
        ]}
      />
    );

    expect(html.indexOf('被高亮 evidence')).toBeLessThan(html.indexOf('普通 evidence'));
    expect(html).toContain('记忆关联高亮');
    expect(html).toContain('命中 1 条来自 Memory Insight 的证据高亮。');

    await renderedButtons.find(item => item.children === '清除高亮')?.onClick?.();
    expect(removeItem).toHaveBeenCalledWith(EVIDENCE_HIGHLIGHT_STORAGE_KEY);

    const setHighlightedEvidenceIds = vi.fn();
    clearHighlightedEvidence({
      storage: { removeItem },
      setHighlightedEvidenceIds
    });
    expect(setHighlightedEvidenceIds).toHaveBeenCalledWith([]);
  });
});
