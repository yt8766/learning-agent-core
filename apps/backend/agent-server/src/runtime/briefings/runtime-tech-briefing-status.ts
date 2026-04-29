// Transitional shim: briefing status aggregation now lives in agents/intel-engine.
// Remove this backend compatibility entry after Task 4/5 rewires callers to the intel facade.
export { readDailyTechBriefingStatus } from '@agent/agents-intel-engine';
