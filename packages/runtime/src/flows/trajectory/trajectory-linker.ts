import type { TrajectoryFactoryOptions, TrajectoryStepLinkInput, TrajectoryStepRecord } from './trajectory-types';
import { createTrajectoryStep } from './trajectory-step-factory';

export function createToolRequestedStep(
  input: TrajectoryStepLinkInput,
  options?: TrajectoryFactoryOptions
): TrajectoryStepRecord {
  return createTrajectoryStep(
    {
      ...input,
      type: 'tool_requested',
      actor: 'execution_node',
      title: input.title ?? 'Tool requested'
    },
    options
  );
}

export function createPolicyCheckedStep(
  input: TrajectoryStepLinkInput,
  options?: TrajectoryFactoryOptions
): TrajectoryStepRecord {
  return createTrajectoryStep(
    {
      ...input,
      type: 'policy_checked',
      actor: 'policy_engine',
      title: input.title ?? 'Policy checked'
    },
    options
  );
}

export function createApprovalRequestedStep(
  input: TrajectoryStepLinkInput,
  options?: TrajectoryFactoryOptions
): TrajectoryStepRecord {
  return createTrajectoryStep(
    {
      ...input,
      type: 'approval_requested',
      actor: 'supervisor',
      title: input.title ?? 'Approval requested'
    },
    options
  );
}

export function createApprovalResolvedStep(
  input: TrajectoryStepLinkInput,
  options?: TrajectoryFactoryOptions
): TrajectoryStepRecord {
  return createTrajectoryStep(
    {
      ...input,
      type: 'approval_resolved',
      actor: 'human',
      title: input.title ?? 'Approval resolved'
    },
    options
  );
}

export function createToolExecutedStep(
  input: TrajectoryStepLinkInput,
  options?: TrajectoryFactoryOptions
): TrajectoryStepRecord {
  return createTrajectoryStep(
    {
      ...input,
      type: 'tool_executed',
      actor: 'execution_node',
      title: input.title ?? 'Tool executed'
    },
    options
  );
}

export function createEvidenceRecordedStep(
  input: TrajectoryStepLinkInput,
  options?: TrajectoryFactoryOptions
): TrajectoryStepRecord {
  return createTrajectoryStep(
    {
      ...input,
      type: 'evidence_recorded',
      actor: 'runtime',
      title: input.title ?? 'Evidence recorded'
    },
    options
  );
}

export function createCheckpointCreatedStep(
  input: TrajectoryStepLinkInput,
  options?: TrajectoryFactoryOptions
): TrajectoryStepRecord {
  return createTrajectoryStep(
    {
      ...input,
      type: 'checkpoint_created',
      actor: 'runtime',
      title: input.title ?? 'Checkpoint created'
    },
    options
  );
}
