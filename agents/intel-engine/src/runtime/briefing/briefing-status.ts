import type { DailyTechBriefingStatusRecord } from './briefing.types';
import { BRIEFING_CATEGORIES } from './briefing-paths';
import {
  type BriefingStorageRepository,
  readBriefingFeedback,
  readBriefingScheduleState,
  readDailyTechBriefingRuns,
  readDailyTechBriefingSchedules
} from './briefing-storage';
import {
  summarizeFocusAreas,
  summarizePreferredSourceNames,
  summarizePreferredTopicLabels,
  summarizeSuppression,
  summarizeTrendHighlights
} from './briefing-storage-status';

export async function readDailyTechBriefingStatus(
  workspaceRoot: string,
  defaults: Pick<DailyTechBriefingStatusRecord, 'enabled' | 'schedule'>,
  repository?: BriefingStorageRepository
): Promise<DailyTechBriefingStatusRecord> {
  const [schedules, runs, scheduleStates] = await Promise.all([
    readDailyTechBriefingSchedules(workspaceRoot, repository),
    readDailyTechBriefingRuns(workspaceRoot, repository),
    readBriefingScheduleState(workspaceRoot, repository)
  ]);
  const feedback = await readBriefingFeedback(workspaceRoot, repository);
  const feedbackMap = new Map<string, { helpful: number; notHelpful: number }>();
  for (const record of feedback) {
    const current = feedbackMap.get(record.messageKey) ?? { helpful: 0, notHelpful: 0 };
    if (record.feedbackType === 'helpful') {
      current.helpful += 1;
    } else {
      current.notHelpful += 1;
    }
    feedbackMap.set(record.messageKey, current);
  }
  const latestSuccessfulRun = runs.find(run => run.status === 'sent');
  const categories = BRIEFING_CATEGORIES.map(category => {
    const latestCategory = runs.flatMap(run => run.categories).find(item => item.category === category);
    const categoryRuns = runs
      .map(run => run.categories.find(item => item.category === category))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    const trendHighlights = summarizeTrendHighlights(categoryRuns);
    return latestCategory
      ? {
          category: latestCategory.category,
          title: latestCategory.title,
          status: latestCategory.status,
          itemCount: latestCategory.itemCount,
          emptyDigest: latestCategory.emptyDigest,
          scheduleState: scheduleStates[category],
          newCount: latestCategory.newCount,
          updateCount: latestCategory.updateCount,
          crossRunSuppressedCount: latestCategory.crossRunSuppressedCount,
          sameRunMergedCount: latestCategory.sameRunMergedCount,
          overflowCollapsedCount: latestCategory.overflowCollapsedCount,
          suppressedSummary:
            latestCategory.suppressedSummary ??
            summarizeSuppression(
              latestCategory.crossRunSuppressedCount,
              latestCategory.sameRunMergedCount,
              latestCategory.overflowCollapsedCount
            ),
          savedAttentionCount:
            latestCategory.savedAttentionCount ??
            (latestCategory.crossRunSuppressedCount ?? 0) +
              (latestCategory.sameRunMergedCount ?? 0) +
              (latestCategory.overflowCollapsedCount ?? 0),
          displayedItemCount: latestCategory.displayedItemCount,
          overflowTitles: latestCategory.overflowTitles,
          auditRecords: latestCategory.auditRecords?.map(record => ({
            ...record,
            helpful: feedbackMap.get(record.messageKey)?.helpful ?? 0,
            notHelpful: feedbackMap.get(record.messageKey)?.notHelpful ?? 0
          })),
          preferredSourceNames: summarizePreferredSourceNames(latestCategory.auditRecords ?? [], feedbackMap),
          preferredTopicLabels: summarizePreferredTopicLabels(latestCategory.auditRecords ?? [], feedbackMap),
          focusAreas: summarizeFocusAreas(latestCategory.auditRecords ?? [], feedbackMap),
          trendHighlights,
          helpful: (latestCategory.auditRecords ?? []).reduce(
            (sum, record) => sum + (feedbackMap.get(record.messageKey)?.helpful ?? 0),
            0
          ),
          notHelpful: (latestCategory.auditRecords ?? []).reduce(
            (sum, record) => sum + (feedbackMap.get(record.messageKey)?.notHelpful ?? 0),
            0
          ),
          sentAt: latestCategory.sentAt,
          error: latestCategory.error
        }
      : {
          category,
          title: category,
          status: 'skipped' as const,
          itemCount: 0,
          emptyDigest: true,
          scheduleState: scheduleStates[category],
          suppressedSummary: summarizeSuppression(0, 0, 0),
          savedAttentionCount: 0,
          preferredSourceNames: [],
          preferredTopicLabels: [],
          focusAreas: [],
          trendHighlights
        };
  });

  const latestRunAt = Object.values(scheduleStates)
    .map(item => item?.lastRunAt)
    .filter(Boolean)
    .sort()
    .at(-1);
  const latestSuccessAt = Object.values(scheduleStates)
    .map(item => item?.lastSuccessAt)
    .filter(Boolean)
    .sort()
    .at(-1);

  return {
    enabled: defaults.enabled,
    schedule: defaults.schedule,
    cron: undefined,
    scheduleValid: Object.values(schedules).some(item => item?.scheduleValid),
    jobKey: undefined,
    lastRegisteredAt: Object.values(schedules)
      .map(item => item?.lastRegisteredAt)
      .filter(Boolean)
      .sort()
      .at(-1),
    scheduler: 'bree',
    timezone: Object.values(schedules)
      .map(item => item?.timezone)
      .find(Boolean),
    lastRunAt: latestRunAt,
    lastSuccessAt: latestSuccessAt ?? latestSuccessfulRun?.runAt,
    scheduleStates,
    recentRuns: runs.slice(0, 12),
    categories
  };
}
