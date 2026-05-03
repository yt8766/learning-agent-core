import { z } from 'zod';

import {
  ChatResponseStepEventSchema,
  ChatResponseStepSnapshotSchema,
  type ChatAgentOsGroup,
  type ChatAgentOsGroupKind,
  type ChatEventRecord,
  type ChatResponseStepEvent,
  type ChatResponseStepPhase,
  type ChatResponseStepRecord,
  type ChatResponseStepSnapshot,
  type ChatResponseStepStatus,
  type ChatResponseStepTarget,
  type ChatTurnDisplayMode
} from '@agent/core';

type BuildStepContext = {
  messageId: string;
  sequence: number;
};

type BuildSnapshotInput = {
  sessionId: string;
  messageId: string;
  status: ChatResponseStepSnapshot['status'];
  steps: ChatResponseStepRecord[];
  updatedAt: string;
};

const StepPayloadSchema = z
  .object({
    title: z.string().optional(),
    summary: z.string().optional(),
    path: z.string().optional(),
    file: z.string().optional(),
    command: z.string().optional(),
    url: z.string().optional(),
    approvalId: z.string().optional(),
    agentScope: z.enum(['main', 'sub', 'system']).optional(),
    agentId: z.string().optional(),
    agentLabel: z.string().optional(),
    ownerLabel: z.string().optional(),
    nodeId: z.string().optional(),
    nodeLabel: z.string().optional(),
    fromNodeId: z.string().optional(),
    toNodeId: z.string().optional(),
    durationMs: z.number().int().nonnegative().optional(),
    /** Tool / execution node completion preview; prefer `summary` when both are set. */
    outputPreview: z.string().optional(),
    chunk: z.string().optional()
  })
  .passthrough();

const EVENT_MAP: Partial<
  Record<
    ChatEventRecord['type'],
    {
      action: ChatResponseStepEvent['action'];
      phase: ChatResponseStepPhase;
      status: ChatResponseStepStatus;
    }
  >
> = {
  tool_called: { action: 'started', phase: 'explore', status: 'running' },
  tool_stream_dispatched: { action: 'started', phase: 'execute', status: 'running' },
  tool_stream_completed: { action: 'completed', phase: 'execute', status: 'completed' },
  execution_step_started: { action: 'started', phase: 'execute', status: 'running' },
  execution_step_completed: { action: 'completed', phase: 'verify', status: 'completed' },
  execution_step_blocked: { action: 'blocked', phase: 'approve', status: 'blocked' },
  approval_required: { action: 'blocked', phase: 'approve', status: 'blocked' },
  approval_resolved: { action: 'completed', phase: 'approve', status: 'completed' },
  review_completed: { action: 'completed', phase: 'verify', status: 'completed' },
  final_response_completed: { action: 'completed', phase: 'summarize', status: 'completed' },
  session_finished: { action: 'completed', phase: 'summarize', status: 'completed' },
  session_failed: { action: 'failed', phase: 'summarize', status: 'failed' },
  run_cancelled: { action: 'cancelled', phase: 'summarize', status: 'cancelled' }
};

export function buildChatResponseStepEvent(
  sourceEvent: ChatEventRecord,
  context: BuildStepContext
): ChatResponseStepEvent | null {
  const mapping = EVENT_MAP[sourceEvent.type];
  if (!mapping) {
    return null;
  }

  const payload = StepPayloadSchema.parse(sourceEvent.payload ?? {});
  const step: ChatResponseStepRecord = {
    id: `response-step-${sourceEvent.id}`,
    sessionId: sourceEvent.sessionId,
    messageId: context.messageId,
    sequence: context.sequence,
    phase: mapping.phase,
    status: mapping.status,
    title: payload.title ?? fallbackTitle(sourceEvent.type),
    detail: resolveStepPayloadDetail(payload),
    target: buildTarget(payload, mapping.phase),
    agentScope: payload.agentScope ?? fallbackAgentScope(sourceEvent.type),
    agentId: payload.agentId,
    agentLabel: payload.agentLabel ?? fallbackAgentLabel(sourceEvent.type),
    ownerLabel: payload.ownerLabel ?? fallbackOwnerLabel(payload.agentScope ?? fallbackAgentScope(sourceEvent.type)),
    nodeId: payload.nodeId ?? sourceEvent.type,
    nodeLabel: payload.nodeLabel ?? fallbackNodeLabel(sourceEvent.type),
    fromNodeId: payload.fromNodeId,
    toNodeId: payload.toNodeId,
    durationMs: payload.durationMs,
    startedAt: sourceEvent.at,
    completedAt: isTerminalStepStatus(mapping.status) ? sourceEvent.at : undefined,
    sourceEventId: sourceEvent.id,
    sourceEventType: sourceEvent.type
  };

  return ChatResponseStepEventSchema.parse({
    projection: 'chat_response_step',
    action: mapping.action,
    step
  });
}

