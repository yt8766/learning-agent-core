import { describe, expect, it } from 'vitest';

import {
  TaskTrajectoryRecordSchema,
  TrajectoryArtifactRecordSchema,
  TrajectoryReplayRecordSchema,
  TrajectoryStepRecordSchema
} from '@agent/core';

import {
  buildTaskTrajectory,
  createTrajectoryReplay,
  createToolExecutedStep,
  createTrajectoryArtifact,
  createTrajectoryStep
} from '../src/flows/trajectory';

const fixedNow = () => '2026-04-25T00:00:00.000Z';
const createFixedId = (prefix: string) => `${prefix}-fixed`;

describe('task trajectory flow helpers', () => {
  it('creates a trajectory step with default arrays, status, startedAt, and schema validity', () => {
    const step = createTrajectoryStep(
      {
        taskId: 'task-1',
        sequence: 2,
        type: 'tool_requested',
        title: 'Request shell command',
        actor: 'execution_node'
      },
      {
        now: fixedNow,
        createId: createFixedId
      }
    );

    expect(step).toMatchObject({
      stepId: 'traj_step-fixed',
      taskId: 'task-1',
      sequence: 2,
      type: 'tool_requested',
      title: 'Request shell command',
      actor: 'execution_node',
      status: 'succeeded',
      startedAt: '2026-04-25T00:00:00.000Z',
      inputRefs: [],
      outputRefs: [],
      evidenceIds: []
    });
    expect(TrajectoryStepRecordSchema.parse(step)).toEqual(step);
  });

  it('creates a diff trajectory artifact with schema validity', () => {
    const artifact = createTrajectoryArtifact(
      {
        taskId: 'task-1',
        kind: 'diff',
        uri: 'git:diff/task-1',
        title: 'Runtime trajectory diff',
        summary: 'Factory implementation diff',
        mimeType: 'text/x-diff',
        sizeBytes: 120,
        checksum: 'sha256:abc',
        metadata: {
          phase: 'phase-2'
        }
      },
      {
        now: fixedNow,
        createId: createFixedId
      }
    );

    expect(artifact).toEqual({
      artifactId: 'traj_artifact-fixed',
      taskId: 'task-1',
      kind: 'diff',
      uri: 'git:diff/task-1',
      title: 'Runtime trajectory diff',
      summary: 'Factory implementation diff',
      mimeType: 'text/x-diff',
      sizeBytes: 120,
      checksum: 'sha256:abc',
      createdAt: '2026-04-25T00:00:00.000Z',
      metadata: {
        phase: 'phase-2'
      }
    });
    expect(TrajectoryArtifactRecordSchema.parse(artifact)).toEqual(artifact);
  });

  it('sorts steps and dedupes artifact and evidence ids when building a task trajectory', () => {
    const laterStep = createTrajectoryStep(
      {
        taskId: 'task-1',
        sequence: 20,
        type: 'evidence_recorded',
        title: 'Record evidence',
        actor: 'runtime',
        startedAt: '2026-04-25T00:02:00.000Z',
        evidenceIds: ['ev-2', 'ev-3']
      },
      { now: fixedNow, createId: prefix => `${prefix}-later` }
    );
    const earlierStep = createTrajectoryStep(
      {
        taskId: 'task-1',
        sequence: 10,
        type: 'intent_received',
        title: 'Receive intent',
        actor: 'gateway',
        startedAt: '2026-04-25T00:01:00.000Z',
        evidenceIds: ['ev-1', 'ev-2']
      },
      { now: fixedNow, createId: prefix => `${prefix}-earlier` }
    );

    const trajectory = buildTaskTrajectory(
      {
        taskId: 'task-1',
        origin: {
          channel: 'chat'
        },
        intent: {
          summary: 'Implement trajectory helpers'
        },
        status: 'succeeded',
        steps: [laterStep, earlierStep],
        artifactIds: ['artifact-1', 'artifact-2', 'artifact-1'],
        evidenceIds: ['ev-0', 'ev-1']
      },
      {
        now: fixedNow,
        createId: createFixedId
      }
    );

    expect(trajectory.steps.map(step => step.sequence)).toEqual([10, 20]);
    expect(trajectory.artifactIds).toEqual(['artifact-1', 'artifact-2']);
    expect(trajectory.evidenceIds).toEqual(['ev-0', 'ev-1', 'ev-2', 'ev-3']);
    expect(trajectory.createdAt).toBe('2026-04-25T00:01:00.000Z');
    expect(TaskTrajectoryRecordSchema.parse(trajectory)).toEqual(trajectory);
  });

  it.each(['succeeded', 'failed', 'cancelled', 'replayed'] as const)('sets finalizedAt for %s trajectories', status => {
    const trajectory = buildTaskTrajectory(
      {
        taskId: `task-${status}`,
        origin: {},
        intent: {
          summary: 'Finalize terminal trajectory'
        },
        status,
        steps: []
      },
      {
        now: fixedNow,
        createId: createFixedId
      }
    );

    expect(trajectory.finalizedAt).toBe('2026-04-25T00:00:00.000Z');
    expect(TaskTrajectoryRecordSchema.parse(trajectory)).toEqual(trajectory);
  });

  it.each(['running', 'interrupted'] as const)('does not set finalizedAt for %s trajectories', status => {
    const trajectory = buildTaskTrajectory(
      {
        taskId: `task-${status}`,
        origin: {},
        intent: {
          summary: 'Keep trajectory open'
        },
        status,
        steps: []
      },
      {
        now: fixedNow,
        createId: createFixedId
      }
    );

    expect(trajectory.finalizedAt).toBeUndefined();
    expect(TaskTrajectoryRecordSchema.parse(trajectory)).toEqual(trajectory);
  });

  it('creates a tool_executed linker step with execution request and evidence refs', () => {
    const step = createToolExecutedStep(
      {
        taskId: 'task-1',
        sequence: 30,
        executionRequestId: 'exec-1',
        evidenceIds: ['ev-tool'],
        outputRefs: ['artifact-1'],
        status: 'succeeded'
      },
      {
        now: fixedNow,
        createId: createFixedId
      }
    );

    expect(step).toMatchObject({
      stepId: 'traj_step-fixed',
      type: 'tool_executed',
      actor: 'execution_node',
      title: 'Tool executed',
      executionRequestId: 'exec-1',
      evidenceIds: ['ev-tool'],
      outputRefs: ['artifact-1']
    });
    expect(TrajectoryStepRecordSchema.parse(step)).toEqual(step);
  });

  it('rejects factory output when injected ids or timestamps are not stable contract values', () => {
    expect(() =>
      createTrajectoryStep(
        {
          taskId: 'task-invalid-factory',
          sequence: 1,
          type: 'intent_received',
          title: 'Receive intent',
          actor: 'gateway'
        },
        {
          now: () => '2026-04-25',
          createId: () => ''
        }
      )
    ).toThrow();
    expect(() =>
      createTrajectoryArtifact(
        {
          taskId: 'task-invalid-factory',
          kind: 'log',
          title: 'Invalid artifact'
        },
        {
          now: () => 'not-a-date',
          createId: () => ''
        }
      )
    ).toThrow();
  });

  it('creates a replay record with replay-specific status and schema validity', () => {
    const replay = createTrajectoryReplay(
      {
        taskId: 'task-replay',
        mode: 'deterministic_only',
        status: 'unavailable',
        sourceTrajectoryId: 'traj-source',
        nonReplayableReasons: ['Approval decision cannot be replayed']
      },
      {
        now: fixedNow,
        createId: createFixedId
      }
    );

    expect(replay).toEqual({
      replayId: 'traj_replay-fixed',
      taskId: 'task-replay',
      mode: 'deterministic_only',
      status: 'unavailable',
      sourceTrajectoryId: 'traj-source',
      startedAt: undefined,
      finishedAt: undefined,
      resultTrajectoryId: undefined,
      nonReplayableReasons: ['Approval decision cannot be replayed'],
      metadata: undefined
    });
    expect(replay.status).not.toBe('succeeded');
    expect(TrajectoryReplayRecordSchema.parse(replay)).toEqual(replay);
  });
});
