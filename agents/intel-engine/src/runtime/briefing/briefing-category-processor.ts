import { computePriorityScore } from './briefing-ranking-policy';
import type {
  BriefingAuditRecord,
  BriefingHistoryRecord,
  TechBriefingCategoryResult,
  TechBriefingItem,
  TechBriefingSourceGroup
} from './briefing.types';
import type { BriefingSettings } from './briefing-schedule';

export function mergeSameRunItems(items: TechBriefingItem[], historyMap: Map<string, BriefingHistoryRecord>) {
  const clusters = new Map<string, TechBriefingItem[]>();
  for (const item of items) {
    const key = item.messageKey ?? item.stableTopicKey ?? item.id;
    clusters.set(key, [...(clusters.get(key) ?? []), item]);
  }
  const primaryItems: TechBriefingItem[] = [];
  let sameRunMergedCount = 0;
  for (const [key, grouped] of clusters) {
    if (grouped.length === 1) {
      primaryItems.push(grouped[0]!);
      continue;
    }
    sameRunMergedCount += grouped.length - 1;
    const previousSource = historyMap.get(key)?.lastSourceName;
    const primary = [...grouped].sort((left, right) => {
      const previousGap = Number(right.sourceName === previousSource) - Number(left.sourceName === previousSource);
      if (previousGap !== 0) {
        return previousGap;
      }
      const sourceGap = sourceGroupWeight(right.sourceGroup) - sourceGroupWeight(left.sourceGroup);
      if (sourceGap !== 0) {
        return sourceGap;
      }
      const authorityGap = sourceAuthorityWeight(right.authorityTier) - sourceAuthorityWeight(left.authorityTier);
      if (authorityGap !== 0) {
        return authorityGap;
      }
      return computePriorityScore(left.category, right) - computePriorityScore(left.category, left);
    })[0]!;
    primaryItems.push({ ...primary, crossVerified: true });
  }
  return { primaryItems, sameRunMergedCount };
}

export function decideItemForSend(
  item: TechBriefingItem,
  history: BriefingHistoryRecord | undefined,
  now: Date,
  duplicateWindowDays: number
): TechBriefingItem {
  if (!history) {
    return { ...item, decisionReason: shouldBypassDuplicateWindow(item) ? 'critical_override' : 'send_new' };
  }
  const withinWindow =
    now.getTime() - new Date(history.lastSentAt ?? history.firstSeenAt).getTime() <=
    duplicateWindowDays * 24 * 60 * 60 * 1000;
  if (!withinWindow) {
    return { ...item, decisionReason: shouldBypassDuplicateWindow(item) ? 'critical_override' : 'send_new' };
  }
  if (history.lastContentFingerprint !== item.contentFingerprint && item.isMaterialChange) {
    return { ...item, decisionReason: shouldBypassDuplicateWindow(item) ? 'critical_override' : 'send_update' };
  }
  return { ...item, decisionReason: 'suppress_duplicate' };
}

export function limitCategoryItems(items: TechBriefingItem[], config: BriefingSettings) {
  const critical = items.filter(isCriticalItem).slice(0, config.maxCriticalItemsPerCategory);
  const nonCritical = items.filter(item => !isCriticalItem(item)).slice(0, config.maxNonCriticalItemsPerCategory);
  const displayedItems = [...critical, ...nonCritical]
    .sort((left, right) => {
      const severityGap = severityWeight(right.displaySeverity) - severityWeight(left.displaySeverity);
      if (severityGap !== 0) {
        return severityGap;
      }
      const priorityGap = computePriorityScore(left.category, right) - computePriorityScore(left.category, left);
      if (priorityGap !== 0) {
        return priorityGap;
      }
      return right.publishedAt.localeCompare(left.publishedAt);
    })
    .slice(0, config.maxTotalItemsPerCategory);
  return {
    displayedItems,
    displayedItemIds: new Set(displayedItems.map(item => item.id))
  };
}

