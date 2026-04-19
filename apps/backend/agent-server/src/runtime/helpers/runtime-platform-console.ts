import type { ChatCheckpointRecord, ChatSessionRecord } from '@agent/core';
import type {
  PlatformConsoleDiagnosticsRecord,
  PlatformConsoleRecord,
  RuntimePlatformConsoleContext
} from '../centers/runtime-platform-console.records';
import { PlatformConsoleDiagnosticsRecordSchema } from '../centers/runtime-platform-console.schemas';
import {
  buildPlatformConsoleCacheKey,
  persistPlatformConsoleCache,
  readPlatformConsoleCache,
  readPlatformConsoleInFlight,
  setPlatformConsoleInFlight,
  withPlatformConsoleCacheStatus
} from './runtime-platform-console.cache';
export { resetPlatformConsoleCacheForTest } from './runtime-platform-console.cache';
export { exportApprovalsCenter, exportEvalsCenter, exportRuntimeCenter } from './runtime-platform-console.export';
import {
  normalizePlatformConsoleEvalsRecord,
  normalizePlatformConsoleEvidenceRecord,
  normalizePlatformConsoleRuntimeRecord
} from './runtime-platform-console.normalize';

const PLATFORM_CONSOLE_CENTER_TIMEOUT_MS = 5_000;

export async function buildPlatformConsole(
  context: RuntimePlatformConsoleContext,
  days = 30,
  filters?: {
    status?: string;
    model?: string;
    pricingSource?: string;
    runtimeExecutionMode?: string;
    runtimeInteractionKind?: string;
    approvalsExecutionMode?: string;
    approvalsInteractionKind?: string;
  }
) {
  return buildPlatformConsoleWithMode(context, days, filters, 'full');
}

export async function buildPlatformConsoleShell(
  context: RuntimePlatformConsoleContext,
  days = 30,
  filters?: {
    status?: string;
    model?: string;
    pricingSource?: string;
    runtimeExecutionMode?: string;
    runtimeInteractionKind?: string;
    approvalsExecutionMode?: string;
    approvalsInteractionKind?: string;
  }
) {
  return buildPlatformConsoleWithMode(context, days, filters, 'shell');
}

async function buildPlatformConsoleWithMode(
  context: RuntimePlatformConsoleContext,
  days: number,
  filters:
    | {
        status?: string;
        model?: string;
        pricingSource?: string;
        runtimeExecutionMode?: string;
        runtimeInteractionKind?: string;
        approvalsExecutionMode?: string;
        approvalsInteractionKind?: string;
      }
    | undefined,
  mode: 'full' | 'shell'
) {
  const cacheKey = buildPlatformConsoleCacheKey(context, days, filters, mode);
  const cached = readPlatformConsoleCache(cacheKey);
  if (cached) {
    return cached;
  }

  const inFlight = readPlatformConsoleInFlight(cacheKey);
  if (inFlight) {
    return inFlight.then(record => withPlatformConsoleCacheStatus(record, 'deduped'));
  }

  const request = buildPlatformConsoleRecord(context, days, filters, mode).then(record =>
    persistPlatformConsoleCache(cacheKey, record)
  );
  setPlatformConsoleInFlight(cacheKey, request);

  return request;
}

