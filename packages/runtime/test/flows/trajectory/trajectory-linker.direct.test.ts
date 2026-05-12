import { describe, expect, it } from 'vitest';

import {
  createToolRequestedStep,
  createPolicyCheckedStep,
  createApprovalRequestedStep,
  createApprovalResolvedStep,
  createToolExecutedStep,
  createEvidenceRecordedStep,
  createCheckpointCreatedStep
} from '../../../src/flows/trajectory/trajectory-linker';

const mockNow = () => '2026-01-01T00:00:00Z';
const mockCreateId = (prefix: string) => `${prefix}_test_id`;
const options = { now: mockNow, createId: mockCreateId };

const baseInput = { taskId: 'task-1', sequence: 1 };

describe('trajectory-linker (direct)', () => {
  it('createToolRequestedStep creates correct step', () => {
    const step = createToolRequestedStep(baseInput, options);
    expect(step.type).toBe('tool_requested');
    expect(step.actor).toBe('execution_node');
    expect(step.title).toBe('Tool requested');
    expect(step.taskId).toBe('task-1');
  });

  it('createToolRequestedStep uses custom title', () => {
    const step = createToolRequestedStep({ ...baseInput, title: 'Custom Title' }, options);
    expect(step.title).toBe('Custom Title');
  });

  it('createPolicyCheckedStep creates correct step', () => {
    const step = createPolicyCheckedStep(baseInput, options);
    expect(step.type).toBe('policy_checked');
    expect(step.actor).toBe('policy_engine');
    expect(step.title).toBe('Policy checked');
  });

  it('createApprovalRequestedStep creates correct step', () => {
    const step = createApprovalRequestedStep(baseInput, options);
    expect(step.type).toBe('approval_requested');
    expect(step.actor).toBe('supervisor');
    expect(step.title).toBe('Approval requested');
  });

  it('createApprovalResolvedStep creates correct step', () => {
    const step = createApprovalResolvedStep(baseInput, options);
    expect(step.type).toBe('approval_resolved');
    expect(step.actor).toBe('human');
    expect(step.title).toBe('Approval resolved');
  });

  it('createToolExecutedStep creates correct step', () => {
    const step = createToolExecutedStep(baseInput, options);
    expect(step.type).toBe('tool_executed');
    expect(step.actor).toBe('execution_node');
    expect(step.title).toBe('Tool executed');
  });

  it('createEvidenceRecordedStep creates correct step', () => {
    const step = createEvidenceRecordedStep(baseInput, options);
    expect(step.type).toBe('evidence_recorded');
    expect(step.actor).toBe('runtime');
    expect(step.title).toBe('Evidence recorded');
  });

  it('createCheckpointCreatedStep creates correct step', () => {
    const step = createCheckpointCreatedStep(baseInput, options);
    expect(step.type).toBe('checkpoint_created');
    expect(step.actor).toBe('runtime');
    expect(step.title).toBe('Checkpoint created');
  });

  it('creates steps without options', () => {
    const step = createToolRequestedStep(baseInput);
    expect(step.stepId).toBeDefined();
    expect(step.startedAt).toBeDefined();
  });

  it('creates steps with summary', () => {
    const step = createToolRequestedStep({ ...baseInput, summary: 'Test summary' }, options);
    expect(step.summary).toBe('Test summary');
  });

  it('creates steps with optional fields', () => {
    const step = createToolRequestedStep(
      {
        ...baseInput,
        status: 'failed',
        startedAt: '2026-01-01T00:00:00Z',
        finishedAt: '2026-01-01T00:01:00Z',
        inputRefs: ['ref-1'],
        outputRefs: ['ref-2'],
        evidenceIds: ['ev-1'],
        executionRequestId: 'exec-1',
        approvalId: 'approval-1',
        checkpointId: 'cp-1',
        metadata: { key: 'value' }
      },
      options
    );
    expect(step.status).toBe('failed');
    expect(step.inputRefs).toEqual(['ref-1']);
    expect(step.outputRefs).toEqual(['ref-2']);
    expect(step.evidenceIds).toEqual(['ev-1']);
    expect(step.executionRequestId).toBe('exec-1');
    expect(step.approvalId).toBe('approval-1');
    expect(step.checkpointId).toBe('cp-1');
    expect(step.metadata).toEqual({ key: 'value' });
  });
});
