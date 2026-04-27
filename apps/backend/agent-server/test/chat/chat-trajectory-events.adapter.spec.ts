import { describe, expect, it } from 'vitest';

import { ChatEventRecordSchema, TaskTrajectoryRecordSchema, TrajectoryStepRecordSchema } from '@agent/core';

import {
  buildTaskTrajectoryChatEvent,
  buildTrajectoryStepChatEvent
} from '../../src/chat/chat-trajectory-events.adapter';

const NOW = '2026-04-26T10:00:00.000Z';

describe('chat trajectory event adapter', () => {
  it('projects mappable tool events into schema-parseable trajectory step ChatEvent payloads', () => {
    const event = buildTrajectoryStepChatEvent(
      {
        sourceEvent: {
          id: 'event-tool-1',
          sessionId: 'session-1',
          type: 'tool_called',
          at: NOW,
          payload: {
            toolName: 'shell',
            executionRequestId: 'exec-1'
          }
        },
        taskId: 'task-1',
        sequence: 3
      },
      {
        now: () => NOW,
        createId: prefix => `${prefix}_fixed`
      }
    );

    expect(ChatEventRecordSchema.parse(event)).toEqual(event);
    expect(event.type).toBe('execution_step_started');
    expect(event.payload.projection).toBe('trajectory_step');
    expect(TrajectoryStepRecordSchema.parse(event.payload.trajectoryStep)).toEqual(
      expect.objectContaining({
        taskId: 'task-1',
        sequence: 3,
        type: 'tool_requested',
        actor: 'execution_node',
        status: 'running',
        executionRequestId: 'exec-1'
      })
    );
  });

  it('projects approval events into blocked trajectory step payloads without touching real executors', () => {
    const event = buildTrajectoryStepChatEvent(
      {
        sourceEvent: {
          id: 'event-approval-1',
          sessionId: 'session-1',
          type: 'approval_required',
          at: NOW,
          payload: {
            approvalId: 'approval-1',
            intent: 'write_file'
          }
        },
        taskId: 'task-1',
        sequence: 4
      },
      {
        now: () => NOW,
        createId: prefix => `${prefix}_fixed`
      }
    );

    expect(ChatEventRecordSchema.parse(event)).toEqual(event);
    expect(event.type).toBe('execution_step_blocked');
    expect(TrajectoryStepRecordSchema.parse(event.payload.trajectoryStep)).toEqual(
      expect.objectContaining({
        taskId: 'task-1',
        sequence: 4,
        type: 'approval_requested',
        actor: 'supervisor',
        status: 'pending',
        approvalId: 'approval-1'
      })
    );
  });

  it('can publish a full task trajectory snapshot as a ChatEvent payload', () => {
    const stepEvent = buildTrajectoryStepChatEvent(
      {
        sourceEvent: {
          id: 'event-evidence-1',
          sessionId: 'session-1',
          type: 'research_progress',
          at: NOW,
          payload: {
            evidenceIds: ['evidence-1'],
            title: 'Evidence recorded'
          }
        },
        taskId: 'task-1',
        sequence: 5
      },
      {
        now: () => NOW,
        createId: prefix => `${prefix}_fixed`
      }
    );
    const step = TrajectoryStepRecordSchema.parse(stepEvent.payload.trajectoryStep);

    const snapshotEvent = buildTaskTrajectoryChatEvent(
      {
        sessionId: 'session-1',
        taskId: 'task-1',
        intent: { summary: 'Run task' },
        status: 'running',
        steps: [step]
      },
      {
        now: () => NOW,
        createId: prefix => `${prefix}_fixed`
      }
    );

    expect(ChatEventRecordSchema.parse(snapshotEvent)).toEqual(snapshotEvent);
    expect(snapshotEvent.type).toBe('node_progress');
    expect(snapshotEvent.payload.projection).toBe('task_trajectory');
    expect(TaskTrajectoryRecordSchema.parse(snapshotEvent.payload.taskTrajectory)).toEqual(
      expect.objectContaining({
        trajectoryId: 'trajectory_fixed',
        taskId: 'task-1',
        sessionId: 'session-1',
        status: 'running',
        evidenceIds: ['evidence-1']
      })
    );
  });
});
