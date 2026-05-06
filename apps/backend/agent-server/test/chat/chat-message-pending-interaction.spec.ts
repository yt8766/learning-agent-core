import { describe, expect, it, vi } from 'vitest';

import { ChatService } from '../../src/chat/chat.service';
import { PendingInteractionService } from '../../src/chat/pending-interaction.service';
import { createCapabilityIntentService, createRuntimeSessionService } from './chat.service.test-helpers';

describe('ChatService pending interaction replies', () => {
  it('resolves a pending interaction reply without creating a new run message', async () => {
    const runtimeSessionService = createRuntimeSessionService();
    const pendingInteractionService = new PendingInteractionService();
    pendingInteractionService.create({
      sessionId: 'session-1',
      runId: 'run-1',
      kind: 'tool_approval',
      promptMessageId: 'assistant-1',
      expectedActions: ['approve', 'reject', 'feedback'],
      requiredConfirmationPhrase: '确认推送'
    });
    const service = new ChatService(
      runtimeSessionService,
      createCapabilityIntentService(),
      undefined as never,
      undefined,
      pendingInteractionService
    );

    const result = await service.appendMessage('session-1', {
      message: '确认推送'
    });

    expect(result).toMatchObject({
      handledAs: 'pending_interaction_reply',
      interactionResolution: {
        intent: {
          action: 'approve',
          matchedConfirmationPhrase: '确认推送'
        },
        resolvedInteraction: {
          status: 'resolved'
        }
      }
    });
    expect(runtimeSessionService.appendSessionMessage).not.toHaveBeenCalled();
  });

  it('keeps vague high-risk replies pending and does not append a new run message', async () => {
    const runtimeSessionService = createRuntimeSessionService();
    const pendingInteractionService = new PendingInteractionService();
    const pending = pendingInteractionService.create({
      sessionId: 'session-1',
      runId: 'run-1',
      kind: 'tool_approval',
      promptMessageId: 'assistant-1',
      expectedActions: ['approve', 'reject', 'feedback'],
      requiredConfirmationPhrase: '确认推送'
    });
    const service = new ChatService(
      runtimeSessionService,
      createCapabilityIntentService(),
      undefined as never,
      undefined,
      pendingInteractionService
    );

    const result = await service.appendMessage('session-1', {
      message: '确认'
    });

    expect(result).toMatchObject({
      handledAs: 'pending_interaction_reply',
      interactionResolution: {
        intent: {
          action: 'unknown',
          confidence: 'low'
        },
        resolvedInteraction: undefined
      }
    });
    expect(pendingInteractionService.getActive('session-1')?.id).toBe(pending.id);
    expect(runtimeSessionService.appendSessionMessage).not.toHaveBeenCalled();
  });

  it('falls back to normal message append when there is no pending interaction', async () => {
    const runtimeSessionService = createRuntimeSessionService();
    const capabilityIntentsService = createCapabilityIntentService();
    const service = new ChatService(
      runtimeSessionService,
      capabilityIntentsService,
      undefined as never,
      undefined,
      new PendingInteractionService()
    );

    await service.appendMessage('session-1', {
      message: '继续'
    });

    expect(capabilityIntentsService.tryHandle as never as ReturnType<typeof vi.fn>).toHaveBeenCalled();
    expect(runtimeSessionService.appendSessionMessage).toHaveBeenCalledWith('session-1', { message: '继续' });
  });

  it('resumes an agent-tool pending approval from a natural-language confirmation', async () => {
    const runtimeSessionService = createRuntimeSessionService();
    const agentToolsService = {
      getProjection: vi.fn(() => ({
        requests: [
          {
            requestId: 'request-1',
            sessionId: 'session-1',
            taskId: 'task-1',
            status: 'pending_approval',
            riskClass: 'high',
            approvalId: 'approval_request-1',
            toolName: 'run_terminal',
            inputPreview: 'git push origin feature/chat-runtime-v2'
          }
        ]
      })),
      resumeApproval: vi.fn(() => ({
        request: {
          requestId: 'request-1',
          status: 'succeeded'
        }
      }))
    };
    const service = new ChatService(
      runtimeSessionService,
      createCapabilityIntentService(),
      undefined as never,
      undefined,
      new PendingInteractionService(),
      agentToolsService as never
    );

    const result = await service.appendMessage('session-1', {
      message: '确认执行'
    });

    expect(result).toMatchObject({
      handledAs: 'pending_interaction_reply',
      interactionResolution: {
        interactionId: 'agent_tool:request-1',
        intent: {
          action: 'approve',
          matchedConfirmationPhrase: '确认执行'
        }
      }
    });
    expect(agentToolsService.resumeApproval).toHaveBeenCalledWith('request-1', {
      sessionId: 'session-1',
      actor: 'agent-chat-user',
      reason: 'natural-language-chat-reply',
      interrupt: {
        action: 'approve',
        requestId: 'request-1',
        approvalId: 'approval_request-1',
        interruptId: 'interrupt_request-1'
      }
    });
    expect(runtimeSessionService.appendSessionMessage).not.toHaveBeenCalled();
  });
});
