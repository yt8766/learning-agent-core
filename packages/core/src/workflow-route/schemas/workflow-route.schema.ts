import { z } from 'zod';

import { ChatRouteRecordSchema, ExecutionPlanModeSchema, WorkflowPresetDefinitionSchema } from '../../primitives';
import { CapabilityAttachmentRecordSchema, RequestedExecutionHintsSchema } from '../../skills';

export const WorkflowRouteTurnSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string()
});

export const WorkflowRouteAdapterIdSchema = z.enum([
  'workflow-command',
  'approval-recovery',
  'identity-capability',
  'figma-design',
  'modification-intent',
  'general-prompt',
  'research-first',
  'plan-only',
  'readiness-fallback',
  'fallback'
]);

export const RouteIntentSchema = z.enum([
  'direct-reply',
  'research-first',
  'plan-only',
  'workflow-execute',
  'approval-recovery'
]);

export const ExecutionReadinessSchema = z.enum([
  'ready',
  'approval-required',
  'missing-capability',
  'missing-connector',
  'missing-workspace',
  'blocked-by-policy'
]);

export const WorkflowRouteContextSchema = z.object({
  goal: z.string(),
  context: z.string().optional(),
  workflow: WorkflowPresetDefinitionSchema.optional(),
  requestedMode: ExecutionPlanModeSchema.optional(),
  requestedHints: RequestedExecutionHintsSchema.optional(),
  capabilityAttachments: z.array(CapabilityAttachmentRecordSchema).optional(),
  connectorRefs: z.array(z.string()).optional(),
  recentTurns: z.array(WorkflowRouteTurnSchema).optional(),
  relatedHistory: z.array(z.string()).optional()
});

export const WorkflowRouteResultSchema = ChatRouteRecordSchema.extend({
  adapter: WorkflowRouteAdapterIdSchema
});

export const IntentClassificationResultSchema = z.object({
  intent: RouteIntentSchema,
  confidence: z.number(),
  matchedSignals: z.array(z.string()),
  adapterHint: WorkflowRouteAdapterIdSchema.optional(),
  reasonHint: z.string().optional()
});

export const RoutingProfileSchema = z.object({
  defaultMode: z.enum(['direct-reply', 'plan-first', 'execute-first']),
  prefersResearchFirst: z.boolean(),
  executionTolerance: z.enum(['low', 'medium', 'high'])
});