export function buildChatResponseStepSnapshot(input: BuildSnapshotInput): ChatResponseStepSnapshot {
  const completedCount = input.steps.filter(step => step.status === 'completed').length;
  const runningCount = input.steps.filter(step => step.status === 'running' || step.status === 'queued').length;
  const blockedCount = input.steps.filter(step => step.status === 'blocked').length;
  const failedCount = input.steps.filter(step => step.status === 'failed').length;
  const displayMode = resolveDisplayMode(input.steps);
  const agentOsGroups = buildAgentOsGroups(input.steps, displayMode);
  const visibleActionCount = agentOsGroups.reduce(
    (total, group) => total + group.steps.filter(step => !isLowValueDeliveryStep(step)).length,
    0
  );

  return ChatResponseStepSnapshotSchema.parse({
    projection: 'chat_response_steps',
    sessionId: input.sessionId,
    messageId: input.messageId,
    status: input.status,
    displayMode,
    steps: input.steps,
    agentOsGroups,
    summary: {
      title:
        displayMode === 'answer_only'
          ? '已思考'
          : input.status === 'completed'
            ? appendDuration(`已处理 ${visibleActionCount} 个动作`, input.steps)
            : appendDuration(`处理中 ${visibleActionCount} 个动作`, input.steps),
      completedCount,
      runningCount,
      blockedCount,
      failedCount
    },
    updatedAt: input.updatedAt
  });
}

function resolveDisplayMode(steps: ChatResponseStepRecord[]): ChatTurnDisplayMode {
  return steps.some(hasExecutionSignal) ? 'agent_execution' : 'answer_only';
}

function hasExecutionSignal(step: ChatResponseStepRecord) {
  if (isLowValueDeliveryStep(step)) {
    return false;
  }
  return (
    step.agentScope === 'sub' ||
    step.phase === 'execute' ||
    step.phase === 'edit' ||
    step.phase === 'verify' ||
    step.target?.kind === 'command' ||
    step.target?.kind === 'file' ||
    step.target?.kind === 'approval' ||
    step.target?.kind === 'test'
  );
}

const AGENT_OS_GROUP_TITLES: Record<ChatAgentOsGroupKind, string> = {
  thinking: '思考',
  exploration: '上下文',
  execution: '执行',
  collaboration: '协作',
  verification: '验证',
  delivery: '交付'
};

function buildAgentOsGroups(steps: ChatResponseStepRecord[], displayMode: ChatTurnDisplayMode): ChatAgentOsGroup[] {
  if (displayMode === 'answer_only') {
    return [];
  }

  const grouped = new Map<ChatAgentOsGroupKind, ChatResponseStepRecord[]>();
  for (const step of steps) {
    const kind = resolveAgentOsGroupKind(step);
    const groupSteps = grouped.get(kind) ?? [];
    groupSteps.push(toUserReadableStep(step));
    grouped.set(kind, groupSteps);
  }

  return (Object.keys(AGENT_OS_GROUP_TITLES) as ChatAgentOsGroupKind[]).flatMap(kind => {
    const groupSteps = grouped.get(kind);
    if (!groupSteps?.length) {
      return [];
    }
    return [
      {
        kind,
        title: AGENT_OS_GROUP_TITLES[kind],
        summary: summarizeAgentOsGroup(kind, groupSteps),
        status: deriveGroupStatus(groupSteps),
        steps: groupSteps
      }
    ];
  });
}

function resolveAgentOsGroupKind(step: ChatResponseStepRecord): ChatAgentOsGroupKind {
  if (step.agentScope === 'sub') {
    return 'collaboration';
  }
  if (
    step.phase === 'context' ||
    step.phase === 'explore' ||
    step.target?.kind === 'file' ||
    step.target?.kind === 'url'
  ) {
    return 'exploration';
  }
  if (
    step.phase === 'approve' ||
    step.phase === 'verify' ||
    step.target?.kind === 'approval' ||
    step.target?.kind === 'test'
  ) {
    return 'verification';
  }
  if (step.phase === 'execute' || step.phase === 'edit' || step.target?.kind === 'command') {
    return 'execution';
  }
  if (step.phase === 'summarize') {
    return 'delivery';
  }
  return 'thinking';
}

function toUserReadableStep(step: ChatResponseStepRecord): ChatResponseStepRecord {
  const readableStep = { ...step };
  delete readableStep.nodeId;
  delete readableStep.nodeLabel;
  delete readableStep.fromNodeId;
  delete readableStep.toNodeId;

  if (isLowValueDeliveryStep(step)) {
    return { ...readableStep, title: '最终回复完成' };
  }
  if (step.target?.kind === 'file') {
    return { ...readableStep, title: `查看 ${step.target.label}` };
  }
  if (step.agentScope === 'sub') {
    return { ...readableStep, title: step.agentLabel ? `${step.agentLabel} 完成协作任务` : '子 Agent 完成协作任务' };
  }
  return readableStep;
}

