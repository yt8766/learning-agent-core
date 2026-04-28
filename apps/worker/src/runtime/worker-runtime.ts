import {
  createDefaultPlatformRuntime,
  createDefaultPlatformRuntimeOptions,
  type PlatformRuntimeFacade
} from '@agent/platform-runtime';
import type { AgentRuntime, RuntimeAgentDependencies } from '@agent/runtime';

import {
  runBackgroundRunnerTick,
  startBackgroundRunnerLoop,
  type WorkerBackgroundRunnerContext
} from './background-runner';

export interface WorkerProcessHandle {
  platformRuntime: PlatformRuntimeFacade<AgentRuntime>;
  runtime: AgentRuntime;
  context: WorkerBackgroundRunnerContext;
  stop: () => Promise<void>;
}

function createWorkerRuntimeAgentDependencies(): RuntimeAgentDependencies {
  return {
    createLibuRouterMinistry: () => ({}) as never,
    createHubuSearchMinistry: () => ({}) as never,
    createLibuDocsMinistry: () => ({}) as never,
    createGongbuCodeMinistry: () => ({}) as never,
    createBingbuOpsMinistry: () => ({}) as never,
    createXingbuReviewMinistry: () => ({}) as never,
    listBootstrapSkills: () => [],
    buildResearchSourcePlan: () => [],
    initializeTaskExecutionSteps: () => undefined,
    markExecutionStepBlocked: () => undefined,
    markExecutionStepCompleted: () => undefined,
    markExecutionStepResumed: () => undefined,
    markExecutionStepStarted: () => undefined,
    mergeEvidence: (existing, incoming) => [...existing, ...incoming],
    resolveWorkflowPreset: goal => ({
      preset: {
        id: 'worker-background',
        command: '/worker-background',
        displayName: 'Worker Background Runtime',
        intentPatterns: ['worker-background'],
        requiredMinistries: [],
        allowedCapabilities: [],
        approvalPolicy: 'manual',
        outputContract: {
          type: 'worker-background',
          requiredSections: []
        }
      },
      normalizedGoal: goal
    }),
    resolveWorkflowRoute: () => ({
      graph: 'workflow',
      flow: 'supervisor',
      reason: 'worker-background-runtime',
      adapter: 'fallback',
      priority: 0,
      intent: 'workflow-execute',
      intentConfidence: 1,
      executionReadiness: 'ready',
      matchedSignals: ['worker-background']
    }),
    resolveSpecialistRoute: () => ({
      specialistLead: {
        id: 'technical-architecture',
        displayName: 'Worker Background Runtime',
        domain: 'technical-architecture'
      },
      supportingSpecialists: [],
      routeConfidence: 0,
      contextSlicesBySpecialist: []
    }),
    runDispatchStage: async () => undefined,
    runGoalIntakeStage: async () => undefined,
    runManagerPlanStage: async () => undefined,
    runRouteStage: async () => undefined,
    buildDataReportContract: () => ({
      scope: 'single',
      templateRef: 'generic-report',
      componentPattern: [],
      implementationNotes: [],
      executionStages: [],
      contextBlock: ''
    }),
    appendDataReportContext: context => context ?? ''
  };
}

function createWorkerPlatformRuntime(): PlatformRuntimeFacade<AgentRuntime> {
  return createDefaultPlatformRuntime({
    ...createDefaultPlatformRuntimeOptions({
      workspaceRoot: process.cwd(),
      settingsOptions: {
        overrides: {
          runtimeBackground: {
            enabled: true,
            runnerIdPrefix: 'worker'
          }
        }
      }
    }),
    agentDependencies: createWorkerRuntimeAgentDependencies()
  });
}

function createWorkerBackgroundContext(runtime: AgentRuntime): WorkerBackgroundRunnerContext {
  const backgroundWorkerSlots = new Map<string, { taskId: string; startedAt: string }>();
  let sweepInFlight = false;

  return {
    enabled: runtime.settings.runtimeBackground.enabled,
    orchestrator: runtime.orchestrator,
    runnerId: `${runtime.settings.runtimeBackground.runnerIdPrefix}-${process.pid}`,
    workerPoolSize: runtime.settings.runtimeBackground.workerPoolSize,
    leaseTtlMs: runtime.settings.runtimeBackground.leaseTtlMs,
    heartbeatMs: runtime.settings.runtimeBackground.heartbeatMs,
    pollMs: runtime.settings.runtimeBackground.pollMs,
    backgroundWorkerSlots,
    isSweepInFlight: () => sweepInFlight,
    setSweepInFlight: value => {
      sweepInFlight = value;
    }
  };
}

export function createWorkerRuntimeHost(): WorkerProcessHandle {
  const platformRuntime = createWorkerPlatformRuntime();
  const runtime = platformRuntime.runtime;
  const context = createWorkerBackgroundContext(runtime);
  const timer = startBackgroundRunnerLoop(context, () => runBackgroundRunnerTick(context));

  return {
    platformRuntime,
    runtime,
    context,
    stop: async () => {
      clearInterval(timer);
      await runtime.stop();
    }
  };
}

export async function startWorkerProcess(): Promise<WorkerProcessHandle> {
  const host = createWorkerRuntimeHost();
  await host.runtime.start();

  return host;
}
