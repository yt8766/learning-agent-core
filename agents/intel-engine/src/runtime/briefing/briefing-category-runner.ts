import { BRIEFING_CATEGORY_TITLES } from './briefing-sources';
import { BRIEFING_CATEGORY_SOURCE_LABELS } from './briefing-source-summary';
import {
  buildSuppressedSummary,
  decideItemForSend,
  limitCategoryItems,
  mergeSameRunItems,
  toAuditRecord
} from './briefing-category-processor';
import type {
  BriefingHistoryRecord,
  TechBriefingCategory,
  TechBriefingCategoryResult,
  TechBriefingItem
} from './briefing.types';
import type { BriefingSettings } from './briefing-schedule';

export interface ProcessCategoryDeps {
  collectItems: (category: TechBriefingCategory, now: Date) => Promise<TechBriefingItem[]>;
  briefingSettings: BriefingSettings;
}

export async function processCategory(
  category: TechBriefingCategory,
  now: Date,
  historyMap: Map<string, BriefingHistoryRecord>,
  deps: ProcessCategoryDeps
): Promise<TechBriefingCategoryResult> {
  const title = `${BRIEFING_CATEGORY_TITLES[category]} | ${now.toISOString().slice(0, 10)}`;
  const sourcesChecked = BRIEFING_CATEGORY_SOURCE_LABELS[category];
  try {
    const items = await deps.collectItems(category, now);
    const merged = mergeSameRunItems(items, historyMap);
    const decided = merged.primaryItems.map(item =>
      decideItemForSend(item, historyMap.get(item.messageKey ?? ''), now, deps.briefingSettings.duplicateWindowDays)
    );
    const eligible = decided.filter(
      item =>
        item.decisionReason === 'send_new' ||
        item.decisionReason === 'send_update' ||
        item.decisionReason === 'critical_override'
    );
    const limited = limitCategoryItems(eligible, deps.briefingSettings);
    const overflowTitles = eligible
      .filter(item => !limited.displayedItemIds.has(item.id))
      .map(item => item.cleanTitle ?? item.title)
      .slice(0, 6);

    return {
      category,
      title,
      status: limited.displayedItems.length === 0 ? 'empty' : 'sent',
      itemCount: limited.displayedItems.length,
      sent: false,
      emptyDigest: limited.displayedItems.length === 0,
      sourcesChecked,
      newCount: limited.displayedItems.filter(item => item.decisionReason === 'send_new').length,
      updateCount: limited.displayedItems.filter(item => item.decisionReason === 'send_update').length,
      crossRunSuppressedCount: decided.filter(item => item.decisionReason === 'suppress_duplicate').length,
      sameRunMergedCount: merged.sameRunMergedCount,
      overflowCollapsedCount: eligible.length - limited.displayedItems.length,
      suppressedSummary: buildSuppressedSummary(
        decided.filter(item => item.decisionReason === 'suppress_duplicate').length,
        merged.sameRunMergedCount,
        eligible.length - limited.displayedItems.length
      ),
      savedAttentionCount:
        decided.filter(item => item.decisionReason === 'suppress_duplicate').length +
        merged.sameRunMergedCount +
        Math.max(0, eligible.length - limited.displayedItems.length),
      displayedItemCount: limited.displayedItems.length,
      displayedItems: limited.displayedItems,
      overflowTitles,
      auditRecords: [
        ...decided.map(item => toAuditRecord(item, limited.displayedItemIds.has(item.id))),
        ...eligible
          .filter(item => !limited.displayedItemIds.has(item.id))
          .map(item => toAuditRecord({ ...item, decisionReason: 'overflow_collapsed' }, false))
      ]
    };
  } catch (error) {
    return {
      category,
      title,
      status: 'failed',
      itemCount: 0,
      sent: false,
      emptyDigest: false,
      sourcesChecked,
      newCount: 0,
      updateCount: 0,
      crossRunSuppressedCount: 0,
      sameRunMergedCount: 0,
      overflowCollapsedCount: 0,
      displayedItemCount: 0,
      displayedItems: [],
      overflowTitles: [],
      auditRecords: [],
      error: error instanceof Error ? error.message : 'daily_tech_briefing_failed'
    };
  }
}
