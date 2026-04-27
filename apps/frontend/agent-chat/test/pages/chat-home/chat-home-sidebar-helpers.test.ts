import { describe, expect, it, vi } from 'vitest';

import {
  buildSessionGroups,
  getSessionGroupLabel,
  getSessionStatusTone
} from '@/pages/chat-home/chat-home-sidebar-helpers';
import type { ChatSessionRecord } from '@/types/chat';

function session(id: string, title: string, updatedAt: string, status: ChatSessionRecord['status']): ChatSessionRecord {
  return {
    id,
    title,
    status,
    createdAt: updatedAt,
    updatedAt
  };
}

describe('chat-home-sidebar-helpers', () => {
  it('groups sessions by today, seven days, thirty days, and month buckets', () => {
    const groups = buildSessionGroups(
      [
        session('today', '今天任务', '2026-04-26T09:00:00.000Z', 'running'),
        session('week', '七天内任务', '2026-04-22T09:00:00.000Z', 'completed'),
        session('month', '三十天内任务', '2026-04-02T09:00:00.000Z', 'waiting_approval'),
        session('march', '三月任务', '2026-03-18T09:00:00.000Z', 'completed')
      ],
      new Date('2026-04-26T12:00:00.000Z')
    );

    expect(groups.map(group => group.label)).toEqual(['今天', '7 天内', '30 天内', '2026-03']);
    expect(groups.map(group => group.sessions.map(item => item.id))).toEqual([
      ['today'],
      ['week'],
      ['month'],
      ['march']
    ]);
  });

  it('keeps day bucket boundaries stable at seven and thirty local days', () => {
    const now = new Date(2026, 3, 26, 12);

    expect(getSessionGroupLabel(localDateString(2026, 3, 19, 9), now)).toBe('7 天内');
    expect(getSessionGroupLabel(localDateString(2026, 3, 18, 9), now)).toBe('30 天内');
    expect(getSessionGroupLabel(localDateString(2026, 2, 27, 9), now)).toBe('30 天内');
    expect(getSessionGroupLabel(localDateString(2026, 2, 26, 9), now)).toBe('2026-03');
  });

  it('does not treat a 23-hour daylight-saving local day as today', () => {
    withTimezone('America/New_York', () => {
      const now = new Date(2026, 2, 9, 12);

      expect(getSessionGroupLabel(localDateString(2026, 2, 8, 9), now)).toBe('7 天内');
    });
  });

  it('maps important session states to sidebar tones', () => {
    expect(getSessionStatusTone('running')).toEqual({ tone: 'running', label: '执行中', accessory: 'pill' });
    expect(getSessionStatusTone('waiting_approval')).toEqual({
      tone: 'approval',
      label: '需要审批',
      accessory: 'pill'
    });
    expect(getSessionStatusTone('waiting_interrupt')).toEqual({
      tone: 'approval',
      label: '需要确认',
      accessory: 'pill'
    });
    expect(getSessionStatusTone('failed')).toEqual({ tone: 'danger', label: '失败', accessory: 'dot' });
    expect(getSessionStatusTone('completed')).toEqual({ tone: 'done', label: '已完成', accessory: 'dot' });
    expect(getSessionStatusTone('idle')).toEqual({ tone: 'idle', label: '未开始', accessory: 'dot' });
  });
});

function localDateString(year: number, monthIndex: number, day: number, hour: number): string {
  return new Date(year, monthIndex, day, hour).toISOString();
}

function withTimezone(timezone: string, run: () => void): void {
  vi.stubEnv('TZ', timezone);

  try {
    run();
  } finally {
    vi.unstubAllEnvs();
  }
}
