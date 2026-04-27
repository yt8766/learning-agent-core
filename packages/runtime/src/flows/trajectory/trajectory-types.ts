import type {
  TaskTrajectoryIntent,
  TaskTrajectoryOrigin,
  TaskTrajectoryRecord,
  TaskTrajectorySummary,
  TrajectoryArtifactKind,
  TrajectoryArtifactRecord,
  TrajectoryReplayMode,
  TrajectoryReplayRecord,
  TrajectoryReplayStatus,
  TrajectoryStatus,
  TrajectoryStepActor,
  TrajectoryStepRecord,
  TrajectoryStepStatus,
  TrajectoryStepType
} from '@agent/core';

export type TrajectoryFactoryOptions = {
  now?: () => string;
  createId?: (prefix: string) => string;
};

export type CreateTrajectoryStepInput = {
  taskId: string;
  sequence: number;
  type: TrajectoryStepType;
  title: string;
  summary?: string;
  actor: TrajectoryStepActor;
  status?: TrajectoryStepStatus;
  startedAt?: string;
  finishedAt?: string;
  inputRefs?: string[];
  outputRefs?: string[];
  evidenceIds?: string[];
  executionRequestId?: string;
  approvalId?: string;
  checkpointId?: string;
  metadata?: Record<string, unknown>;
};

export type CreateTrajectoryArtifactInput = {
  taskId: string;
  kind: TrajectoryArtifactKind;
  uri?: string;
  title: string;
  summary?: string;
  mimeType?: string;
  sizeBytes?: number;
  checksum?: string;
  metadata?: Record<string, unknown>;
};

export type CreateTrajectoryReplayInput = {
  taskId: string;
  mode: TrajectoryReplayMode;
  status: TrajectoryReplayStatus;
  sourceTrajectoryId?: string;
  startedAt?: string;
  finishedAt?: string;
  resultTrajectoryId?: string;
  nonReplayableReasons?: string[];
  metadata?: Record<string, unknown>;
};

export type BuildTaskTrajectoryInput = {
  taskId: string;
  sessionId?: string;
  origin?: TaskTrajectoryOrigin;
  intent: TaskTrajectoryIntent;
  status: TrajectoryStatus;
  steps: TrajectoryStepRecord[];
  artifactIds?: string[];
  evidenceIds?: string[];
  summary?: TaskTrajectorySummary;
  replay?: TrajectoryReplayRecord;
  metadata?: Record<string, unknown>;
};

export type TrajectoryStepLinkInput = Omit<CreateTrajectoryStepInput, 'type' | 'actor' | 'title'> & {
  title?: string;
};

export type { TaskTrajectoryRecord, TrajectoryArtifactRecord, TrajectoryReplayRecord, TrajectoryStepRecord };
