import {
  ChatResponseStepEventSchema,
  ChatResponseStepSnapshotSchema,
  type ChatAgentOsGroup,
  type ChatAgentOsGroupKind,
  type ChatResponseStepEvent,
  type ChatResponseStepRecord,
  type ChatResponseStepSnapshot,
  type ChatResponseStepSummary,
  type ChatTurnDisplayMode
} from '@agent/core';

import type { ChatEventRecord } from '@/types/chat';

type ChatResponseStepsForMessageBase = {
  messageId: string;
  status: ChatResponseStepSnapshot['status'] | 'running';
  steps: ChatResponseStepRecord[];
  summary: ChatResponseStepSummary;
  updatedAt: string;
};

export type NormalizedChatResponseStepsForMessage = ChatResponseStepsForMessageBase & {
  displayMode: ChatTurnDisplayMode;
  agentOsGroups: ChatAgentOsGroup[];
};

type LegacyChatResponseStepsForMessage = ChatResponseStepsForMessageBase & {
  displayMode?: undefined;
  agentOsGroups?: undefined;
};

export type ChatResponseStepsForMessage = NormalizedChatResponseStepsForMessage | LegacyChatResponseStepsForMessage;

export type ChatResponseStepsState = {
  byMessageId: Record<string, ChatResponseStepsForMessage>;
};

export type ChatResponseStepProjection = ChatResponseStepEvent | ChatResponseStepSnapshot;

const EMPTY_RESPONSE_STEPS_STATE: ChatResponseStepsState = { byMessageId: {} };

export function initialChatResponseStepsState(): ChatResponseStepsState {
  return EMPTY_RESPONSE_STEPS_STATE;
}

export function isChatResponseStepProjectionPayloadCandidate(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const projection = (payload as { projection?: unknown }).projection;
  return projection === 'chat_response_step' || projection === 'chat_response_steps';
}

export function parseChatResponseStepProjection(payload: unknown): ChatResponseStepProjection | null {
  if (!isChatResponseStepProjectionPayloadCandidate(payload)) {
    return null;
  }

  const event = ChatResponseStepEventSchema.safeParse(payload);
  if (event.success) {
    return event.data;
  }

  const snapshot = ChatResponseStepSnapshotSchema.safeParse(payload);
  if (snapshot.success) {
    return snapshot.data;
  }

  return null;
}

export function foldChatResponseStepProjection(
  state: ChatResponseStepsState,
  projection: ChatResponseStepProjection
): ChatResponseStepsState {
  if (projection.projection === 'chat_response_steps') {
    const steps = sortSteps(projection.steps);
    const displayMode = projection.displayMode ?? deriveDisplayMode(steps);
    const agentOsGroups = projection.agentOsGroups ?? buildFallbackAgentOsGroups(steps);

    return {
      byMessageId: {
        ...state.byMessageId,
        [projection.messageId]: {
          messageId: projection.messageId,
          status: projection.status,
          displayMode,
          agentOsGroups,
          steps,
          summary: projection.summary,
          updatedAt: projection.updatedAt
        }
      }
    };
  }

  const current = state.byMessageId[projection.step.messageId];
  const steps = sortSteps(upsertStep(current?.steps ?? [], projection.step));
  const updatedAt = projection.step.completedAt ?? projection.step.startedAt;
  const displayMode = deriveDisplayMode(steps);
  const agentOsGroups = buildFallbackAgentOsGroups(steps);

  return {
    byMessageId: {
      ...state.byMessageId,
      [projection.step.messageId]: {
        messageId: projection.step.messageId,
        status: deriveStatus(steps),
        displayMode,
        agentOsGroups,
        steps,
        summary: summarizeSteps(steps, displayMode),
        updatedAt
      }
    }
  };
}

export function foldChatResponseStepProjectionsFromEvents(events: ChatEventRecord[]): ChatResponseStepsState {
  const result = events.reduce((state, event) => {
    const projection = parseChatResponseStepProjection(event.payload);
    return projection ? foldChatResponseStepProjection(state, projection) : state;
  }, initialChatResponseStepsState());

  // Return stable empty reference when no steps were ever folded
  if (Object.keys(result.byMessageId).length === 0) {
    return EMPTY_RESPONSE_STEPS_STATE;
  }
  return result;
}

function upsertStep(steps: ChatResponseStepRecord[], next: ChatResponseStepRecord) {
  if (!steps.some(step => step.id === next.id)) {
    return [...steps, next];
  }

  return steps.map(step => (step.id === next.id ? next : step));
}

function sortSteps(steps: ChatResponseStepRecord[]) {
  return [...steps].sort(
    (left, right) => left.sequence - right.sequence || left.startedAt.localeCompare(right.startedAt)
  );
}

function deriveStatus(steps: ChatResponseStepRecord[]): ChatResponseStepsForMessage['status'] {
  if (steps.some(step => step.status === 'failed')) return 'failed';
  if (steps.some(step => step.status === 'blocked')) return 'blocked';
  if (steps.some(step => step.status === 'cancelled')) return 'cancelled';
  if (steps.length > 0 && steps.every(step => step.status === 'completed')) return 'completed';
  return 'running';
}

