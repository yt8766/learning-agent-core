const METRICS_SNAPSHOT_REFRESH_MS = 30 * 60 * 1000;

export interface RuntimeScheduleContext {
  refreshMetricsSnapshots?: (days: number) => Promise<unknown>;
}

export class RuntimeScheduleService {
  private initialized = false;
  private metricsRefreshTimer?: NodeJS.Timeout;

  constructor(private readonly getContext: () => RuntimeScheduleContext) {}

  async initialize() {
    if (this.initialized) {
      return;
    }
    this.startMetricsRefreshLoop();
    this.initialized = true;
  }

  async dispose() {
    if (this.metricsRefreshTimer) {
      clearInterval(this.metricsRefreshTimer);
      this.metricsRefreshTimer = undefined;
    }
    this.initialized = false;
  }

  async syncSchedules() {
    return [];
  }

  async syncMetricsSnapshots(days = 30) {
    if (!this.ctx().refreshMetricsSnapshots) {
      return;
    }
    await this.ctx().refreshMetricsSnapshots(days);
  }

  private startMetricsRefreshLoop() {
    if (!this.ctx().refreshMetricsSnapshots || this.metricsRefreshTimer) {
      return;
    }
    this.metricsRefreshTimer = setInterval(() => {
      void this.syncMetricsSnapshots().catch(() => undefined);
    }, METRICS_SNAPSHOT_REFRESH_MS);
    this.metricsRefreshTimer.unref?.();
  }

  private ctx() {
    return this.getContext();
  }
}
