import type { CapabilityOwnerType, PlatformApprovalInterruptRecord, RiskLevel } from '@agent/core';
import type { ToolCapabilityType } from '../contracts/governance';

type ActionIntentValue = string;

export type RuntimeInteractionKind =
  | 'approval'
  | 'plan-question'
  | 'supplemental-input'
  | 'revise-required'
  | 'micro-loop-exhausted'
  | 'mode-transition';

export interface RuntimeApprovalInterruptRecord extends Omit<
  PlatformApprovalInterruptRecord,
  'intent' | 'riskLevel' | 'createdAt'
> {
  intent?: ActionIntentValue;
  createdAt: string;
  riskLevel?: RiskLevel;
  family?: string;
  capabilityType?: ToolCapabilityType;
  ownerType?: CapabilityOwnerType;
  ownerId?: string;
  blockedReason?: string;
  threadId?: string;
  checkpointId?: string;
  interactionKind?: RuntimeInteractionKind;
  origin?: 'counselor_proxy' | 'runtime' | 'timeout' | 'budget' | 'review';
  proxySourceAgentId?: string;
  timeoutMinutes?: number;
  timeoutPolicy?: 'reject' | 'default-continue' | 'cancel-task';
  timedOutAt?: string;
  resolvedAt?: string;
}
