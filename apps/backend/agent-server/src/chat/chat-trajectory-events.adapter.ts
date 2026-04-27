import { z } from 'zod';

import {
  ChatEventRecordSchema,
  TaskTrajectoryRecordSchema,
  TrajectoryStepRecordSchema,
  type ChatEventRecord,
  type TaskTrajectoryIntent,
  type TrajectoryStatus,
  type TrajectoryStepRecord
} from '@agent/core';
import {
  buildTaskTrajectory,
  createApprovalRequestedStep,
  createApprovalResolvedStep,
  createEvidenceRecordedStep,
  createToolExecutedStep,
  createToolRequestedStep,
  type TrajectoryFactoryOptions
} from '@agent/runtime';

type TrajectoryStepChatEventInput = {
  sourceEvent: ChatEventRecord;
  taskId: string;
  sequence: number;
};

type TaskTrajectoryChatEventInput = {
  sessionId: string;
  taskId: string;
  intent: TaskTrajectoryIntent;
  status: TrajectoryStatus;
  steps: TrajectoryStepRecord[];
};

type StepProjection = {
  eventType: ChatEventRecord['type'];
  step: TrajectoryStepRecord;
};

type StepProjector = (
  sourceEvent: ChatEventRecord,
  input: TrajectoryStepChatEventInput,
  options?: TrajectoryFactoryOptions
) => StepProjection;

const OptionalStringPayloadSchema = z
  .object({
    title: z.string().optional(),
    summary: z.string().optional(),
    executionRequestId: z.string().optional(),
    approvalId: z.string().optional()
  })
  .passthrough();

const EvidencePayloadSchema = OptionalStringPayloadSchema.extend({
  evidenceIds: z.array(z.string()).optional()
});

const PROJECTORS: Partial<Record<ChatEventRecord['type'], StepProjector>> = {
  tool_called: (sourceEvent, input, options) => {
    const payload = OptionalStringPayloadSchema.parse(sourceEvent.payload);
    return {
      eventType: 'execution_step_started',
      step: createToolRequestedStep(
        {
          taskId: input.taskId,
          sequence: input.sequence,
          title: payload.title,
          summary: payload.summary,
          status: 'running',
          executionRequestId: payload.executionRequestId,
          metadata: {
            sourceEventId: sourceEvent.id,
            sourceEventType: sourceEvent.type
          }
        },
        options
      )
    };
  },
  tool_stream_completed: (sourceEvent, input, options) => {
    const payload = OptionalStringPayloadSchema.parse(sourceEvent.payload);
    return {
      eventType: 'execution_step_completed',
      step: createToolExecutedStep(
        {
          taskId: input.taskId,
          sequence: input.sequence,
          title: payload.title,
          summary: payload.summary,
          status: 'succeeded',
          executionRequestId: payload.executionRequestId,
          metadata: {
            sourceEventId: sourceEvent.id,
            sourceEventType: sourceEvent.type
          }
        },
        options
      )
    };
  },
  approval_required: (sourceEvent, input, options) => {
    const payload = OptionalStringPayloadSchema.parse(sourceEvent.payload);
    return {
      eventType: 'execution_step_blocked',
      step: createApprovalRequestedStep(
        {
          taskId: input.taskId,
          sequence: input.sequence,
          title: payload.title,
          summary: payload.summary,
          status: 'pending',
          approvalId: payload.approvalId,
          metadata: {
            sourceEventId: sourceEvent.id,
            sourceEventType: sourceEvent.type
          }
        },
        options
      )
    };
  },
  interrupt_pending: (sourceEvent, input, options) => {
    const payload = OptionalStringPayloadSchema.parse(sourceEvent.payload);
    return {
      eventType: 'execution_step_blocked',
      step: createApprovalRequestedStep(
        {
          taskId: input.taskId,
          sequence: input.sequence,
          title: payload.title,
          summary: payload.summary,
          status: 'pending',
          approvalId: payload.approvalId,
          metadata: {
            sourceEventId: sourceEvent.id,
            sourceEventType: sourceEvent.type
          }
        },
        options
      )
    };
  },
  approval_resolved: (sourceEvent, input, options) => {
    const payload = OptionalStringPayloadSchema.parse(sourceEvent.payload);
    return {
      eventType: 'execution_step_resumed',
      step: createApprovalResolvedStep(
        {
          taskId: input.taskId,
          sequence: input.sequence,
          title: payload.title,
          summary: payload.summary,
          status: 'succeeded',
          approvalId: payload.approvalId,
          metadata: {
            sourceEventId: sourceEvent.id,
            sourceEventType: sourceEvent.type
          }
        },
        options
      )
    };
  },
  interrupt_resumed: (sourceEvent, input, options) => {
    const payload = OptionalStringPayloadSchema.parse(sourceEvent.payload);
    return {
      eventType: 'execution_step_resumed',
      step: createApprovalResolvedStep(
        {
          taskId: input.taskId,
          sequence: input.sequence,
          title: payload.title,
          summary: payload.summary,
          status: 'succeeded',
          approvalId: payload.approvalId,
          metadata: {
            sourceEventId: sourceEvent.id,
            sourceEventType: sourceEvent.type
          }
        },
        options
      )
    };
  },
  research_progress: (sourceEvent, input, options) => {
    const payload = EvidencePayloadSchema.parse(sourceEvent.payload);
    return {
      eventType: 'execution_step_completed',
      step: createEvidenceRecordedStep(
        {
          taskId: input.taskId,
          sequence: input.sequence,
          title: payload.title,
          summary: payload.summary,
          status: 'succeeded',
          evidenceIds: payload.evidenceIds,
          metadata: {
            sourceEventId: sourceEvent.id,
            sourceEventType: sourceEvent.type
          }
        },
        options
      )
    };
  }
};

export function buildTrajectoryStepChatEvent(
  input: TrajectoryStepChatEventInput,
  options?: TrajectoryFactoryOptions
): ChatEventRecord {
  const sourceEvent = ChatEventRecordSchema.parse(input.sourceEvent);
  const projector = PROJECTORS[sourceEvent.type];

  if (!projector) {
    throw new Error(`Chat event ${sourceEvent.type} cannot be projected to a trajectory step`);
  }

  const projection = projector(sourceEvent, input, options);
  const step = TrajectoryStepRecordSchema.parse(projection.step);
  return ChatEventRecordSchema.parse({
    id: options?.createId?.('chat_evt') ?? `chat_evt_${Date.now()}`,
    sessionId: sourceEvent.sessionId,
    type: projection.eventType,
    at: options?.now?.() ?? new Date().toISOString(),
    payload: {
      projection: 'trajectory_step',
      sourceEventId: sourceEvent.id,
      sourceEventType: sourceEvent.type,
      taskId: input.taskId,
      trajectoryStep: step
    }
  });
}

export function buildTaskTrajectoryChatEvent(
  input: TaskTrajectoryChatEventInput,
  options?: TrajectoryFactoryOptions
): ChatEventRecord {
  const trajectory = TaskTrajectoryRecordSchema.parse(
    buildTaskTrajectory(
      {
        sessionId: input.sessionId,
        taskId: input.taskId,
        intent: input.intent,
        status: input.status,
        steps: input.steps
      },
      options
    )
  );

  return ChatEventRecordSchema.parse({
    id: options?.createId?.('chat_evt') ?? `chat_evt_${Date.now()}`,
    sessionId: input.sessionId,
    type: 'node_progress',
    at: options?.now?.() ?? new Date().toISOString(),
    payload: {
      projection: 'task_trajectory',
      taskId: input.taskId,
      taskTrajectory: trajectory
    }
  });
}
