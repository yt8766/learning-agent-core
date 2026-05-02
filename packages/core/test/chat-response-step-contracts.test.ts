import { describe, expect, it } from 'vitest';

import { ChatResponseStepEventSchema, ChatResponseStepRecordSchema, ChatResponseStepSnapshotSchema } from '../src';

const now = '2026-05-02T08:30:00.000Z';

describe('chat response step contracts', () => {
  it('parses a running file-read response step', () => {
    const parsed = ChatResponseStepRecordSchema.parse({
      id: 'step-read-chat-page',
      sessionId: 'session-1',
      messageId: 'assistant-1',
      sequence: 1,
      phase: 'explore',
      status: 'running',
      title: 'Read chat-home-page.tsx',
      detail: 'Inspecting the current chat home page composition.',
      target: {
        kind: 'file',
        label: 'chat-home-page.tsx',
        path: 'apps/frontend/agent-chat/src/pages/chat-home/chat-home-page.tsx'
      },
      startedAt: now,
      sourceEventId: 'event-1',
      sourceEventType: 'tool_called'
    });

    expect(parsed.phase).toBe('explore');
    expect(parsed.target?.kind).toBe('file');
  });

  it('parses a completed snapshot for quick and detail rendering', () => {
    const parsed = ChatResponseStepSnapshotSchema.parse({
      projection: 'chat_response_steps',
      sessionId: 'session-1',
      messageId: 'assistant-1',
      status: 'completed',
      steps: [
        {
          id: 'step-verify',
          sessionId: 'session-1',
          messageId: 'assistant-1',
          sequence: 2,
          phase: 'verify',
          status: 'completed',
          title: 'Ran affected tests',
          target: {
            kind: 'test',
            label: 'chat response steps tests'
          },
          startedAt: now,
          completedAt: now,
          sourceEventId: 'event-2',
          sourceEventType: 'execution_step_completed'
        }
      ],
      summary: {
        title: '已处理 2m 14s',
        completedCount: 1,
        runningCount: 0,
        blockedCount: 0,
        failedCount: 0
      },
      updatedAt: now
    });

    expect(parsed.projection).toBe('chat_response_steps');
    expect(parsed.steps[0]?.status).toBe('completed');
  });

  it('rejects unknown phase and status values', () => {
    expect(() =>
      ChatResponseStepRecordSchema.parse({
        id: 'step-bad',
        sessionId: 'session-1',
        messageId: 'assistant-1',
        sequence: 1,
        phase: 'wander',
        status: 'done-ish',
        title: 'Invalid step',
        startedAt: now,
        sourceEventId: 'event-3',
        sourceEventType: 'node_status'
      })
    ).toThrow();
  });

  it('rejects target fields that do not match their kind', () => {
    expect(() =>
      ChatResponseStepRecordSchema.parse({
        id: 'step-bad-target',
        sessionId: 'session-1',
        messageId: 'assistant-1',
        sequence: 1,
        phase: 'explore',
        status: 'running',
        title: 'Invalid target',
        target: {
          kind: 'file',
          label: 'chat-home-page.tsx'
        },
        startedAt: now,
        sourceEventId: 'event-target',
        sourceEventType: 'tool_called'
      })
    ).toThrow();

    expect(() =>
      ChatResponseStepRecordSchema.parse({
        id: 'step-extra-target',
        sessionId: 'session-1',
        messageId: 'assistant-1',
        sequence: 2,
        phase: 'execute',
        status: 'running',
        title: 'Invalid command target',
        target: {
          kind: 'command',
          label: 'pnpm test',
          path: 'package.json'
        },
        startedAt: now,
        sourceEventId: 'event-command',
        sourceEventType: 'execution_step_started'
      })
    ).toThrow();

    expect(() =>
      ChatResponseStepRecordSchema.parse({
        id: 'step-url-target',
        sessionId: 'session-1',
        messageId: 'assistant-1',
        sequence: 3,
        phase: 'context',
        status: 'running',
        title: 'Invalid URL target',
        target: {
          kind: 'url',
          label: 'example'
        },
        startedAt: now,
        sourceEventId: 'event-url',
        sourceEventType: 'tool_called'
      })
    ).toThrow();
  });

  it('rejects snapshots whose steps belong to another session or message', () => {
    expect(() =>
      ChatResponseStepSnapshotSchema.parse({
        projection: 'chat_response_steps',
        sessionId: 'session-1',
        messageId: 'assistant-1',
        status: 'completed',
        steps: [
          {
            id: 'step-mismatch',
            sessionId: 'session-1',
            messageId: 'assistant-2',
            sequence: 1,
            phase: 'verify',
            status: 'completed',
            title: 'Ran tests',
            startedAt: now,
            completedAt: now,
            sourceEventId: 'event-5',
            sourceEventType: 'execution_step_completed'
          }
        ],
        summary: {
          title: '已处理 1 个步骤',
          completedCount: 1,
          runningCount: 0,
          blockedCount: 0,
          failedCount: 0
        },
        updatedAt: now
      })
    ).toThrow();

    expect(() =>
      ChatResponseStepSnapshotSchema.parse({
        projection: 'chat_response_steps',
        sessionId: 'session-1',
        messageId: 'assistant-1',
        status: 'completed',
        steps: [
          {
            id: 'step-session-mismatch',
            sessionId: 'session-2',
            messageId: 'assistant-1',
            sequence: 1,
            phase: 'verify',
            status: 'completed',
            title: 'Ran tests',
            startedAt: now,
            completedAt: now,
            sourceEventId: 'event-6',
            sourceEventType: 'execution_step_completed'
          }
        ],
        summary: {
          title: '已处理 1 个步骤',
          completedCount: 1,
          runningCount: 0,
          blockedCount: 0,
          failedCount: 0
        },
        updatedAt: now
      })
    ).toThrow();
  });

  it('parses an incremental event wrapper', () => {
    const parsed = ChatResponseStepEventSchema.parse({
      projection: 'chat_response_step',
      action: 'completed',
      step: {
        id: 'step-command',
        sessionId: 'session-1',
        messageId: 'assistant-1',
        sequence: 3,
        phase: 'execute',
        status: 'completed',
        title: 'Ran pnpm exec vitest',
        target: {
          kind: 'command',
          label: 'pnpm exec vitest run'
        },
        startedAt: now,
        completedAt: now,
        sourceEventId: 'event-4',
        sourceEventType: 'execution_step_completed'
      }
    });

    expect(parsed.action).toBe('completed');
  });

  it('rejects snapshots whose summary counts do not match steps', () => {
    expect(() =>
      ChatResponseStepSnapshotSchema.parse({
        projection: 'chat_response_steps',
        sessionId: 'session-1',
        messageId: 'assistant-1',
        status: 'completed',
        steps: [
          {
            id: 'step-summary-mismatch',
            sessionId: 'session-1',
            messageId: 'assistant-1',
            sequence: 1,
            phase: 'verify',
            status: 'completed',
            title: 'Ran tests',
            startedAt: now,
            completedAt: now,
            sourceEventId: 'event-summary',
            sourceEventType: 'execution_step_completed'
          }
        ],
        summary: {
          title: '已处理 1 个步骤',
          completedCount: 2,
          runningCount: 0,
          blockedCount: 0,
          failedCount: 0
        },
        updatedAt: now
      })
    ).toThrow();
  });

  it('rejects event actions that conflict with step status', () => {
    expect(() =>
      ChatResponseStepEventSchema.parse({
        projection: 'chat_response_step',
        action: 'completed',
        step: {
          id: 'step-status-mismatch',
          sessionId: 'session-1',
          messageId: 'assistant-1',
          sequence: 4,
          phase: 'execute',
          status: 'running',
          title: 'Conflicting status',
          startedAt: now,
          sourceEventId: 'event-6',
          sourceEventType: 'execution_step_completed'
        }
      })
    ).toThrow();

    expect(() =>
      ChatResponseStepEventSchema.parse({
        projection: 'chat_response_step',
        action: 'started',
        step: {
          id: 'step-started-mismatch',
          sessionId: 'session-1',
          messageId: 'assistant-1',
          sequence: 5,
          phase: 'explore',
          status: 'completed',
          title: 'Started mismatch',
          startedAt: now,
          completedAt: now,
          sourceEventId: 'event-7',
          sourceEventType: 'tool_called'
        }
      })
    ).toThrow();

    expect(() =>
      ChatResponseStepEventSchema.parse({
        projection: 'chat_response_step',
        action: 'updated',
        step: {
          id: 'step-updated-mismatch',
          sessionId: 'session-1',
          messageId: 'assistant-1',
          sequence: 6,
          phase: 'execute',
          status: 'failed',
          title: 'Updated mismatch',
          startedAt: now,
          completedAt: now,
          sourceEventId: 'event-8',
          sourceEventType: 'execution_step_started'
        }
      })
    ).toThrow();
  });
});
