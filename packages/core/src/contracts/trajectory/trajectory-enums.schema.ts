import { z } from 'zod';

export const TrajectoryStatusSchema = z.enum([
  'running',
  'succeeded',
  'failed',
  'cancelled',
  'interrupted',
  'replayed'
]);
export type TrajectoryStatus = z.infer<typeof TrajectoryStatusSchema>;

export const TrajectoryStepTypeSchema = z.enum([
  'intent_received',
  'context_loaded',
  'route_planned',
  'agent_dispatched',
  'tool_requested',
  'policy_checked',
  'approval_requested',
  'approval_resolved',
  'tool_executed',
  'evidence_recorded',
  'checkpoint_created',
  'recovery_requested',
  'recovered',
  'learning_extracted',
  'finalized'
]);
export type TrajectoryStepType = z.infer<typeof TrajectoryStepTypeSchema>;

export const TrajectoryStepActorSchema = z.enum([
  'human',
  'gateway',
  'supervisor',
  'ministry',
  'specialist_agent',
  'runtime',
  'execution_node',
  'policy_engine',
  'learning_recorder'
]);
export type TrajectoryStepActor = z.infer<typeof TrajectoryStepActorSchema>;

export const TrajectoryStepStatusSchema = z.enum(['pending', 'running', 'succeeded', 'failed', 'skipped', 'cancelled']);
export type TrajectoryStepStatus = z.infer<typeof TrajectoryStepStatusSchema>;

export const TrajectoryArtifactKindSchema = z.enum([
  'file',
  'diff',
  'terminal_output',
  'browser_snapshot',
  'test_report',
  'evidence_bundle',
  'skill_draft',
  'log'
]);
export type TrajectoryArtifactKind = z.infer<typeof TrajectoryArtifactKindSchema>;

export const TrajectoryReplayModeSchema = z.enum(['dry_run', 'deterministic_only', 'full_replay']);
export type TrajectoryReplayMode = z.infer<typeof TrajectoryReplayModeSchema>;

export const TrajectoryReplayStatusSchema = z.enum([
  'not_requested',
  'available',
  'unavailable',
  'running',
  'completed',
  'failed'
]);
export type TrajectoryReplayStatus = z.infer<typeof TrajectoryReplayStatusSchema>;