export function updateHistoryRecords(
  existing: BriefingHistoryRecord[],
  categories: TechBriefingCategoryResult[],
  now: Date
) {
  const map = new Map(existing.map(record => [record.messageKey, record] as const));
  const nowIso = now.toISOString();
  for (const category of categories) {
    for (const item of category.displayedItems ?? []) {
      const messageKey = item.messageKey;
      const contentFingerprint = item.contentFingerprint;
      if (!messageKey || !contentFingerprint) {
        continue;
      }
      const record = map.get(messageKey);
      map.set(messageKey, {
        messageKey,
        category: item.category,
        firstSeenAt: record?.firstSeenAt ?? nowIso,
        firstSentAt: record?.firstSentAt ?? nowIso,
        lastSentAt: nowIso,
        lastPublishedAt: item.publishedAt,
        lastContentFingerprint: contentFingerprint,
        lastContentChangeAt:
          !record || record.lastContentFingerprint !== contentFingerprint
            ? nowIso
            : (record.lastContentChangeAt ?? nowIso),
        lastTitle: item.cleanTitle ?? item.title,
        lastUrl: item.url,
        lastSourceName: item.sourceName,
        lastDecision: item.decisionReason ?? 'send_new'
      });
    }
  }
  return [...map.values()];
}

export function finalizeCategoryStatus(
  category: TechBriefingCategoryResult,
  sent: boolean
): TechBriefingCategoryResult {
  if (category.status === 'failed') {
    return category;
  }
  if ((category.displayedItems?.length ?? 0) === 0) {
    return { ...category, status: category.emptyDigest ? 'empty' : 'skipped', sent };
  }
  return {
    ...category,
    status: sent ? 'sent' : 'failed',
    sent,
    sentAt: sent ? new Date().toISOString() : undefined,
    error: sent ? undefined : (category.error ?? 'daily_tech_briefing_send_failed')
  };
}

export function toAuditRecord(item: TechBriefingItem, sent: boolean): BriefingAuditRecord {
  return {
    messageKey: item.messageKey ?? item.id,
    title: item.cleanTitle ?? item.title,
    category: item.category,
    decisionReason: item.decisionReason ?? 'send_new',
    updateStatus: item.updateStatus,
    displaySeverity: item.displaySeverity,
    sourceName: item.sourceName,
    sourceGroup: item.sourceGroup,
    publishedAt: item.publishedAt,
    sent,
    crossVerified: item.crossVerified,
    displayScope: item.displayScope,
    url: item.url,
    whyItMatters: item.whyItMatters,
    relevanceLevel: item.relevanceLevel,
    recommendedAction: item.recommendedAction,
    impactScenarioTags: item.impactScenarioTags,
    recommendedNextStep: item.recommendedNextStep
  };
}

export function buildSuppressedSummary(
  crossRunSuppressedCount: number,
  sameRunMergedCount: number,
  overflowCollapsedCount: number
) {
  const parts = [
    crossRunSuppressedCount > 0 ? `跨轮去重 ${crossRunSuppressedCount}` : '',
    sameRunMergedCount > 0 ? `同轮合并 ${sameRunMergedCount}` : '',
    overflowCollapsedCount > 0 ? `超上限折叠 ${overflowCollapsedCount}` : ''
  ].filter(Boolean);
  return parts.length > 0 ? `今日已压缩 ${parts.join(' / ')} 条噪音更新。` : undefined;
}

function isCriticalItem(item: TechBriefingItem) {
  return item.displaySeverity === 'critical' || item.displaySeverity === 'high';
}

function shouldBypassDuplicateWindow(item: TechBriefingItem) {
  if (
    item.category !== 'frontend-security' &&
    item.category !== 'general-security' &&
    item.category !== 'devtool-security'
  ) {
    return false;
  }
  return item.priorityCode === 'P0' || item.priorityCode === 'P1' || item.displaySeverity === 'critical';
}

function sourceGroupWeight(group: TechBriefingSourceGroup) {
  switch (group) {
    case 'official':
      return 3;
    case 'authority':
      return 2;
    default:
      return 1;
  }
}

function sourceAuthorityWeight(tier: TechBriefingItem['authorityTier']) {
  switch (tier) {
    case 'official-advisory':
      return 4;
    case 'official-release':
      return 3;
    case 'official-blog':
      return 2;
    default:
      return 1;
  }
}

function severityWeight(severity: TechBriefingItem['displaySeverity']) {
  switch (severity) {
    case 'critical':
      return 5;
    case 'high':
      return 4;
    case 'medium':
      return 3;
    case 'normal':
      return 2;
    default:
      return 1;
  }
}
