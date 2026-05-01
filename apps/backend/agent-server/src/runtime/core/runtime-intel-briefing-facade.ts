import {
  appendBriefingFeedback,
  ensureDailyTechBriefingSchedules,
  listPersistedBriefingSchedules,
  readDailyTechBriefingRuns,
  readDailyTechBriefingStatus,
  RuntimeTechBriefingService,
  saveDailyTechBriefingSchedule,
  type BriefingFeedbackRecord,
  type DailyTechBriefingScheduleRecord,
  type DailyTechBriefingStatusRecord,
  type RuntimeTechBriefingContext,
  type TechBriefingCategory
} from '@agent/agents-intel-engine';

export {
  appendBriefingFeedback,
  ensureDailyTechBriefingSchedules,
  listPersistedBriefingSchedules,
  readDailyTechBriefingRuns,
  readDailyTechBriefingStatus,
  saveDailyTechBriefingSchedule
};

export type {
  BriefingFeedbackRecord,
  DailyTechBriefingScheduleRecord,
  DailyTechBriefingStatusRecord,
  RuntimeTechBriefingContext,
  TechBriefingCategory
};

export class RuntimeIntelBriefingFacade {
  private readonly service: RuntimeTechBriefingService;

  constructor(getContext: () => RuntimeTechBriefingContext) {
    this.service = new RuntimeTechBriefingService(getContext);
  }

  initializeSchedule() {
    return this.service.initializeSchedule();
  }

  runScheduled(now?: Date, categories?: TechBriefingCategory[]) {
    return this.service.runScheduled(now, categories);
  }

  forceRun(category: TechBriefingCategory, now?: Date) {
    return this.service.forceRun(category, now);
  }

  getStatus() {
    return this.service.getStatus();
  }
}
