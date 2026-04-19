import type { RuntimeBackgroundRunnerContext } from '../../helpers/runtime-background-runner';
import type { RuntimeHost } from '../../core/runtime.host';
import type { RuntimeOperationalStateService } from '../../services/runtime-operational-state.service';

export interface RuntimeBackgroundContextInput {
  settings: () => RuntimeHost['settings'];
  orchestrator: () => RuntimeHost['orchestrator'];
  operationalState: () => RuntimeOperationalStateService;
  backgroundRunnerId: string;
  backgroundWorkerPoolSize: number;
  backgroundLeaseTtlMs: number;
  backgroundHeartbeatMs: number;
  backgroundPollMs: number;
}

export function createBackgroundRunnerContext(input: RuntimeBackgroundContextInput): RuntimeBackgroundRunnerContext {
  return {
    enabled: input.settings().runtimeBackground.enabled,
    orchestrator: input.orchestrator(),
    runnerId: input.backgroundRunnerId,
    workerPoolSize: input.backgroundWorkerPoolSize,
    leaseTtlMs: input.backgroundLeaseTtlMs,
    heartbeatMs: input.backgroundHeartbeatMs,
    pollMs: input.backgroundPollMs,
    backgroundWorkerSlots: input.operationalState().getBackgroundWorkerSlots(),
    isSweepInFlight: () => input.operationalState().isBackgroundRunnerSweepInFlight(),
    setSweepInFlight: value => input.operationalState().setBackgroundRunnerSweepInFlight(value)
  };
}
