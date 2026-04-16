import type { CapabilityAttachmentRecord, TaskRecord } from '@agent/shared';

export function resolveCapabilityRedirect(
  task: Pick<TaskRecord, 'capabilityAttachments' | 'executionMode'>,
  target?: string
): {
  requestedTarget?: string;
  redirectedTarget?: string;
  attachment?: CapabilityAttachmentRecord;
  redirectAttachment?: CapabilityAttachmentRecord;
  requiresReadonlyFallback: boolean;
} {
  if (!target) {
    return {
      requestedTarget: target,
      redirectedTarget: target,
      requiresReadonlyFallback: task.executionMode === 'plan'
    };
  }
  const attachments = task.capabilityAttachments ?? [];
  const normalizedTarget = target.toLowerCase();
  const attachment = attachments.find(item =>
    [item.id, item.displayName, item.sourceId].filter(Boolean).some(value => value!.toLowerCase() === normalizedTarget)
  );
  const redirectedTarget = attachment?.deprecated_in_favor_of ?? target;
  const redirectAttachment = attachments.find(item =>
    [item.id, item.displayName, item.sourceId]
      .filter(Boolean)
      .some(value => value!.toLowerCase() === redirectedTarget.toLowerCase())
  );
  return {
    requestedTarget: target,
    redirectedTarget,
    attachment,
    redirectAttachment,
    requiresReadonlyFallback: task.executionMode === 'plan'
  };
}