function deriveGroupStatus(steps: ChatResponseStepRecord[]): ChatResponseStepStatus {
  if (steps.some(step => step.status === 'failed')) {
    return 'failed';
  }
  if (steps.some(step => step.status === 'blocked')) {
    return 'blocked';
  }
  if (steps.some(step => step.status === 'cancelled')) {
    return 'cancelled';
  }
  if (steps.some(step => step.status === 'running' || step.status === 'queued')) {
    return 'running';
  }
  return 'completed';
}

function summarizeAgentOsGroup(kind: ChatAgentOsGroupKind, steps: ChatResponseStepRecord[]) {
  if (kind === 'execution') {
    const commandCount = steps.filter(step => step.target?.kind === 'command').length;
    return commandCount > 0 ? `Ran ${commandCount} command(s)` : `执行 ${steps.length} 项`;
  }
  if (kind === 'exploration') {
    return `已查看 ${steps.length} 个上下文`;
  }
  if (kind === 'collaboration') {
    return `协作 ${steps.length} 项`;
  }
  if (kind === 'verification') {
    return `验证 ${steps.length} 项`;
  }
  if (kind === 'delivery') {
    return '最终交付已整理';
  }
  return `思考 ${steps.length} 项`;
}

function isLowValueDeliveryStep(step: ChatResponseStepRecord) {
  return step.sourceEventType === 'final_response_completed' || step.sourceEventType === 'session_finished';
}

function buildTarget(
  payload: z.infer<typeof StepPayloadSchema>,
  phase: ChatResponseStepPhase
): ChatResponseStepTarget | undefined {
  const path = payload.path ?? payload.file;
  if (path) {
    return { kind: 'file', label: path.split('/').at(-1) ?? path, path };
  }
  if (payload.command) {
    return { kind: 'command', label: payload.command };
  }
  if (payload.url && z.string().url().safeParse(payload.url).success) {
    return { kind: 'url', label: payload.url, href: payload.url };
  }
  if (payload.approvalId) {
    return { kind: 'approval', label: payload.approvalId };
  }
  if (phase === 'verify') {
    return { kind: 'test', label: 'verification' };
  }
  return undefined;
}

function appendDuration(title: string, steps: ChatResponseStepRecord[]) {
  const durationMs = steps.reduce((total, step) => total + (step.durationMs ?? 0), 0);
  if (durationMs <= 0) {
    return title;
  }
  return `${title} · 用时 ${formatDuration(durationMs)}`;
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(1, Math.round(durationMs / 1000));
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

function fallbackTitle(eventType: ChatEventRecord['type']) {
  if (eventType === 'final_response_completed' || eventType === 'session_finished') {
    return '整理最终答复';
  }
  return eventType.split('_').join(' ');
}

function fallbackAgentScope(eventType: ChatEventRecord['type']) {
  if (eventType === 'session_failed' || eventType === 'run_cancelled') {
    return 'system' as const;
  }
  return 'main' as const;
}

function fallbackAgentLabel(eventType: ChatEventRecord['type']) {
  if (eventType === 'final_response_completed' || eventType === 'session_finished') {
    return '礼部';
  }
  if (eventType === 'review_completed') {
    return '刑部';
  }
  if (eventType === 'tool_called' || eventType.startsWith('tool_stream_')) {
    return '兵部';
  }
  return undefined;
}

function fallbackOwnerLabel(scope: 'main' | 'sub' | 'system') {
  if (scope === 'sub') {
    return '子 Agent';
  }
  if (scope === 'system') {
    return '系统';
  }
  return '主 Agent';
}

function fallbackNodeLabel(eventType: ChatEventRecord['type']) {
  if (eventType === 'final_response_completed' || eventType === 'session_finished') {
    return '最终答复完成';
  }
  if (eventType === 'tool_called') {
    return '工具调用';
  }
  if (eventType === 'review_completed') {
    return '审查完成';
  }
  return undefined;
}

function isTerminalStepStatus(status: ChatResponseStepStatus) {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}

function resolveStepPayloadDetail(payload: z.infer<typeof StepPayloadSchema>): string | undefined {
  if (typeof payload.summary === 'string' && payload.summary.trim()) {
    return payload.summary.trim();
  }
  if (typeof payload.outputPreview === 'string' && payload.outputPreview.trim()) {
    return payload.outputPreview.trim();
  }
  if (typeof payload.chunk === 'string' && payload.chunk.trim()) {
    return payload.chunk.trim();
  }
  return undefined;
}
