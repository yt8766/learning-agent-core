import { AgentRuntime } from '@agent/runtime';

import {
  runBackgroundRunnerTick,
  startBackgroundRunnerLoop,
  type WorkerBackgroundRunnerContext
} from './background-runner';

export interface WorkerProcessHandle {
  runtime: AgentRuntime;
  context: WorkerBackgroundRunnerContext;
  stop: () => Promise<void>;
}

export async function startWorkerProcess(): Promise<WorkerProcessHandle> {
  const runtime = new AgentRuntime({
    profile: 'platform',
    settingsOptions: {
      workspaceRoot: process.cwd(),
      overrides: {
        runtimeBackground: {
          enabled: true,
          runnerIdPrefix: 'worker'
        }
      }
    }
  });
  await runtime.start();

  const backgroundWorkerSlots = new Map<string, { taskId: string; startedAt: string }>();
  let sweepInFlight = false;
  const context: WorkerBackgroundRunnerContext = {
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

  const timer = startBackgroundRunnerLoop(context, () => runBackgroundRunnerTick(context));

  return {
    runtime,
    context,
    stop: async () => {
      clearInterval(timer);
      await runtime.stop();
    }
  };
}
