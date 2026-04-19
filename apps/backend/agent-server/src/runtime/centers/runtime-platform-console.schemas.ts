import { z } from 'zod/v4';

const UnknownRecordSchema = z.record(z.string(), z.unknown());

export const PlatformConsolePendingApprovalSchema = z
  .object({
    requestedBy: z.string().optional(),
    intent: z.string().optional(),
    toolName: z.string().optional(),
    riskLevel: z.string().optional(),
    reason: z.string().optional()
  })
  .partial();

export const PlatformConsoleActiveInterruptSchema = z
  .object({
    requestedBy: z.string().optional(),
    source: z.string().optional(),
    intent: z.string().optional(),
    toolName: z.string().optional(),
    riskLevel: z.string().optional(),
    reason: z.string().optional(),
    interactionKind: z.string().optional(),
    kind: z.string().optional(),
    payload: UnknownRecordSchema.optional()
  })
  .partial();

export const PlatformConsoleStreamStatusSchema = z
  .object({
    nodeLabel: z.string().optional(),
    nodeId: z.string().optional(),
    detail: z.string().optional(),
    progressPercent: z.union([z.number(), z.string()]).optional()
  })
  .partial();

export const PlatformConsoleContextFilterStateSchema = z
  .object({
    filteredContextSlice: z
      .object({
        compressionApplied: z.union([z.string(), z.boolean()]).optional(),
        compressionSource: z.string().optional(),
        compressedMessageCount: z.union([z.number(), z.string()]).optional()
      })
      .partial()
      .optional()
  })
  .partial();

export const PlatformConsoleDispatchRecordSchema = z
  .object({
    taskId: z.string().optional(),
    subTaskId: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    kind: z.enum(['strategy', 'ministry', 'fallback']).optional(),
    objective: z.string().optional(),
    specialistDomain: z.string().optional(),
    requiredCapabilities: z.array(z.string()).optional(),
    agentId: z.string().optional(),
    candidateAgentIds: z.array(z.string()).optional(),
    selectedAgentId: z.string().optional(),
    selectionSource: z.string().optional()
  })
  .partial();

export const PlatformConsoleRuntimeTaskRecordSchema = z
  .object({
    id: z.string().optional(),
    status: z.string().optional(),
    executionMode: z.string().optional(),
    currentMinistry: z.string().optional(),
    pendingApproval: PlatformConsolePendingApprovalSchema.optional(),
    activeInterrupt: PlatformConsoleActiveInterruptSchema.optional(),
    currentWorker: z.string().optional(),
    dispatches: z.array(PlatformConsoleDispatchRecordSchema).optional(),
    streamStatus: PlatformConsoleStreamStatusSchema.optional(),
    contextFilterState: PlatformConsoleContextFilterStateSchema.optional(),
    updatedAt: z.string().optional()
  })
  .partial();

export const PlatformConsoleUsagePointSchema = z.object({
  day: z.string(),
  tokens: z.number(),
  costUsd: z.number(),
  costCny: z.number(),
  runs: z.number(),
  overBudget: z.boolean().optional()
});

export const PlatformConsoleDailyTechBriefingCategorySchema = z.object({
  category: z.string(),
  status: z.string(),
  itemCount: z.number(),
  emptyDigest: z.union([z.string(), z.boolean()]).optional(),
  sentAt: z.string().optional(),
  error: z.string().optional()
});

export const PlatformConsoleDailyTechBriefingSchema = z
  .object({
    scheduler: z.string().optional(),
    schedule: z.string().optional(),
    cron: z.string().optional(),
    scheduleValid: z.union([z.string(), z.boolean()]).optional(),
    jobKey: z.string().optional(),
    lastRegisteredAt: z.string().optional(),
    categories: z.array(PlatformConsoleDailyTechBriefingCategorySchema).optional()
  })
  .partial();

export const PlatformConsoleRuntimeRecordSchema = z
  .object({
    usageAnalytics: z
      .object({
        daily: z.array(PlatformConsoleUsagePointSchema).optional(),
        persistedDailyHistory: z.array(PlatformConsoleUsagePointSchema).optional()
      })
      .partial()
      .default({}),
    recentRuns: z.array(PlatformConsoleRuntimeTaskRecordSchema).default([]),
    dailyTechBriefing: PlatformConsoleDailyTechBriefingSchema.optional()
  })
  .catchall(z.unknown());

export const PlatformConsoleEvalsDailyPointSchema = z
  .object({
    day: z.string().optional(),
    runCount: z.number().optional(),
    passCount: z.number().optional(),
    passRate: z.number().optional()
  })
  .partial();

export const PlatformConsoleEvalsRecentRunSchema = z
  .object({
    taskId: z.string().optional(),
    createdAt: z.string().optional(),
    success: z.boolean().optional(),
    scenarioIds: z.array(z.string()).optional()
  })
  .partial();

export const PlatformConsolePromptSuiteSchema = z
  .object({
    suiteId: z.string().optional(),
    label: z.string().optional(),
    promptCount: z.number().optional(),
    versions: z.array(z.string()).optional()
  })
  .partial();

export const PlatformConsoleEvalsRecordSchema = z
  .object({
    dailyTrend: z.array(PlatformConsoleEvalsDailyPointSchema).default([]),
    persistedDailyHistory: z.array(PlatformConsoleEvalsDailyPointSchema).default([]),
    recentRuns: z.array(PlatformConsoleEvalsRecentRunSchema).default([]),
    promptRegression: z
      .object({
        suites: z.array(PlatformConsolePromptSuiteSchema).default([])
      })
      .partial()
      .optional()
  })
  .catchall(z.unknown());

export const PlatformConsoleEvidenceRecordSchema = z
  .object({
    totalEvidenceCount: z.number().optional(),
    recentEvidence: z.array(z.unknown()).default([])
  })
  .catchall(z.unknown());

export const PlatformConsoleTimingRecordSchema = z.object({
  total: z.number(),
  skills: z.number(),
  rules: z.number(),
  learning: z.number(),
  skillSources: z.number(),
  connectors: z.number(),
  companyAgents: z.number(),
  runtime: z.number(),
  approvals: z.number(),
  evals: z.number(),
  evidence: z.number(),
  tasks: z.number(),
  sessions: z.number(),
  checkpoints: z.number()
});

export const PlatformConsoleDiagnosticsRecordSchema = z.object({
  cacheStatus: z.enum(['miss', 'hit', 'deduped']),
  generatedAt: z.string(),
  timingsMs: PlatformConsoleTimingRecordSchema
});

export type PlatformConsoleRuntimeTaskRecord = z.infer<typeof PlatformConsoleRuntimeTaskRecordSchema>;
export type PlatformConsoleRuntimeRecord = z.infer<typeof PlatformConsoleRuntimeRecordSchema>;
export type PlatformConsoleEvalsRecord = z.infer<typeof PlatformConsoleEvalsRecordSchema>;
export type PlatformConsoleEvidenceRecord = z.infer<typeof PlatformConsoleEvidenceRecordSchema>;
export type PlatformConsoleTimingRecord = z.infer<typeof PlatformConsoleTimingRecordSchema>;
export type PlatformConsoleDiagnosticsRecord = z.infer<typeof PlatformConsoleDiagnosticsRecordSchema>;