function summarizeSteps(steps: ChatResponseStepRecord[], displayMode: ChatTurnDisplayMode): ChatResponseStepSummary {
  const runningCount = steps.filter(step => step.status === 'running' || step.status === 'queued').length;
  const completedCount = steps.filter(step => step.status === 'completed').length;
  const blockedCount = steps.filter(step => step.status === 'blocked').length;
  const failedCount = steps.filter(step => step.status === 'failed').length;
  if (displayMode === 'answer_only') {
    if (runningCount > 0) {
      return {
        title: `处理中 ${steps.length} 个步骤`,
        completedCount,
        runningCount,
        blockedCount,
        failedCount
      };
    }

    return {
      title: '已思考',
      completedCount,
      runningCount,
      blockedCount,
      failedCount
    };
  }

  const titlePrefix = runningCount > 0 ? '处理中' : '已处理';
  const visibleActionCount = countVisibleAgentOsActions(buildFallbackAgentOsGroups(steps));

  return {
    title: `${titlePrefix} ${visibleActionCount} 个动作`,
    completedCount,
    runningCount,
    blockedCount,
    failedCount
  };
}

function deriveDisplayMode(steps: ChatResponseStepRecord[]): ChatTurnDisplayMode {
  return steps.some(hasExecutionSignal) ? 'agent_execution' : 'answer_only';
}

function hasExecutionSignal(step: ChatResponseStepRecord) {
  if (step.sourceEventType === 'final_response_completed' || step.sourceEventType === 'session_finished') {
    return false;
  }
  if (step.agentScope === 'sub') {
    return true;
  }
  if (step.phase === 'execute' || step.phase === 'edit' || step.phase === 'verify') {
    return true;
  }
  return (
    step.target?.kind === 'command' ||
    step.target?.kind === 'file' ||
    step.target?.kind === 'approval' ||
    step.target?.kind === 'test'
  );
}

function buildFallbackAgentOsGroups(steps: ChatResponseStepRecord[]): ChatAgentOsGroup[] {
  if (deriveDisplayMode(steps) === 'answer_only') {
    return [];
  }

  const groupsByKind = new Map<ChatAgentOsGroupKind, ChatResponseStepRecord[]>();
  for (const step of steps) {
    const kind = resolveFallbackGroupKind(step);
    groupsByKind.set(kind, [...(groupsByKind.get(kind) ?? []), sanitizeStepForAgentOs(step)]);
  }

  return fallbackGroupOrder
    .map(kind => {
      const groupSteps = groupsByKind.get(kind) ?? [];
      if (groupSteps.length === 0) {
        return null;
      }
      return {
        kind,
        title: groupTitle(kind),
        status: deriveGroupStatus(groupSteps),
        steps: groupSteps
      } satisfies ChatAgentOsGroup;
    })
    .filter((group): group is ChatAgentOsGroup => group !== null);
}

const fallbackGroupOrder: ChatAgentOsGroupKind[] = [
  'thinking',
  'exploration',
  'execution',
  'collaboration',
  'verification',
  'delivery'
];

function resolveFallbackGroupKind(step: ChatResponseStepRecord): ChatAgentOsGroupKind {
  if (step.agentScope === 'sub') {
    return 'collaboration';
  }
  if (step.phase === 'context' || step.phase === 'explore' || step.target?.kind === 'file') {
    return 'exploration';
  }
  if (
    step.phase === 'verify' ||
    step.phase === 'approve' ||
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

function groupTitle(kind: ChatAgentOsGroupKind) {
  switch (kind) {
    case 'thinking':
      return '思考';
    case 'exploration':
      return '探索';
    case 'execution':
      return '执行';
    case 'collaboration':
      return '协作';
    case 'verification':
      return '验证';
    case 'delivery':
      return '交付';
  }
}

function deriveGroupStatus(steps: ChatResponseStepRecord[]): ChatAgentOsGroup['status'] {
  if (steps.some(step => step.status === 'failed')) return 'failed';
  if (steps.some(step => step.status === 'blocked')) return 'blocked';
  if (steps.some(step => step.status === 'cancelled')) return 'cancelled';
  if (steps.some(step => step.status === 'running' || step.status === 'queued')) return 'running';
  return 'completed';
}

function countVisibleAgentOsActions(groups: ChatAgentOsGroup[]) {
  return groups.reduce(
    (count, group) => count + group.steps.filter(step => !isLowValueDeliveryStep(group, step)).length,
    0
  );
}

function isLowValueDeliveryStep(group: ChatAgentOsGroup, step: ChatResponseStepRecord) {
  return (
    group.kind === 'delivery' &&
    (step.sourceEventType === 'final_response_completed' || step.sourceEventType === 'session_finished')
  );
}

function sanitizeStepForAgentOs(step: ChatResponseStepRecord): ChatResponseStepRecord {
  const { nodeId, nodeLabel, fromNodeId, toNodeId, ...sanitizedStep } = step;
  return sanitizedStep;
}
