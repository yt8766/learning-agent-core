// Transitional shim: briefing storage now lives in agents/intel-engine.
// Remove this backend compatibility entry after Task 4/5 rewires callers to the intel facade.
export {
  appendBriefingFeedback,
  appendBriefingRawEvidence,
  appendDailyTechBriefingRun,
  ensureDailyTechBriefingSchedules,
  listPersistedBriefingSchedules,
  readBriefingFeedback,
  readBriefingHistory,
  readBriefingRawEvidence,
  readBriefingScheduleState,
  readDailyTechBriefingRuns,
  readDailyTechBriefingSchedules,
  saveBriefingHistory,
  saveDailyTechBriefingSchedule
} from '@agent/agents-intel-engine';
