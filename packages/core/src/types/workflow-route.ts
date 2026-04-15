import type {
  CapabilityAttachmentRecord,
  ChatRouteRecord,
  CreateTaskDto,
  RequestedExecutionHints,
  WorkflowPresetDefinition
} from '@agent/shared';

export interface WorkflowRouteContext {
  goal: string;
  context?: string;
  workflow?: WorkflowPresetDefinition;
  requestedMode?: CreateTaskDto['requestedMode'];
  requestedHints?: RequestedExecutionHints;
  capabilityAttachments?: CapabilityAttachmentRecord[];
  connectorRefs?: string[];
  recentTurns?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  relatedHistory?: string[];
}

export type WorkflowRouteAdapterId =
  | 'workflow-command'
  | 'approval-recovery'
  | 'identity-capability'
  | 'figma-design'
  | 'modification-intent'
  | 'general-prompt'
  | 'research-first'
  | 'plan-only'
  | 'readiness-fallback'
  | 'fallback';

export interface WorkflowRouteResult extends ChatRouteRecord {
  adapter: WorkflowRouteAdapterId;
}

export type RouteIntent = 'direct-reply' | 'research-first' | 'plan-only' | 'workflow-execute' | 'approval-recovery';

export type ExecutionReadiness =
  | 'ready'
  | 'approval-required'
  | 'missing-capability'
  | 'missing-connector'
  | 'missing-workspace'
  | 'blocked-by-policy';

export interface IntentClassificationResult {
  intent: RouteIntent;
  confidence: number;
  matchedSignals: string[];
  adapterHint?: WorkflowRouteAdapterId;
  reasonHint?: string;
}

export interface RoutingProfile {
  defaultMode: 'direct-reply' | 'plan-first' | 'execute-first';
  prefersResearchFirst: boolean;
  executionTolerance: 'low' | 'medium' | 'high';
}
