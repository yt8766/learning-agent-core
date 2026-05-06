import { Injectable } from '@nestjs/common';
import {
  ChatPendingInteractionSchema,
  type ApprovalReplyIntent,
  type ChatPendingInteraction,
  type ChatPendingInteractionAction,
  type ChatPendingInteractionKind
} from '@agent/core';

export type CreatePendingInteractionInput = {
  sessionId: string;
  runId: string;
  kind: ChatPendingInteractionKind;
  promptMessageId: string;
  interruptId?: string;
  reviewId?: string;
  expectedActions: ChatPendingInteractionAction[];
  requiredConfirmationPhrase?: string;
};

@Injectable()
export class PendingInteractionService {
  private readonly interactions = new Map<string, ChatPendingInteraction>();

  create(input: CreatePendingInteractionInput): ChatPendingInteraction {
    const interaction = ChatPendingInteractionSchema.parse({
      id: `pending_interaction_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ...input,
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    this.interactions.set(interaction.id, interaction);
    return interaction;
  }

  getActive(sessionId: string): ChatPendingInteraction | undefined {
    return [...this.interactions.values()].find(
      interaction => interaction.sessionId === sessionId && interaction.status === 'pending'
    );
  }

  resolve(interactionId: string, intent: ApprovalReplyIntent): ChatPendingInteraction | undefined {
    const interaction = this.interactions.get(interactionId);
    if (!interaction || intent.action === 'unknown') {
      return undefined;
    }
    const resolved = ChatPendingInteractionSchema.parse({
      ...interaction,
      status: 'resolved',
      resolvedAt: new Date().toISOString()
    });
    this.interactions.set(interactionId, resolved);
    return resolved;
  }
}
