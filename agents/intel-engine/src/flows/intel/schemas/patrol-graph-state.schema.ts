import { z } from 'zod/v4';

import {
  IntelAlertSchema,
  IntelDeliverySchema,
  IntelSignalSchema,
  type IntelAlert,
  type IntelDelivery,
  type IntelSignal
} from '@agent/core';

const PatrolModeSchema = z.enum(['patrol', 'ingest']);

export const PatrolTopicSchema = z.object({
  key: z.string().min(1),
  priorityDefault: z.enum(['P0', 'P1', 'P2']),
  queries: z.array(z.string().min(1)).min(1),
  recencyHours: z.number().int().positive()
});

export const PatrolSearchTaskSchema = z.object({
  taskId: z.string().min(1),
  topicKey: z.string().min(1),
  query: z.string().min(1),
  priorityDefault: z.enum(['P0', 'P1', 'P2']),
  recencyHours: z.number().int().positive(),
  mode: PatrolModeSchema
});

export const PatrolSearchResultSchema = z.object({
  taskId: z.string().min(1),
  topicKey: z.string().min(1),
  query: z.string().min(1),
  priorityDefault: z.enum(['P0', 'P1', 'P2']),
  sourceName: z.string().min(1),
  sourceType: z.enum(['official', 'community']),
  title: z.string().min(1),
  url: z.string().min(1),
  snippet: z.string().min(1),
  publishedAt: z.string().min(1),
  fetchedAt: z.string().min(1),
  contentHash: z.string().min(1).optional()
});

export const PatrolStatsSchema = z.object({
  searchTasks: z.number().int().nonnegative().default(0),
  rawEvents: z.number().int().nonnegative().default(0),
  normalizedSignals: z.number().int().nonnegative().default(0),
  mergedSignals: z.number().int().nonnegative().default(0),
  scoredSignals: z.number().int().nonnegative().default(0),
  generatedAlerts: z.number().int().nonnegative().default(0)
});

export const PatrolRouteMatchSchema = z.object({
  routeId: z.string().min(1),
  channelTargets: z.array(z.string().min(1)).default([])
});

export const PatrolGraphStateSchema = z.object({
  mode: PatrolModeSchema,
  jobId: z.string().min(1),
  startedAt: z.string().min(1),
  topics: z.array(PatrolTopicSchema).default([]),
  searchTasks: z.array(PatrolSearchTaskSchema).default([]),
  rawResults: z.array(PatrolSearchResultSchema).default([]),
  persistedRawEventIds: z.array(z.union([z.string().min(1), z.number().int().nonnegative()])).default([]),
  normalizedSignals: z.array(IntelSignalSchema).default([]),
  mergedSignals: z.array(IntelSignalSchema).default([]),
  signalMergeMap: z.record(z.string(), z.string()).default({}),
  scoredSignals: z.array(IntelSignalSchema).default([]),
  generatedAlerts: z.array(IntelAlertSchema).default([]),
  matchedRoutes: z.array(PatrolRouteMatchSchema).default([]),
  queuedDeliveries: z.array(IntelDeliverySchema).default([]),
  stats: PatrolStatsSchema.default({
    searchTasks: 0,
    rawEvents: 0,
    normalizedSignals: 0,
    mergedSignals: 0,
    scoredSignals: 0,
    generatedAlerts: 0
  }),
  errors: z.array(z.string().min(1)).default([])
});

export type PatrolTopic = z.infer<typeof PatrolTopicSchema>;
export type PatrolSearchTask = z.infer<typeof PatrolSearchTaskSchema>;
export type PatrolSearchResult = z.infer<typeof PatrolSearchResultSchema>;
export type PatrolStats = z.infer<typeof PatrolStatsSchema>;
export type PatrolRouteMatch = z.infer<typeof PatrolRouteMatchSchema>;
export type PatrolGraphState = z.infer<typeof PatrolGraphStateSchema>;
export type PatrolIntelSignal = IntelSignal;
export type PatrolIntelAlert = IntelAlert;
export type PatrolIntelDelivery = IntelDelivery;
