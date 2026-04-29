// Transitional shim: briefing types now live in agents/intel-engine.
// Remove this backend compatibility entry after Task 4/5 rewires callers to the intel facade.
export type * from '@agent/agents-intel-engine';
