import {
  ChatResponseStepEventSchema,
  ChatResponseStepSnapshotSchema,
  type ChatResponseStepEvent,
  type ChatResponseStepRecord,
  type ChatResponseStepSnapshot,
  type ChatResponseStepSummary
} from '@agent/core';

import type { ChatEventRecord } from '@/types/chat';

export type ChatResponseStepsForMessage = {
  messageId: string;
  status: ChatResponseStepSnapshot['status'] | 'running';
  steps: ChatResponseStepRecord[];
  summary: ChatResponseStepSummary;
  updatedAt: string;
};

export type ChatResponseStepsState = {
  byMessageId: Record<string, ChatResponseStepsForMessage>;
};

export type ChatResponseStepProjection = ChatResponseStepEvent | ChatResponseStepSnapshot;

export function initialChatResponseStepsState(): ChatResponseStepsState {
  return { byMessageId: {} };
}

export function parseChatResponseStepProjection(payload: unknown): ChatResponseStepProjection | null {
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
    return {
      byMessageId: {
        ...state.byMessageId,
        [projection.messageId]: {
          messageId: projection.messageId,
          status: projection.status,
          steps: sortSteps(projection.steps),
          summary: projection.summary,
          updatedAt: projection.updatedAt
        }
      }
    };
  }

  const current = state.byMessageId[projection.step.messageId];
  const steps = sortSteps(upsertStep(current?.steps ?? [], projection.step));
  const updatedAt = projection.step.completedAt ?? projection.step.startedAt;

  return {
    byMessageId: {
      ...state.byMessageId,
      [projection.step.messageId]: {
        messageId: projection.step.messageId,
        status: deriveStatus(steps),
        steps,
        summary: summarizeSteps(steps),
        updatedAt
      }
    }
  };
}

export function foldChatResponseStepProjectionsFromEvents(events: ChatEventRecord[]): ChatResponseStepsState {
  return events.reduce((state, event) => {
    const projection = parseChatResponseStepProjection(event.payload);
    return projection ? foldChatResponseStepProjection(state, projection) : state;
  }, initialChatResponseStepsState());
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

function summarizeSteps(steps: ChatResponseStepRecord[]): ChatResponseStepSummary {
  const runningCount = steps.filter(step => step.status === 'running' || step.status === 'queued').length;
  const completedCount = steps.filter(step => step.status === 'completed').length;
  const titlePrefix = runningCount > 0 ? '处理中' : '已处理';

  return {
    title: `${titlePrefix} ${steps.length} 个步骤`,
    completedCount,
    runningCount,
    blockedCount: steps.filter(step => step.status === 'blocked').length,
    failedCount: steps.filter(step => step.status === 'failed').length
  };
}
