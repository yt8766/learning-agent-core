import {
  ChatViewStreamEventSchema,
  type ChatEventRecord,
  type ChatRunRecord,
  type ChatViewStreamEvent
} from '@agent/core';

type ProjectChatViewStreamContext = {
  run: ChatRunRecord;
  nextSeq?: number;
};

type DraftViewEvent = Omit<ChatViewStreamEvent, 'id' | 'seq' | 'sessionId' | 'runId' | 'at'>;

const RESPONSE_FRAGMENT_KIND = 'response';

export function projectChatViewStreamEvents(
  sourceEvents: ChatEventRecord[],
  context: ProjectChatViewStreamContext
): ChatViewStreamEvent[] {
  let nextSeq = context.nextSeq ?? 0;

  return sourceEvents.flatMap(sourceEvent => {
    const projectedEvents = projectSingleChatViewStreamEvent(sourceEvent, context.run);

    return projectedEvents.map((event, index) =>
      ChatViewStreamEventSchema.parse({
        id: `view-${sourceEvent.id}-${event.event}-${index}`,
        seq: nextSeq++,
        sessionId: sourceEvent.sessionId,
        runId: context.run.id,
        at: sourceEvent.at,
        ...event
      })
    );
  });
}

function projectSingleChatViewStreamEvent(sourceEvent: ChatEventRecord, run: ChatRunRecord): DraftViewEvent[] {
  switch (sourceEvent.type) {
    case 'assistant_token':
      return [
        {
          event: 'fragment_delta',
          data: {
            messageId: resolveMessageId(sourceEvent, run),
            fragmentId: buildResponseFragmentId(run),
            delta: readPayloadString(sourceEvent, ['content', 'delta', 'token', 'text'])
          }
        }
      ];
    case 'assistant_message':
    case 'final_response_completed':
      return [
        {
          event: 'fragment_completed',
          data: {
            messageId: resolveMessageId(sourceEvent, run),
            fragmentId: buildResponseFragmentId(run),
            kind: RESPONSE_FRAGMENT_KIND,
            status: 'completed',
            content: readPayloadString(sourceEvent, ['content', 'text', 'message'])
          }
        },
        {
          event: 'run_status',
          data: {
            status: 'completed',
            completedAt: sourceEvent.at
          }
        },
        {
          event: 'close',
          data: {
            reason: 'completed'
          }
        }
      ];
    case 'session_failed':
      return [
        {
          event: 'error',
          data: {
            code: readPayloadString(sourceEvent, ['code']) || 'session_failed',
            message: readPayloadString(sourceEvent, ['message', 'error']) || 'Session failed',
            recoverable: true
          }
        },
        {
          event: 'close',
          data: {
            reason: 'error',
            retryable: true
          }
        }
      ];
    case 'node_progress':
      return [
        {
          event: 'step_updated',
          data: {
            ...sourceEvent.payload,
            sourceEventId: sourceEvent.id
          }
        }
      ];
    case 'interrupt_pending':
      if (sourceEvent.payload.kind !== 'tool_execution') {
        return [];
      }
      return [
        {
          event: 'interaction_waiting',
          data: {
            naturalLanguageOnly: true,
            interaction: {
              id: `agent_tool:${readPayloadString(sourceEvent, ['requestId'])}`,
              sessionId: sourceEvent.sessionId,
              runId: run.id,
              kind: 'tool_approval',
              status: 'pending',
              promptMessageId: run.responseMessageId || run.requestMessageId,
              interruptId: readPayloadString(sourceEvent, ['interruptId']) || undefined,
              reviewId: readPayloadString(sourceEvent, ['reviewId']) || undefined,
              expectedActions: ['approve', 'reject', 'feedback'],
              requiredConfirmationPhrase: getRequiredConfirmationPhrase(sourceEvent),
              createdAt: sourceEvent.at
            }
          }
        }
      ];
    default:
      return [];
  }
}

function resolveMessageId(sourceEvent: ChatEventRecord, run: ChatRunRecord): string {
  return readPayloadString(sourceEvent, ['messageId']) || run.responseMessageId || run.requestMessageId;
}

function buildResponseFragmentId(run: ChatRunRecord): string {
  return `fragment-${run.id}-${RESPONSE_FRAGMENT_KIND}`;
}

function readPayloadString(sourceEvent: ChatEventRecord, keys: string[]): string {
  for (const key of keys) {
    const value = sourceEvent.payload[key];
    if (typeof value === 'string') {
      return value;
    }
  }
  return '';
}

function getRequiredConfirmationPhrase(sourceEvent: ChatEventRecord): string | undefined {
  const riskClass = readPayloadString(sourceEvent, ['riskClass']);
  return riskClass === 'medium' || riskClass === 'high' || riskClass === 'critical' ? '确认执行' : undefined;
}
