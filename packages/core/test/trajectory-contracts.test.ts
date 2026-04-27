import { describe, expect, it } from 'vitest';

import {
  TaskTrajectoryRecordSchema,
  TrajectoryArtifactKindSchema,
  TrajectoryArtifactRecordSchema,
  TrajectoryReplayModeSchema,
  TrajectoryReplayRecordSchema,
  TrajectoryReplayStatusSchema,
  TrajectoryStatusSchema,
  TrajectoryStepActorSchema,
  TrajectoryStepRecordSchema,
  TrajectoryStepStatusSchema,
  TrajectoryStepTypeSchema
} from '../src';

const startedAt = '2026-04-25T12:00:00.000Z';
const finishedAt = '2026-04-25T12:03:00.000Z';

describe('@agent/core trajectory contracts', () => {
  it('parses a running task trajectory', () => {
    const parsed = TaskTrajectoryRecordSchema.parse({
      trajectoryId: 'traj-1',
      taskId: 'task-1',
      sessionId: 'session-1',
      origin: {
        channel: 'agent-chat',
        principalId: 'user-1',
        requestId: 'request-1'
      },
      intent: {
        summary: 'Run smoke verification',
        rawMessage: 'Please run the smoke checks.'
      },
      status: 'running',
      steps: [],
      artifactIds: [],
      evidenceIds: [],
      createdAt: startedAt,
      updatedAt: startedAt
    });

    expect(parsed.status).toBe('running');
    expect(parsed.intent.summary).toBe('Run smoke verification');
  });

  it('parses a succeeded trajectory with execution steps', () => {
    const parsed = TaskTrajectoryRecordSchema.parse({
      trajectoryId: 'traj-2',
      taskId: 'task-2',
      origin: {},
      intent: {
        summary: 'Implement approved change'
      },
      status: 'succeeded',
      steps: [
        {
          stepId: 'step-1',
          taskId: 'task-2',
          sequence: 1,
          type: 'intent_received',
          title: 'Intent received',
          actor: 'gateway',
          status: 'succeeded',
          startedAt,
          finishedAt,
          inputRefs: [],
          outputRefs: ['intent-1'],
          evidenceIds: [],
          metadata: {
            source: 'chat'
          }
        },
        {
          stepId: 'step-2',
          taskId: 'task-2',
          sequence: 2,
          type: 'tool_executed',
          title: 'Run tests',
          summary: 'Executed targeted vitest checks.',
          actor: 'execution_node',
          status: 'succeeded',
          startedAt,
          finishedAt,
          inputRefs: ['intent-1'],
          outputRefs: ['artifact-1'],
          evidenceIds: ['ev-1']
        }
      ],
      artifactIds: ['artifact-1'],
      evidenceIds: ['ev-1'],
      summary: {
        title: 'Change verified',
        outcome: 'Targeted tests passed.'
      },
      createdAt: startedAt,
      updatedAt: finishedAt,
      finalizedAt: finishedAt
    });

    expect(parsed.steps).toHaveLength(2);
    expect(parsed.summary?.outcome).toBe('Targeted tests passed.');
  });

  it('parses a failed trajectory with a failure point step id', () => {
    const parsed = TaskTrajectoryRecordSchema.parse({
      trajectoryId: 'traj-3',
      taskId: 'task-3',
      origin: {},
      intent: {
        summary: 'Run integration verification'
      },
      status: 'failed',
      steps: [
        {
          stepId: 'step-failed',
          taskId: 'task-3',
          sequence: 1,
          type: 'tool_executed',
          title: 'Integration verification',
          actor: 'execution_node',
          status: 'failed',
          startedAt,
          finishedAt,
          inputRefs: [],
          outputRefs: ['artifact-failure'],
          evidenceIds: ['ev-failure']
        }
      ],
      artifactIds: ['artifact-failure'],
      evidenceIds: ['ev-failure'],
      summary: {
        title: 'Integration failed',
        outcome: 'Backend build failed.',
        failurePointStepId: 'step-failed'
      },
      createdAt: startedAt,
      updatedAt: finishedAt,
      finalizedAt: finishedAt
    });

    expect(parsed.summary?.failurePointStepId).toBe('step-failed');
  });

  it('parses a step linked to an execution request id', () => {
    const parsed = TrajectoryStepRecordSchema.parse({
      stepId: 'step-execution',
      taskId: 'task-4',
      sequence: 1,
      type: 'tool_requested',
      title: 'Request terminal execution',
      actor: 'supervisor',
      status: 'succeeded',
      startedAt,
      inputRefs: [],
      outputRefs: [],
      evidenceIds: [],
      executionRequestId: 'exec-req-1'
    });

    expect(parsed.executionRequestId).toBe('exec-req-1');
  });

  it('parses a step linked to an approval id', () => {
    const parsed = TrajectoryStepRecordSchema.parse({
      stepId: 'step-approval',
      taskId: 'task-5',
      sequence: 1,
      type: 'approval_requested',
      title: 'Request approval',
      actor: 'policy_engine',
      status: 'pending',
      startedAt,
      inputRefs: [],
      outputRefs: [],
      evidenceIds: [],
      approvalId: 'approval-1'
    });

    expect(parsed.approvalId).toBe('approval-1');
  });

  it('parses a step linked to a checkpoint id', () => {
    const parsed = TrajectoryStepRecordSchema.parse({
      stepId: 'step-checkpoint',
      taskId: 'task-6',
      sequence: 1,
      type: 'checkpoint_created',
      title: 'Create checkpoint',
      actor: 'runtime',
      status: 'succeeded',
      startedAt,
      inputRefs: [],
      outputRefs: [],
      evidenceIds: [],
      checkpointId: 'checkpoint-1'
    });

    expect(parsed.checkpointId).toBe('checkpoint-1');
  });

  it('parses diff, terminal output, and test report artifacts', () => {
    const artifacts = [
      {
        artifactId: 'artifact-diff',
        taskId: 'task-7',
        kind: 'diff',
        uri: 'artifact://diff/1',
        title: 'Implementation diff',
        mimeType: 'text/x-diff',
        sizeBytes: 1024,
        checksum: 'sha256:diff',
        createdAt: startedAt
      },
      {
        artifactId: 'artifact-terminal',
        taskId: 'task-7',
        kind: 'terminal_output',
        title: 'Vitest output',
        summary: 'Targeted test run output.',
        createdAt: startedAt
      },
      {
        artifactId: 'artifact-report',
        taskId: 'task-7',
        kind: 'test_report',
        title: 'Test report',
        createdAt: startedAt,
        metadata: {
          command: 'pnpm exec vitest run packages/core/test/trajectory-contracts.test.ts'
        }
      }
    ].map(artifact => TrajectoryArtifactRecordSchema.parse(artifact));

    expect(artifacts.map(artifact => artifact.kind)).toEqual(['diff', 'terminal_output', 'test_report']);
  });

  it('parses an unavailable replay with non-replayable reasons', () => {
    const parsed = TrajectoryReplayRecordSchema.parse({
      replayId: 'replay-1',
      taskId: 'task-8',
      mode: 'deterministic_only',
      status: 'unavailable',
      sourceTrajectoryId: 'traj-source',
      nonReplayableReasons: ['Missing terminal artifact', 'Approval decision cannot be replayed'],
      metadata: {
        checkedBy: 'runtime'
      }
    });

    expect(parsed.nonReplayableReasons).toHaveLength(2);
  });

  it('rejects invalid step types', () => {
    expect(() => TrajectoryStepTypeSchema.parse('deployment_started')).toThrow();
    expect(() =>
      TrajectoryStepRecordSchema.parse({
        stepId: 'step-invalid',
        taskId: 'task-9',
        sequence: 1,
        type: 'deployment_started',
        title: 'Invalid step',
        actor: 'runtime',
        status: 'running',
        startedAt,
        inputRefs: [],
        outputRefs: [],
        evidenceIds: []
      })
    ).toThrow();
  });

  it('rejects invalid trajectory enum values', () => {
    expect(() => TrajectoryStatusSchema.parse('paused')).toThrow();
    expect(() => TrajectoryReplayModeSchema.parse('live_replay')).toThrow();
    expect(() => TrajectoryReplayStatusSchema.parse('queued')).toThrow();
    expect(() => TrajectoryStepActorSchema.parse('scheduler')).toThrow();
    expect(() => TrajectoryStepStatusSchema.parse('blocked')).toThrow();
  });

  it('rejects non-integer and negative step sequence values', () => {
    const baseStep = {
      stepId: 'step-invalid-sequence',
      taskId: 'task-invalid-sequence',
      sequence: 0,
      type: 'intent_received',
      title: 'Reject invalid sequence',
      actor: 'gateway',
      status: 'succeeded',
      startedAt,
      inputRefs: [],
      outputRefs: [],
      evidenceIds: []
    };

    expect(() => TrajectoryStepRecordSchema.parse({ ...baseStep, sequence: -1 })).toThrow();
    expect(() => TrajectoryStepRecordSchema.parse({ ...baseStep, sequence: 1.5 })).toThrow();
    expect(TrajectoryStepRecordSchema.parse(baseStep).sequence).toBe(0);
  });

  it('rejects negative artifact sizes', () => {
    const baseArtifact = {
      artifactId: 'artifact-invalid-size',
      taskId: 'task-invalid-size',
      kind: 'log',
      title: 'Reject invalid artifact size',
      createdAt: startedAt
    };

    expect(() => TrajectoryArtifactRecordSchema.parse({ ...baseArtifact, sizeBytes: -1 })).toThrow();
    expect(TrajectoryArtifactRecordSchema.parse({ ...baseArtifact, sizeBytes: 0 }).sizeBytes).toBe(0);
  });

  it('rejects invalid artifact kinds', () => {
    expect(() => TrajectoryArtifactKindSchema.parse('screenshot')).toThrow();
    expect(() =>
      TrajectoryArtifactRecordSchema.parse({
        artifactId: 'artifact-invalid',
        taskId: 'task-10',
        kind: 'screenshot',
        title: 'Invalid artifact',
        createdAt: startedAt
      })
    ).toThrow();
  });

  it('rejects blank public identifiers across trajectory records', () => {
    expect(() =>
      TaskTrajectoryRecordSchema.parse({
        trajectoryId: '',
        taskId: 'task-blank-id',
        origin: {},
        intent: {
          summary: 'Reject blank trajectory id'
        },
        status: 'running',
        steps: [],
        artifactIds: [],
        evidenceIds: [],
        createdAt: startedAt,
        updatedAt: startedAt
      })
    ).toThrow();
    expect(() =>
      TrajectoryStepRecordSchema.parse({
        stepId: '',
        taskId: 'task-blank-id',
        sequence: 1,
        type: 'intent_received',
        title: 'Reject blank step id',
        actor: 'gateway',
        status: 'succeeded',
        startedAt,
        inputRefs: [],
        outputRefs: [],
        evidenceIds: []
      })
    ).toThrow();
    expect(() =>
      TrajectoryArtifactRecordSchema.parse({
        artifactId: '',
        taskId: 'task-blank-id',
        kind: 'log',
        title: 'Reject blank artifact id',
        createdAt: startedAt
      })
    ).toThrow();
    expect(() =>
      TrajectoryReplayRecordSchema.parse({
        replayId: '',
        taskId: 'task-blank-id',
        mode: 'dry_run',
        status: 'not_requested',
        nonReplayableReasons: []
      })
    ).toThrow();
  });

  it('rejects non ISO datetime fields when present', () => {
    expect(() =>
      TaskTrajectoryRecordSchema.parse({
        trajectoryId: 'traj-invalid-time',
        taskId: 'task-invalid-time',
        origin: {},
        intent: {
          summary: 'Reject invalid trajectory time'
        },
        status: 'succeeded',
        steps: [],
        artifactIds: [],
        evidenceIds: [],
        createdAt: '2026-04-25',
        updatedAt: startedAt,
        finalizedAt: finishedAt
      })
    ).toThrow();
    expect(() =>
      TrajectoryStepRecordSchema.parse({
        stepId: 'step-invalid-time',
        taskId: 'task-invalid-time',
        sequence: 1,
        type: 'intent_received',
        title: 'Reject invalid step time',
        actor: 'gateway',
        status: 'succeeded',
        startedAt: startedAt.replace('Z', ''),
        finishedAt,
        inputRefs: [],
        outputRefs: [],
        evidenceIds: []
      })
    ).toThrow();
    expect(() =>
      TrajectoryArtifactRecordSchema.parse({
        artifactId: 'artifact-invalid-time',
        taskId: 'task-invalid-time',
        kind: 'log',
        title: 'Reject invalid artifact time',
        createdAt: 'not-a-date'
      })
    ).toThrow();
    expect(() =>
      TrajectoryReplayRecordSchema.parse({
        replayId: 'replay-invalid-time',
        taskId: 'task-invalid-time',
        mode: 'dry_run',
        status: 'running',
        startedAt: '2026-04-25 12:00:00',
        nonReplayableReasons: []
      })
    ).toThrow();
  });
});
