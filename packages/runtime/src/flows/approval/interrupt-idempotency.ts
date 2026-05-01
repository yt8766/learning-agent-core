type PendingInterrupt = {
  id: string;
  status?: string;
};

type PendingApproval = {
  taskId: string;
  intent: string;
  actor?: string;
  decision?: string;
};

export function recordPendingInterruptOnce<TInterrupt extends PendingInterrupt>(
  task: { interruptHistory?: TInterrupt[] },
  interrupt: TInterrupt
) {
  const history = task.interruptHistory ?? [];
  const existingIndex = history.findIndex(item => item.id === interrupt.id && item.status === 'pending');
  if (existingIndex >= 0) {
    task.interruptHistory = history.map((item, index) => (index === existingIndex ? interrupt : item));
    return false;
  }

  task.interruptHistory = [...history, interrupt];
  return true;
}

export function recordPendingApprovalOnce<TApproval extends PendingApproval>(
  task: { approvals: TApproval[] },
  approval: TApproval
) {
  const existing = task.approvals.some(
    item =>
      item.taskId === approval.taskId &&
      item.intent === approval.intent &&
      item.actor === approval.actor &&
      item.decision === 'pending'
  );
  if (existing) {
    return false;
  }

  task.approvals.push(approval);
  return true;
}
