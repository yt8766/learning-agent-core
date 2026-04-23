export function shouldUsePersistedUsageSnapshot(
  persisted: {
    persistedDailyHistory?: Array<unknown>;
    recentUsageAudit?: Array<unknown>;
  },
  tasks: Array<unknown>
) {
  if ((persisted.persistedDailyHistory?.length ?? 0) > 0) {
    return true;
  }
  if ((persisted.recentUsageAudit?.length ?? 0) > 0) {
    return true;
  }
  return tasks.length === 0;
}

export function shouldUsePersistedEvalSnapshot(
  persisted: {
    persistedDailyHistory?: Array<unknown>;
  },
  tasks: Array<unknown>
) {
  if ((persisted.persistedDailyHistory?.length ?? 0) > 0) {
    return true;
  }
  return tasks.length === 0;
}
