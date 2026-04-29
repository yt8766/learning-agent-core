// Transitional shim: briefing runtime now lives in agents/intel-engine.
// Remove this backend compatibility entry after Task 4/5 rewires callers to the intel facade.
export { RuntimeTechBriefingService } from '@agent/agents-intel-engine';
export type { RuntimeTechBriefingContext } from '@agent/agents-intel-engine';
