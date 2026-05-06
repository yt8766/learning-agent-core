import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  ChatMessageFeedbackRequestSchema,
  type ChatEventRecord,
  type ChatMessageFeedbackRecord,
  type ChatMessageFeedbackRequest,
  type ChatMessageRecord
} from '@agent/core';

import type { RuntimeSessionService } from '../runtime/services/runtime-session.service';

export async function submitChatMessageFeedback(
  runtimeSessionService: RuntimeSessionService,
  messageId: string,
  input: ChatMessageFeedbackRequest
): Promise<ChatMessageRecord> {
  const parsed = ChatMessageFeedbackRequestSchema.parse(input);
  const message = findMessageForFeedback(runtimeSessionService, parsed.sessionId, messageId);

  if (message.sessionId !== parsed.sessionId) {
    throw new BadRequestException(`Message ${messageId} does not belong to session ${parsed.sessionId}`);
  }
  if (message.role !== 'assistant') {
    throw new BadRequestException('Feedback can only be submitted for assistant messages');
  }

  const feedback = buildMessageFeedback(message.id, parsed);
  if (feedback) {
    (message as ChatMessageRecord & { feedback?: ChatMessageFeedbackRecord }).feedback = feedback;
  } else {
    delete (message as ChatMessageRecord & { feedback?: ChatMessageFeedbackRecord }).feedback;
  }

  appendMessageFeedbackLearningCandidate(runtimeSessionService, message, parsed);
  await persistFeedbackRuntimeState(runtimeSessionService, parsed.sessionId);
  return message;
}

function findMessageForFeedback(
  runtimeSessionService: RuntimeSessionService,
  sessionId: string,
  messageId: string
): ChatMessageRecord {
  runtimeSessionService.getSession(sessionId);
  const message = listOriginalSessionMessages(runtimeSessionService, sessionId).find(
    candidate => candidate.id === messageId
  );
  if (message) {
    return message;
  }

  const crossSessionMessage = findMessageInOtherSessions(runtimeSessionService, sessionId, messageId);
  if (crossSessionMessage) {
    throw new BadRequestException(`Message ${messageId} does not belong to session ${sessionId}`);
  }

  throw new NotFoundException(`Message ${messageId} not found`);
}

function findMessageInOtherSessions(
  runtimeSessionService: RuntimeSessionService,
  sessionId: string,
  messageId: string
): ChatMessageRecord | undefined {
  for (const session of runtimeSessionService.listSessions()) {
    if (session.id === sessionId) {
      continue;
    }
    const message = listOriginalSessionMessages(runtimeSessionService, session.id).find(
      candidate => candidate.id === messageId
    );
    if (message) {
      return message;
    }
  }

  return undefined;
}

function listOriginalSessionMessages(
  runtimeSessionService: RuntimeSessionService,
  sessionId: string
): ChatMessageRecord[] {
  const coordinator = readRuntimeSessionCoordinator(runtimeSessionService);
  return coordinator?.getMessages?.(sessionId) ?? runtimeSessionService.listSessionMessages(sessionId);
}

async function persistFeedbackRuntimeState(
  runtimeSessionService: RuntimeSessionService,
  sessionId: string
): Promise<void> {
  const session = runtimeSessionService.getSession(sessionId);
  if (session) {
    session.updatedAt = new Date().toISOString();
  }
  const coordinator = readRuntimeSessionCoordinator(runtimeSessionService);
  await coordinator?.store?.persistRuntimeState?.();
}

function appendMessageFeedbackLearningCandidate(
  runtimeSessionService: RuntimeSessionService,
  message: ChatMessageRecord,
  input: ChatMessageFeedbackRequest
): void {
  const candidateText = buildMessageFeedbackLearningCandidate(input);
  if (!candidateText) {
    return;
  }

  const coordinator = readRuntimeSessionCoordinator(runtimeSessionService);
  coordinator?.store?.addEvent?.(input.sessionId, 'message_feedback_learning_candidate', {
    messageId: message.id,
    rating: input.rating,
    reasonCode: input.reasonCode,
    comment: input.comment,
    candidateText,
    source: 'message_feedback'
  });
}

function buildMessageFeedback(
  messageId: string,
  input: ChatMessageFeedbackRequest
): ChatMessageFeedbackRecord | undefined {
  if (input.rating === 'none') {
    return undefined;
  }

  const feedback: ChatMessageFeedbackRecord = {
    messageId,
    sessionId: input.sessionId,
    rating: input.rating,
    updatedAt: new Date().toISOString()
  };

  if (input.reasonCode) {
    feedback.reasonCode = input.reasonCode;
  }
  if (input.comment) {
    feedback.comment = input.comment;
  }

  return feedback;
}

function readRuntimeSessionCoordinator(runtimeSessionService: RuntimeSessionService):
  | {
      getMessages?: (sessionId: string) => ChatMessageRecord[];
      store?: {
        addEvent?: (
          sessionId: string,
          type: ChatEventRecord['type'],
          payload: Record<string, unknown>
        ) => ChatEventRecord;
        persistRuntimeState?: () => Promise<void>;
      };
    }
  | undefined {
  const getContext = (runtimeSessionService as unknown as { getContext?: () => unknown }).getContext;
  if (!getContext) {
    return undefined;
  }

  const context = getContext.call(runtimeSessionService) as { sessionCoordinator?: unknown };
  return context.sessionCoordinator as
    | {
        getMessages?: (sessionId: string) => ChatMessageRecord[];
        store?: {
          addEvent?: (
            sessionId: string,
            type: ChatEventRecord['type'],
            payload: Record<string, unknown>
          ) => ChatEventRecord;
          persistRuntimeState?: () => Promise<void>;
        };
      }
    | undefined;
}

function buildMessageFeedbackLearningCandidate(input: ChatMessageFeedbackRequest): string | undefined {
  if (input.rating !== 'unhelpful') {
    return undefined;
  }

  if (input.reasonCode === 'too_shallow') {
    return '基础技术概念题回答时，先给核心结论，再用类比、对比表、关键机制、命令示例和注意事项组织答案。';
  }
  if (input.reasonCode === 'bad_format') {
    return '用户点踩格式时，后续回答要使用更清晰的标题、列表或对比表，避免长段落堆叠。';
  }
  if (input.reasonCode === 'missed_point') {
    return '用户点踩没答到点时，后续回答要先锁定用户追问对象，再补充背景解释。';
  }
  if (input.reasonCode === 'other') {
    return input.comment?.trim() || undefined;
  }

  return undefined;
}
