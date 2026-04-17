import { z } from 'zod';

import {
  ExecutionReadinessSchema,
  IntentClassificationResultSchema,
  RouteIntentSchema,
  RoutingProfileSchema,
  WorkflowRouteAdapterIdSchema,
  WorkflowRouteContextSchema,
  WorkflowRouteResultSchema
} from '../spec/workflow-route';

export type WorkflowRouteContext = z.infer<typeof WorkflowRouteContextSchema>;
export type WorkflowRouteAdapterId = z.infer<typeof WorkflowRouteAdapterIdSchema>;
export type WorkflowRouteResult = z.infer<typeof WorkflowRouteResultSchema>;
export type RouteIntent = z.infer<typeof RouteIntentSchema>;
export type ExecutionReadiness = z.infer<typeof ExecutionReadinessSchema>;
export type IntentClassificationResult = z.infer<typeof IntentClassificationResultSchema>;
export type RoutingProfile = z.infer<typeof RoutingProfileSchema>;
