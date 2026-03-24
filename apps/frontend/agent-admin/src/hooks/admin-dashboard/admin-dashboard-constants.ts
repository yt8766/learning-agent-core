import type { ApprovalCenterItem, DashboardPageKey, PlatformConsoleRecord, TaskRecord } from '../../types/admin';

export const PAGE_KEYS: DashboardPageKey[] = [
  'runtime',
  'approvals',
  'learning',
  'evals',
  'archives',
  'skills',
  'evidence',
  'connectors'
];

export const PAGE_TITLES: Record<DashboardPageKey, string> = {
  runtime: 'Runtime Center',
  approvals: 'Approvals Center',
  learning: 'Learning Center',
  evals: 'Evals',
  archives: 'Archive Center',
  skills: 'Skill Lab',
  evidence: 'Evidence Center',
  connectors: 'Connector & Policy Center'
};

export function readPageFromHash(): DashboardPageKey {
  const page = window.location.hash.replace('#/', '');
  return PAGE_KEYS.includes(page as DashboardPageKey) ? (page as DashboardPageKey) : 'runtime';
}

export function toApprovalItems(consoleData: PlatformConsoleRecord | null): ApprovalCenterItem[] {
  if (!consoleData) {
    return [];
  }

  return consoleData.approvals.flatMap(task =>
    task.approvals
      .filter(approval => approval.decision === 'pending')
      .map(approval => ({
        taskId: task.taskId,
        goal: task.goal,
        status: task.status,
        sessionId: task.sessionId,
        currentMinistry: task.currentMinistry,
        currentWorker: task.currentWorker,
        intent: approval.intent,
        reason: approval.reason
      }))
  );
}

export function shouldPollTask(task?: TaskRecord) {
  return Boolean(task && ['queued', 'running', 'waiting_approval', 'blocked'].includes(task.status));
}

export function downloadText(filename: string, mimeType: string, content: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
