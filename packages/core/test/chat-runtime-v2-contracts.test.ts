import { describe, expect, it } from 'vitest';

import {
  ApprovalReplyIntentSchema,
  ChatMessageFragmentSchema,
  ChatPendingInteractionSchema,
  ChatRunRecordSchema,
  ChatViewStreamEventSchema,
  ExecutionAutoReviewRecordSchema
} from '../src';

const timestamp = '2026-05-05T10:00:00.000Z';

describe('chat runtime v2 contracts', () => {
  it('parses a minimal chat run record', () => {
    const parsed = ChatRunRecordSchema.parse({
      id: 'run-1',
      sessionId: 'session-1',
      requestMessageId: 'message-user-1',
      responseMessageId: 'message-assistant-1',
      route: 'supervisor',
      status: 'running',
      modelId: 'default',
      createdAt: timestamp,
      startedAt: timestamp
    });

    expect(parsed.route).toBe('supervisor');
    expect(parsed.status).toBe('running');
  });

  it('parses a streaming response message fragment', () => {
    const parsed = ChatMessageFragmentSchema.parse({
      id: 'fragment-response-1',
      sessionId: 'session-1',
      runId: 'run-1',
      messageId: 'message-assistant-1',
      kind: 'response',
      content: '推荐采用双流模型',
      status: 'streaming',
      references: [
        {
          id: 'source-1',
          title: 'Agent Chat Runtime V2 API',
          sourceType: 'doc'
        }
      ]
    });

    expect(parsed.kind).toBe('response');
    expect(parsed.references?.[0]?.sourceType).toBe('doc');
  });

  it('parses ready and fragment delta view stream events', () => {
    const ready = ChatViewStreamEventSchema.parse({
      id: 'view-event-1',
      seq: 1,
      sessionId: 'session-1',
      runId: 'run-1',
      event: 'ready',
      at: timestamp,
      data: {
        requestMessageId: 'message-user-1',
        responseMessageId: 'message-assistant-1',
        modelId: 'default',
        thinkingEnabled: true
      }
    });

    const delta = ChatViewStreamEventSchema.parse({
      id: 'view-event-2',
      seq: 2,
      sessionId: 'session-1',
      runId: 'run-1',
      event: 'fragment_delta',
      at: timestamp,
      data: {
        messageId: 'message-assistant-1',
        fragmentId: 'fragment-response-1',
        delta: '这里是增量文本'
      }
    });

    expect(ready.event).toBe('ready');
    expect(delta.data.delta).toBe('这里是增量文本');
  });

  it('parses resumable fragment lifecycle view stream events', () => {
    const started = ChatViewStreamEventSchema.parse({
      id: 'view-fragment-started',
      seq: 2,
      sessionId: 'session-1',
      runId: 'run-1',
      event: 'fragment_started',
      at: timestamp,
      data: {
        messageId: 'message-assistant-1',
        fragmentId: 'fragment-response-1',
        kind: 'response',
        status: 'streaming'
      }
    });

    const completed = ChatViewStreamEventSchema.parse({
      id: 'view-fragment-completed',
      seq: 4,
      sessionId: 'session-1',
      runId: 'run-1',
      event: 'fragment_completed',
      at: timestamp,
      data: {
        messageId: 'message-assistant-1',
        fragmentId: 'fragment-response-1',
        kind: 'response',
        status: 'completed',
        content: '最终回答'
      }
    });

    expect(started.data.kind).toBe('response');
    expect(completed.data.content).toBe('最终回答');
  });

  it('rejects incomplete fragment completion view stream events', () => {
    const result = ChatViewStreamEventSchema.safeParse({
      id: 'view-fragment-completed',
      seq: 4,
      sessionId: 'session-1',
      runId: 'run-1',
      event: 'fragment_completed',
      at: timestamp,
      data: {
        messageId: 'message-assistant-1',
        fragmentId: 'fragment-response-1',
        kind: 'response',
        status: 'completed'
      }
    });

    expect(result.success).toBe(false);
  });

  it('parses tool execution view stream events without accepting raw payload fields', () => {
    const started = ChatViewStreamEventSchema.parse({
      id: 'view-tool-started',
      seq: 5,
      sessionId: 'session-1',
      runId: 'run-1',
      event: 'tool_execution_started',
      at: timestamp,
      data: {
        toolName: 'shell',
        toolDisplayName: 'Shell command',
        stage: 'execute',
        status: 'running',
        riskLevel: 'low',
        userFacingSummary: '正在执行只读验证命令'
      }
    });

    const completed = ChatViewStreamEventSchema.parse({
      id: 'view-tool-completed',
      seq: 6,
      sessionId: 'session-1',
      runId: 'run-1',
      event: 'tool_execution_completed',
      at: timestamp,
      data: {
        toolName: 'shell',
        status: 'completed',
        elapsedMs: 120,
        userFacingSummary: '验证命令已完成'
      }
    });

    const rawPayload = ChatViewStreamEventSchema.safeParse({
      id: 'view-tool-raw',
      seq: 7,
      sessionId: 'session-1',
      runId: 'run-1',
      event: 'tool_execution_started',
      at: timestamp,
      data: {
        toolName: 'shell',
        status: 'running',
        userFacingSummary: '正在执行命令',
        rawInput: {
          token: 'secret'
        }
      }
    });

    expect(started.data).not.toHaveProperty('rawInput');
    expect(completed.data.elapsedMs).toBe(120);
    expect(rawPayload.success).toBe(false);
  });

  it('parses run status events and rejects invalid stream sequence values', () => {
    const runStatus = ChatViewStreamEventSchema.parse({
      id: 'view-run-status',
      seq: 8,
      sessionId: 'session-1',
      runId: 'run-1',
      event: 'run_status',
      at: timestamp,
      data: {
        status: 'completed',
        completedAt: timestamp,
        reason: 'final_response_completed'
      }
    });

    const fractionalSeq = ChatViewStreamEventSchema.safeParse({
      id: 'view-bad-seq',
      seq: 8.5,
      sessionId: 'session-1',
      runId: 'run-1',
      event: 'run_status',
      at: timestamp,
      data: {
        status: 'completed'
      }
    });

    expect(runStatus.data.status).toBe('completed');
    expect(fractionalSeq.success).toBe(false);
  });

  it('parses auto review completed and interaction waiting view stream events', () => {
    const review = ExecutionAutoReviewRecordSchema.parse({
      id: 'review-1',
      sessionId: 'session-1',
      runId: 'run-1',
      requestId: 'tool-1',
      subject: 'shell_command',
      verdict: 'needs_confirmation',
      riskLevel: 'high',
      autoExecutable: false,
      reasons: ['会推送到远端仓库'],
      reasonCodes: ['GIT_PUSH'],
      requiredConfirmationPhrase: '确认推送',
      userFacingSummary: '自动审查要求确认：高风险推送操作。',
      createdAt: timestamp
    });

    const interaction = ChatPendingInteractionSchema.parse({
      id: 'pending-interaction-1',
      sessionId: 'session-1',
      runId: 'run-1',
      kind: 'tool_approval',
      status: 'pending',
      promptMessageId: 'message-assistant-1',
      reviewId: review.id,
      expectedActions: ['approve', 'reject', 'feedback'],
      requiredConfirmationPhrase: '确认推送',
      createdAt: timestamp
    });

    expect(
      ChatViewStreamEventSchema.parse({
        id: 'view-event-3',
        seq: 3,
        sessionId: 'session-1',
        runId: 'run-1',
        event: 'auto_review_completed',
        at: timestamp,
        data: {
          review
        }
      }).data.review.verdict
    ).toBe('needs_confirmation');

    expect(
      ChatViewStreamEventSchema.parse({
        id: 'view-event-4',
        seq: 4,
        sessionId: 'session-1',
        runId: 'run-1',
        event: 'interaction_waiting',
        at: timestamp,
        data: {
          interaction,
          naturalLanguageOnly: true
        }
      }).data.interaction.requiredConfirmationPhrase
    ).toBe('确认推送');
  });

  it('parses error and close view stream events', () => {
    const error = ChatViewStreamEventSchema.parse({
      id: 'view-event-5',
      seq: 5,
      sessionId: 'session-1',
      runId: 'run-1',
      event: 'error',
      at: timestamp,
      data: {
        code: 'MODEL_STREAM_FAILED',
        message: '模型流式响应失败',
        recoverable: true
      }
    });

    const close = ChatViewStreamEventSchema.parse({
      id: 'view-event-6',
      seq: 6,
      sessionId: 'session-1',
      runId: 'run-1',
      event: 'close',
      at: timestamp,
      data: {
        reason: 'error',
        retryable: true,
        autoResume: false
      }
    });

    expect(error.data.recoverable).toBe(true);
    expect(close.data.reason).toBe('error');
  });

  it('parses approval reply intents including feedback', () => {
    const approve = ApprovalReplyIntentSchema.parse({
      interactionId: 'pending-interaction-1',
      action: 'approve',
      confidence: 'high',
      originalText: '确认推送',
      normalizedText: '确认推送',
      matchedConfirmationPhrase: '确认推送'
    });

    const feedback = ApprovalReplyIntentSchema.parse({
      interactionId: 'pending-interaction-1',
      action: 'feedback',
      confidence: 'high',
      originalText: '可以，但不要删除文件',
      normalizedText: '可以，但不要删除文件',
      feedback: '不要删除文件'
    });

    expect(approve.action).toBe('approve');
    expect(feedback.feedback).toBe('不要删除文件');
  });

  it('rejects inconsistent auto review executability', () => {
    const result = ExecutionAutoReviewRecordSchema.safeParse({
      id: 'review-bad',
      sessionId: 'session-1',
      runId: 'run-1',
      requestId: 'tool-1',
      subject: 'shell_command',
      verdict: 'allow',
      riskLevel: 'low',
      autoExecutable: false,
      reasons: ['只读验证命令'],
      reasonCodes: ['READ_ONLY_CHECK'],
      userFacingSummary: '自动审查通过。',
      createdAt: timestamp
    });

    expect(result.success).toBe(false);
  });
});
