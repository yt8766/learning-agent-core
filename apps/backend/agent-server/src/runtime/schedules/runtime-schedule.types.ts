export type RuntimeScheduleMode = 'cron' | 'manual' | 'invalid';

export interface RuntimeScheduleResolution {
  schedule: string;
  mode: RuntimeScheduleMode;
  scheduleValid: boolean;
  cron?: string;
}

export interface PersistedRuntimeScheduleRecord {
  id: string;
  name?: string;
  schedule: string;
  status?: string;
  cron?: string;
  scheduleValid?: boolean;
  jobKey?: string;
  lastRegisteredAt?: string;
  scheduler?: 'bree';
  nextRunAt?: string;
  updatedAt?: string;
}
