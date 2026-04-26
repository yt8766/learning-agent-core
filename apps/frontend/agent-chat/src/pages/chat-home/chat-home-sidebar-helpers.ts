import { getSessionStatusLabel } from '@/hooks/use-chat-session';
import type { ChatSessionRecord } from '@/types/chat';

export interface ChatSessionGroup {
  label: string;
  sessions: ChatSessionRecord[];
}

export type ChatSessionStatusTone = 'running' | 'warning' | 'danger' | 'done' | 'idle';

export interface ChatSessionStatusDisplay {
  tone: ChatSessionStatusTone;
  label: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function buildSessionGroups(sessions: ChatSessionRecord[], now = new Date()): ChatSessionGroup[] {
  const sorted = [...sessions].sort((left, right) => {
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
  const groups = new Map<string, ChatSessionRecord[]>();

  for (const item of sorted) {
    const label = getSessionGroupLabel(item.updatedAt, now);
    groups.set(label, [...(groups.get(label) ?? []), item]);
  }

  return Array.from(groups.entries()).map(([label, groupSessions]) => ({
    label,
    sessions: groupSessions
  }));
}

export function getSessionGroupLabel(updatedAt: string, now = new Date()): string {
  const updated = new Date(updatedAt);
  const ageDays = Math.max(0, localDayNumber(now) - localDayNumber(updated));

  if (ageDays === 0) {
    return '今天';
  }

  if (ageDays <= 7) {
    return '7 天内';
  }

  if (ageDays <= 30) {
    return '30 天内';
  }

  const year = updated.getFullYear();
  const month = String(updated.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getSessionStatusTone(status: ChatSessionRecord['status']): ChatSessionStatusDisplay {
  switch (status) {
    case 'running':
      return { tone: 'running', label: getSidebarSessionStatusLabel(status) };
    case 'waiting_approval':
      return { tone: 'warning', label: getSidebarSessionStatusLabel(status) };
    case 'waiting_interrupt':
      return { tone: 'warning', label: getSidebarSessionStatusLabel(status) };
    case 'failed':
      return { tone: 'danger', label: getSidebarSessionStatusLabel(status) };
    case 'completed':
      return { tone: 'done', label: getSidebarSessionStatusLabel(status) };
    default:
      return { tone: 'idle', label: getSidebarSessionStatusLabel(status) };
  }
}

function getSidebarSessionStatusLabel(status: ChatSessionRecord['status']): string {
  if (status === 'waiting_interrupt') {
    return '待确认';
  }

  return getSessionStatusLabel(status);
}

function localDayNumber(value: Date): number {
  return Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) / DAY_MS;
}
