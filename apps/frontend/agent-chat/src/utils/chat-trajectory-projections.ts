import type { ChatEventRecord } from '@/types/chat';

const EXECUTION_STEP_EVENT_LABELS: Record<string, string> = {
  execution_step_started: '执行步骤开始',
  execution_step_completed: '执行步骤完成',
  execution_step_blocked: '执行步骤阻断',
  execution_step_resumed: '执行步骤恢复'
};

export function buildExecutionStepEventCopy(eventType: string, payload: Record<string, unknown>) {
  const trajectoryStep = getObject(payload.trajectoryStep);
  const label = EXECUTION_STEP_EVENT_LABELS[eventType] ?? '执行步骤更新';
  const segments = [
    getString(payload.stage) ?? getString(trajectoryStep?.type),
    getString(payload.toolName),
    getString(payload.nodeId) ?? getString(trajectoryStep?.actor),
    getString(payload.runId)
  ].filter(Boolean);
  if (!segments.length) {
    const requestId = getString(payload.requestId) ?? getString(payload.executionRequestId);
    if (requestId) {
      segments.push(requestId);
    }
  }
  const detail =
    getString(payload.detail) ??
    getString(payload.outputPreview) ??
    getString(payload.reason) ??
    getString(payload.reasonCode) ??
    getString(payload.verdict) ??
    getString(payload.status) ??
    getString(trajectoryStep?.summary) ??
    getString(trajectoryStep?.status);

  return `${label}：${segments.length ? segments.join(' · ') : '当前执行节点'}${detail ? `。${detail}` : '。'}`;
}

export function buildTrajectoryStepEventCopy(payload: Record<string, unknown>) {
  const step = getObject(payload.trajectoryStep) ?? payload;
  const sequence = typeof step.sequence === 'number' ? step.sequence : undefined;
  const title = getString(step.title) ?? getString(step.type) ?? getString(step.stepId) ?? '未命名步骤';
  const summary = getString(step.summary);
  const prefix = typeof sequence === 'number' ? `轨迹步骤 ${sequence}` : '轨迹步骤';

  return `${prefix}：${title}${summary ? `。${summary}` : '。'}`;
}

export function buildTaskTrajectoryEventCopy(payload: Record<string, unknown>) {
  const trajectory = getObject(payload.taskTrajectory) ?? payload;
  const summary = getObject(trajectory.summary);
  const intent = getObject(trajectory.intent);
  const title =
    getString(summary?.title) ?? getString(intent?.summary) ?? getString(trajectory.trajectoryId) ?? '任务轨迹';
  const outcome = getString(summary?.outcome);
  if (outcome) {
    return `${title}：${outcome}`;
  }
  const status = getString(trajectory.status);
  const stepCount = Array.isArray(trajectory.steps) ? trajectory.steps.length : undefined;
  const suffixes = [
    typeof stepCount === 'number' ? `${stepCount} 个步骤` : undefined,
    status ? `状态：${status}` : undefined
  ].filter(Boolean);

  return suffixes.length ? `${title}：${suffixes.join(' · ')}` : title;
}

export function buildNodeLifecycleEventCopy(payload: Record<string, unknown>): string | undefined {
  const detail = getString(payload.detail);
  const nodeLabel = getString(payload.nodeLabel) ?? getString(payload.nodeId);
  const legacyNode = getString(payload.node);
  const phase = getString(payload.phase);
  const status = getString(payload.status);
  const route = getString(payload.route);
  const ministry = getString(payload.ministry);
  const progressPercent = typeof payload.progressPercent === 'number' ? payload.progressPercent : undefined;

  const label = nodeLabel ?? legacyNode;
  if (!label && !detail && !status && !route && progressPercent === undefined && !ministry) {
    return undefined;
  }

  const phaseCopy =
    phase === 'start' ? '开始' : phase === 'progress' ? '进行中' : phase === 'end' ? '已完成' : (phase ?? '');

  const humanizedLabel = label ? humanizeNodeLabelToken(label) : '';
  const segments = [
    ministry ?? '',
    humanizedLabel,
    phaseCopy,
    detail ?? '',
    status ? `状态：${status}` : '',
    route ? `路径：${route}` : '',
    typeof progressPercent === 'number' ? `进度 ${progressPercent}%` : ''
  ].filter(Boolean);

  return segments.length ? segments.join(' · ') : undefined;
}

function humanizeNodeLabelToken(raw: string): string {
  return raw
    .replace(/direct_reply/gi, '直接回复')
    .replace(/direct-reply/gi, '直接回复')
    .replace(/_/g, ' ')
    .trim();
}

/**
 * Converts wide backend trajectory payloads into tolerant UI copy.
 * Unknown event shapes should degrade to undefined instead of throwing during stream rendering.
 */
export function buildProjectedEventSummary(eventItem: Pick<ChatEventRecord, 'type' | 'payload'>) {
  const payload = eventItem.payload ?? {};
  if (isExecutionStepEvent(eventItem.type)) {
    return buildExecutionStepEventCopy(eventItem.type, payload);
  }
  if (eventItem.type === 'trajectory_step') {
    return buildTrajectoryStepEventCopy(payload);
  }
  if (eventItem.type === 'task_trajectory') {
    return buildTaskTrajectoryEventCopy(payload);
  }
  if (eventItem.type === 'node_progress' && payload.projection === 'task_trajectory') {
    return buildTaskTrajectoryEventCopy(payload);
  }
  if (eventItem.type === 'node_status' || eventItem.type === 'node_progress') {
    return buildNodeLifecycleEventCopy(payload);
  }
  return undefined;
}

export function resolveProjectedEventThoughtStatus(eventItem: Pick<ChatEventRecord, 'type' | 'payload'>) {
  const payload = eventItem.payload ?? {};
  const trajectoryStep = getObject(payload.trajectoryStep);
  const taskTrajectory = getObject(payload.taskTrajectory);
  const status = getString(payload.status) ?? getString(trajectoryStep?.status) ?? getString(taskTrajectory?.status);

  if ((eventItem.type === 'node_status' || eventItem.type === 'node_progress') && getString(payload.phase) === 'end') {
    return 'success' as const;
  }

  if (eventItem.type === 'execution_step_blocked' || status === 'failed') {
    return 'error' as const;
  }
  if (status === 'cancelled') {
    return 'abort' as const;
  }
  if (
    eventItem.type === 'execution_step_completed' ||
    status === 'completed' ||
    status === 'succeeded' ||
    status === 'passed'
  ) {
    return 'success' as const;
  }
  return 'loading' as const;
}

export function isExecutionStepEvent(eventType: string) {
  return (
    eventType === 'execution_step_started' ||
    eventType === 'execution_step_completed' ||
    eventType === 'execution_step_blocked' ||
    eventType === 'execution_step_resumed'
  );
}

function getObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

function getString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}
