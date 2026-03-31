export class RuntimeOperationalStateService {
  private readonly backgroundWorkerSlots = new Map<string, { taskId: string; startedAt: string }>();
  private backgroundRunnerSweepInFlight = false;

  getBackgroundWorkerSlots(): Map<string, { taskId: string; startedAt: string }> {
    return this.backgroundWorkerSlots;
  }

  isBackgroundRunnerSweepInFlight(): boolean {
    return this.backgroundRunnerSweepInFlight;
  }

  setBackgroundRunnerSweepInFlight(value: boolean) {
    this.backgroundRunnerSweepInFlight = value;
  }
}