async function buildPlatformConsoleRecord(
  context: RuntimePlatformConsoleContext,
  days = 30,
  filters?: {
    status?: string;
    model?: string;
    pricingSource?: string;
    runtimeExecutionMode?: string;
    runtimeInteractionKind?: string;
    approvalsExecutionMode?: string;
    approvalsInteractionKind?: string;
  },
  mode: 'full' | 'shell' = 'full'
) {
  const startedAt = Date.now();
  const [skills, rules, learning, skillSources, connectors, companyAgents, runtime, approvals, evals, evidence] =
    await Promise.all([
      measureAsync(() => context.skillRegistry.list().catch(() => [])),
      measureAsync(() => context.orchestrator.listRules().catch(() => [])),
      measureAsync(() =>
        withPlatformConsoleTimeout(
          () =>
            mode === 'shell'
              ? (context.getLearningCenterSummary?.() ?? context.getLearningCenter())
              : context.getLearningCenter(),
          () => ({
            totalCandidates: 0,
            pendingCandidates: 0,
            confirmedCandidates: 0,
            candidates: [],
            recentJobs: [],
            localSkillSuggestions: [],
            recentSkillGovernance: [],
            recentGovernanceReports: [],
            capabilityTrustProfiles: [],
            ministryGovernanceProfiles: [],
            workerGovernanceProfiles: [],
            specialistGovernanceProfiles: [],
            ministryScorecards: [],
            budgetEfficiencyWarnings: [],
            learningQueue: [],
            counselorSelectorConfigs: [],
            recentQuarantinedMemories: [],
            recentCrossCheckEvidence: [],
            quarantineCategoryStats: {},
            quarantineRestoreSuggestions: []
          })
        )
      ),
      measureAsync(() =>
        mode === 'shell'
          ? Promise.resolve(buildEmptySkillSourcesCenter())
          : context.getSkillSourcesCenter().catch(() => buildEmptySkillSourcesCenter())
      ),
      measureAsync(() => (mode === 'shell' ? Promise.resolve([]) : context.getConnectorsCenter().catch(() => []))),
      measureAsync(() =>
        mode === 'shell'
          ? Promise.resolve([])
          : Promise.resolve()
              .then(() => context.getCompanyAgentsCenter())
              .catch(() => [])
      ),
      measureAsync(() =>
        withPlatformConsoleTimeout(
          () =>
            (mode === 'shell'
              ? (context.getRuntimeCenterSummary?.bind(context) ?? context.getRuntimeCenter)
              : context.getRuntimeCenter)(days, {
              status: filters?.status,
              model: filters?.model,
              pricingSource: filters?.pricingSource,
              executionMode: filters?.runtimeExecutionMode,
              interactionKind: filters?.runtimeInteractionKind,
              metricsMode: 'snapshot-preferred'
            }),
          () => ({
            taskCount: 0,
            activeTaskCount: 0,
            queueDepth: 0,
            blockedRunCount: 0,
            pendingApprovalCount: 0,
            sessionCount: 0,
            activeSessionCount: 0,
            activeMinistries: [],
            activeWorkers: [],
            recentRuns: [],
            usageAnalytics: {
              totalEstimatedPromptTokens: 0,
              totalEstimatedCompletionTokens: 0,
              totalEstimatedTokens: 0,
              totalEstimatedCostUsd: 0,
              totalEstimatedCostCny: 0,
              providerMeasuredCostUsd: 0,
              providerMeasuredCostCny: 0,
              estimatedFallbackCostUsd: 0,
              estimatedFallbackCostCny: 0,
              measuredRunCount: 0,
              estimatedRunCount: 0,
              daily: [],
              models: [],
              budgetPolicy: {
                dailyTokenWarning: 100_000,
                dailyCostCnyWarning: 5,
                totalCostCnyWarning: 20
              },
              persistedDailyHistory: [],
              recentUsageAudit: [],
              alerts: []
            }
          })
        )
      ),
      measureAsync(() =>
        Promise.resolve()
          .then(() =>
            context.getApprovalsCenter({
              executionMode: filters?.approvalsExecutionMode,
              interactionKind: filters?.approvalsInteractionKind
            })
          )
          .catch(() => [])
      ),
      measureAsync(() =>
        (mode === 'shell'
          ? (context.getEvalsCenterSummary?.bind(context) ?? context.getEvalsCenter)
          : context.getEvalsCenter)(days, {
          metricsMode: 'snapshot-preferred'
        }).catch(() => ({
          dailyTrend: [],
          persistedDailyHistory: [],
          recentRuns: [],
          scenarioTrends: [],
          scenarios: [],
          scenarioCount: 0,
          runCount: 0,
          overallPassRate: 0,
          promptRegression: { suites: [] }
        }))
      ),
      measureAsync(() =>
        mode === 'shell'
          ? Promise.resolve<unknown>([])
          : withPlatformConsoleTimeout(
              () => context.getEvidenceCenter(),
              () => ({
                totalEvidenceCount: 0,
                recentEvidence: []
              })
            )
      )
    ]);
  const tasks =
    mode === 'shell' ? { value: [] as unknown[], durationMs: 0 } : measureSync(() => context.orchestrator.listTasks());
  const sessions =
    mode === 'shell'
      ? { value: [] as ChatSessionRecord[], durationMs: 0 }
      : measureSync(() => context.sessionCoordinator.listSessions());
  const checkpointsMeasured =
    mode === 'shell'
      ? { value: [] as Array<{ session: ChatSessionRecord; checkpoint: ChatCheckpointRecord }>, durationMs: 0 }
      : measureSync(() =>
          sessions.value
            .map(session => {
              const checkpoint = context.sessionCoordinator.getCheckpoint(session.id);
              return checkpoint ? { session, checkpoint } : undefined;
            })
            .filter((item): item is { session: ChatSessionRecord; checkpoint: ChatCheckpointRecord } => Boolean(item))
        );

  const diagnostics: PlatformConsoleDiagnosticsRecord = PlatformConsoleDiagnosticsRecordSchema.parse({
    cacheStatus: 'miss',
    generatedAt: new Date().toISOString(),
    timingsMs: {
      total: Date.now() - startedAt,
      skills: skills.durationMs,
      rules: rules.durationMs,
      learning: learning.durationMs,
      skillSources: skillSources.durationMs,
      connectors: connectors.durationMs,
      companyAgents: companyAgents.durationMs,
      runtime: runtime.durationMs,
      approvals: approvals.durationMs,
      evals: evals.durationMs,
      evidence: evidence.durationMs,
      tasks: tasks.durationMs,
      sessions: sessions.durationMs,
      checkpoints: checkpointsMeasured.durationMs
    }
  });

  return {
    runtime: normalizePlatformConsoleRuntimeRecord(runtime.value),
    approvals: approvals.value,
    learning: learning.value,
    evals: normalizePlatformConsoleEvalsRecord(evals.value),
    skills: skills.value,
    evidence: normalizePlatformConsoleEvidenceRecord(evidence.value),
    connectors: connectors.value,
    skillSources: skillSources.value,
    companyAgents: companyAgents.value,
    rules: rules.value,
    tasks: tasks.value,
    sessions: sessions.value,
    checkpoints: checkpointsMeasured.value,
    diagnostics
  } as PlatformConsoleRecord;
}

function buildEmptySkillSourcesCenter() {
  return {
    sources: [],
    manifests: [],
    installed: [],
    receipts: []
  };
}

async function withPlatformConsoleTimeout<T>(loader: () => Promise<T>, fallback: () => T): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      loader().catch(() => fallback()),
      new Promise<T>(resolve => {
        timeoutHandle = setTimeout(() => resolve(fallback()), PLATFORM_CONSOLE_CENTER_TIMEOUT_MS);
      })
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

async function measureAsync<T>(loader: () => Promise<T>) {
  const startedAt = Date.now();
  const value = await loader();
  return {
    value,
    durationMs: Date.now() - startedAt
  };
}

function measureSync<T>(loader: () => T) {
  const startedAt = Date.now();
  const value = loader();
  return {
    value,
    durationMs: Date.now() - startedAt
  };
}
