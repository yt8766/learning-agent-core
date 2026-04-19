import {
  createDefaultPlatformRuntime,
  createDefaultPlatformRuntimeOptions,
  type PlatformRuntimeFacade
} from '@agent/platform-runtime';
import type { AgentRuntime } from '@agent/runtime';

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
    })
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
