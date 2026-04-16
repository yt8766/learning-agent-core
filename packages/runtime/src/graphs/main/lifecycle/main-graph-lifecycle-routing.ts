import { ActionIntent, TaskRecord, TaskStatus } from '@agent/shared';

export type CreatedTaskDispatch =
  | { kind: 'wait_approval' }
  | { kind: 'session_bootstrap_and_pipeline' }
  | { kind: 'background_queue' };

export function resolveCreatedTaskDispatch(task: TaskRecord): CreatedTaskDispatch {
  if (task.status === TaskStatus.WAITING_APPROVAL) {
    return {
      kind: 'wait_approval'
    };
  }

  if (task.sessionId) {
    return {
      kind: 'session_bootstrap_and_pipeline'
    };
  }

  return {
    kind: 'background_queue'
  };
}

export function isSkillInstallApprovalPending(task: TaskRecord): boolean {
  return task.status === TaskStatus.WAITING_APPROVAL && task.pendingApproval?.intent === ActionIntent.INSTALL_SKILL;
}
