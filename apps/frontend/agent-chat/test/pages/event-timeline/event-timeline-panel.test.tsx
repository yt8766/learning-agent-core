import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { EventTimelinePanel } from '@/pages/event-timeline/event-timeline-panel';

vi.mock('@/hooks/use-chat-session', () => ({
  formatSessionTime: (value?: string) => (value ? `formatted:${value}` : '刚刚')
}));

describe('event-timeline-panel', () => {
  it('renders interrupt, compaction and tool stream events with summaries and metadata', () => {
    const html = renderToStaticMarkup(
      <EventTimelinePanel
        events={
          [
            {
              id: 'evt-1',
              type: 'tool_stream_detected',
              at: '2026-04-01T09:00:00.000Z',
              payload: {
                toolName: 'browser.open',
                from: 'executor',
                node: 'tool_selected',
                scheduling: 'stream'
              }
            },
            {
              id: 'evt-2',
              type: 'context_compaction_retried',
              at: '2026-04-01T09:01:00.000Z',
              payload: {
                reactiveRetryCount: 2,
                stage: 'checkpoint',
                reasonCode: 'token_budget'
              }
            },
            {
              id: 'evt-3',
              type: 'interrupt_pending',
              at: '2026-04-01T09:02:00.000Z',
              payload: {
                interactionKind: 'plan-question',
                interruptSource: 'graph',
                interruptMode: 'blocking',
                reason: '需要补充执行范围',
                intent: 'plan'
              }
            }
          ] as any
        }
      />
    );

    expect(html).toContain('等待方案澄清');
    expect(html).toContain('需要补充执行范围');
    expect(html).toContain('交互：计划提问');
    expect(html).toContain('中断来源：图内');
    expect(html).toContain('模式：阻塞式');
    expect(html).toContain('触发应急压缩并重试 · 第 2 次');
    expect(html).toContain('压缩层：checkpoint');
    expect(html).toContain('原因：token_budget');
    expect(html).toContain('browser.open 已进入流式调度队列');
    expect(html).toContain('来源：Executor Agent');
    expect(html).toContain('工具：browser.open');
    expect(html).toContain('formatted:2026-04-01T09:02:00.000Z');
  });

  it('renders empty fallback and watchdog-style governance labels', () => {
    const watchdogHtml = renderToStaticMarkup(
      <EventTimelinePanel
        events={
          [
            {
              id: 'evt-watchdog',
              type: 'approval_required',
              at: '2026-04-01T09:03:00.000Z',
              payload: {
                watchdog: true,
                runtimeGovernanceReasonCode: 'policy_guard',
                summary: '需要治理确认'
              }
            }
          ] as any
        }
      />
    );
    const emptyHtml = renderToStaticMarkup(<EventTimelinePanel events={[]} />);

    expect(watchdogHtml).toContain('运行时治理中断');
    expect(watchdogHtml).toContain('需要治理确认');
    expect(watchdogHtml).toContain('原因：policy_guard');
    expect(emptyHtml).toContain('执行后会出现事件流');
  });
});
