import { ApprovalReplyIntentSchema, type ApprovalReplyIntent, type ChatPendingInteractionAction } from '@agent/core';

export type InterpretApprovalReplyInput = {
  interactionId: string;
  text: string;
  expectedActions: ChatPendingInteractionAction[];
  requiredConfirmationPhrase?: string;
};

const APPROVE_PHRASES = ['确认', '确认执行', '可以', '执行吧', '继续', '同意', 'yes', 'approve', '没问题'];
const REJECT_PHRASES = ['取消', '不要', '别执行', '拒绝', '不行', 'stop', 'reject', '停止'];
const FEEDBACK_MARKERS = ['但', '但是', '不过', '先', '改成', '换成', '不要'];

export function interpretApprovalReply(input: InterpretApprovalReplyInput): ApprovalReplyIntent {
  const normalizedText = input.text.trim().toLowerCase();
  const originalText = input.text.trim();
  const required = input.requiredConfirmationPhrase?.trim();

  if (input.expectedActions.includes('feedback') && includesAny(originalText, FEEDBACK_MARKERS)) {
    return parse({
      interactionId: input.interactionId,
      action: 'feedback',
      confidence: 'high',
      originalText,
      normalizedText,
      feedback: originalText
    });
  }

  if (input.expectedActions.includes('reject') && includesAny(normalizedText, REJECT_PHRASES)) {
    return parse({
      interactionId: input.interactionId,
      action: 'reject',
      confidence: 'high',
      originalText,
      normalizedText
    });
  }

  if (input.expectedActions.includes('approve')) {
    if (required) {
      if (originalText === required) {
        return parse({
          interactionId: input.interactionId,
          action: 'approve',
          confidence: 'high',
          originalText,
          normalizedText,
          matchedConfirmationPhrase: required
        });
      }
      return unknown(input.interactionId, originalText, normalizedText);
    }

    if (APPROVE_PHRASES.some(phrase => normalizedText === phrase || normalizedText.includes(phrase))) {
      return parse({
        interactionId: input.interactionId,
        action: 'approve',
        confidence: 'high',
        originalText,
        normalizedText
      });
    }
  }

  return unknown(input.interactionId, originalText, normalizedText);
}

function includesAny(text: string, phrases: string[]) {
  return phrases.some(phrase => text.includes(phrase));
}

function unknown(interactionId: string, originalText: string, normalizedText: string): ApprovalReplyIntent {
  return parse({
    interactionId,
    action: 'unknown',
    confidence: 'low',
    originalText,
    normalizedText
  });
}

function parse(intent: ApprovalReplyIntent): ApprovalReplyIntent {
  return ApprovalReplyIntentSchema.parse(intent);
}
